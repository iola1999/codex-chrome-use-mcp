# Contributing

Thanks for considering a contribution.

## Development Setup

Requirements:

- Node.js 20 or newer
- npm
- Google Chrome
- Codex Chrome Extension, when testing real browser control

Install dependencies:

```bash
npm ci
```

Run local checks:

```bash
npm run ci
```

## Pull Requests

Before opening a pull request:

- Keep changes focused and small.
- Add or update tests for behavior changes.
- Update `README.md`, `docs/`, or `skills/` when changing user-visible behavior.
- Run `npm run ci`.
- Do not commit local Chrome profile data, logs, cookies, tokens, or generated native host manifests.

## Release Process

Releases are published from GitHub Actions through npm Trusted Publishing.

1. Update `package.json` version.
2. Update `CHANGELOG.md`.
3. Commit and push the change to `main`.
4. Create and push a matching tag, such as `v1.0.1`.
5. Let the GitHub Actions publish workflow run from that tag.

The npm package must be configured with a Trusted Publisher for this repository and the workflow filename `publish.yml`.
