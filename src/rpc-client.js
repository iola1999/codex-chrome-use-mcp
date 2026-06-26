export class RpcClient {
  constructor(peer, { idPrefix = "req" } = {}) {
    this.peer = peer;
    this.idPrefix = idPrefix;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];

    this.peer.on("message", (message) => this.#handleMessage(message));
    this.peer.on("close", (error) => this.#rejectAll(error ?? new Error("transport closed")));
  }

  request(method, params = {}, { timeoutMs = 30_000 } = {}) {
    const id = `${this.idPrefix}:${this.nextId++}`;
    const message = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.peer.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  readNotifications({ method, limit = 100 } = {}) {
    const selected = [];
    const remaining = [];
    for (const item of this.notifications) {
      if (selected.length < limit && (method == null || item.method === method)) {
        selected.push(item);
      } else {
        remaining.push(item);
      }
    }
    this.notifications = remaining;
    return selected;
  }

  #handleMessage(message) {
    if (message && typeof message === "object" && "id" in message && !("method" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if ("error" in message) {
        pending.reject(new Error(message.error?.message ?? String(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message && typeof message === "object" && "method" in message && !("id" in message)) {
      this.notifications.push({
        method: message.method,
        params: message.params,
        receivedAt: new Date().toISOString(),
      });
    }
  }

  #rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
