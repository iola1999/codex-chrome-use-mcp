import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_CONFIG_PATH,
  CODEX_NATIVE_HOST_NAME,
  INSTALL_STATE_PATH,
  SUPPORTED_BROWSERS,
  browserProfileDir,
  configPathFor,
  installStatePathFor,
  nativeHostManifestPath,
} from "../src/constants.js";

test("chrome and edge are both supported", () => {
  assert.deepEqual(SUPPORTED_BROWSERS, ["chrome", "edge"]);
});

test("nativeHostManifestPath defaults to chrome and differs per browser", () => {
  assert.equal(nativeHostManifestPath(), nativeHostManifestPath("chrome"));
  const chrome = nativeHostManifestPath("chrome");
  const edge = nativeHostManifestPath("edge");
  assert.notEqual(chrome, edge);
  for (const manifest of [chrome, edge]) {
    assert.ok(manifest.endsWith(`${CODEX_NATIVE_HOST_NAME}.json`));
    assert.ok(manifest.endsWith(`NativeMessagingHosts/${CODEX_NATIVE_HOST_NAME}.json`));
  }
});

test("browserProfileDir points at the matching browser directory", () => {
  assert.match(browserProfileDir("chrome").toLowerCase(), /chrome/);
  assert.match(browserProfileDir("edge").toLowerCase(), /edge/);
  assert.notEqual(browserProfileDir("chrome"), browserProfileDir("edge"));
});

test("chrome keeps the legacy unsuffixed state filenames for back-compat", () => {
  assert.equal(installStatePathFor("chrome"), INSTALL_STATE_PATH);
  assert.equal(configPathFor("chrome"), APP_CONFIG_PATH);
  assert.ok(installStatePathFor("chrome").endsWith("install-state.json"));
  assert.ok(configPathFor("chrome").endsWith("config.json"));
});

test("edge gets its own state files so it never clobbers chrome", () => {
  assert.ok(installStatePathFor("edge").endsWith("install-state.edge.json"));
  assert.ok(configPathFor("edge").endsWith("config.edge.json"));
  assert.notEqual(installStatePathFor("edge"), installStatePathFor("chrome"));
  assert.notEqual(configPathFor("edge"), configPathFor("chrome"));
});

test("unsupported browsers are rejected", () => {
  assert.throws(() => browserProfileDir("firefox"), /Unsupported browser/);
  assert.throws(() => nativeHostManifestPath("safari"), /Unsupported browser/);
});
