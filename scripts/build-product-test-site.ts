import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

type Briefing = {
  slug: string;
  title: string;
  category: string;
  productUse: string;
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
  <h2>${escapeHtml(briefing.title)}</h2>
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
    category: categoryFor(title),
    productUse: section(raw, "Product Use"),
    actionsTaken: section(raw, "Actions Taken"),
    assertionsMade: assertions,
  });
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "index.html"), page(briefings), "utf8");
