import { realpathSync } from "node:fs";
import path from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  exportPluginPackage,
  inspectPluginDirectory,
  PluginExporterError,
} from "./exporter.js";

export const name = "laobos-plugin-exporter";
export const inject = ["tools", "systemPrompt"];

const jsonOutput = {
  schema: { type: "json" },
  render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
};

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function workspacePath(root, value, fallback = ".") {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (text.includes("\0") || text.length > 4_096) {
    throw new PluginExporterError("PATH_INVALID", "插件路径无效。", 400);
  }
  const resolved = path.resolve(root, text);
  if (!isInside(root, resolved)) {
    throw new PluginExporterError(
      "WORKSPACE_BOUNDARY",
      "为防止误打包本机隐私，源目录和导出目录必须位于当前工作区。",
      403,
    );
  }
  return resolved;
}

function publicResult(root, value) {
  if (!value?.outputPath) return value;
  return {
    ...value,
    outputRelative: path.relative(root, value.outputPath).replaceAll(path.sep, "/") || ".",
  };
}

export function createPluginExporterRuntime({ workspace = process.cwd() } = {}) {
  const root = realpathSync(path.resolve(workspace));
  const inspect = async (input = {}, signal) => inspectPluginDirectory(
    workspacePath(root, input.sourceDir),
    { allowedRoot: root, signal },
  );
  const exportPackage = async (input = {}, signal) => {
    const sourceDir = workspacePath(root, input.sourceDir);
    const outputDir = input.outputDir
      ? workspacePath(root, input.outputDir)
      : path.join(sourceDir, ".laobos-exports");
    return publicResult(root, await exportPluginPackage({
      sourceDir,
      outputDir,
      outputName: input.outputName,
      overwrite: input.overwrite === true,
      allowedRoot: root,
      signal,
    }));
  };
  return Object.freeze({ exportPackage, inspect, root });
}

export function apply(ctx) {
  const runtime = createPluginExporterRuntime();

  ctx.systemPrompt.section({
    name: "laobos:plugin-export-guidance",
    order: 45,
    text: () => `# DSH 插件包导出规则

用户要求制作或导出 DSH 插件包时，使用 plugin_package_export。先执行 inspect，修复全部结构错误后再执行 export。
该能力只在当前工作区生成 .tar.gz 文件，不会上传、发布或修改劳博士云端市场；导出后由用户在插件管理平台手动上传并选择默认、白名单或自定义分组。
不得用 Shell 绕过敏感文件排除、符号链接限制、工作区边界或体积校验。`,
  });

  ctx.tools.register(defineTool({
    name: "plugin_package_export",
    description: "Inspect a DSH plugin directory or export it as a validated .tar.gz package for manual upload to the Laobos plugin market. This never uploads or publishes anything. Source and output must stay inside the current workspace.",
    parameters: {
      action: { type: "string", required: true, enum: ["inspect", "export"], description: "Use inspect first; export writes the archive." },
      sourceDir: { type: "string", description: "Plugin directory relative to the current workspace; defaults to the workspace root." },
      outputDir: { type: "string", description: "Export directory inside the current workspace; defaults to <plugin>/.laobos-exports." },
      outputName: { type: "string", description: "Optional .tar.gz filename. Defaults to <package-name>-<version>.tar.gz." },
      overwrite: { type: "boolean", description: "Whether to transactionally replace an existing archive with the same name." },
      reason: { type: "string", description: "Required for export; explains why the archive should be written." },
    },
    output: jsonOutput,
    timeoutMs: 180_000,
    execute: async (args, exec) => {
      if (args.action === "inspect") return runtime.inspect(args, exec.signal);
      if (args.action !== "export") {
        throw new PluginExporterError("ACTION_INVALID", `不支持的插件导出操作：${args.action || "空"}。`);
      }
      if (!String(args.reason || "").trim()) {
        throw new PluginExporterError("REASON_REQUIRED", "导出插件包必须说明 reason。");
      }
      return runtime.exportPackage(args, exec.signal);
    },
    isConcurrencySafe: (args) => args.action === "inspect",
  }));

  ctx.on("tools/pre-execute", async (exec, next) => {
    const decision = await next();
    if (decision.kind !== "allow" || exec.name !== "plugin_package_export"
      || exec.arguments?.action !== "export") return decision;
    const args = exec.arguments || {};
    return {
      kind: "ask",
      reason: `Agent 请求把当前工作区内的 DSH 插件导出为 .tar.gz：${args.sourceDir || "."}\n输出目录：${args.outputDir || "<插件目录>/.laobos-exports"}\n原因：${String(args.reason || "未说明")}`,
    };
  });
}
