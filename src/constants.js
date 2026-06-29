import os from "node:os";
import path from "node:path";

export const CODEX_EXTENSION_ID = "hehggadaopoacecdllhhajmbjkdcmajg";
export const CODEX_NATIVE_HOST_NAME = "com.openai.codexextension";
export const BRIDGE_SOCKET_DIR =
  process.platform === "win32" ? "\\\\.\\pipe\\codex-browser-use" : "/tmp/codex-browser-use";
export const BRIDGE_SOCKET_PREFIX = "codex-control-chrome-mcp";
export const APP_STATE_DIR = path.join(os.homedir(), ".codex-control-chrome-mcp");
export const APP_CONFIG_PATH = path.join(APP_STATE_DIR, "config.json");
export const INSTALL_STATE_PATH = path.join(APP_STATE_DIR, "install-state.json");

// Chromium browsers that ship the Codex extension and use the same Native
// Messaging mechanism. Edge installs Chrome Web Store extensions under the
// same `chrome-extension://<id>` origin, so one manifest works for both.
export const DEFAULT_BROWSER = "chrome";
export const SUPPORTED_BROWSERS = ["chrome", "edge"];

// Per-platform location of each browser's user profile directory. The Native
// Messaging host manifest lives in a `NativeMessagingHosts` subdirectory, and
// the profile directory's existence is our "is this browser installed" signal.
// (On Windows native hosts are registered through the registry, not a file in
// this directory, which is why Windows is unsupported for now.)
const BROWSER_PROFILE_SEGMENTS = {
  chrome: {
    darwin: ["Library", "Application Support", "Google", "Chrome"],
    linux: [".config", "google-chrome"],
    win32: ["AppData", "Local", "Google", "Chrome"],
  },
  edge: {
    darwin: ["Library", "Application Support", "Microsoft Edge"],
    linux: [".config", "microsoft-edge"],
    win32: ["AppData", "Local", "Microsoft", "Edge"],
  },
};

export function browserProfileDir(browser = DEFAULT_BROWSER) {
  const perPlatform = BROWSER_PROFILE_SEGMENTS[browser];
  if (!perPlatform) {
    throw new Error(`Unsupported browser: ${browser}`);
  }
  const segments = perPlatform[process.platform];
  if (!segments) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  return path.join(os.homedir(), ...segments);
}

export function nativeHostManifestPath(browser = DEFAULT_BROWSER) {
  return path.join(
    browserProfileDir(browser),
    "NativeMessagingHosts",
    `${CODEX_NATIVE_HOST_NAME}.json`,
  );
}

// Chrome keeps the original unsuffixed state filenames so installs from before
// multi-browser support remain valid; other browsers get a per-browser suffix
// so a second install never clobbers the first one's restore/self-heal metadata.
export function configPathFor(browser = DEFAULT_BROWSER) {
  return browser === DEFAULT_BROWSER
    ? APP_CONFIG_PATH
    : path.join(APP_STATE_DIR, `config.${browser}.json`);
}

export function installStatePathFor(browser = DEFAULT_BROWSER) {
  return browser === DEFAULT_BROWSER
    ? INSTALL_STATE_PATH
    : path.join(APP_STATE_DIR, `install-state.${browser}.json`);
}
