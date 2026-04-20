export interface DatasetImplementationConfig {
  id: string;
  productName: string;
  siteName: string;
  siteDescription: string;
  datasetId: string;
  datasetLabelSingular: string;
  datasetLabelPlural: string;
  heroTitle: string;
  heroSubtitle: string;
  searchPlaceholder: string;
  theme: {
    accent: string;
    accentStrong: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    line: string;
  };
}

export const DEFAULT_IMPLEMENTATION: DatasetImplementationConfig = {
  id: "default",
  productName: "Alpha Datasets",
  siteName: "alpha datasets",
  siteDescription: "Explore arbitrary datasets through a unified interface for search, filtering, and aggregation.",
  datasetId: "unknown",
  datasetLabelSingular: "record",
  datasetLabelPlural: "records",
  heroTitle: "Explore your data like a product, not a notebook.",
  heroSubtitle: "Search text projections, filter structured rows, and run instant aggregations from one surface.",
  searchPlaceholder: "Search the dataset...",
  theme: {
    accent: "#b55833",
    accentStrong: "#7f3318",
    surface: "#f6efe4",
    surfaceAlt: "#eadfcf",
    text: "#1f1611",
    textMuted: "#6d5a4d",
    line: "#cebba7",
  },
};

export function mergeImplementationConfig(
  base: DatasetImplementationConfig,
  overrides?: Partial<DatasetImplementationConfig> | null,
): DatasetImplementationConfig {
  if (!overrides) {
    return base;
  }
  return {
    ...base,
    ...overrides,
    theme: {
      ...base.theme,
      ...(overrides.theme ?? {}),
    },
  };
}

