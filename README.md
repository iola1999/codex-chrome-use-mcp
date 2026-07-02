# Codex Control Chrome MCP

[![npm version](https://img.shields.io/npm/v/codex-control-chrome-mcp.svg)](https://www.npmjs.com/package/codex-control-chrome-mcp)
[![CI](https://github.com/iola1999/codex-control-chrome-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/iola1999/codex-control-chrome-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Expose the Codex Chrome Extension flow to other Agent tools through MCP.

This project lets MCP clients control the user's normal Chrome profile through the installed [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg). It is useful when an Agent needs existing tabs, cookies, logged-in sessions, installed extensions, screenshots, console/network events, or raw Chrome DevTools Protocol commands.

This is an independent community project. It is not affiliated with OpenAI, Codex, Google, or Chrome.

- NPM: [codex-control-chrome-mcp](https://www.npmjs.com/package/codex-control-chrome-mcp)
- GitHub: [iola1999/codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)
- Chrome Extension: [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg)
- Skill: [`skills/codex-control-chrome-mcp/SKILL.md`](./skills/codex-control-chrome-mcp/SKILL.md)

## Platform Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Tested | Primary supported platform. |
| Linux | Experimental | Manifest path targets Google Chrome under `~/.config/google-chrome`. |
| Windows | Unsupported | Native Messaging registration uses registry keys on Windows and is not implemented yet. |

Node.js 20 or newer is required. npm Trusted Publishing for releases uses Node.js 24 in GitHub Actions.

## Browser Support

Both Chromium browsers use the same Codex extension and the same `chrome-extension://` origin, so a single manifest works for either.

| Browser | Status | Notes |
| --- | --- | --- |
| Google Chrome | Tested | Default target. |
| Microsoft Edge | Supported | Same extension and native-messaging mechanism; installs to the Edge `NativeMessagingHosts` directory. |

Commands accept `--browser <chrome\|edge\|all>`. Without the flag, `install-native-host` installs for every supported browser whose profile directory exists, `uninstall-native-host` targets every browser it previously installed for, and `status` reports both.

## Quick Start

Install and enable the [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg) in the Chrome or Edge profile you want to automate.

Install the native host (auto-detects the browsers present):

```bash
npx -y codex-control-chrome-mcp@latest install-native-host
```

To target one browser explicitly:

```bash
npx -y codex-control-chrome-mcp@latest install-native-host --browser edge
```

Configure your Agent to use the MCP stdio server:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "codex-control-chrome-mcp@latest", "--stdio"],
  "startup_timeout_sec": 30
}
```

Check status:

```bash
npx -y codex-control-chrome-mcp@latest status
```

Uninstall and restore the previous Codex native host manifest:

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host
```

## Agent Skill

If your Agent supports skills, install or reference the bundled skill folder:

```text
skills/codex-control-chrome-mcp
```

The skill documents the recommended MCP tool order for:

- status checks
- tab listing and claiming
- CDP attach and command execution
- screenshots
- network and console event reads
- tab finalization

## Security Notes

This project controls the user's normal Chrome profile. MCP clients connected to it can inspect page contents and send raw CDP commands to claimed tabs.

Only install and run it on machines and Chrome profiles you own or are explicitly authorized to automate. Do not send browser cookies, password stores, profile databases, tokens, or private session files in issues or logs.

See [SECURITY.md](./SECURITY.md) for the security model and reporting process.

## How It Works

The Codex Chrome Extension does not need an external Chrome remote debugging port. It uses Chrome Native Messaging and the extension's `chrome.debugger` permission:

```text
Chrome extension
  -> chrome.runtime.connectNative("com.openai.codexextension")
  -> codex-control-chrome-mcp native host
  -> local MCP bridge socket
  -> chrome.debugger.attach / chrome.debugger.sendCommand
  -> CDP
```

Because the control entrypoint is inside the normal Chrome profile, existing cookies, logged-in sessions, tabs, and extensions can be reused.

Read more:

- [Architecture](./docs/architecture.md)
- [Install And Uninstall](./docs/install.md)
- [Official Socket Probe Notes](./docs/socket-probe.md)
- [Release Process](./docs/release.md)

## Development

Install dependencies:

```bash
npm ci
```

Run checks:

```bash
npm run ci
```

Run the MCP server locally:

```bash
node ./bin/codex-control-chrome-mcp.js --stdio
```

Run native host mode locally for development:

```bash
node ./bin/codex-control-chrome-mcp.js --native-host
```

## Troubleshooting

### A Codex update stopped the bridge

Codex App/extension updates re-register their own `com.openai.codexextension` native-messaging manifest, which overwrites this project's proxy registration (the bundled host binary has even been renamed across releases). The symptom is `status` showing `sockets: []`, `registered: false`, and a manifest `path` back inside the Codex bundle.

The MCP stdio server now **self-heals**: on startup it re-asserts the manifest when it detects it was reverted, so you usually do not need to re-run `install-native-host`. Because Chrome only reads the manifest when the extension reconnects, **reload the Codex Chrome Extension (or restart Chrome) once** after a Codex update to bring the bridge back. Set `CODEX_CONTROL_CHROME_NO_AUTO_REGISTER=1` to disable the auto re-register.

If Codex App integration stops working, uninstall this native host to restore the backed-up manifest:

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host
```

If tab or CDP tools fail, use the bundled skill workflow: list tabs again, claim only current tab IDs, attach before raw CDP calls, and read CDP events after enabling the relevant domain.

See [Install And Uninstall](./docs/install.md#troubleshooting) for the full per-browser checklist (the `registered` flag and host `classification`).

## License

MIT
