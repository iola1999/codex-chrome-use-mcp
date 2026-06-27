import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { APP_STATE_DIR, CODEX_EXTENSION_ID, CODEX_NATIVE_HOST_NAME } from "./constants.js";

// Description we stamp on manifests we own. Used as one (not the only) signal.
export const MANIFEST_DESCRIPTION = "Codex Control Chrome MCP native messaging host";

/** A manifest this project wrote (description marker, or path inside our state dir). */
export function isProjectManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  if (manifest.description === MANIFEST_DESCRIPTION) return true;
  return isOurLauncherPath(manifest.path);
}

/** True when a host path points at a launcher we generated under APP_STATE_DIR. */
export function isOurLauncherPath(hostPath) {
  if (typeof hostPath !== "string" || hostPath.length === 0) return false;
  const resolved = path.resolve(hostPath);
  const stateRoot = path.resolve(APP_STATE_DIR) + path.sep;
  return resolved === path.resolve(APP_STATE_DIR) || resolved.startsWith(stateRoot);
}

/**
 * Positive identification of OpenAI's genuine Codex native-host *manifest*,
 * using stable identifiers (host name + the official extension id) rather than
 * the binary filename (which OpenAI has renamed across releases).
 */
export function isOfficialCodexManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  if (isProjectManifest(manifest)) return false;
  if (manifest.name !== CODEX_NATIVE_HOST_NAME) return false;
  const origins = Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [];
  return origins.some((origin) => originMatchesCodexExtension(origin));
}

function originMatchesCodexExtension(origin) {
  return typeof origin === "string" && origin.includes(`chrome-extension://${CODEX_EXTENSION_ID}`);
}

/** Stable directory-structure signature of the bundled Codex host (filename-agnostic). */
export function hostPathLooksOfficial(hostPath) {
  if (typeof hostPath !== "string" || hostPath.length === 0) return false;
  const normalized = path.resolve(hostPath).split(path.sep).join("/").toLowerCase();
  return normalized.includes("/openai-bundled/") && normalized.includes("/extension-host/");
}

const MAGIC = {
  "7f454c46": "elf", // ELF
  feedface: "macho", // Mach-O 32 LE
  feedfacf: "macho", // Mach-O 64 LE
  cefaedfe: "macho", // Mach-O 32 BE
  cffaedfe: "macho", // Mach-O 64 BE
  cafebabe: "macho", // universal (fat) — also Java .class, acceptable for a host binary
  bebafeca: "macho",
};

/** Inspect the host file: does it exist, is it a compiled binary or a shell script? */
export async function inspectHostBinary(hostPath) {
  if (typeof hostPath !== "string" || hostPath.length === 0) {
    return { exists: false, kind: "missing", executable: false };
  }
  let handle;
  try {
    const stat = await fs.stat(hostPath);
    if (!stat.isFile()) return { exists: true, kind: "unknown", executable: false };
    handle = await fs.open(hostPath, "r");
    const buf = Buffer.alloc(4);
    const { bytesRead } = await handle.read(buf, 0, 4, 0);
    const head = buf.subarray(0, bytesRead);
    let kind = "unknown";
    if (head.length >= 2 && head[0] === 0x23 && head[1] === 0x21) kind = "script"; // #!
    else if (head.length === 4 && MAGIC[head.toString("hex")]) kind = MAGIC[head.toString("hex")];
    else if (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a) kind = "pe"; // MZ
    return { exists: true, kind, executable: (stat.mode & 0o111) !== 0 };
  } catch {
    return { exists: false, kind: "missing", executable: false };
  } finally {
    await handle?.close().catch(() => {});
  }
}

/** Best-effort macOS code-signature check; the strongest OpenAI signal when available. */
export function verifyOpenAiCodesign(hostPath) {
  if (process.platform !== "darwin" || typeof hostPath !== "string" || !hostPath) {
    return Promise.resolve({ available: false });
  }
  return new Promise((resolve) => {
    execFile("codesign", ["-dvvv", hostPath], { timeout: 4000 }, (error, stdout, stderr) => {
      const out = `${stdout || ""}${stderr || ""}`; // codesign -d writes to stderr
      if (!out) return resolve({ available: false, error: error?.message });
      const teamId = (out.match(/TeamIdentifier=(\S+)/) || [])[1] || null;
      const authority = (out.match(/Authority=([^\r\n]+)/) || [])[1] || null;
      const openai = /openai/i.test(out);
      resolve({ available: true, signed: Boolean(authority), openai, teamId, authority });
    });
  });
}

/**
 * Full classification of a (manifest, hostPath) pair against stable signals.
 * `trustedOfficial` means: looks like OpenAI's real host and is safe to back up /
 * proxy to. We require the manifest-level identity plus at least one host-level
 * signal (bundle path, compiled binary, or an OpenAI code signature).
 */
export async function classifyHost({ manifest, hostPath } = {}) {
  const resolvedPath = hostPath ?? manifest?.path ?? null;
  const ours = isProjectManifest(manifest) || isOurLauncherPath(resolvedPath);
  const officialManifest = isOfficialCodexManifest(manifest);
  const pathOfficial = hostPathLooksOfficial(resolvedPath);
  const binary = await inspectHostBinary(resolvedPath);
  const codesign = await verifyOpenAiCodesign(resolvedPath);

  const hostSignal = pathOfficial || codesign.openai === true || binary.kind === "macho" || binary.kind === "elf";
  const trustedOfficial = !ours && officialManifest && hostSignal;

  return {
    ours,
    officialManifest,
    pathOfficial,
    binary,
    codesign,
    trustedOfficial,
    kind: ours ? "ours" : trustedOfficial ? "official-openai" : "unknown",
  };
}
