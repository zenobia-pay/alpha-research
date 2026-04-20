import {
  aggregateRecords,
  buildTextCompatibleDocuments,
  describeDataset,
  queryDataset,
} from "@alpha-datasets/core";
import { getFixtureAdapter } from "@alpha-datasets/fixture";

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    flags[token.slice(2)] = args[index + 1] ?? "";
    index += 1;
  }
  return flags;
}

function printUsage() {
  console.log([
    "Usage:",
    "  describe <dataset-id>",
    "  preview <dataset-id>",
    "  query <dataset-id> [--text <query>] [--filter <field:eq:value>]",
    "  aggregate <dataset-id> --group-by <field> --measure <field> [--op sum|avg|min|max|count]",
    "  documents <dataset-id>",
  ].join("\n"));
}

async function main() {
  const [command, datasetId, ...rest] = process.argv.slice(2);
  if (!command || !datasetId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const adapter = getFixtureAdapter(datasetId);
  if (!adapter) {
    throw new Error(`Unknown dataset: ${datasetId}`);
  }

  if (command === "describe") {
    console.log(describeDataset(adapter));
    return;
  }

  if (command === "preview") {
    console.log(JSON.stringify(await adapter.listRecords(), null, 2));
    return;
  }

  if (command === "query") {
    const flags = parseFlags(rest);
    const filterArg = flags.filter;
    const filters = filterArg
      ? [(() => {
          const [field, op, value] = filterArg.split(":");
          if (!field || !op) {
            throw new Error(`Invalid filter: ${filterArg}`);
          }
          const parsedValue = Number.isFinite(Number(value)) && value.trim() !== "" ? Number(value) : value;
          return {
            field,
            op: op as "eq" | "in" | "contains" | "gte" | "lte",
            value: parsedValue,
          };
        })()]
      : [];
    const result = await queryDataset(adapter, {
      text: flags.text,
      filters,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "aggregate") {
    const flags = parseFlags(rest);
    if (!flags["group-by"] || !flags.measure) {
      throw new Error("aggregate requires --group-by and --measure");
    }
    const records = await adapter.listRecords();
    console.log(JSON.stringify(aggregateRecords(records, {
      groupBy: flags["group-by"],
      measure: flags.measure,
      op: (flags.op as "sum" | "avg" | "min" | "max" | "count" | undefined) ?? "sum",
    }), null, 2));
    return;
  }

  if (command === "documents") {
    const records = await adapter.listRecords();
    console.log(JSON.stringify(buildTextCompatibleDocuments(adapter, records), null, 2));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
