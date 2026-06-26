import assert from "node:assert/strict";
import os from "node:os";
import { PassThrough } from "node:stream";
import test from "node:test";
import { encodeLengthPrefixedJson, LengthPrefixedJsonPeer } from "../src/framing.js";

test("encodeLengthPrefixedJson writes a native-endian length header", () => {
  const message = { jsonrpc: "2.0", id: 1, method: "ping" };
  const frame = encodeLengthPrefixedJson(message);
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const length = os.endianness() === "LE" ? frame.readUInt32LE(0) : frame.readUInt32BE(0);

  assert.equal(frame.length, 4 + payload.length);
  assert.equal(length, payload.length);
  assert.deepEqual(frame.subarray(4), payload);
});

test("LengthPrefixedJsonPeer parses fragmented frames", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const peer = new LengthPrefixedJsonPeer({ input, output, name: "test-peer" });
  const frame = encodeLengthPrefixedJson({ ok: true, value: 42 });
  const messages = [];

  peer.on("message", (message) => messages.push(message));
  input.write(frame.subarray(0, 2));
  input.write(frame.subarray(2, 6));
  input.write(frame.subarray(6));

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(messages, [{ ok: true, value: 42 }]);
});

test("LengthPrefixedJsonPeer send writes a complete frame", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const peer = new LengthPrefixedJsonPeer({ input, output, name: "test-peer" });
  const chunks = [];

  output.on("data", (chunk) => chunks.push(chunk));
  peer.send({ result: "pong" });

  await new Promise((resolve) => setImmediate(resolve));
  const frame = Buffer.concat(chunks);
  const length = os.endianness() === "LE" ? frame.readUInt32LE(0) : frame.readUInt32BE(0);
  assert.deepEqual(JSON.parse(frame.subarray(4, 4 + length).toString("utf8")), { result: "pong" });
});
