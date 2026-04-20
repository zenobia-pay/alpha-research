import { useEffect, useMemo, useState, type CSSProperties } from "react";

type InstanceSummary = {
  id: string;
  productName: string;
  datasetId: string;
  displayName: string;
  description: string;
  recordCount: number;
};

type BootstrapPayload = {
  implementation: {
    productName: string;
    siteDescription: string;
    heroTitle: string;
    heroSubtitle: string;
    searchPlaceholder: string;
    datasetLabelSingular: string;
    datasetLabelPlural: string;
    theme: Record<string, string>;
  };
  descriptor: {
    displayName: string;
    description: string;
    fields: Array<{ key: string; label: string; kind: string }>;
    measures?: Array<{ key: string; label: string }>;
  };
  recordCount: number;
  sampleRecords: Array<{
    id: string;
    title: string;
    summary?: string | null;
    values: Record<string, unknown>;
  }>;
  supportsTextSearch: boolean;
};

type QueryPayload = {
  totalRecords: number;
  records: Array<{
    id: string;
    title: string;
    summary?: string | null;
    values: Record<string, unknown>;
  }>;
  textHits: Array<{
    recordId: string;
    score: number;
    excerpt: string;
  }>;
};

type AggregatePayload = {
  buckets: Array<{
    key: string;
    value: number;
    count: number;
  }>;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [queryText, setQueryText] = useState("");
  const [queryResult, setQueryResult] = useState<QueryPayload | null>(null);
  const [aggregate, setAggregate] = useState<AggregatePayload | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState("");
  const [selectedGroupBy, setSelectedGroupBy] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchJson<{ instances: InstanceSummary[] }>("/api/instances").then((payload) => {
      setInstances(payload.instances);
      setInstanceId((current) => current || payload.instances[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    if (!instanceId) {
      return;
    }
    setLoading(true);
    void fetchJson<BootstrapPayload>(`/api/instances/${instanceId}/bootstrap`)
      .then((payload) => {
        setBootstrap(payload);
        setQueryResult({
          totalRecords: payload.recordCount,
          records: payload.sampleRecords,
          textHits: [],
        });
        setSelectedMeasure(payload.descriptor.measures?.[0]?.key ?? "");
        setSelectedGroupBy(payload.descriptor.fields[0]?.key ?? "");
      })
      .finally(() => setLoading(false));
  }, [instanceId]);

  const themeStyle = useMemo(() => {
    const theme = bootstrap?.implementation.theme;
    return theme
      ? ({
          "--accent": theme.accent,
          "--accent-strong": theme.accentStrong,
          "--surface": theme.surface,
          "--surface-alt": theme.surfaceAlt,
          "--text": theme.text,
          "--text-muted": theme.textMuted,
          "--line": theme.line,
        } as CSSProperties)
      : undefined;
  }, [bootstrap]);

  async function runQuery() {
    if (!instanceId) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchJson<QueryPayload>(`/api/instances/${instanceId}/query`, {
        method: "POST",
        body: JSON.stringify({
          text: queryText.trim() || undefined,
        }),
      });
      setQueryResult(result);
    } finally {
      setLoading(false);
    }
  }

  async function runAggregate() {
    if (!instanceId || !selectedGroupBy || !selectedMeasure) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchJson<AggregatePayload>(`/api/instances/${instanceId}/aggregate`, {
        method: "POST",
        body: JSON.stringify({
          groupBy: selectedGroupBy,
          measure: selectedMeasure,
          op: "avg",
        }),
      });
      setAggregate(result);
    } finally {
      setLoading(false);
    }
  }

  const resultMap = useMemo(
    () => new Map(queryResult?.textHits.map((hit) => [hit.recordId, hit]) ?? []),
    [queryResult],
  );

  return (
    <div className="app-shell" style={themeStyle}>
      <div className="grain" />
      <header className="topbar">
        <div>
          <div className="eyebrow">Dataset-Centric Platform</div>
          <h1>{bootstrap?.implementation.productName ?? "Alpha Research"}</h1>
        </div>
        <label className="instance-picker">
          <span>Instance</span>
          <select value={instanceId} onChange={(event) => setInstanceId(event.target.value)}>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.productName}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="layout">
        <section className="hero-panel">
          <p className="eyebrow">{bootstrap?.descriptor.displayName ?? "Dataset explorer"}</p>
          <h2>{bootstrap?.implementation.heroTitle ?? "Explore arbitrary datasets"}</h2>
          <p className="hero-copy">{bootstrap?.implementation.heroSubtitle ?? bootstrap?.implementation.siteDescription}</p>
          <div className="hero-metrics">
            <div>
              <span>Records</span>
              <strong>{bootstrap?.recordCount.toLocaleString() ?? "0"}</strong>
            </div>
            <div>
              <span>Fields</span>
              <strong>{bootstrap?.descriptor.fields.length ?? 0}</strong>
            </div>
            <div>
              <span>Measures</span>
              <strong>{bootstrap?.descriptor.measures?.length ?? 0}</strong>
            </div>
          </div>
          <div className="query-bar">
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder={bootstrap?.implementation.searchPlaceholder ?? "Search..."}
            />
            <button onClick={() => void runQuery()} disabled={loading}>
              {loading ? "Running..." : "Search"}
            </button>
          </div>
          <p className="microcopy">
            This surface supports both text-backed datasets and structured datasets. Text search is optional; aggregation is not.
          </p>
        </section>

        <section className="control-panel">
          <div className="panel-head">
            <h3>Quick aggregate</h3>
            <button onClick={() => void runAggregate()} disabled={loading || !selectedMeasure || !selectedGroupBy}>
              Compute
            </button>
          </div>
          <div className="control-grid">
            <label>
              <span>Group by</span>
              <select value={selectedGroupBy} onChange={(event) => setSelectedGroupBy(event.target.value)}>
                {(bootstrap?.descriptor.fields ?? []).map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Measure</span>
              <select value={selectedMeasure} onChange={(event) => setSelectedMeasure(event.target.value)}>
                {(bootstrap?.descriptor.measures ?? []).map((measure) => (
                  <option key={measure.key} value={measure.key}>{measure.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="aggregate-list">
            {(aggregate?.buckets ?? []).map((bucket) => (
              <div className="aggregate-row" key={bucket.key}>
                <div>
                  <strong>{bucket.key}</strong>
                  <span>{bucket.count} records</span>
                </div>
                <em>{bucket.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</em>
              </div>
            ))}
            {!aggregate?.buckets?.length && <p className="empty-state">Run an aggregation to summarize the active instance.</p>}
          </div>
        </section>

        <section className="results-panel">
          <div className="panel-head">
            <h3>Records</h3>
            <span>{queryResult?.totalRecords ?? bootstrap?.recordCount ?? 0} matched</span>
          </div>
          <div className="record-list">
            {(queryResult?.records ?? []).map((record) => {
              const hit = resultMap.get(record.id);
              return (
                <article className="record-card" key={record.id}>
                  <div className="record-head">
                    <h4>{record.title}</h4>
                    <code>{record.id}</code>
                  </div>
                  {record.summary && <p className="record-summary">{record.summary}</p>}
                  {hit && <blockquote>{hit.excerpt}</blockquote>}
                  <div className="field-grid">
                    {Object.entries(record.values).slice(0, 8).map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>{Array.isArray(value) ? value.join(", ") : String(value)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
