import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { APP_STATE_DIR, CODEX_EXTENSION_ID, CODEX_NATIVE_HOST_NAME } from "../src/constants.js";
import {
  MANIFEST_DESCRIPTION,
  hostPathLooksOfficial,
  inspectHostBinary,
  isOfficialCodexManifest,
  isOurLauncherPath,
  isProjectManifest,
} from "../src/host-identity.js";

const officialManifest = {
  name: CODEX_NATIVE_HOST_NAME,
  description: "Codex chrome native messaging host",
  path: "/Users/x/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/macos/arm64/Codex for Chrome",
  type: "stdio",
  allowed_origins: [`chrome-extension://${CODEX_EXTENSION_ID}/`],
};

test("isOfficialCodexManifest accepts OpenAI's manifest by name + extension origin", () => {
  assert.equal(isOfficialCodexManifest(officialManifest), true);
});

test("isOfficialCodexManifest rejects our own manifest and wrong identifiers", () => {
  assert.equal(isOfficialCodexManifest({ ...officialManifest, description: MANIFEST_DESCRIPTION }), false);
  assert.equal(isOfficialCodexManifest({ ...officialManifest, name: "com.someone.else" }), false);
  assert.equal(isOfficialCodexManifest({ ...officialManifest, allowed_origins: ["chrome-extension://other/"] }), false);
  assert.equal(isOfficialCodexManifest(null), false);
});

test("isProjectManifest detects our description marker and our launcher path", () => {
  assert.equal(isProjectManifest({ description: MANIFEST_DESCRIPTION }), true);
  assert.equal(isProjectManifest({ path: path.join(APP_STATE_DIR, "native-host-launcher") }), true);
  assert.equal(isProjectManifest(officialManifest), false);
});

test("isOurLauncherPath matches files under the app state dir only", () => {
  assert.equal(isOurLauncherPath(path.join(APP_STATE_DIR, "native-host-local-launcher")), true);
  assert.equal(isOurLauncherPath("/Users/x/.codex/plugins/.../Codex for Chrome"), false);
});

test("hostPathLooksOfficial keys on bundle structure, not the binary filename", () => {
  assert.equal(hostPathLooksOfficial(officialManifest.path), true);
  // filename changed across releases (extension-host -> Codex for Chrome): still official
  assert.equal(
    hostPathLooksOfficial(officialManifest.path.replace("Codex for Chrome", "extension-host")),
    true,
  );
  assert.equal(hostPathLooksOfficial("/usr/local/bin/something"), false);
});

test("inspectHostBinary distinguishes shell scripts, real files and missing paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "host-identity-"));
  const script = path.join(root, "launcher.sh");
  await fs.writeFile(script, "#!/usr/bin/env sh\nexec node x\n", { mode: 0o755 });
  assert.equal((await inspectHostBinary(script)).kind, "script");
  assert.equal((await inspectHostBinary(path.join(root, "nope"))).exists, false);
});
