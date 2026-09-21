#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "sbom");
fs.mkdirSync(outDir, { recursive: true });

function run(args) {
  const result = spawnSync("pnpm", args, { stdio: "inherit", cwd: root });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([
  "sbom",
  "--lockfile-only",
  "--sbom-format",
  "cyclonedx",
  "--sbom-type",
  "application",
  "--sbom-spec-version",
  "1.6",
  "--out",
  "sbom/cyclonedx.json",
]);
run([
  "sbom",
  "--lockfile-only",
  "--sbom-format",
  "spdx",
  "--sbom-type",
  "application",
  "--out",
  "sbom/spdx.json",
]);

for (const file of ["cyclonedx.json", "spdx.json"]) {
  const full = path.join(outDir, file);
  const digest = createHash("sha256").update(fs.readFileSync(full)).digest("hex");
  fs.writeFileSync(path.join(outDir, `${file}.sha256`), `${digest}  ${file}\n`);
  console.log(`Wrote ${full}`);
}
