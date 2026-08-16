import { fileURLToPath } from "node:url";

export const name = "laobos-performance";
export const inject = ["agentPresets"];

export function installPerformancePresetRoot(agentPresets, rootPath) {
  if (!Array.isArray(agentPresets?.resolvedRoots)) {
    throw new Error("性能模式无法访问 DSH Agent Preset 根目录。 ");
  }

  const existing = agentPresets.resolvedRoots.find(
    (entry) => entry.path === rootPath,
  );
  if (existing) return () => {};

  const entry = { path: rootPath, trust: "system" };
  const userRoot = agentPresets.resolvedRoots.findIndex(
    (candidate) => candidate.trust === "user",
  );
  const insertionIndex = userRoot < 0
    ? agentPresets.resolvedRoots.length
    : userRoot;
  agentPresets.resolvedRoots.splice(insertionIndex, 0, entry);

  return () => {
    const index = agentPresets.resolvedRoots.indexOf(entry);
    if (index >= 0) agentPresets.resolvedRoots.splice(index, 1);
  };
}

export function apply(ctx) {
  const presetRoot = fileURLToPath(new URL("../presets/", import.meta.url));
  ctx.effect(
    () => installPerformancePresetRoot(ctx.agentPresets, presetRoot),
    "laobos-performance: install system preset root",
  );
}
