import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  BRIDGE_SOCKET_DIR,
  BRIDGE_SOCKET_PREFIX,
  DEFAULT_BROWSER,
  configPathFor,
} from "./constants.js";
import { LengthPrefixedJsonPeer } from "./framing.js";

const LOCAL_ID_PREFIX = "codex-control-chrome-mcp:";

export async function runNativeHost({ origin = process.argv[2], browser = DEFAULT_BROWSER } = {}) {
  await fs.mkdir(BRIDGE_SOCKET_DIR, { recursive: true });
  const socketPath = path.join(
    BRIDGE_SOCKET_DIR,
    `${BRIDGE_SOCKET_PREFIX}-${process.pid}-${crypto.randomUUID()}.sock`,
  );

  const extensionPeer = new LengthPrefixedJsonPeer({
    input: process.stdin,
    output: process.stdout,
    name: "chrome-extension",
  });

  const proxyPeer = await maybeStartOfficialProxy(origin, browser);
  const bridge = new NativeHostBridge({ extensionPeer, proxyPeer });
  await bridge.listen(socketPath);

  const cleanup = async () => {
    await bridge.close();
    try {
      await fs.unlink(socketPath);
    } catch {}
  };
  process.once("SIGINT", () => cleanup().finally(() => process.exit(130)));
  process.once("SIGTERM", () => cleanup().finally(() => process.exit(143)));
  process.once("exit", () => {
    try {
      bridge.closeSync();
    } catch {}
  });
}

class NativeHostBridge {
  constructor({ extensionPeer, proxyPeer = null }) {
    this.extensionPeer = extensionPeer;
    this.proxyPeer = proxyPeer;
    this.server = null;
    this.clients = new Map();
    this.nextClientId = 1;
    this.nextRequestId = 1;
    this.pendingLocalRequests = new Map();

    this.extensionPeer.on("message", (message) => this.#handleExtensionMessage(message));
    this.extensionPeer.on("close", () => this.close());

    if (this.proxyPeer) {
      this.proxyPeer.on("message", (message) => this.#handleProxyMessage(message));
      this.proxyPeer.on("close", () => {
        this.proxyPeer = null;
      });
    }
  }

  async listen(socketPath) {
    this.socketPath = socketPath;
    this.server = net.createServer((socket) => this.#addClient(socket));
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(socketPath, () => {
        this.server.off("error", reject);
        resolve();
      });
    });
  }

  async close() {
    for (const peer of this.clients.values()) {
      peer.close();
    }
    this.clients.clear();
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
  }

  closeSync() {
    for (const peer of this.clients.values()) {
      peer.close();
    }
    this.server?.close();
  }

  #addClient(socket) {
    const clientId = this.nextClientId++;
    const peer = new LengthPrefixedJsonPeer({
      input: socket,
      output: socket,
      name: `local-client:${clientId}`,
    });
    this.clients.set(clientId, peer);
    peer.on("message", (message) => this.#handleLocalMessage(clientId, peer, message));
    peer.on("close", () => {
      this.clients.delete(clientId);
      for (const [bridgeId, pending] of this.pendingLocalRequests) {
        if (pending.clientId === clientId) {
          this.pendingLocalRequests.delete(bridgeId);
        }
      }
    });
  }

  #handleLocalMessage(clientId, peer, message) {
    if (!message || typeof message !== "object" || !("method" in message)) {
      return;
    }
    if (!("id" in message)) {
      this.extensionPeer.send(message);
      return;
    }
    if (message.method === "bridge.getStatus") {
      peer.send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          ok: true,
          proxy: Boolean(this.proxyPeer),
          clients: this.clients.size,
          socketPath: this.socketPath,
        },
      });
      return;
    }
    const bridgeId = `${LOCAL_ID_PREFIX}${clientId}:${this.nextRequestId++}`;
    this.pendingLocalRequests.set(bridgeId, { clientId, originalId: message.id, peer });
    this.extensionPeer.send({ ...message, id: bridgeId });
  }

  #handleExtensionMessage(message) {
    if (!message || typeof message !== "object") {
      return;
    }
    if ("id" in message && !("method" in message)) {
      const id = String(message.id);
      const pending = this.pendingLocalRequests.get(id);
      if (pending) {
        this.pendingLocalRequests.delete(id);
        pending.peer.send({ ...message, id: pending.originalId });
      } else {
        this.proxyPeer?.send(message);
      }
      return;
    }
    if ("method" in message && !("id" in message)) {
      this.#broadcast(message);
      this.proxyPeer?.send(message);
      return;
    }
    if ("method" in message && "id" in message) {
      if (this.proxyPeer) {
        this.proxyPeer.send(message);
      } else {
        this.#handleExtensionRequestStandalone(message);
      }
    }
  }

  #handleProxyMessage(message) {
    this.extensionPeer.send(message);
  }

  #handleExtensionRequestStandalone(message) {
    if (message.method === "ping") {
      this.extensionPeer.send({ jsonrpc: "2.0", id: message.id, result: "pong" });
      return;
    }
    if (message.method === "ensureCodexAppServer") {
      this.extensionPeer.send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          ok: false,
          error: "Codex app server is not provided by codex-control-chrome-mcp standalone mode.",
        },
      });
      return;
    }
    this.extensionPeer.send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: `No native host handler for ${message.method}` },
    });
  }

  #broadcast(message) {
    for (const peer of this.clients.values()) {
      try {
        peer.send(message);
      } catch {}
    }
  }
}

async function maybeStartOfficialProxy(origin, browser = DEFAULT_BROWSER) {
  const config = await readJsonIfExists(configPathFor(browser));
  const officialHostPath = config?.officialHostPath;
  if (typeof officialHostPath !== "string" || officialHostPath.length === 0) {
    return null;
  }
  if (path.resolve(officialHostPath) === path.resolve(process.argv[1])) {
    return null;
  }
  try {
    await fs.access(officialHostPath);
  } catch {
    return null;
  }

  const child = spawn(officialHostPath, [origin ?? ""], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  return new LengthPrefixedJsonPeer({
    input: child.stdout,
    output: child.stdin,
    name: "official-extension-host",
  });
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
