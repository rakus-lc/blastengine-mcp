import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

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
const names = toolsResponse.result.tools.map((tool) => tool.name);
assert(names.includes("blastengine_send_transaction"));
assert(names.includes("blastengine_bulk_commit_immediate"));
assert(names.includes("blastengine_bulk_import_recipients_csv"));
assert(names.includes("blastengine_usage_latest_get"));

console.log("stdio smoke ok");

