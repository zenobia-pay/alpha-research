import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../../../scripts/normalize_dataset.py", import.meta.url));

function printUsage() {
  console.log([
    "Usage:",
    "  npm run dev -w @rprend/alpha-ingest -- --input <file> --id <instance-id> --name <product-name> [--dataset-id <dataset-id>]",
    "Options:",
    "  --title-field <field>",
    "  --summary-field <field>",
    "  --text-fields <field1,field2,...>",
    "  --date-field <field>",
    "  --output-root <dir>",
  ].join("\n"));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    printUsage();
    return;
  }

  const python = process.env.PYTHON_BIN ?? "python3";
  const child = spawn(python, [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`normalize_dataset.py exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
