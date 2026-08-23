#!/usr/bin/env node

import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = [
  ["packages/laobos-performance/src/client.jsx", "packages/laobos-performance/lib/client.js"],
  ["packages/laobos-context-window/src/client.jsx", "packages/laobos-context-window/lib/client.js"],
  ["packages/laobos-platform-bridge/src/client.js", "packages/laobos-platform-bridge/lib/client.js"],
  ["packages/laobos-shell/src/client.jsx", "packages/laobos-shell/lib/client.js"],
  ["packages/laobos-file-attachments/src/client.jsx", "packages/laobos-file-attachments/lib/client.js"],
  ["packages/laobos-workspace-tools/src/client.jsx", "packages/laobos-workspace-tools/lib/client.js"],
  ["packages/laobos-browserops/src/client.jsx", "packages/laobos-browserops/lib/client.js"],
  ["packages/laobos-terminal-ui/src/client.jsx", "packages/laobos-terminal-ui/lib/client.js"],
  ["packages/laobos-ssh/src/client.jsx", "packages/laobos-ssh/lib/client.js"],
  ["packages/laobos-app-manager/src/client.jsx", "packages/laobos-app-manager/lib/client.js"],
  ["packages/laobos-updater/src/client.jsx", "packages/laobos-updater/lib/client.js"],
];

for (const [entry, output] of entries) {
  const outputPath = path.join(root, output);
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: outputPath,
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
    ...(entry.includes("laobos-performance") ? {
      define: { "process.env.NODE_ENV": '"production"' },
    } : {}),
    ...(entry.includes("laobos-platform-bridge") ? {} : {
      banner: {
        js: entry.includes("laobos-workspace-tools")
          ? "/* eslint-disable @next/next/no-assign-module-variable, @typescript-eslint/no-this-alias -- generated DSH module factory */"
          : "/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */",
      },
    }),
    legalComments: "none",
    sourcemap: false,
  });

  const generated = await readFile(outputPath, "utf8");
  const normalized = generated.replace(/[\t ]+$/gmu, "");
  if (normalized !== generated) await writeFile(outputPath, normalized);
}
