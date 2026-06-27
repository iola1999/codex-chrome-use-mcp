import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CODEX_EXTENSION_ID, CODEX_NATIVE_HOST_NAME } from "../src/constants.js";
import {
  ensureNativeHostRegistered,
  installNativeHost,
  uninstallNativeHost,
} from "../src/installer.js";
import { MANIFEST_DESCRIPTION } from "../src/host-identity.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/package-meta.js";

function tmpPaths(root) {
  const appStateDir = path.join(root, "state");
  return {
    manifestPath: path.join(root, "NativeMessagingHosts", `${CODEX_NATIVE_HOST_NAME}.json`),
    appStateDir,
    configPath: path.join(appStateDir, "config.json"),
    installStatePath: path.join(appStateDir, "install-state.json"),
  };
}

function officialManifest(hostPath) {
  return {
    name: CODEX_NATIVE_HOST_NAME,
    description: "Codex chrome native messaging host",
    path: hostPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${CODEX_EXTENSION_ID}/`],
  };
}

test("installNativeHost backs up and restores an existing manifest", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-control-chrome-mcp-test-"));
  const manifestPath = path.join(root, "NativeMessagingHosts", `${CODEX_NATIVE_HOST_NAME}.json`);
  const appStateDir = path.join(root, "state");
  const paths = {
    manifestPath,
    appStateDir,
    configPath: path.join(appStateDir, "config.json"),
    installStatePath: path.join(appStateDir, "install-state.json"),
  };
  const originalManifest = {
    name: CODEX_NATIVE_HOST_NAME,
    description: "Official Codex native host",
    path: path.join(root, "official-extension-host"),
    type: "stdio",
    allowed_origins: [`chrome-extension://${CODEX_EXTENSION_ID}/`],
  };

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(originalManifest, null, 2)}\n`, "utf8");

  const installResult = await installNativeHost({ paths });
  const installedManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const launcher = await fs.readFile(installedManifest.path, "utf8");

  assert.equal(installedManifest.name, CODEX_NATIVE_HOST_NAME);
  assert.equal(installedManifest.description, "Codex Control Chrome MCP native messaging host");
  assert.equal(installResult.officialHostPath, originalManifest.path);
  assert.match(launcher, new RegExp(`npx -y ${PACKAGE_NAME}@${PACKAGE_VERSION} --native-host`));

  const backupManifest = JSON.parse(await fs.readFile(installResult.backupPath, "utf8"));
  assert.deepEqual(backupManifest, originalManifest);

  const uninstallResult = await uninstallNativeHost({ paths });
  const restoredManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  assert.equal(uninstallResult.action, "restored");
  assert.deepEqual(restoredManifest, originalManifest);
});

test("installNativeHost prefers the live official host over a stale recorded path", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-control-chrome-mcp-test-"));
  const paths = tmpPaths(root);
  await fs.mkdir(path.dirname(paths.manifestPath), { recursive: true });
  await fs.mkdir(paths.appStateDir, { recursive: true });

  // The current official host (renamed by an update) exists on disk...
  const liveHost = path.join(root, "Codex for Chrome");
  await fs.writeFile(liveHost, "binary", { mode: 0o755 });
  // ...while the previously recorded host path is now gone.
  const staleHost = path.join(root, "extension-host");

  await fs.writeFile(
    paths.manifestPath,
    `${JSON.stringify(officialManifest(liveHost), null, 2)}\n`,
    "utf8",
  );
  const staleBackup = `${paths.manifestPath}.backup-stale`;
  await fs.writeFile(staleBackup, `${JSON.stringify(officialManifest(staleHost), null, 2)}\n`, "utf8");
  await fs.writeFile(
    paths.installStatePath,
    `${JSON.stringify({ officialHostPath: staleHost, backupPath: staleBackup, hostPath: path.join(paths.appStateDir, "old") }, null, 2)}\n`,
    "utf8",
  );

  const result = await installNativeHost({ paths });
  assert.equal(result.officialHostPath, liveHost); // live host wins, stale path dropped
});

test("ensureNativeHostRegistered re-registers a manifest reverted by an update", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-control-chrome-mcp-test-"));
  const paths = tmpPaths(root);

  await installNativeHost({ paths });
  assert.equal((await ensureNativeHostRegistered({ paths })).action, "ok");

  // Simulate Codex reclaiming the manifest after an update.
  const reclaimedHost = path.join(root, "Codex for Chrome");
  await fs.writeFile(reclaimedHost, "binary", { mode: 0o755 });
  await fs.writeFile(
    paths.manifestPath,
    `${JSON.stringify(officialManifest(reclaimedHost), null, 2)}\n`,
    "utf8",
  );

  const result = await ensureNativeHostRegistered({ paths });
  assert.equal(result.action, "re-registered");

  const manifest = JSON.parse(await fs.readFile(paths.manifestPath, "utf8"));
  assert.equal(manifest.description, MANIFEST_DESCRIPTION); // back to our launcher
  assert.equal(manifest.path, result.hostPath);
});

test("ensureNativeHostRegistered skips when nothing was ever installed", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-control-chrome-mcp-test-"));
  const result = await ensureNativeHostRegistered({ paths: tmpPaths(root) });
  assert.equal(result.action, "skip");
});
