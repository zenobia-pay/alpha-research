#!/usr/bin/env python3
"""Run interactive RESEARCH TUI journeys in a real PTY.

This runner launches `node apps/cli/dist/index.js` without `--prompt`, types
journey messages into the Ink TUI, records the raw transcript, and renders
color-aware SVG screenshots from a small ANSI terminal emulator.
"""

from __future__ import annotations

import argparse
import codecs
import html
import json
import os
import pty
import re
import select
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


WIDTH = int(os.environ.get("TUI_JOURNEY_WIDTH", "120"))
HEIGHT = int(os.environ.get("TUI_JOURNEY_HEIGHT", "36"))
SNAPSHOT_SECONDS = float(os.environ.get("TUI_JOURNEY_SNAPSHOT_SECONDS", "3"))
INITIAL_WAIT_SECONDS = float(os.environ.get("TUI_JOURNEY_INITIAL_WAIT_SECONDS", "2"))
AFTER_MESSAGE_SECONDS = float(os.environ.get("TUI_JOURNEY_AFTER_MESSAGE_SECONDS", "18"))
TIMEOUT_SECONDS = float(os.environ.get("TUI_JOURNEY_TIMEOUT_SECONDS", "180"))
JUDGE_TIMEOUT_SECONDS = float(os.environ.get("TUI_JOURNEY_JUDGE_TIMEOUT_SECONDS", "240"))


@dataclass
class Journey:
    id: str
    title: str
    messages: list[str]
    intention: str
    correct_outcome: str
    judge_for: str
    setup: str | None = None


TUI_JOURNEYS = [
    Journey(
        id="TUI01",
        title="First Open Empty State",
        messages=[],
        intention="The user has just opened `research` and has not typed anything yet.",
        correct_outcome=(
            "The TUI immediately communicates what `research` is, whether there are active runs, "
            "and what the user can type next. The input area should be obvious. The screen should "
            "not look blank, broken, or like a generic terminal prompt."
        ),
        judge_for=(
            "Is the first screen self-explanatory, are colors legible, is the input target obvious, "
            "are active-run/status panels understandable, and does the UI avoid overwhelming a first-time user?"
        ),
    ),
    Journey(
        id="TUI02",
        title="Orientation In TUI",
        messages=["What can you help me do?"],
        intention="The user asks for product orientation from inside the interactive app.",
        correct_outcome=(
            "The TUI shows the user message, a visible pending/thinking state, and a concise orientation answer. "
            "It should preserve readable layout after the response and keep the input area ready for the next prompt."
        ),
        judge_for=(
            "Does the user see that their message was submitted, is pending state visible, does the answer fit "
            "without awkward wrapping, and is the next input location clear?"
        ),
    ),
    Journey(
        id="TUI03",
        title="Multi-Turn Dataset Discovery And Follow-Up",
        messages=["What datasets do I have?", "Describe the tweets dataset."],
        intention="The user starts with inventory, then follows up using a dataset mentioned in the prior response.",
        correct_outcome=(
            "The TUI should preserve conversational context, show the dataset inventory clearly, then interpret "
            "`tweets` as the dataset from the list. It should not force the user to restate ids if the prior "
            "response made the dataset obvious."
        ),
        judge_for=(
            "Can the user visually connect the follow-up to the previous answer, does scrolling preserve enough "
            "context, are tool/progress messages distinguishable from final answers, and does the input remain ergonomic?"
        ),
    ),
    Journey(
        id="TUI04",
        title="Vague Idea Clarification Loop",
        messages=[
            "What’s up with tweets? Can you run an experiment for me on what types of tweets go viral?",
            "Use quote_tweet_count and sample 100 tweets.",
        ],
        intention="The user gives a vague experiment request, then answers the clarification/approval prompt.",
        correct_outcome=(
            "The first turn should propose a concrete experiment without starting a run. The second turn should "
            "either start the run or ask only for genuinely missing details. The UI should make it visually obvious "
            "when work is only proposed versus when it has actually started."
        ),
        judge_for=(
            "Are plan/proposal and run started visually distinct, does the TUI avoid duplicate messages, and does "
            "the user understand whether expensive work has begun?"
        ),
    ),
    Journey(
        id="TUI05",
        title="Specific Run Start And Active Status Panel",
        messages=[
            "Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples."
        ],
        intention="The user provides a specific analysis request and expects a run to start or a clear block.",
        correct_outcome=(
            "The TUI should show progress through dataset lookup/start-run steps, then either show a run id/link/artifact "
            "expectations or a clear busy/blocking state. If a run starts, the active-run panel should update and remain understandable."
        ),
        judge_for=(
            "Does the active-run panel update, are status colors meaningful, are run ids/links readable without dominating "
            "the screen, and is the next action clear?"
        ),
    ),
    Journey(
        id="TUI06",
        title="Busy Dataset Recovery In TUI",
        messages=["Run a new analysis on enriched-tweets."],
        setup="`enriched-tweets` has an active blocking run in tracked or backend state.",
        intention="The user tries to start work on a locked dataset.",
        correct_outcome=(
            "The TUI should show a clear blocked state before presenting analysis options. It should identify the active run, "
            "explain that no new run was started, and offer recovery actions such as inspect, wait, cancel, or retry later."
        ),
        judge_for=(
            "Is the block visually prominent, does color communicate severity without ambiguity, are recovery actions clear, "
            "and does the UI avoid presenting normal analysis menus before resolving the lock?"
        ),
    ),
    Journey(
        id="TUI07",
        title="Stuck Run From Active Status Panel",
        messages=["My last run seems stuck. What’s happening?"],
        setup="At least one active tracked run is visible in the TUI status panel.",
        intention="The user sees the active run panel and asks for diagnosis.",
        correct_outcome=(
            "The TUI should connect the answer to the visible active run, explain last update/heartbeat/current activity in "
            "plain language, and offer inspect/debug/wait/cancel actions."
        ),
        judge_for=(
            "Does the answer match the run shown in the panel, are stale/active states visually clear, and does the UI avoid raw lifecycle jargon?"
        ),
    ),
    Journey(
        id="TUI08",
        title="Return Later And Retrieve Results",
        messages=["Show me the results from my last run."],
        setup="The tracked-run store contains at least one active run and one completed or failed run.",
        intention="The user expects continuity without remembering run ids.",
        correct_outcome=(
            "The TUI should distinguish latest active run from last completed run. If ambiguous, it should show a compact choice list. "
            "It should not dump raw prompts, mounted-dataset instructions, or artifact JSON into the main conversation."
        ),
        judge_for=(
            "Is last run disambiguated, are artifacts summarized cleanly, and does the TUI keep long results readable through scrolling/wrapping?"
        ),
    ),
    Journey(
        id="TUI09",
        title="Signed-Out Interactive Auth Recovery",
        messages=["Show my remote datasets."],
        setup="The TUI is launched with no valid `research` session.",
        intention="The user is inside the interactive app and asks for remote data while signed out.",
        correct_outcome=(
            "The TUI should explain sign-in in product terms, show exactly how to sign in, and keep the conversation usable after auth. "
            "It should avoid session-file internals and should not leave the user wondering whether to quit."
        ),
        judge_for=(
            "Is auth failure visually and verbally clear, does the UI show a simple next step, and does it preserve the user's original intent after sign-in if possible?"
        ),
    ),
    Journey(
        id="TUI10",
        title="Long Output And Scroll Ergonomics",
        messages=[
            "Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025. Include FRED rates, Census population/income, Zillow home values and rents, BLS employment/unemployment/CPI, FHFA HPI, and NBER recession indicators. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest."
        ],
        intention="The user provides a long, specific build request that may produce a long plan or run-start response.",
        correct_outcome=(
            "The TUI should preserve the full user prompt, show progress without blank/stalled screens, and render the plan or block "
            "state in a scannable way. Long URLs and ids should not destroy layout."
        ),
        judge_for=(
            "Does wrapping remain readable, does the input composer handle long text, does the output avoid flooding the viewport, "
            "and are the next action/artifact expectations visible without excessive scrolling?"
        ),
    ),
]


FG = {
    30: "#111827",
    31: "#ef4444",
    32: "#22c55e",
    33: "#eab308",
    34: "#3b82f6",
    35: "#d946ef",
    36: "#06b6d4",
    37: "#e5e7eb",
    90: "#6b7280",
    91: "#f87171",
    92: "#4ade80",
    93: "#facc15",
    94: "#60a5fa",
    95: "#e879f9",
    96: "#22d3ee",
    97: "#f9fafb",
}

BG = {
    40: "#111827",
    41: "#7f1d1d",
    42: "#14532d",
    43: "#713f12",
    44: "#1e3a8a",
    45: "#581c87",
    46: "#164e63",
    47: "#e5e7eb",
}


class Terminal:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.grid = [[{"ch": " ", "fg": "#f3f5f7", "bg": None, "bold": False} for _ in range(width)] for _ in range(height)]
        self.row = 0
        self.col = 0
        self.fg = "#f3f5f7"
        self.bg = None
        self.bold = False
        self.state = "text"
        self.esc = ""

    def clear(self) -> None:
        for row in range(self.height):
            self.clear_line(row)
        self.row = 0
        self.col = 0

    def clear_line(self, row: int, start: int = 0) -> None:
        if 0 <= row < self.height:
            for col in range(start, self.width):
                self.grid[row][col] = {"ch": " ", "fg": "#f3f5f7", "bg": None, "bold": False}

    def scroll(self) -> None:
        self.grid.pop(0)
        self.grid.append([{"ch": " ", "fg": "#f3f5f7", "bg": None, "bold": False} for _ in range(self.width)])
        self.row = self.height - 1

    def put(self, ch: str) -> None:
        if ch == "\r":
            self.col = 0
            return
        if ch == "\n":
            self.row += 1
            self.col = 0
            if self.row >= self.height:
                self.scroll()
            return
        if ch == "\b":
            self.col = max(0, self.col - 1)
            return
        if ord(ch) < 32:
            return
        if self.col >= self.width:
            self.row += 1
            self.col = 0
        if self.row >= self.height:
            self.scroll()
        self.grid[self.row][self.col] = {"ch": ch, "fg": self.fg, "bg": self.bg, "bold": self.bold}
        self.col += 1

    def feed(self, data: str) -> None:
        for ch in data:
            if self.state == "text":
                if ch == "\x1b":
                    self.state = "esc"
                    self.esc = ch
                else:
                    self.put(ch)
            elif self.state == "esc":
                self.esc += ch
                if ch == "[":
                    self.state = "csi"
                elif ch == "]":
                    self.state = "osc"
                else:
                    self.state = "text"
            elif self.state == "osc":
                self.esc += ch
                if ch == "\a":
                    self.state = "text"
            elif self.state == "csi":
                self.esc += ch
                if "@" <= ch <= "~":
                    self.handle_csi(self.esc[2:-1], ch)
                    self.state = "text"

    def handle_csi(self, params: str, final: str) -> None:
        clean = params.replace("?", "")
        values = [int(part) if part else 0 for part in clean.split(";") if part == "" or re.match(r"^\d+$", part)]
        first = values[0] if values else 0
        if final in ("H", "f"):
            self.row = max(0, min(self.height - 1, (values[0] if len(values) > 0 and values[0] else 1) - 1))
            self.col = max(0, min(self.width - 1, (values[1] if len(values) > 1 and values[1] else 1) - 1))
        elif final == "J":
            if first in (0, 2, 3):
                self.clear()
        elif final == "K":
            self.clear_line(self.row, self.col if first == 0 else 0)
        elif final == "A":
            self.row = max(0, self.row - (first or 1))
        elif final == "B":
            self.row = min(self.height - 1, self.row + (first or 1))
        elif final == "C":
            self.col = min(self.width - 1, self.col + (first or 1))
        elif final == "D":
            self.col = max(0, self.col - (first or 1))
        elif final == "G":
            self.col = max(0, min(self.width - 1, (first or 1) - 1))
        elif final == "m":
            if not values:
                values = [0]
            for value in values:
                if value == 0:
                    self.fg = "#f3f5f7"
                    self.bg = None
                    self.bold = False
                elif value == 1:
                    self.bold = True
                elif value == 22:
                    self.bold = False
                elif value == 39:
                    self.fg = "#f3f5f7"
                elif value == 49:
                    self.bg = None
                elif value in FG:
                    self.fg = FG[value]
                elif value in BG:
                    self.bg = BG[value]

    def plain_text(self) -> str:
        return "\n".join("".join(cell["ch"] for cell in row).rstrip() for row in self.grid)

    def svg(self) -> str:
        char_width = 8.4
        line_height = 18
        padding = 16
        svg_width = int(self.width * char_width + padding * 2)
        svg_height = self.height * line_height + padding * 2
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}">',
            '<rect width="100%" height="100%" fill="#101317"/>',
            '<g font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="13" xml:space="preserve">',
        ]
        for row_index, row in enumerate(self.grid):
            y = padding + 14 + row_index * line_height
            col = 0
            while col < self.width:
                cell = row[col]
                start = col
                text = cell["ch"]
                col += 1
                while col < self.width and row[col]["fg"] == cell["fg"] and row[col]["bg"] == cell["bg"] and row[col]["bold"] == cell["bold"]:
                    text += row[col]["ch"]
                    col += 1
                if not text.strip():
                    continue
                x = padding + start * char_width
                if cell["bg"]:
                    parts.append(f'<rect x="{x}" y="{y - 14}" width="{len(text) * char_width}" height="{line_height}" fill="{cell["bg"]}"/>')
                weight = "700" if cell["bold"] else "400"
                parts.append(f'<text x="{x}" y="{y}" fill="{cell["fg"]}" font-weight="{weight}">{html.escape(text)}</text>')
        parts.extend(["</g>", "</svg>"])
        return "\n".join(parts)


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def journey_markdown(journey: Journey) -> str:
    lines = [
        f"# {journey.id}: {journey.title}",
        "",
        "## Messages",
        "",
    ]
    if journey.messages:
        for index, message in enumerate(journey.messages, 1):
            lines.extend([f"### Message {index}", "", "```text", message, "```", ""])
    else:
        lines.extend(["```text", "<none>", "```", ""])
    if journey.setup:
        lines.extend(["## Setup", "", journey.setup, ""])
    lines.extend([
        "## Intention",
        "",
        journey.intention,
        "",
        "## Correct Outcome",
        "",
        journey.correct_outcome,
        "",
        "## Judge For",
        "",
        journey.judge_for,
        "",
    ])
    return "\n".join(lines)


def write_snapshot(term: Terminal, out_dir: Path, events: list[dict], started: float, label: str, index: int) -> None:
    base = f"{index:04d}-{label}"
    snapshots_dir = out_dir / "snapshots"
    screenshots_dir = out_dir / "screenshots"
    txt_path = snapshots_dir / f"{base}.txt"
    svg_path = screenshots_dir / f"{base}.svg"
    txt_path.write_text(term.plain_text(), encoding="utf-8")
    svg_path.write_text(term.svg(), encoding="utf-8")
    events.append({
        "atMs": int((time.time() - started) * 1000),
        "type": "snapshot",
        "label": label,
        "textPath": str(txt_path),
        "screenshotPath": str(svg_path),
    })


def type_message(master_fd: int, message: str) -> None:
    for character in message:
        os.write(master_fd, character.encode("utf-8"))
        time.sleep(0.01)
    time.sleep(0.05)
    os.write(master_fd, b"\x1b[13u")


def run_journey(journey: Journey, out_root: Path, no_run: bool = False) -> Path:
    run_id = timestamp()
    out_dir = out_root / journey.id / run_id
    (out_dir / "screenshots").mkdir(parents=True, exist_ok=True)
    (out_dir / "snapshots").mkdir(parents=True, exist_ok=True)
    out_dir.joinpath("journey.md").write_text(journey_markdown(journey), encoding="utf-8")
    command = ["node", "apps/cli/dist/index.js"]
    out_dir.joinpath("input.json").write_text(json.dumps({
        "journeyId": journey.id,
        "messages": journey.messages,
        "command": command,
        "timeoutSeconds": TIMEOUT_SECONDS,
        "snapshotSeconds": SNAPSHOT_SECONDS,
        "width": WIDTH,
        "height": HEIGHT,
    }, indent=2), encoding="utf-8")

    if no_run:
        return out_dir

    env = os.environ.copy()
    env.pop("NO_COLOR", None)
    env.update({
        "COLUMNS": str(WIDTH),
        "LINES": str(HEIGHT),
        "TERM": "xterm-256color",
        "FORCE_COLOR": "1",
        "CI": "0",
    })
    if journey.id == "TUI09":
        session_root = out_dir / "signed-out-session"
        session_root.mkdir(parents=True, exist_ok=True)
        env["RESEARCH_SESSION_DIR"] = str(session_root)

    pid, master_fd = pty.fork()
    if pid == 0:
        os.chdir(Path.cwd())
        os.execvpe(command[0], command, env)

    os.set_blocking(master_fd, False)
    exit_code: int | None = None

    def poll_child() -> int | None:
        nonlocal exit_code
        if exit_code is not None:
            return exit_code
        try:
            waited_pid, status = os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            return exit_code
        if waited_pid == 0:
            return None
        if os.WIFEXITED(status):
            exit_code = os.WEXITSTATUS(status)
        elif os.WIFSIGNALED(status):
            exit_code = -os.WTERMSIG(status)
        else:
            exit_code = status
        return exit_code

    term = Terminal(WIDTH, HEIGHT)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    raw = bytearray()
    events: list[dict] = []
    started = time.time()
    next_snapshot = started
    snapshot_index = 0
    next_message_index = 0
    next_message_at = started + INITIAL_WAIT_SECONDS
    finish_at = None

    def read_available() -> None:
        nonlocal raw
        while True:
            try:
                chunk = os.read(master_fd, 4096)
            except BlockingIOError:
                break
            except OSError:
                break
            if not chunk:
                break
            raw.extend(chunk)
            text = decoder.decode(chunk)
            term.feed(text)
            events.append({"atMs": int((time.time() - started) * 1000), "type": "pty_output", "bytes": len(chunk)})

    try:
        while time.time() - started < TIMEOUT_SECONDS:
            ready, _, _ = select.select([master_fd], [], [], 0.1)
            if ready:
                read_available()

            now = time.time()
            if now >= next_snapshot:
                label = "start" if snapshot_index == 0 else f"{round(now - started)}s"
                write_snapshot(term, out_dir, events, started, label, snapshot_index)
                snapshot_index += 1
                next_snapshot = now + SNAPSHOT_SECONDS

            if next_message_index < len(journey.messages) and now >= next_message_at:
                message = journey.messages[next_message_index]
                type_message(master_fd, message)
                events.append({"atMs": int((time.time() - started) * 1000), "type": "typed", "messageIndex": next_message_index + 1, "text": message})
                next_message_index += 1
                next_message_at = now + AFTER_MESSAGE_SECONDS
                if next_message_index == len(journey.messages):
                    finish_at = now + AFTER_MESSAGE_SECONDS

            if len(journey.messages) == 0 and now >= started + AFTER_MESSAGE_SECONDS:
                finish_at = finish_at or now

            if finish_at and now >= finish_at:
                break

            if poll_child() is not None:
                break
    finally:
        try:
            os.write(master_fd, b"\x03")
        except OSError:
            pass
        deadline = time.time() + 3
        while poll_child() is None and time.time() < deadline:
            time.sleep(0.1)
        if poll_child() is None:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            deadline = time.time() + 3
            while poll_child() is None and time.time() < deadline:
                time.sleep(0.1)
        read_available()
        term.feed(decoder.decode(b"", final=True))
        write_snapshot(term, out_dir, events, started, "final", snapshot_index)
        os.close(master_fd)

    out_dir.joinpath("terminal.log").write_bytes(bytes(raw))
    out_dir.joinpath("terminal.txt").write_text(bytes(raw).decode("utf-8", errors="replace"), encoding="utf-8")
    out_dir.joinpath("events.jsonl").write_text("\n".join(json.dumps(event) for event in events) + "\n", encoding="utf-8")
    out_dir.joinpath("metadata.json").write_text(json.dumps({
        "journeyId": journey.id,
        "title": journey.title,
        "startedAt": datetime.fromtimestamp(started, timezone.utc).isoformat(),
        "elapsedMs": int((time.time() - started) * 1000),
        "exit": {"code": exit_code},
        "width": WIDTH,
        "height": HEIGHT,
        "mode": "interactive-tui",
    }, indent=2), encoding="utf-8")
    return out_dir


def judge_prompt(out_dir: Path) -> str:
    return f"""You are judging the UX of the interactive `research` Ink TUI for one canonical user journey.

Workspace: {Path.cwd()}
Run directory: {out_dir}

Read:
- {out_dir / "journey.md"}
- {out_dir / "terminal.txt"}
- {out_dir / "events.jsonl"}
- {out_dir / "metadata.json"}
- text snapshots under {out_dir / "snapshots"}
- color SVG screenshots under {out_dir / "screenshots"}

Your job:
1. Reconstruct what the user experienced from the color screenshots/snapshots first, then use logs to verify exact text.
2. Judge the interactive TUI specifically: colors, active-run panel, input composer, scrolling, wrapping, pending state, and visual hierarchy.
3. Decide whether `research` chose the right behavior: clarify, plan, start work, retrieve, wait, report block, or debug.
4. Identify every confusing moment visible to a normal user. Reference screenshot filenames or log evidence.
5. Separate product confusion from dataset confusion, auth confusion, run lifecycle confusion, and terminal/UI readability problems.
6. Return a Markdown briefing with: Verdict, user input burden, correct behavior assessment, confusing moments, missing information, information to remove/de-emphasize, suggested TUI/output changes, and evidence references.

Do not modify files. Return only the Markdown briefing."""


def run_judge(out_dir: Path) -> None:
    briefing = out_dir / "briefing.md"
    cmd = [
        "codex",
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        "--ignore-user-config",
        "--ignore-rules",
        "-m",
        os.environ.get("TUI_JOURNEY_JUDGE_MODEL", "gpt-5.4-mini"),
        "-C",
        str(Path.cwd()),
        "-o",
        str(briefing),
        judge_prompt(out_dir),
    ]
    process = subprocess.run(cmd, cwd=Path.cwd(), text=True, capture_output=True, timeout=JUDGE_TIMEOUT_SECONDS)
    (out_dir / "judge.log").write_text((process.stdout or "") + (process.stderr or ""), encoding="utf-8")
    if not briefing.exists():
        briefing.write_text("# Judge Failed\n\nCodex did not produce a briefing.\n", encoding="utf-8")


def latest_run_dir(root: Path) -> Path | None:
    if not root.exists():
        return None
    dirs = sorted([path for path in root.iterdir() if path.is_dir()])
    return dirs[-1] if dirs else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run interactive TUI journey evals.")
    parser.add_argument("--journeys", help="Comma-separated TUI journey ids. Defaults to all TUI journeys.")
    parser.add_argument("--out", default=".tmp/tui-journey-runs", help="Output root.")
    parser.add_argument("--no-judge", action="store_true")
    parser.add_argument("--judge-only", action="store_true")
    parser.add_argument("--no-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out_root = Path(args.out).resolve()
    out_root.mkdir(parents=True, exist_ok=True)
    ids = [part.strip() for part in args.journeys.split(",")] if args.journeys else [journey.id for journey in TUI_JOURNEYS]
    selected = []
    for journey_id in ids:
        match = next((journey for journey in TUI_JOURNEYS if journey.id == journey_id), None)
        if not match:
            raise SystemExit(f"Unknown TUI journey id {journey_id}")
        selected.append(match)

    run_dirs: list[Path] = []
    if args.judge_only:
        for journey in selected:
            latest = latest_run_dir(out_root / journey.id)
            if not latest:
                raise SystemExit(f"No run found for {journey.id}")
            run_dirs.append(latest)
    else:
        for journey in selected:
            print(f"Running {journey.id}: {journey.title}", flush=True)
            run_dir = run_journey(journey, out_root, no_run=args.no_run)
            run_dirs.append(run_dir)
            print(f"Captured {run_dir}", flush=True)

    if not args.no_judge:
        for run_dir in run_dirs:
            print(f"Judging {run_dir}", flush=True)
            run_judge(run_dir)
            print(f"Briefing {run_dir / 'briefing.md'}", flush=True)


if __name__ == "__main__":
    main()
