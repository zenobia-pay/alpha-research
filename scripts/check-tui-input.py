#!/usr/bin/env python3
from __future__ import annotations

import os
import pty
import select
import signal
import sys
import time


def main() -> int:
    command = sys.argv[1:] or ["research"]
    env = os.environ.copy()
    env.update({
        "TERM": "xterm-256color",
        "COLUMNS": "100",
        "LINES": "30",
        "FORCE_COLOR": "1",
        "CI": "0",
        "RESEARCH_DISABLE_RUN_WATCHER": "1",
        "RESEARCH_SESSION_DIR": ".tmp/tui-input-check-session",
    })

    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe(command[0], command, env)

    os.set_blocking(fd, False)
    raw = bytearray()

    def read_for(seconds: float) -> None:
        end = time.time() + seconds
        while time.time() < end:
            ready, _, _ = select.select([fd], [], [], 0.05)
            if not ready:
                continue
            try:
                chunk = os.read(fd, 4096)
            except OSError:
                break
            if not chunk:
                break
            raw.extend(chunk)

    try:
        read_for(2)
        before_typing = len(raw)
        os.write(fd, b"abcdef")
        read_for(0.5)
        before_ctrl = len(raw)
        os.write(fd, b"\x03")
        read_for(0.8)
        ctrl_chunk = bytes(raw[before_ctrl:]).decode("utf-8", errors="replace")
        os.write(fd, b"XYZ")
        read_for(0.5)
        os.write(fd, b"\x03")
        read_for(0.3)
        os.write(fd, b"\x03")
        read_for(0.8)
    finally:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            os.close(fd)
        except OSError:
            pass

    transcript = bytes(raw).decode("utf-8", errors="replace")
    typing_chunk = bytes(raw[before_typing:before_ctrl]).decode("utf-8", errors="replace")
    full_line_clears = transcript.count("\x1b[2K")
    typing_escapes = typing_chunk.count("\x1b")
    failures: list[str] = []
    if full_line_clears:
        failures.append(f"expected incremental rendering with 0 full-line clears, saw {full_line_clears}")
    if typing_escapes:
        failures.append(f"expected plain typed echo with 0 ANSI escapes while typing, saw {typing_escapes}")
    if "abcdef" not in typing_chunk:
        failures.append("typed characters were not echoed as a contiguous draft")
    if "abcdef" in ctrl_chunk:
        failures.append("Ctrl-C did not clear the typed draft")
    if "XYZ" not in transcript:
        failures.append("input did not continue accepting text after Ctrl-C clear")

    if failures:
        print("TUI input check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("TUI input check passed.")
    print(f"Command: {' '.join(command)}")
    print("Verified: typed echo has no ANSI redraws, Ctrl-C clears draft, input continues after clear.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
