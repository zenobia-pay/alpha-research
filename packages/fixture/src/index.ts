import type {
  DatasetAdapter,
  DatasetRecord,
  DatasetTextProjection,
} from "@rprend/alpha-core";

export const tweetThreadRecords: DatasetRecord[] = [
  {
    id: "thread-housing",
    datasetId: "tweets",
    entityType: "thread",
    title: "Housing permits and local demand",
    summary: "A short thread connecting permit activity to housing supply pressure.",
    observedAt: "2025-03-03T12:00:00Z",
    tags: ["housing", "permits", "urbanism"],
    values: {
      username: "civicgraphs",
      participants: ["civicgraphs"],
      post_count: 3,
      created_at: "2025-03-03T12:00:00Z",
      conversation_id: "t-100",
    },
  },
  {
    id: "thread-labor",
    datasetId: "tweets",
    entityType: "thread",
    title: "Labor markets are cooling unevenly",
    summary: "A thread about why cooling labor demand still looks hot in national toplines.",
    observedAt: "2025-03-07T09:30:00Z",
    tags: ["labor", "macro", "economics"],
    values: {
      username: "macrothread",
      participants: ["macrothread", "econreplyguy"],
      post_count: 4,
      created_at: "2025-03-07T09:30:00Z",
      conversation_id: "t-200",
    },
  },
  {
    id: "thread-ai-policy",
    datasetId: "tweets",
    entityType: "thread",
    title: "Compute policy and export controls",
    summary: "A thread about the bottlenecks in compute governance.",
    observedAt: "2025-03-08T16:45:00Z",
    tags: ["ai", "policy", "chips"],
    values: {
      username: "policyvector",
      participants: ["policyvector"],
      post_count: 2,
      created_at: "2025-03-08T16:45:00Z",
      conversation_id: "t-300",
    },
  },
];

const tweetThreadBodies: Record<string, string> = {
  "thread-housing": [
    "Cities with rising housing demand are still under-building relative to permit pipelines.",
    "When permit issuance slows, rents usually keep climbing because the stock shortage is already locked in.",
    "The useful variable is not just permits, but permits relative to household formation and zoning capacity.",
  ].join("\n\n"),
  "thread-labor": [
    "Labor markets can cool in the aggregate while staying tight in specific metros and occupations.",
    "National payroll prints hide the fact that hiring pipelines are breaking unevenly across construction, logistics, and healthcare.",
    "If you only look at the headline unemployment rate, you miss the reallocation story.",
    "That reallocation story matters for wages, migration, and the shape of local recessions.",
  ].join("\n\n"),
  "thread-ai-policy": [
    "Compute policy is really a supply-chain policy problem wearing an AI mask.",
    "Export controls matter, but so do power, packaging, fabs, and who can actually absorb the hardware into production systems.",
  ].join("\n\n"),
};

export const countyEconomicRecords: DatasetRecord[] = [
  {
    id: "county-sf-2024",
    datasetId: "county-economics",
    entityType: "county_stat",
    title: "San Francisco County, CA (2024)",
    observedAt: "2024-01-01",
    values: {
      state: "CA",
      county: "San Francisco",
      geography_level: "county",
      year: 2024,
      population: 808988,
      median_household_income: 167046,
      unemployment_rate: 4.2,
      housing_permits: 1943,
    },
  },
  {
    id: "county-la-2024",
    datasetId: "county-economics",
    entityType: "county_stat",
    title: "Los Angeles County, CA (2024)",
    observedAt: "2024-01-01",
    values: {
      state: "CA",
      county: "Los Angeles",
      geography_level: "county",
      year: 2024,
      population: 9663345,
      median_household_income: 87312,
      unemployment_rate: 5.7,
      housing_permits: 10482,
    },
  },
  {
    id: "county-kings-2024",
    datasetId: "county-economics",
    entityType: "county_stat",
    title: "Kings County, NY (2024)",
    observedAt: "2024-01-01",
    values: {
      state: "NY",
      county: "Kings",
      geography_level: "county",
      year: 2024,
      population: 2736074,
      median_household_income: 84278,
      unemployment_rate: 4.9,
      housing_permits: 6210,
    },
  },
  {
    id: "county-travis-2024",
    datasetId: "county-economics",
    entityType: "county_stat",
    title: "Travis County, TX (2024)",
    observedAt: "2024-01-01",
    values: {
      state: "TX",
      county: "Travis",
      geography_level: "county",
      year: 2024,
      population: 1366843,
      median_household_income: 96563,
      unemployment_rate: 3.8,
      housing_permits: 15321,
    },
  },
];

function buildTweetProjection(record: DatasetRecord): DatasetTextProjection[] {
  const body = tweetThreadBodies[record.id];
  if (!body) {
    return [];
  }
  return [{
    id: `${record.id}-projection`,
    recordId: record.id,
    title: record.title,
    text: body,
    sourceLabel: `@${String(record.values.username ?? "unknown")}`,
    metadata: {
      tags: record.tags ?? [],
      observedAt: record.observedAt ?? null,
    },
  }];
}

export const tweetArchiveAdapter: DatasetAdapter = {
  descriptor: {
    id: "tweets",
    displayName: "Tweet Archive",
    description: "Text-heavy thread records with optional text projections for retrieval and citation flows.",
    entityTypes: ["thread"],
    fields: [
      { key: "username", label: "Username", kind: "string" },
      { key: "participants", label: "Participants", kind: "string", repeated: true },
      { key: "post_count", label: "Post Count", kind: "number" },
      { key: "created_at", label: "Created At", kind: "date" },
      { key: "conversation_id", label: "Conversation ID", kind: "string" },
    ],
    capabilities: {
      textProjections: true,
      structuredFilters: true,
      aggregations: true,
      artifacts: false,
    },
  },
  async listRecords() {
    return tweetThreadRecords;
  },
  async getRecordById(recordId) {
    return tweetThreadRecords.find((record) => record.id === recordId) ?? null;
  },
  projectText(record) {
    return buildTweetProjection(record);
  },
};

export const countyEconomicsAdapter: DatasetAdapter = {
  descriptor: {
    id: "county-economics",
    displayName: "County Economics",
    description: "Structured county-level observations showing why tabular datasets need first-class measures and filters.",
    entityTypes: ["county_stat"],
    fields: [
      { key: "state", label: "State", kind: "category" },
      { key: "county", label: "County", kind: "geography" },
      { key: "geography_level", label: "Geography Level", kind: "category" },
      { key: "year", label: "Year", kind: "number" },
      { key: "population", label: "Population", kind: "number" },
      { key: "median_household_income", label: "Median Household Income", kind: "number" },
      { key: "unemployment_rate", label: "Unemployment Rate", kind: "number" },
      { key: "housing_permits", label: "Housing Permits", kind: "number" },
    ],
    measures: [
      { key: "population", label: "Population" },
      { key: "median_household_income", label: "Median Household Income", unit: "usd" },
      { key: "unemployment_rate", label: "Unemployment Rate", unit: "percent" },
      { key: "housing_permits", label: "Housing Permits" },
    ],
    capabilities: {
      textProjections: false,
      structuredFilters: true,
      aggregations: true,
      artifacts: false,
      timeSeries: true,
      geography: true,
    },
  },
  async listRecords() {
    return countyEconomicRecords;
  },
  async getRecordById(recordId) {
    return countyEconomicRecords.find((record) => record.id === recordId) ?? null;
  },
};

export const fixtureAdapters = new Map<string, DatasetAdapter>([
  [tweetArchiveAdapter.descriptor.id, tweetArchiveAdapter],
  [countyEconomicsAdapter.descriptor.id, countyEconomicsAdapter],
]);

export function getFixtureAdapter(id: string): DatasetAdapter | null {
  return fixtureAdapters.get(id) ?? null;
}

