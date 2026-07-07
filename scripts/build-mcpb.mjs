#!/usr/bin/env node
// Build a Claude Desktop MCP Bundle (.mcpb).
// Stages dist + production node_modules into build/mcpb-staging, then packs
// it with the @anthropic-ai/mcpb CLI (pinned in devDependencies). Output: build/<name>-<version>.mcpb
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, "build");
const staging = path.join(buildDir, "mcpb-staging");

function run(command, cwd, extraEnv) {
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env
  });
}

run("npm run build", root);

rmSync(buildDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
mkdirSync(staging, { recursive: true });

for (const file of ["manifest.json", "icon.png", "package.json", "package-lock.json", "README.md", "LICENSE"]) {
  cpSync(path.join(root, file), path.join(staging, file));
}
cpSync(path.join(root, "dist"), path.join(staging, "dist"), { recursive: true });

run("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", staging);

const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
const outFile = path.join(buildDir, `${manifest.name}-${manifest.version}.mcpb`);
run(`npx mcpb pack "${staging}" "${outFile}"`, root, {
  npm_config_ignore_scripts: "true"
});

console.log(`\nMCPB bundle created: ${outFile}`);
