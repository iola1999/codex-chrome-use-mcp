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
import {
  MANIFEST_DESCRIPTION,
  classifyHost,
  inspectHostBinary,
  isOfficialCodexManifest,
  isOurLauncherPath,
  isProjectManifest,
} from "./host-identity.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./package-meta.js";

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

  const officialHostPath = proxy
    ? await resolveOfficialHostPath({ existing, existingIsOurs, previousState, previousBackup, hostPath })
    : null;

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
    binPath: binPath ? path.resolve(binPath) : null,
    launchMode: binPath ? "direct-bin" : "npx-launcher",
    backupPath,
    officialHostPath,
    proxy,
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await fs.writeFile(installStatePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

/**
 * Resolve the genuine OpenAI host to proxy to. Authority order:
 *   1. the live manifest, when it is verifiably OpenAI's (most up to date),
 *   2. the previously recorded official host,
 *   3. the backed-up manifest's path.
 * Self-references and our own launcher are dropped, and a candidate whose file
 * still exists is preferred so a renamed/removed host (e.g. after a Codex
 * update) never gets recorded as the official target.
 */
async function resolveOfficialHostPath({ existing, existingIsOurs, previousState, previousBackup, hostPath }) {
  const candidates = [];
  if (existing?.path && !existingIsOurs && isOfficialCodexManifest(existing)) {
    candidates.push(existing.path);
  }
  if (typeof previousState?.officialHostPath === "string") {
    candidates.push(previousState.officialHostPath);
  }
  if (previousBackup?.path && !isProjectManifest(previousBackup)) {
    candidates.push(previousBackup.path);
  }

  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (resolved === path.resolve(hostPath) || isOurLauncherPath(candidate) || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    unique.push(candidate);
  }

  for (const candidate of unique) {
    if ((await inspectHostBinary(candidate)).exists) return candidate;
  }
  // None of the candidates exist on disk; fall back to the most authoritative
  // one (the live official manifest) for diagnostics rather than inventing null.
  return unique[0] ?? null;
}

/**
 * Idempotently re-assert a previously-established install. Used on stdio
 * startup so a Codex update that reclaims the manifest self-heals without a
 * manual `install-native-host`. Never bootstraps a fresh install silently.
 */
export async function ensureNativeHostRegistered({ paths = defaultInstallPaths() } = {}) {
  const { manifestPath, installStatePath } = paths;
  const state = await readJsonIfExists(installStatePath);
  if (!state || typeof state.hostPath !== "string") {
    return { action: "skip", reason: "not-installed" };
  }

  const manifest = await readJsonIfExists(manifestPath);
  const pointsToUs =
    isProjectManifest(manifest) &&
    typeof manifest?.path === "string" &&
    path.resolve(manifest.path) === path.resolve(state.hostPath);
  const launcherExists = (await inspectHostBinary(state.hostPath)).exists;
  if (pointsToUs && launcherExists) {
    return { action: "ok", reason: "already-registered" };
  }

  const result = await installNativeHost({
    binPath: state.launchMode === "direct-bin" ? state.binPath ?? undefined : undefined,
    proxy: state.proxy !== false,
    paths,
  });
  return {
    action: "re-registered",
    reason: launcherExists ? "manifest-reverted" : "launcher-missing",
    manifestPath,
    hostPath: result.hostPath,
    officialHostPath: result.officialHostPath,
  };
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
  const classification = await classifyHost({ manifest, hostPath: manifest?.path });
  const registered =
    isProjectManifest(manifest) &&
    typeof state?.hostPath === "string" &&
    typeof manifest?.path === "string" &&
    path.resolve(manifest.path) === path.resolve(state.hostPath);
  return { manifestPath, manifest, state, registered, classification };
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
