import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

type Briefing = {
  slug: string;
  title: string;
  displayTitle: string;
  category: string;
  productUse: string;
  whyThisTest: string;
  actionsTaken: string;
  assertionsMade: string[];
};

const docsDir = "docs/product-tests";
const outDir = "docs/product-tests-site";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/gu, "<code>$1</code>");
}

function section(raw: string, heading: string) {
  const pattern = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |$)`, "u");
  return raw.match(pattern)?.[1]?.trim() ?? "";
}

function listItems(raw: string) {
  return raw.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function categoryFor(title: string) {
  if (title.startsWith("golden:")) return "Golden Transcript";
  if (title.startsWith("symphony case:")) return "Symphony Case";
  if (title.startsWith("test:slow")) return "Slow E2E";
  if (title.startsWith("tool registry") || title.startsWith("dashboard run links")) return "Registry Contract";
  return "CLI Product";
}

function displayTitleFor(title: string) {
  const titles: Record<string, string> = {
    "async query run returns immediately with canonical dashboard and terminal links": "A tweet query starts a trackable run and returns usable links",
    "busy dataset conflict returns blocking run guidance": "A busy dataset points the user to the blocking run",
    "dashboard run links use canonical dashboard route": "Run links always open the right dashboard page",
    "dataset describe request starts briefing run with required artifacts": "Describe dataset creates briefing and profile artifacts",
    "golden: cancel active run": "Canceling a run gives a clear confirmation",
    "golden: mixed public private environment": "Mixed public and private sources start a research environment build",
    "golden: public data environment": "Public SEC data setup starts an environment build",
    "golden: retrieve run result": "Completed run results are readable and artifact-aware",
    "golden: show remote datasets": "Dataset discovery shows what is available",
    "product planning: vague viral tweets request designs scoped experiment before running": "A vague viral-tweets question becomes a scoped experiment plan",
    "product workflow success: econ research hypothesis creates data environment, specs, scripts, labels, and artifacts": "An economics hypothesis runs through the full research workflow",
    "run debug bundle redacts session token and includes remote evidence": "Run debug bundles preserve evidence without leaking tokens",
    "run result retrieval includes original prompt and artifacts": "Run results include the original request and saved artifacts",
    "symphony case: econ housing cycle dataset build": "Housing-cycle dataset requests become concrete environment plans",
    "symphony case: viral tweets experiment planning": "Viral tweet experiments are planned before work starts",
    "test:slow:econ:discover": "Economics discovery classifies source fetchability",
    "test:slow:econ:environment": "The economics environment builds end to end",
    "test:slow:econ:hypothesis": "The economics dataset supports hypothesis analysis",
    "test:slow:econ:normalization-execution": "Economics normalization produces validated tables",
    "test:slow:econ:normalization-plan": "Economics discovery becomes an executable normalization plan",
    "test:slow:econ": "The staged economics journey works as a suite",
    "test:slow:tweets": "The viral tweets workflow uses mounted enriched-tweets data",
    "test:slow": "The full slow product suite completes",
    "tool registry is structurally valid and serializable": "The tool registry stays stable for product actions",
    "tool registry metadata exposes async run-start tools": "Async run-start tools are marked for progress tracking",
    "unauthenticated local run request bypasses remote planning": "Local run status works without sign-in",
    "wait for run completion can time out deterministically": "Waiting on a run reports still-running state clearly",
  };
  return titles[title] ?? title;
}

function paragraphHtml(text: string) {
  return text.split(/\n\n+/u)
    .map((paragraph) => `<p>${inlineMarkdown(paragraph.replace(/\n/gu, " "))}</p>`)
    .join("\n");
}

function briefingCard(briefing: Briefing, index: number) {
  const assertions = briefing.assertionsMade
    .map((item) => `<li>${inlineMarkdown(item)}</li>`)
    .join("\n");
  return `<article class="briefing-card" id="${briefing.slug}" data-title="${escapeHtml(briefing.title.toLowerCase())}" data-category="${escapeHtml(briefing.category)}">
  <div class="section-head">
    <span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(briefing.category)}</span>
    <a href="#${briefing.slug}">#</a>
  </div>
  <h2>${escapeHtml(briefing.displayTitle)}</h2>
  <p class="test-name"><span>Test name</span><code>${escapeHtml(briefing.title)}</code></p>
  <div class="why-block">
    <h3>Why This Test</h3>
    ${paragraphHtml(briefing.whyThisTest)}
  </div>
  <div class="two-col">
    <div>
      <h3>Product Use</h3>
      ${paragraphHtml(briefing.productUse)}
    </div>
    <div>
      <h3>Actions Taken</h3>
      ${paragraphHtml(briefing.actionsTaken)}
    </div>
  </div>
  <div class="assertions">
    <h3>Assertions Made</h3>
    <ul>${assertions}</ul>
  </div>
</article>`;
}

function categoryCounts(briefings: Briefing[]) {
  return [...briefings.reduce((map, briefing) => {
    map.set(briefing.category, (map.get(briefing.category) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .sort(([left], [right]) => left.localeCompare(right));
}

function script() {
  return `<script>
const search = document.querySelector('#search');
const filters = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.briefing-card')];
let activeCategory = 'All';

function applyFilters() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {
    const matchesCategory = activeCategory === 'All' || card.dataset.category === activeCategory;
    const matchesQuery = !query || card.innerText.toLowerCase().includes(query);
    const show = matchesCategory && matchesQuery;
    card.hidden = !show;
    if (show) visible += 1;
  }
  document.querySelector('#visible-count').textContent = String(visible);
}

search.addEventListener('input', applyFilters);
for (const button of filters) {
  button.addEventListener('click', () => {
    activeCategory = button.dataset.filter;
    for (const other of filters) other.classList.toggle('active', other === button);
    applyFilters();
  });
}
</script>`;
}

function page(briefings: Briefing[]) {
  const counts = categoryCounts(briefings);
  const filters = ["All", ...counts.map(([category]) => category)]
    .map((category, index) => `<button class="${index === 0 ? "active" : ""}" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join("");
  const statCards = [
    ["Briefings", String(briefings.length)],
    ["Assertions", String(briefings.reduce((total, briefing) => total + briefing.assertionsMade.length, 0))],
    ["Categories", String(counts.length)],
    ["Source", "MD"],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  const categoryRows = counts.map(([category, count]) => `<tr><td>${escapeHtml(category)}</td><td>${count}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product Test Briefings</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="page">
    <header class="page-header">
      <p class="nav"><a href="../PRODUCT_TEST_BRIEFING.md">Markdown index</a></p>
      <h1>Product Test Briefings</h1>
      <p class="eyebrow">Alpha Research · generated from docs/product-tests · ${new Date().toISOString().slice(0, 10)}</p>
      <p class="lede">Readable product explanations for every test contract. Each entry describes how the product is used, what actions are taken, and what assertions are made.</p>
    </header>

    <section class="stat-grid">${statCards}</section>

    <section class="panel controls">
      <div>
        <h2>Browse The Tests</h2>
        <p class="lede"><span id="visible-count">${briefings.length}</span> briefings visible. Search by feature, assertion, dataset, run type, or artifact.</p>
      </div>
      <label>
        <span>Search</span>
        <input id="search" type="search" placeholder="Try enriched-tweets, mounted, dashboard, econ">
      </label>
      <div class="filter-row">${filters}</div>
    </section>

    <section class="panel two-col">
      <div>
        <h2>Coverage Mix</h2>
        <table class="hypothesis-table">
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
      <div>
        <h2>How To Read This</h2>
        <ul>
          <li><b>Product Use</b> states the user-facing scenario.</li>
          <li><b>Actions Taken</b> states what the product does.</li>
          <li><b>Assertions Made</b> states what the test proves.</li>
        </ul>
      </div>
    </section>

    <section class="panel briefing-stack">
      ${briefings.map(briefingCard).join("\n")}
    </section>
  </main>
  ${script()}
</body>
</html>
`;
}

const files = (await readdir(docsDir))
  .filter((file) => file.endsWith(".md"))
  .sort();

const briefings: Briefing[] = [];
for (const file of files) {
  const path = join(docsDir, file);
  const raw = await readFile(path, "utf8");
  const title = raw.match(/^# (.+)$/mu)?.[1] ?? basename(file, ".md");
  const assertions = listItems(section(raw, "Assertions Made"));
  briefings.push({
    slug: basename(file, ".md"),
    title,
    displayTitle: displayTitleFor(title),
    category: categoryFor(title),
    productUse: section(raw, "Product Use"),
    whyThisTest: section(raw, "Why This Test"),
    actionsTaken: section(raw, "Actions Taken"),
    assertionsMade: assertions,
  });
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "index.html"), page(briefings), "utf8");
