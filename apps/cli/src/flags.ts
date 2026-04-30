import type { DatasetFilter } from "@zenobia-pay/alpha-core";

export function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

export function parseCliArgs(args: string[]) {
  const flags = parseFlags(args);
  const positionals = args.filter((token, index) => {
    if (token.startsWith("--")) {
      return false;
    }
    const previous = args[index - 1];
    if (previous?.startsWith("--") && !previous.startsWith("---")) {
      return false;
    }
    return true;
  });
  return { flags, positionals };
}

export function parseFilter(filterArg: string): DatasetFilter {
  const [field, op, ...valueParts] = filterArg.split(":");
  const valueText = valueParts.join(":");
  if (!field || !op || valueText.length === 0) {
    throw new Error(`Invalid filter: ${filterArg}`);
  }
  const numericValue = Number(valueText);
  const value = Number.isFinite(numericValue) && valueText.trim() !== "" ? numericValue : valueText;
  return {
    field,
    op: op as DatasetFilter["op"],
    value,
  };
}
