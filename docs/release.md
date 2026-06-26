# Release Process

Releases are published from GitHub Actions through npm Trusted Publishing.

## Trusted Publishing Setup

Configure the npm package settings:

- Package: `codex-control-chrome-mcp`
- Publisher: GitHub Actions
- Organization or user: `iola1999`
- Repository: `codex-control-chrome-mcp`
- Workflow filename: `publish.yml`
- Environment name: leave blank unless you add a GitHub deployment environment
- Allowed action: `npm publish`

Trusted Publishing requires a GitHub-hosted runner, OIDC permission, npm CLI 11.5.1 or newer, and Node.js 22.14.0 or newer. The publish workflow uses Node.js 24 and installs the latest npm before publishing.

## Publish A New Version

1. Update `package.json` version.
2. Update `CHANGELOG.md`.
3. Run checks locally:

```bash
npm run ci
```

4. Commit and push to `main`.
5. Create and push a matching tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The tag must match the package version exactly. For example, `package.json` version `1.0.1` must use tag `v1.0.1`.

## What The Workflow Does

The `publish.yml` workflow:

1. Installs dependencies with `npm ci`.
2. Verifies the tag matches `package.json`.
3. Runs `npm run ci`.
4. Publishes with `npm publish`.

No long-lived `NPM_TOKEN` is required.

## GitHub Release

After the npm publish workflow succeeds, create a GitHub Release from the same tag and copy the relevant section from `CHANGELOG.md` into the release notes.

Do not create a new GitHub Release for a tag if the npm publish failed.
