import { EventEmitter } from "node:events";
import os from "node:os";

const LENGTH_BYTES = 4;
const IS_LE = os.endianness() === "LE";

export function encodeLengthPrefixedJson(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(LENGTH_BYTES);
  if (IS_LE) {
    header.writeUInt32LE(payload.length, 0);
  } else {
    header.writeUInt32BE(payload.length, 0);
  }
  return Buffer.concat([header, payload]);
}

function readFrameLength(buffer) {
  return IS_LE ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);
}

export class LengthPrefixedJsonPeer extends EventEmitter {
  constructor({ input, output, name = "peer" }) {
    super();
    this.input = input;
    this.output = output;
    this.name = name;
    this.buffer = Buffer.alloc(0);
    this.closed = false;

    this.input.on("data", (chunk) => this.#handleData(chunk));
    this.input.on("end", () => this.#markClosed());
    this.input.on("close", () => this.#markClosed());
    this.input.on("error", (error) => this.#markClosed(error));
    this.output.on?.("error", (error) => this.#markClosed(error));
  }

  send(message) {
    if (this.closed) {
      throw new Error(`${this.name} is closed`);
    }
    this.output.write(encodeLengthPrefixedJson(message));
  }

  close() {
    this.#markClosed();
    this.output.end?.();
    this.input.destroy?.();
  }

  #handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= LENGTH_BYTES) {
      const length = readFrameLength(this.buffer);
      if (this.buffer.length < LENGTH_BYTES + length) {
        return;
      }
      const payload = this.buffer.subarray(LENGTH_BYTES, LENGTH_BYTES + length);
      this.buffer = this.buffer.subarray(LENGTH_BYTES + length);
      try {
        this.emit("message", JSON.parse(payload.toString("utf8")));
      } catch (error) {
        this.emit("error", error);
      }
    }
  }

  #markClosed(error) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.emit("close", error);
  }
}
