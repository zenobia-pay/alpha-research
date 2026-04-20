import type { SessionRecord } from "./config.js";

export type RemoteDatasetSummary = {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  deploymentStatus?: string;
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
        throw new Error(`Remote CLI API is not available yet at ${this.session.origin}${path}.${detail}`);
      }
      throw new Error(`Remote request failed (${response.status}) for ${path}.${detail}`);
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
      throw new Error(`Remote request failed (${response.status}) for ${path}.${detail}`);
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

  async listDatasets() {
    return this.request<{ datasets: RemoteDatasetSummary[] }>("/api/cli/datasets");
  }

  async createDataset(body: {
    name: string;
    datasetId: string;
    sourceType: "local_instance" | "remote_manifest";
    instanceId?: string;
    manifestPath?: string;
    description?: string;
  }) {
    return this.request<{ dataset: RemoteDatasetSummary }>("/api/cli/datasets", {
      method: "POST",
      body,
    });
  }

  async deployDataset(datasetId: string) {
    return this.request<{ deployment: { datasetId: string; status: string; url?: string } }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/deploy`, {
      method: "POST",
    });
  }

  async listRuns(datasetId?: string) {
    const suffix = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
    return this.request<{ runs: RemoteRunSummary[] }>(`/api/cli/runs${suffix}`);
  }

  async startRun(datasetId: string, prompt: string) {
    return this.request<{ run: RemoteRunSummary }>(`/api/cli/datasets/${encodeURIComponent(datasetId)}/runs`, {
      method: "POST",
      body: { prompt },
    });
  }

  async getRun(runId: string) {
    return this.requestOptional<{ run: RemoteRunSummary }>(`/api/cli/runs/${encodeURIComponent(runId)}`);
  }

  async getRunEvents(runId: string, after?: string) {
    const suffix = after ? `?after=${encodeURIComponent(after)}` : "";
    return this.requestOptional<{ events: RemoteRunEvent[] }>(`/api/cli/runs/${encodeURIComponent(runId)}/events${suffix}`);
  }
}
