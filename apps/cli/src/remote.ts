import type { SessionRecord } from "./config.js";

export class RemoteRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "RemoteRequestError";
  }
}

export type RemoteDatasetSummary = {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  deploymentStatus?: string;
};

export type RemoteDatasetVolume = {
  id: string;
  name: string;
  region: string;
  mountPath: string;
};

export type RemoteDatasetDetail = RemoteDatasetSummary & {
  updatedAt?: string;
  manifestPath?: string | null;
  volume?: RemoteDatasetVolume | null;
  ingestConfig?: Record<string, unknown> | null;
  sourceFilename?: string | null;
  sourceType?: string | null;
  profile?: {
    datasetId: string;
    schema?: unknown;
    sampleRows?: unknown;
    notes?: string | null;
    updatedAt?: string;
  } | null;
};

export type RemoteRunSummary = {
  id: string;
  datasetId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  prompt?: string;
  outputPreview?: string;
};

export type RemoteRunEvent = {
  id: string;
  runId: string;
  message: string;
  level?: "info" | "warning" | "error";
  createdAt?: string;
};

export type RemoteRunArtifact = {
  id: string;
  runId: string;
  type: string;
  title: string;
  url?: string;
  content?: unknown;
  createdAt?: string;
};

export type ResearchSpec = {
  id: string;
  datasetId: string;
  hypothesis: string;
  spec?: Record<string, unknown> | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
};

export class RemoteApiClient {
  constructor(private readonly session: SessionRecord) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.session.origin}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const detail = text.trim().length > 0 ? ` ${text.trim()}` : "";
      if (response.status === 404) {
        throw new RemoteRequestError(`Remote CLI API is not available yet at ${this.session.origin}${path}.${detail}`, response.status, path);
      }
      throw new RemoteRequestError(`Remote request failed (${response.status}) for ${path}.${detail}`, response.status, path);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async requestOptional<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
    const response = await fetch(`${this.session.origin}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const detail = text.trim().length > 0 ? ` ${text.trim()}` : "";
      throw new RemoteRequestError(`Remote request failed (${response.status}) for ${path}.${detail}`, response.status, path);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  async getMe() {
    return this.request<{ user: { id: string; email?: string; name?: string } }>("/api/cli/me");
  }

  async planAction(input: string) {
    return this.request<{ action: unknown }>("/api/cli/plan", {
      method: "POST",
      body: { input },
    });
  }

  async respond(body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let response: Response;
    try {
      response = await fetch(`${this.session.origin}/api/cli/respond`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new RemoteRequestError(
          "Remote agent planning timed out after 90s for /api/cli/respond. If a run was started, use `what runs are active?` to inspect it.",
          408,
          "/api/cli/respond",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const detail = text.trim().length > 0 ? ` ${text.trim()}` : "";
      throw new RemoteRequestError(`Remote request failed (${response.status}) for /api/cli/respond.${detail}`, response.status, "/api/cli/respond");
    }
    const payload = await response.json() as Record<string, unknown>;
    return {
      payload,
      sessionId: response.headers.get("X-Research-Session-Id"),
    };
  }

  async appendSessionEntry(sessionId: string, body: {
    role: string;
    kind: string;
    title?: string;
    content: string;
    metadata?: unknown;
    createdAt?: string;
  }) {
    return this.request<{ id: string }>(`/api/cli/sessions/${encodeURIComponent(sessionId)}/entries`, {
      method: "POST",
      body,
    });
  }

  async listDatasets() {
    return this.request<{ datasets: RemoteDatasetSummary[] }>("/api/cli/datasets");
  }

  async getDataset(datasetId: string) {
    return this.request<{ dataset: RemoteDatasetDetail }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}`);
  }

  async getDatasetProfile(datasetId: string) {
    return this.request<{ profile: RemoteDatasetDetail["profile"] }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/profile`);
  }

  async updateDatasetProfile(datasetId: string, body: {
    schema?: unknown;
    sampleRows?: unknown;
    notes?: string;
  }) {
    return this.request<{ profile: RemoteDatasetDetail["profile"] }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/profile`, {
      method: "POST",
      body,
    });
  }

  async createDataset(body: {
    name: string;
    datasetId: string;
    sourceType: "uploaded_source" | "local_instance" | "remote_manifest" | "public_data" | "private_data" | "mixed_data";
    sourceFilename?: string;
    mode?: "auto" | "tabular" | "unstructured";
    ingestConfig?: Record<string, string>;
    instanceId?: string;
    manifestPath?: string;
    description?: string;
  }) {
    return this.request<{ dataset: RemoteDatasetSummary }>("/api/cli/datasets", {
      method: "POST",
      body,
    });
  }

  async requestDatasetSourceUpload(datasetId: string, body: {
    filename: string;
    sizeBytes?: number;
  }) {
    return this.request<{ upload: { method: "PUT"; url: string; key: string } }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/source-upload`, {
      method: "POST",
      body,
    });
  }

  async completeDatasetSourceUpload(datasetId: string, body: {
    sizeBytes?: number;
  }) {
    return this.request<{ ok: true }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/source-complete`, {
      method: "POST",
      body,
    });
  }

  async deployDataset(datasetId: string) {
    return this.request<{ deployment: { datasetId: string; status: string; url?: string; volume?: RemoteDatasetVolume }; run?: RemoteRunSummary }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/deploy`, {
      method: "POST",
    });
  }

  async createPublicDataEnvironment(datasetId: string, body: {
    name?: string;
    description?: string;
    sourceDescription: string;
    prompt: string;
    artifacts?: Array<Record<string, unknown>>;
  }) {
    return this.request<{
      dataset: RemoteDatasetSummary | null;
      environment: {
        datasetId: string;
        status: string;
        volume?: RemoteDatasetVolume;
        manifestPath?: string;
      };
      run: RemoteRunSummary;
    }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/public-environment`, {
      method: "POST",
      body,
    });
  }

  async createResearchEnvironment(datasetId: string, body: {
    name?: string;
    description?: string;
    sourceDescription?: string;
    publicSources?: Array<Record<string, unknown>>;
    privateSources?: Array<{
      key: string;
      filename: string;
      sizeBytes?: number;
      description?: string;
    }>;
    prompt: string;
    artifacts?: Array<Record<string, unknown>>;
  }) {
    return this.request<{
      dataset: RemoteDatasetSummary | null;
      environment: {
        datasetId: string;
        status: string;
        volume?: RemoteDatasetVolume;
        manifestPath?: string;
      };
      run: RemoteRunSummary;
    }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/research-environment`, {
      method: "POST",
      body,
    });
  }

  async listRuns(datasetId?: string) {
    const suffix = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
    return this.request<{ runs: RemoteRunSummary[] }>(`/api/cli/runs${suffix}`);
  }

  async startRun(datasetId: string, prompt: string, options?: {
    type?: string;
    config?: Record<string, unknown>;
    artifacts?: Array<Record<string, unknown>>;
  }) {
    return this.request<{ run: RemoteRunSummary }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/runs`, {
      method: "POST",
      body: { prompt, ...options },
    });
  }

  async getRun(runId: string) {
    return this.requestOptional<{ run: RemoteRunSummary }>(`/api/cli/runs/${encodeURIComponent(runId)}`);
  }

  async cancelRun(runId: string) {
    return this.request<{ run: RemoteRunSummary }>(`/api/cli/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
    });
  }

  async getRunEvents(runId: string, after?: string) {
    const suffix = after ? `?after=${encodeURIComponent(after)}` : "";
    return this.requestOptional<{ events: RemoteRunEvent[] }>(`/api/cli/runs/${encodeURIComponent(runId)}/events${suffix}`);
  }

  async getRunArtifacts(runId: string) {
    return this.request<{ artifacts: RemoteRunArtifact[] }>(`/api/cli/runs/${encodeURIComponent(runId)}/artifacts`);
  }

  async getRunResults(runId: string) {
    return this.request<{
      run: RemoteRunSummary;
      metadata?: { config?: unknown; artifactSpec?: unknown } | null;
      artifacts: RemoteRunArtifact[];
      events: RemoteRunEvent[];
    }>(`/api/cli/runs/${encodeURIComponent(runId)}/results`);
  }

  async listResearchSpecs(datasetId?: string) {
    const suffix = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
    return this.request<{ specs: ResearchSpec[] }>(`/api/cli/research-specs${suffix}`);
  }

  async createResearchSpec(body: {
    datasetId: string;
    hypothesis: string;
    spec?: Record<string, unknown>;
    status?: string;
  }) {
    return this.request<{ spec: ResearchSpec }>("/api/cli/research-specs", {
      method: "POST",
      body,
    });
  }

  async getResearchSpec(id: string) {
    return this.request<{ spec: ResearchSpec }>(`/api/cli/research-specs/${encodeURIComponent(id)}`);
  }
}
