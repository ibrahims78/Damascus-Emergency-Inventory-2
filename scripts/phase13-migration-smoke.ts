import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), "damascus-baseline-"));
const inputPath = join(directory, "legacy.json");
const firstOutput = join(directory, "baseline-1.json");
const secondOutput = join(directory, "baseline-2.json");

try {
  await writeFile(inputPath, JSON.stringify({
    version: "2.0",
    data: {
      items: [
        { id: 7, name: "ضماد", password: "must-not-be-exported" },
        { id: 7, name: "duplicate" },
      ],
      transactions: [{ localId: "tx-1", quantity: 2 }],
    },
  }));

  const run = async (outputPath: string) => {
    const result = await execFileAsync(
      process.execPath,
      ["./legacy-baseline-report.mjs", "--input", inputPath, "--output", outputPath],
      { cwd: new URL(".", import.meta.url).pathname },
    );
    return JSON.parse(await readFile(outputPath, "utf8")) as {
      mappings: Array<{ entityType: string; localId: string | number; globalId: string }>;
      generatedGlobalIds: number;
      duplicateLocalKeys: string[];
      sensitivePaths: string[];
      warnings: string[];
    };
  };

  const first = await run(firstOutput);
  const second = await run(secondOutput);
  assert.deepEqual(first.mappings, second.mappings);
  assert.equal(first.generatedGlobalIds, 3);
  assert.deepEqual(first.duplicateLocalKeys, ["items:7"]);
  assert.ok(first.sensitivePaths.some((path) => path.endsWith(".password")));
  assert.ok(first.warnings.some((warning) => warning.includes("automatic merge is disabled")));
  assert.ok(first.mappings.every((mapping) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(mapping.globalId)));
  console.log("PASS phase 13 baseline generation is deterministic across repeated runs");
  console.log("PASS phase 13 duplicate and sensitive legacy fields are reported without automatic apply");
} finally {
  await rm(directory, { recursive: true, force: true });
}