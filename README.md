# Codex Control Chrome MCP

Expose the Codex Chrome extension flow to other Agent tools through MCP.

- NPM: [codex-control-chrome-mcp](https://www.npmjs.com/package/codex-control-chrome-mcp)
- GitHub: [iola1999/codex-control-chrome-mcp](https://github.com/iola1999/codex-control-chrome-mcp)
- Chrome Extension: [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg)
- Skill: [`skills/codex-control-chrome-mcp/SKILL.md`](./skills/codex-control-chrome-mcp/SKILL.md)

Current implementation is an early Node.js prototype with:

- official `@modelcontextprotocol/sdk` stdio server
- Chrome Native Messaging host mode
- MCP stdio server mode
- install/uninstall commands with manifest backup
- JSON-RPC bridge socket under `/tmp/codex-browser-use`
- basic Chrome tab/CDP MCP tools

Install the Chrome native host:

```bash
npx -y codex-control-chrome-mcp@latest install-native-host
```

The user must also have the [Codex Chrome Extension](https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg) installed and enabled in the Chrome profile they want to automate.

Uninstall and restore the previous Codex native host manifest:

```bash
npx -y codex-control-chrome-mcp@latest uninstall-native-host
```

Intended Agent config:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "codex-control-chrome-mcp@latest", "--stdio"]
}
```

If your Agent supports skills, install or reference the bundled skill folder:

```text
skills/codex-control-chrome-mcp
```

The skill documents the recommended MCP tool order for status checks, tab claiming, CDP commands, screenshots, events, and tab finalization.

Read:

- [Architecture](./docs/architecture.md)
- [Install And Uninstall](./docs/install.md)
- [Official Socket Probe Notes](./docs/socket-probe.md)
