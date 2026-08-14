import { readFileSync } from "node:fs";
import path from "node:path";

export const name = "laobos-imported-context";
export const inject = ["systemPrompt"];

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8").trim();
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function readManifest(dshHome) {
  try {
    return JSON.parse(
      readFileSync(path.join(dshHome, "imports", "pi", "manifest.json"), "utf8"),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

export function renderImportedContext(dshHome, workspace) {
  const importRoot = path.join(dshHome, "imports", "pi");
  const manifest = readManifest(dshHome);
  const sections = [];
  const globalPrompt = readText(path.join(importRoot, "SYSTEM.md"));
  const memory = manifest.memoryEnabled === false
    ? ""
    : readText(path.join(importRoot, "MEMORY.md"));
  const projectPrompt = workspace
    ? readText(path.join(workspace, ".pi", "SYSTEM.md"))
    : "";

  if (globalPrompt) {
    sections.push(`# 劳博士用户系统指令\n\n${globalPrompt}`);
  }
  if (projectPrompt) {
    sections.push(`# 当前项目的 Pi 兼容指令\n\n${projectPrompt}`);
  }
  if (memory) {
    sections.push(
      `# 劳博士长期记忆\n\n以下内容是用户管理的持久上下文；除非用户明确要求，否则不要改写。\n\n${memory}`,
    );
  }

  return sections.join("\n\n");
}

export function apply(ctx) {
  const dshHome = process.env.DSH_HOME;
  if (!dshHome) return;

  ctx.systemPrompt.section({
    name: "laobos:imported-context",
    order: 35,
    text: (context) =>
      renderImportedContext(
        dshHome,
        context.agent?.session.header.cwd || process.cwd(),
      ),
  });
}
