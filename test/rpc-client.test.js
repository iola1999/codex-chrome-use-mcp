import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { RpcClient } from "../src/rpc-client.js";

class FakePeer extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
  }

  send(message) {
    this.sent.push(message);
  }
}

test("RpcClient sends requests and resolves matching responses", async () => {
  const peer = new FakePeer();
  const client = new RpcClient(peer, { idPrefix: "test" });
  const promise = client.request("getInfo", { hello: "world" });

  assert.deepEqual(peer.sent, [
    {
      jsonrpc: "2.0",
      id: "test:1",
      method: "getInfo",
      params: { hello: "world" },
    },
  ]);

  peer.emit("message", { jsonrpc: "2.0", id: "test:1", result: { ok: true } });
  assert.deepEqual(await promise, { ok: true });
});

test("RpcClient rejects JSON-RPC error responses", async () => {
  const peer = new FakePeer();
  const client = new RpcClient(peer, { idPrefix: "test" });
  const promise = client.request("getInfo");

  peer.emit("message", {
    jsonrpc: "2.0",
    id: "test:1",
    error: { code: -32601, message: "missing" },
  });

  await assert.rejects(promise, /missing/);
});

test("RpcClient reads and clears buffered notifications", () => {
  const peer = new FakePeer();
  const client = new RpcClient(peer, { idPrefix: "test" });

  peer.emit("message", { jsonrpc: "2.0", method: "Network.requestWillBeSent", params: { id: 1 } });
  peer.emit("message", { jsonrpc: "2.0", method: "Runtime.consoleAPICalled", params: { id: 2 } });
  peer.emit("message", { jsonrpc: "2.0", method: "Network.requestWillBeSent", params: { id: 3 } });

  assert.deepEqual(
    client.readNotifications({ method: "Network.requestWillBeSent", limit: 1 }).map((event) => event.params),
    [{ id: 1 }],
  );
  assert.deepEqual(
    client.readNotifications({ method: "Network.requestWillBeSent" }).map((event) => event.params),
    [{ id: 3 }],
  );
  assert.deepEqual(
    client.readNotifications().map((event) => event.params),
    [{ id: 2 }],
  );
});
