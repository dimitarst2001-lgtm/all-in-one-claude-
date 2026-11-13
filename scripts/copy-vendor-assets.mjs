#!/usr/bin/env node
/**
 * Copies the MapLibre web worker into /public so the browser can load it.
 * MapLibre 6 loads its worker from a separate module file, which bundlers do
 * not emit automatically. The file name carries the version so it can be
 * cached forever. Runs on `postinstall`.
 */
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));

const outDir = join(root, "public", "vendor");
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
  if (file.startsWith("maplibre-gl-worker-")) rmSync(join(outDir, file));
}
copyFileSync(
  join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"),
  join(outDir, `maplibre-gl-worker-${version}.mjs`),
);
console.log(`copied maplibre-gl worker ${version} to public/vendor`);
