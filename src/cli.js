import { runMcpServer } from "./mcp-server.js";
import { runNativeHost } from "./native-host.js";
import { installNativeHost, nativeHostInstallStatus, uninstallNativeHost } from "./installer.js";
import { listBridgeSockets } from "./bridge-client.js";
import { probeLengthPrefixedSocket } from "./probe.js";

export async function runCli(argv) {
  const args = argv.slice(2);
  const command = args[0];

  if (args.includes("--stdio") || command === "stdio") {
    await runMcpServer();
    return;
  }

  if (args.includes("--native-host") || looksLikeChromeOrigin(command)) {
    await runNativeHost({ origin: looksLikeChromeOrigin(command) ? command : argv[3] });
    return;
  }

  switch (command) {
    case "install-native-host": {
      const binPath = readOption(args, "--bin");
      const noProxy = args.includes("--no-proxy");
      const result = await installNativeHost({ binPath, proxy: !noProxy });
      printJson(result);
      return;
    }
    case "uninstall-native-host": {
      const result = await uninstallNativeHost({ force: args.includes("--force") });
      printJson(result);
      return;
    }
    case "status": {
      printJson({
        install: await nativeHostInstallStatus(),
        sockets: await listBridgeSockets(),
      });
      return;
    }
    case "probe-socket": {
      const socketPath = args[1];
      if (!socketPath) {
        throw new Error("Usage: codex-control-chrome-mcp probe-socket <socket-path>");
      }
      printJson(await probeLengthPrefixedSocket(socketPath));
      return;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function looksLikeChromeOrigin(value) {
  return typeof value === "string" && value.startsWith("chrome-extension://");
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printHelp() {
  process.stdout.write(`codex-control-chrome-mcp

Usage:
  codex-control-chrome-mcp --stdio
  codex-control-chrome-mcp --native-host
  codex-control-chrome-mcp install-native-host [--bin /path/to/codex-control-chrome-mcp] [--no-proxy]
  codex-control-chrome-mcp uninstall-native-host [--force]
  codex-control-chrome-mcp status
  codex-control-chrome-mcp probe-socket <socket-path>

Notes:
  --stdio is the MCP server mode for Agent tools.
  --native-host is normally launched by Chrome through Native Messaging.
  install-native-host without --bin writes a stable launcher that runs npx.
`);
}
