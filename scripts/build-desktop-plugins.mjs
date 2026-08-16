#!/usr/bin/env node

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = [
  ["packages/laobos-shell/src/client.jsx", "packages/laobos-shell/lib/client.js"],
  ["packages/laobos-file-attachments/src/client.jsx", "packages/laobos-file-attachments/lib/client.js"],
  ["packages/laobos-workspace-tools/src/client.jsx", "packages/laobos-workspace-tools/lib/client.js"],
  ["packages/laobos-terminal-ui/src/client.jsx", "packages/laobos-terminal-ui/lib/client.js"],
  ["packages/laobos-ssh/src/client.jsx", "packages/laobos-ssh/lib/client.js"],
  ["packages/laobos-app-manager/src/client.jsx", "packages/laobos-app-manager/lib/client.js"],
];

for (const [entry, output] of entries) {
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: path.join(root, output),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome132"],
    charset: "utf8",
    jsx: "transform",
    // Every client plugin owns its React binding inside the DSH module factory.
    // Compiling JSX to an unbound `h(...)` makes the plugin mount successfully
    // and then crash on its first visible render.
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    tsconfigRaw: { compilerOptions: { jsx: "react" } },
    loader: { ".css": "text" },
    banner: {
      js: "/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */",
    },
    legalComments: "none",
    sourcemap: false,
  });
}
