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

export function nativeHostManifestPath() {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(
        home,
        "Library",
        "Application Support",
        "Google",
        "Chrome",
        "NativeMessagingHosts",
        `${CODEX_NATIVE_HOST_NAME}.json`,
      );
    case "linux":
      return path.join(
        home,
        ".config",
        "google-chrome",
        "NativeMessagingHosts",
        `${CODEX_NATIVE_HOST_NAME}.json`,
      );
    case "win32":
      return path.join(
        home,
        "AppData",
        "Local",
        "Google",
        "Chrome",
        "NativeMessagingHosts",
        `${CODEX_NATIVE_HOST_NAME}.json`,
      );
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
