import type { Config } from "./config.js";

const LEVELS: Record<Config["logLevel"], number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

export class Logger {
  constructor(private readonly level: Config["logLevel"]) {}

  error(message: string): void {
    this.write("error", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  info(message: string): void {
    this.write("info", message);
  }

  debug(message: string): void {
    this.write("debug", message);
  }

  private write(level: Exclude<Config["logLevel"], "silent">, message: string): void {
    if (LEVELS[this.level] < LEVELS[level]) {
      return;
    }
    process.stderr.write(`[${level}] ${message}\n`);
  }
}

