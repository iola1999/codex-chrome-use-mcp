import fs from "node:fs/promises";
import path from "node:path";
import {
  APP_CONFIG_PATH,
  APP_STATE_DIR,
  CODEX_EXTENSION_ID,
  CODEX_NATIVE_HOST_NAME,
  INSTALL_STATE_PATH,
  nativeHostManifestPath,
} from "./constants.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./package-meta.js";

const MANIFEST_DESCRIPTION = "Codex Control Chrome MCP native messaging host";

export async function installNativeHost({ binPath, proxy = true, paths = defaultInstallPaths() } = {}) {
  const { manifestPath, appStateDir, configPath, installStatePath } = paths;
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir(appStateDir, { recursive: true });

  const hostPath = binPath
    ? await createLocalLauncher(path.resolve(binPath), appStateDir)
    : await createNpxLauncher(appStateDir);
  const existing = await readJsonIfExists(manifestPath);
  const previousState = await readJsonIfExists(installStatePath);
  const previousBackup = previousState?.backupPath
    ? await readJsonIfExists(previousState.backupPath)
    : null;
  const existingIsOurs = isProjectManifest(existing);
  const previousBackupIsOurs = isProjectManifest(previousBackup);
  let backupPath = null;
  if (existing && !existingIsOurs) {
    backupPath = await backupManifest(manifestPath);
  } else if (previousBackup && !previousBackupIsOurs) {
    backupPath = previousState.backupPath;
  }

  let officialHostPath = null;
  if (proxy && previousBackup?.path && !previousBackupIsOurs) {
    officialHostPath = previousBackup.path;
  } else if (
    proxy &&
    typeof previousState?.officialHostPath === "string" &&
    path.resolve(previousState.officialHostPath) !== path.resolve(hostPath)
  ) {
    officialHostPath = previousState.officialHostPath;
  } else if (
    proxy &&
    existing?.path &&
    !existingIsOurs &&
    path.resolve(existing.path) !== path.resolve(hostPath)
  ) {
    officialHostPath = existing.path;
  }

  const manifest = {
    allowed_origins: [`chrome-extension://${CODEX_EXTENSION_ID}/`],
    description: MANIFEST_DESCRIPTION,
    name: CODEX_NATIVE_HOST_NAME,
    path: hostPath,
    type: "stdio",
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const config = {
    installedAt: new Date().toISOString(),
    manifestPath,
    hostPath,
    launchMode: binPath ? "direct-bin" : "npx-launcher",
    backupPath,
    officialHostPath,
    proxy,
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await fs.writeFile(installStatePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export async function uninstallNativeHost({ force = false, paths = defaultInstallPaths() } = {}) {
  const { manifestPath, installStatePath } = paths;
  const state = await readJsonIfExists(installStatePath);
  const manifest = await readJsonIfExists(manifestPath);

  if (!manifest && !state?.backupPath) {
    return { ok: true, action: "noop", manifestPath };
  }

  if (!force && !isProjectManifest(manifest)) {
    throw new Error(
      `Refusing to uninstall because ${manifestPath} does not look like a codex-control-chrome-mcp manifest. Use --force to override.`,
    );
  }

  if (state?.backupPath) {
    await fs.copyFile(state.backupPath, manifestPath);
    return { ok: true, action: "restored", manifestPath, backupPath: state.backupPath };
  }

  await fs.rm(manifestPath, { force: true });
  return { ok: true, action: "removed", manifestPath };
}

export async function nativeHostInstallStatus() {
  const { manifestPath, installStatePath } = defaultInstallPaths();
  const manifest = await readJsonIfExists(manifestPath);
  const state = await readJsonIfExists(installStatePath);
  return { manifestPath, manifest, state };
}

function defaultInstallPaths() {
  return {
    manifestPath: nativeHostManifestPath(),
    appStateDir: APP_STATE_DIR,
    configPath: APP_CONFIG_PATH,
    installStatePath: INSTALL_STATE_PATH,
  };
}

async function backupManifest(manifestPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath)}.backup-${stamp}`,
  );
  await fs.copyFile(manifestPath, backupPath);
  return backupPath;
}

async function createNpxLauncher(appStateDir) {
  if (process.platform === "win32") {
    throw new Error("NPX native host launcher installation is not implemented for Windows yet.");
  }
  const launcherPath = path.join(appStateDir, "native-host-launcher");
  const script = `#!/usr/bin/env sh
exec npx -y ${PACKAGE_NAME}@${PACKAGE_VERSION} --native-host "$@"
`;
  await fs.writeFile(launcherPath, script, { encoding: "utf8", mode: 0o755 });
  await fs.chmod(launcherPath, 0o755);
  return launcherPath;
}

function isProjectManifest(manifest) {
  return manifest?.description === MANIFEST_DESCRIPTION;
}

async function createLocalLauncher(binPath, appStateDir) {
  if (process.platform === "win32") {
    return binPath;
  }
  if (!binPath.endsWith(".js")) {
    return binPath;
  }
  const launcherPath = path.join(appStateDir, "native-host-local-launcher");
  const script = `#!/usr/bin/env sh
exec ${shellQuote(process.execPath)} ${shellQuote(binPath)} "$@"
`;
  await fs.writeFile(launcherPath, script, { encoding: "utf8", mode: 0o755 });
  await fs.chmod(launcherPath, 0o755);
  return launcherPath;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
