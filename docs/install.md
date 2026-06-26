# Install And Uninstall

Package:

- NPM: [codex-control-chrome-mcp](https://www.npmjs.com/package/codex-control-chrome-mcp)
- GitHub: [iola1999/codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)
- Chrome Extension: [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg)

## Development Status

The current implementation provides:

- MCP stdio mode: `npx -y codex-control-chrome-mcp@latest --stdio`
- manifest install: `npx -y codex-control-chrome-mcp@latest install-native-host`
- manifest uninstall: `npx -y codex-control-chrome-mcp@latest uninstall-native-host`
- bridge/socket status: `npx -y codex-control-chrome-mcp@latest status`

Do not run install on a machine where Codex Chrome integration is important unless you are ready to test proxy mode or restore from backup.

## Install

First install and enable the [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg) in the Chrome profile you want to automate.

```bash
npx -y codex-control-chrome-mcp@latest install-native-host
```

This writes a stable launcher:

```text
~/.codex-control-chrome-mcp/native-host-launcher
```

The launcher invokes:

```bash
npx -y codex-control-chrome-mcp@1.0.0 --native-host "$@"
```

The installer:

1. Reads the existing `com.openai.codexextension.json`.
2. Backs it up in the same directory with a timestamped suffix.
3. Writes a new manifest pointing to this project's CLI.
4. Records restore metadata in `~/.codex-control-chrome-mcp/install-state.json`.

Example manifest path on macOS:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json
```

## MCP Client Config

Use stdio mode from other Agent tools:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "codex-control-chrome-mcp@latest", "--stdio"],
  "startup_timeout_sec": 30
}
```

If the Agent supports skills, install or reference the bundled skill folder from this package or repository:

```text
skills/codex-control-chrome-mcp
```

The skill teaches the Agent how to use the MCP tools instead of guessing tool order, tab ownership, CDP event handling, and cleanup behavior.

For local development:

```json
{
  "type": "stdio",
  "command": "/absolute/path/to/codex-control-chrome-mcp/bin/codex-control-chrome-mcp.js",
  "args": ["--stdio"],
  "startup_timeout_sec": 30
}
```

## Uninstall

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host
```

This restores the backed-up official manifest if one was recorded.

Use `--force` only if the current manifest was manually edited and you still want to restore/remove it:

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host --force
```

## Status

```bash
npx -y codex-control-chrome-mcp@latest status
```

This prints:

- active native host manifest
- saved install state
- discovered bridge sockets under `/tmp/codex-browser-use`

## Operational Notes

Chrome launches the native host only when the extension connects. If no bridge socket is visible, reload Chrome or the Codex extension after installing the manifest.

If the extension is missing, install the [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg) from Chrome Web Store and enable it in the target Chrome profile.

Stopping the MCP stdio process does not uninstall the native host. Uninstall explicitly to restore the original manifest.

The MCP stdio server uses the official `@modelcontextprotocol/sdk` package and must not write logs to stdout. Use stderr for diagnostics.
