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

This is an independent community project. It is not affiliated with OpenAI, Codex, Google, or Chrome.

## Platform Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Tested | Primary supported platform. |
| Linux | Experimental | Uses the browser's user-level Native Messaging host directory. |
| Windows | Unsupported | Native Messaging registration uses registry keys on Windows and is not implemented yet. |

## Browser Support

| Browser | Status | Notes |
| --- | --- | --- |
| Google Chrome | Tested | Default target. |
| Microsoft Edge | Supported | Same Codex extension and `chrome-extension://` origin; installs to Edge's `NativeMessagingHosts` directory. |

Commands accept `--browser <chrome|edge|all>`. Without it, `install-native-host` auto-detects the browsers present on the machine, `uninstall-native-host` targets every browser it previously installed for, and `status` reports both browsers.

## Install

First install and enable the [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg) in the Chrome or Edge profile you want to automate.

```bash
npx -y codex-control-chrome-mcp@latest install-native-host
```

Without `--browser`, this installs for every supported browser whose profile directory exists. Pass `--browser <chrome|edge|all>` to target one explicitly.

This writes a stable per-browser launcher (Edge uses the `-edge` suffix):

```text
~/.codex-control-chrome-mcp/native-host-launcher
~/.codex-control-chrome-mcp/native-host-launcher-edge
```

The launcher invokes (the `--browser` flag tells the host which browser's config to read for proxy mode):

```bash
npx -y codex-control-chrome-mcp@latest --native-host --browser chrome "$@"
```

For each selected browser the installer:

1. Reads the existing `com.openai.codexextension.json` in that browser's directory.
2. Backs it up in the same directory with a timestamped suffix.
3. Writes a new manifest pointing to this project's CLI.
4. Records restore metadata in `~/.codex-control-chrome-mcp/install-state.json` (Chrome) or `install-state.<browser>.json` (other browsers), so browsers never clobber each other's state.
5. Records the genuine OpenAI host path for proxy mode when available.

### Identifying the official host

The installer identifies OpenAI's genuine host with stable signals instead of the
binary filename (OpenAI has renamed it across releases, e.g. `extension-host` →
`Codex for Chrome`):

- the manifest `name` (`com.openai.codexextension`) and the official extension origin,
- the bundle directory structure (`.../openai-bundled/.../extension-host/...`),
- the binary format (a compiled Mach-O/ELF executable, not a shell script),
- on macOS, the OpenAI code signature (Developer ID Team `2DC432GLL2`).

When choosing the proxy target it prefers the **live** manifest (most up to date) and
skips paths that no longer exist, so a renamed or removed host is never recorded as the
official target. `status` reports these signals under `classification`.

Example manifest paths on macOS:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json
~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/com.openai.codexextension.json
```

Example manifest paths on Linux:

```text
~/.config/google-chrome/NativeMessagingHosts/com.openai.codexextension.json
~/.config/microsoft-edge/NativeMessagingHosts/com.openai.codexextension.json
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

This restores the backed-up official manifest if one was recorded. Without `--browser` it uninstalls from every browser it previously installed for; pass `--browser <chrome|edge|all>` to scope it.

Use `--force` only if the current manifest was manually edited and you still want to restore/remove it:

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host --force
```

## Status

```bash
npx -y codex-control-chrome-mcp@latest status
```

This prints, per browser under `install.chrome` / `install.edge`:

- active native host manifest
- saved install state
- the `registered` flag and live-manifest `classification`

and the discovered bridge sockets under `/tmp/codex-browser-use`. Pass `--browser` to scope it to one browser.

## Operational Notes

Chrome launches the native host only when the extension connects. If no bridge socket is visible, reload Chrome or the Codex extension after installing the manifest.

### Auto re-register after Codex updates

A Codex App/extension update re-registers its own `com.openai.codexextension` manifest and reverts this project's proxy registration. To avoid a manual repair each time, the MCP stdio server re-asserts the manifest on startup when it detects it was reverted (only if it was installed before — it never bootstraps a fresh install silently). Logs go to stderr only.

Re-asserting the manifest takes effect on the extension's **next** Native Messaging connection, so reload the Codex Chrome Extension or restart Chrome once after a Codex update. Disable this behavior with:

```bash
CODEX_CONTROL_CHROME_NO_AUTO_REGISTER=1
```

If the extension is missing, install the [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg) from Chrome Web Store and enable it in the target Chrome profile.

Stopping the MCP stdio process does not uninstall the native host. Uninstall explicitly to restore the original manifest.

The MCP stdio server uses the official `@modelcontextprotocol/sdk` package and must not write logs to stdout. Use stderr for diagnostics.

## Troubleshooting

If `status` shows no sockets:

1. Confirm Chrome is running with the profile where the extension is installed.
2. Reload or disable/enable the Codex Chrome Extension.
3. Run `npx -y codex-control-chrome-mcp@latest status`.
4. Check `install.<browser>.registered`. If it is `false` and `classification.kind` is `official-openai`, a Codex update reclaimed that browser's manifest. The stdio server re-asserts it on next startup; reload the extension or restart the browser to reconnect (or run `install-native-host` to repair immediately).
5. When `registered` is `true`, the active manifest points to `~/.codex-control-chrome-mcp/native-host-launcher` (or the `-edge` variant, or your local launcher) and the extension just needs to connect.

If Codex App integration is affected, uninstall this project:

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host
```

If the recorded backup is stale or manually changed, inspect the manifest and use `--force` only when you intentionally want to restore/remove the current project manifest.

## Publishing

This package is published from GitHub Actions through npm Trusted Publishing. See [Release Process](./release.md).
