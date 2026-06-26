import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { BRIDGE_SOCKET_DIR, BRIDGE_SOCKET_PREFIX } from "./constants.js";
import { LengthPrefixedJsonPeer } from "./framing.js";
import { RpcClient } from "./rpc-client.js";

export async function listBridgeSockets() {
  let names = [];
  try {
    names = await fs.readdir(BRIDGE_SOCKET_DIR);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.startsWith(`${BRIDGE_SOCKET_PREFIX}-`) && name.endsWith(".sock"))
    .map((name) => path.join(BRIDGE_SOCKET_DIR, name))
    .sort((a, b) => a.localeCompare(b));
}

export async function connectBridge({ socketPath, timeoutMs = 5000 } = {}) {
  const sockets = socketPath ? [socketPath] : await listBridgeSockets();
  const failures = [];
  for (const candidate of sockets) {
    try {
      const socket = await connectUnixSocket(candidate, timeoutMs);
      const peer = new LengthPrefixedJsonPeer({
        input: socket,
        output: socket,
        name: `bridge:${candidate}`,
      });
      const rpc = new RpcClient(peer, { idPrefix: `mcp-${process.pid}` });
      return { socketPath: candidate, peer, rpc };
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(
    `No Codex Control Chrome MCP bridge socket is available. Tried ${sockets.length} socket(s). ${failures.join("; ")}`,
  );
}

function connectUnixSocket(socketPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`connect timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
