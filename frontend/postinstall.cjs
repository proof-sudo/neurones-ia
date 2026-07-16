#!/usr/bin/env node
// Re-applies the SWC options patch after every npm install.
// Root cause: dynamicIoEnabled was emitted as undefined → omitted by JSON.stringify
// → SWC Rust struct fails serde deserialization (required bool field missing).
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "node_modules/next/dist/build/swc/options.js"
);

let src = fs.readFileSync(target, "utf8");

const before = "dynamicIoEnabled: isDynamicIo,";
const after  = "dynamicIoEnabled: isDynamicIo ?? false,";

if (src.includes(before)) {
  src = src.replace(before, after);
  fs.writeFileSync(target, src, "utf8");
  console.log("[postinstall] SWC options patch applied.");
} else if (src.includes(after)) {
  console.log("[postinstall] SWC options patch already present — skipped.");
} else {
  console.warn("[postinstall] WARNING: patch target not found in options.js — Next.js version may have changed.");
}
