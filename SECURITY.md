# Security Policy

## Supported Versions

Security fixes are provided for the latest published npm version.

## Reporting a Vulnerability

Please report security issues privately by emailing `iola1999@foxmail.com`.

Include:

- affected version
- operating system
- Chrome version and profile type
- MCP client name and version
- reproduction steps
- relevant `codex-control-chrome-mcp status` output with sensitive paths or data redacted

Do not include browser cookies, password-store data, session databases, or other private Chrome profile files in reports.

## Security Model

This project controls the user's normal Chrome profile through the Codex Chrome Extension and Chrome DevTools Protocol. That can expose sensitive browser state, including logged-in sessions and page contents.

The trusted boundary is the local user account. Only install and run this tool on machines and Chrome profiles you own or are explicitly authorized to automate.

This project is not affiliated with OpenAI, Codex, Google, or Chrome. It reuses the installed Codex Chrome Extension native messaging host name so the extension can connect to this local bridge.

## Known Security Tradeoffs

- The native host manifest for `com.openai.codexextension` is replaced during install and restored during uninstall.
- The local bridge socket is intended for same-user local access only.
- MCP clients connected to this server can send raw CDP commands to claimed tabs.
- The project does not attempt to enforce per-site or per-command policy.

For operational details, see `docs/architecture.md` and `docs/install.md`.
