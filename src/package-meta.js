import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export const PACKAGE_NAME = packageJson.name;
export const PACKAGE_VERSION = packageJson.version;
