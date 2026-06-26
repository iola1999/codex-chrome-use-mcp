#!/usr/bin/env node
import { runCli } from "../src/cli.js";

runCli(process.argv).catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
