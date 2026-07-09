import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outputPath = process.argv[2];
assert(outputPath, "output path is required");

const output = await readFile(outputPath, "utf8");
const responses = output
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const initialized = responses.find((response) => response.id === 1);
assert(initialized, "initialize response missing");
assert.equal(initialized.result.serverInfo.name, "blastengine-mcp-server");

const toolsResponse = responses.find((response) => response.id === 2);
assert(toolsResponse, "tools/list response missing");
const liveNames = toolsResponse.result.tools.map((tool) => tool.name).sort();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const manifestNames = manifest.tools.map((t) => t.name).sort();

assert.deepEqual(
  liveNames,
  manifestNames,
  `manifest.json tools[] is out of sync with the live server.\n` +
    `  live:     ${JSON.stringify(liveNames)}\n` +
    `  manifest: ${JSON.stringify(manifestNames)}`
);

console.log("stdio smoke ok");

