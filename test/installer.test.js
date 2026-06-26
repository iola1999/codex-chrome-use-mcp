import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CODEX_EXTENSION_ID, CODEX_NATIVE_HOST_NAME } from "../src/constants.js";
import { installNativeHost, uninstallNativeHost } from "../src/installer.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/package-meta.js";

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
