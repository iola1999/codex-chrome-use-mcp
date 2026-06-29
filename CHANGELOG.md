# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [Unreleased]

## [1.2.0] - 2026-06-29

### Added

- Microsoft Edge support as a first-class browser alongside Chrome. `install-native-host`, `uninstall-native-host`, and `status` accept `--browser <chrome|edge|all>`.
- Auto-detection: without `--browser`, `install-native-host` installs for every supported browser whose profile directory exists, `uninstall-native-host` targets every browser it previously installed for, and `status` reports both browsers.
- The MCP stdio server's self-heal now re-asserts the manifest for every browser it manages, not just Chrome.

### Changed

- Native host install state is now stored per browser (`install-state.<browser>.json` / `config.<browser>.json`). Chrome keeps the original unsuffixed filenames, so existing installs remain valid; Edge no longer clobbers Chrome's restore and self-heal metadata.
- `status` output now nests install state under each browser (`install.chrome`, `install.edge`). The `chrome_status` MCP tool additionally reports `manifestPaths` for every supported browser.

## [1.1.0] - 2026-06-27

### Added

- Self-healing native host registration: the MCP stdio server re-asserts the manifest on startup when a Codex update reverts it (opt out with `CODEX_CONTROL_CHROME_NO_AUTO_REGISTER=1`).
- Robust identification of OpenAI's genuine host via stable signals (manifest name + extension origin, bundle path, binary format, and the macOS OpenAI code signature) instead of the binary filename.
- `status` now reports `registered` and a `classification` of the live manifest/host.

### Fixed

- Proxy target resolution preferred a stale recorded path over the live manifest, so a renamed/removed official host (e.g. `extension-host` → `Codex for Chrome`) could be recorded as the proxy target. It now prefers the live official manifest and skips paths that no longer exist.

## [1.0.1] - 2026-06-26

### Added

- Open source governance files.
- CI and npm trusted publishing workflows.
- Node.js test coverage for framing, RPC, and installer behavior.

### Changed

- Runtime package name and version are now read from `package.json` instead of being hard-coded in implementation files.

## [1.0.0] - 2026-06-26

### Added

- Initial npm package.
- MCP stdio server.
- Chrome Native Messaging host bridge.
- Native host install and uninstall commands with manifest backup.
- Basic Chrome tab, navigation, screenshot, CDP, and event MCP tools.
- Skill documentation for Agent tool usage.
