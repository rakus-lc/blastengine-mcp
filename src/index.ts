#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";
import { createBlastengineMcpServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const server = createBlastengineMcpServer({ config });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("blastengine MCP server running on stdio");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[error] ${message}\n`);
  process.exit(1);
});

