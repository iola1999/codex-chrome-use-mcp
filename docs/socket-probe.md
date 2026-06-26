# Official Socket Probe Notes

## What Was Tested

The official Codex integration exposes Unix sockets under:

```text
/tmp/codex-browser-use
```

On the test machine, `lsof` showed:

```text
extension-host ... /tmp/codex-browser-use/c5389d5f-...sock
Codex         ... /tmp/codex-browser-use/*.sock
```

Two direct probes were attempted against the official `extension-host` socket:

1. Send a Codex browser-client style 4-byte length-prefixed JSON-RPC `getInfo`.
2. Send basic HTTP/WebSocket-looking requests over the Unix socket.

The latest probe result was:

```json
[
  { "type": "connect" },
  { "type": "error", "message": "write EPIPE" },
  { "type": "close" }
]
```

That means the Unix socket accepted the connection but closed the stream before or during the attempted raw JSON-RPC write.

## Interpretation

This does not mean the Chrome extension or CDP path is unusable.

It means the official socket is not a public raw JSON-RPC endpoint. Codex's `browser-client.mjs` checks for a privileged runtime:

```text
privileged native pipe bridge is not available; browser-client is not trusted
```

The official binary also contains strings for app-server proxying, WebSocket, and trusted browser client hashes, which points to an extra trust/proxy layer in front of the raw browser protocol.

## Design Consequence

This project should not depend on directly connecting to the official socket.

Instead, it implements its own bridge socket:

```text
/tmp/codex-browser-use/codex-control-chrome-mcp-*.sock
```

The MCP side and the future Codex `browser-client.mjs` shim can connect to this project-owned socket with a simple 4-byte length-prefixed JSON-RPC protocol.

That removes the opaque official socket from the critical path.

`codex-control-chrome-mcp status` intentionally lists only project-owned bridge sockets named:

```text
/tmp/codex-browser-use/codex-control-chrome-mcp-*.sock
```

It does not treat official Codex or Codex App sockets as usable backends.
