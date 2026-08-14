"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  Handle,
  MarkerType,
  Node,
  NodeChange,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChangeEvent, DragEvent, FormEvent, Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ApiFetch = (pathname: string, init?: RequestInit) => Promise<Response>;
type WorkflowNodeType =
  | "input"
  | "llm"
  | "knowledge-search"
  | "template"
  | "if-else"
  | "question-classifier"
  | "parameter-extractor"
  | "variable-assigner"
  | "variable-aggregator"
  | "list-operator"
  | "http-request"
  | "tool"
  | "code"
  | "iteration"
  | "loop"
  | "output";
type FieldType = "string" | "number" | "boolean" | "object" | "array" | "file" | "any";
type ErrorMode = "stop" | "default-value" | "fail-branch";

type WorkflowField = {
  name: string;
  label?: string;
  description?: string;
  type: FieldType;
  required?: boolean;
  default?: unknown;
  options?: string[];
};

type WorkflowNodeData = Record<string, unknown> & {
  label: string;
  workflowType: WorkflowNodeType;
  fields?: WorkflowField[];
  template?: string;
  query?: string;
  collectionId?: string;
  topK?: number;
  retrievalMode?: "inherit" | "fast" | "smart";
  prompt?: string;
  systemPrompt?: string;
  outputSchema?: WorkflowField[];
  conditions?: Array<{ left: unknown; operator: string; right?: unknown }>;
  logicalOperator?: "and" | "or";
  input?: unknown;
  classes?: Array<{ id: string; name: string; description?: string }>;
  instruction?: string;
  parameters?: WorkflowField[];
  assignments?: Array<{ name: string; value: unknown }>;
  variables?: unknown[];
  operation?: "filter" | "sort" | "slice" | "first" | "last" | "join" | "length";
  condition?: { left: unknown; operator: string; right?: unknown };
  field?: string;
  direction?: "asc" | "desc";
  start?: number;
  end?: number;
  separator?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  timeoutMs?: number;
  toolName?: string;
  arguments?: Record<string, unknown>;
  code?: string;
  definition?: WorkflowDefinition;
  parallel?: boolean;
  maxConcurrency?: number;
  failureMode?: "terminated" | "continue-on-error" | "remove-abnormal-output";
  initialVariables?: Record<string, unknown>;
  maxIterations?: number;
  value?: unknown;
  outputs?: Array<{ name: string; value: unknown }>;
  errorPolicy?: { mode: ErrorMode; defaultValue?: unknown };
  resultState?: "success" | "failed" | "skipped" | "running" | "idle";
  resultElapsedMs?: number;
  selectedHandle?: string;
  resultPreview?: string;
};

type WorkflowNode = Node<WorkflowNodeData>;
type WorkflowDefinition = {
  version?: 2;
  nodes: Array<Record<string, unknown> & { id: string; type: WorkflowNodeType; label?: string }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
};
type Workflow = {
  id: string;
	revision: string;
  name: string;
  description: string;
  toolName: string;
  definition: WorkflowDefinition;
  publishedVersion?: number;
  publishedAt?: string;
  updatedAt: string;
};
type KnowledgeCollection = { id: string; name: string; retrievalMode: "fast" | "smart" };
type WorkflowTrace = {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: "succeeded" | "failed" | "skipped";
  elapsedMs: number;
  input?: unknown;
  output?: unknown;
  selectedHandle?: string;
  error?: { code: string; message: string };
};
type WorkflowRun = { output: unknown; nodeOutputs: Record<string, unknown>; trace?: WorkflowTrace[] };
type VariableOption = { token: string; label: string; group: string; preview?: string };

const nodeMeta: Record<WorkflowNodeType, { label: string; icon: string; hint: string; group: string }> = {
  input: { label: "用户输入", icon: "↗", hint: "定义 Agent 工具参数", group: "入口与输出" },
  output: { label: "输出", icon: "✓", hint: "定义工具返回结果", group: "入口与输出" },
  llm: { label: "LLM", icon: "✦", hint: "生成与结构化输出", group: "AI" },
  "question-classifier": { label: "问题分类器", icon: "◇", hint: "按类别路由分支", group: "AI" },
  "parameter-extractor": { label: "参数提取器", icon: "{}", hint: "自然语言转结构化数据", group: "AI" },
  "knowledge-search": { label: "知识库检索", icon: "⌕", hint: "检索本地知识库", group: "知识与工具" },
  tool: { label: "工具", icon: "⌘", hint: "调用已发布工具", group: "知识与工具" },
  "http-request": { label: "HTTP 请求", icon: "↔", hint: "调用 Web API", group: "知识与工具" },
  "if-else": { label: "IF/ELSE", icon: "⑂", hint: "条件分支", group: "逻辑" },
  iteration: { label: "迭代", icon: "∞", hint: "逐项执行子流程", group: "逻辑" },
  loop: { label: "循环", icon: "↻", hint: "满足条件时重复", group: "逻辑" },
  template: { label: "文本模板", icon: "T", hint: "组合文本与变量", group: "数据处理" },
  "variable-assigner": { label: "变量赋值", icon: "=", hint: "写入工作流变量", group: "数据处理" },
  "variable-aggregator": { label: "变量聚合", icon: "⋈", hint: "汇聚互斥分支", group: "数据处理" },
  "list-operator": { label: "列表操作", icon: "≡", hint: "筛选、排序或切片", group: "数据处理" },
  code: { label: "代码", icon: "</>", hint: "运行 JavaScript 数据处理", group: "数据处理" },
};

const paletteTypes: WorkflowNodeType[] = [
  "llm",
  "question-classifier",
  "parameter-extractor",
  "knowledge-search",
  "tool",
  "http-request",
  "if-else",
  "iteration",
  "loop",
  "template",
  "variable-assigner",
  "variable-aggregator",
  "list-operator",
  "code",
];
const conditionOperators = [
  ["equals", "等于"],
  ["not-equals", "不等于"],
  ["contains", "包含"],
  ["not-contains", "不包含"],
  ["greater-than", "大于"],
  ["greater-than-or-equal", "大于等于"],
  ["less-than", "小于"],
  ["less-than-or-equal", "小于等于"],
  ["is-empty", "为空"],
  ["is-not-empty", "不为空"],
  ["exists", "存在"],
  ["not-exists", "不存在"],
] as const;

const emptySubflow = (): WorkflowDefinition => ({
  version: 2,
  nodes: [
    { id: "input", type: "input", position: { x: 40, y: 100 } },
    { id: "output", type: "output", value: "{{input.item}}", position: { x: 330, y: 100 } },
  ],
  edges: [{ id: "input-output", source: "input", target: "output" }],
});

function initialData(type: WorkflowNodeType): WorkflowNodeData {
  const base = { label: nodeMeta[type].label, workflowType: type, errorPolicy: { mode: "stop" as const } };
  switch (type) {
    case "input": return { ...base, fields: [{ name: "query", label: "用户问题", type: "string", required: true }] };
    case "output": return { ...base, value: "{{previous}}" };
    case "llm": return { ...base, prompt: "请处理以下内容：\n{{previous}}", systemPrompt: "" };
    case "knowledge-search": return { ...base, query: "{{input.query}}", collectionId: "", topK: 5, retrievalMode: "inherit" };
    case "template": return { ...base, template: "{{previous}}" };
    case "if-else": return { ...base, conditions: [{ left: "{{previous}}", operator: "is-not-empty", right: "" }], logicalOperator: "and" };
    case "question-classifier": return { ...base, input: "{{input.query}}", instruction: "判断用户问题属于哪一类", classes: [{ id: "general", name: "普通问题" }, { id: "other", name: "其他" }] };
    case "parameter-extractor": return { ...base, input: "{{input.query}}", instruction: "提取以下参数", parameters: [{ name: "result", label: "结果", type: "string", required: true }] };
    case "variable-assigner": return { ...base, assignments: [{ name: "value", value: "{{previous}}" }] };
    case "variable-aggregator": return { ...base, variables: ["{{previous}}"] };
    case "list-operator": return { ...base, input: "{{previous}}", operation: "first", separator: "\n" };
    case "http-request": return { ...base, method: "GET", url: "https://", headers: {}, timeoutMs: 30000 };
    case "tool": return { ...base, toolName: "knowledge_search", arguments: { query: "{{input.query}}" } };
    case "code": return { ...base, code: "return previous;" };
    case "iteration": return { ...base, input: "{{previous}}", definition: emptySubflow(), parallel: false, maxConcurrency: 4, failureMode: "terminated" };
    case "loop": return { ...base, initialVariables: {}, condition: { left: "{{loop.done}}", operator: "not-equals", right: true }, definition: emptySubflow(), maxIterations: 10 };
  }
}

const defaultNodes: WorkflowNode[] = [
  { id: "input", type: "workflow-card", position: { x: 90, y: 190 }, data: initialData("input") },
  { id: "output", type: "workflow-card", position: { x: 540, y: 190 }, data: initialData("output") },
];
const defaultEdges: Edge[] = [{ id: "input-output", source: "input", target: "output", markerEnd: { type: MarkerType.ArrowClosed } }];

function sourceHandles(data: WorkflowNodeData): Array<{ id: string; label: string }> {
  if (data.workflowType === "if-else") return [{ id: "true", label: "IF" }, { id: "false", label: "ELSE" }];
  if (data.workflowType === "question-classifier") return (data.classes || []).map((item) => ({ id: `case:${item.id}`, label: item.name }));
  if (data.errorPolicy?.mode === "fail-branch") return [{ id: "success", label: "成功" }, { id: "error", label: "失败" }];
  return data.workflowType === "output" ? [] : [{ id: "success", label: "" }];
}

function compactValue(value: unknown, maximum = 62): string {
  const text = typeof value === "string" ? value : displayJson(value);
  const oneLine = text.replace(/\s+/gu, " ").trim();
  return oneLine.length > maximum ? `${oneLine.slice(0, maximum - 1)}…` : oneLine;
}

function nodeSummary(data: WorkflowNodeData): string {
  switch (data.workflowType) {
    case "input": return `${data.fields?.length || 0} 个工具输入字段`;
    case "output": return `返回 ${compactValue(data.value ?? "{{previous}}", 44)}`;
    case "llm": return compactValue(data.prompt || "等待配置提示词");
    case "knowledge-search": return `查询 ${compactValue(data.query || "{{input.query}}", 42)} · Top ${data.topK || 5}`;
    case "template": return compactValue(data.template || "{{previous}}");
    case "if-else": return `${data.conditions?.length || 0} 个条件 · ${(data.logicalOperator || "and").toUpperCase()}`;
    case "question-classifier": return `${data.classes?.length || 0} 个分类出口`;
    case "parameter-extractor": return `提取 ${data.parameters?.length || 0} 个参数`;
    case "variable-assigner": return `写入 ${data.assignments?.length || 0} 个变量`;
    case "variable-aggregator": return `聚合 ${data.variables?.length || 0} 个候选值`;
    case "list-operator": return `${data.operation || "first"} · ${compactValue(data.input || "{{previous}}", 38)}`;
    case "http-request": return `${data.method || "GET"} ${compactValue(data.url || "https://", 45)}`;
    case "tool": return `调用 ${data.toolName || "未选择工具"}`;
    case "code": return compactValue(data.code || "return previous;");
    case "iteration": return `${data.parallel ? "并行" : "顺序"}处理 ${compactValue(data.input || "{{previous}}", 36)}`;
    case "loop": return `最多循环 ${data.maxIterations || 10} 次`;
  }
}

function expectedOutputFields(data: WorkflowNodeData): string[] {
  switch (data.workflowType) {
    case "input": return (data.fields || []).map((field) => field.name);
    case "llm": return (data.outputSchema || []).map((field) => field.name);
    case "knowledge-search": return ["0.title", "0.content", "0.score", "0.documentId", "0.collectionId"];
    case "if-else": return ["matched"];
    case "question-classifier": return ["classId", "className"];
    case "parameter-extractor": return (data.parameters || []).map((field) => field.name);
    case "variable-assigner": return (data.assignments || []).map((item) => item.name);
    case "http-request": return ["status", "headers", "body"];
    case "loop": return ["iterations"];
    default: return [];
  }
}

function valuePaths(value: unknown, prefix = "", depth = 0): string[] {
  if (depth > 2 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return valuePaths(value[0], prefix ? `${prefix}.0` : "0", depth + 1);
  }
  if (typeof value !== "object") return prefix ? [prefix] : [];
  const paths: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 24)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    paths.push(...valuePaths(item, path, depth + 1));
  }
  return [...new Set(paths)].slice(0, 40);
}

function upstreamNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]);
  const result = new Set<string>();
  const queue = [...(incoming.get(nodeId) || [])];
  while (queue.length) {
    const current = queue.shift();
    if (!current || result.has(current)) continue;
    result.add(current);
    queue.push(...(incoming.get(current) || []));
  }
  return result;
}

function formatWorkflowDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚更新";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function codeVariableToken(token: string): string {
  return token.replace(/^\{\{|\}\}$/gu, "").replace(/\.(\d+)(?=\.|$)/gu, "[$1]");
}

function WorkflowCard({ data, selected }: NodeProps<WorkflowNode>) {
  const meta = nodeMeta[data.workflowType];
  const handles = sourceHandles(data);
  return (
    <div className={`workflow-node-card node-${data.workflowType} ${selected ? "is-selected" : ""} is-${data.resultState || "idle"}`}>
      {data.workflowType !== "input" ? <Handle id="input" type="target" position={Position.Left} /> : null}
      <div className="workflow-node-header-row">
        <div className="workflow-node-icon">{meta.icon}</div>
        <div className="workflow-node-copy">
          <small>{meta.label}</small>
          <strong>{data.label || meta.label}</strong>
        </div>
        {data.resultState === "success" ? <span className="workflow-node-ok">✓</span> : null}
        {data.resultState === "skipped" ? <span className="workflow-node-skip">—</span> : null}
        {data.resultState === "running" ? <span className="workflow-node-running">•••</span> : null}
      </div>
      <div className="workflow-node-summary">{nodeSummary(data)}</div>
      <div className={`workflow-node-result is-${data.resultState || "idle"}`}>
        <span>{data.resultState === "success" ? "完成" : data.resultState === "failed" ? "失败" : data.resultState === "skipped" ? "跳过" : data.resultState === "running" ? "运行中" : "未运行"}</span>
        <small>{data.resultPreview || (data.selectedHandle ? `出口 ${data.selectedHandle}` : "运行后在此显示结果")}</small>
        {typeof data.resultElapsedMs === "number" ? <em>{data.resultElapsedMs}ms</em> : null}
      </div>
      {handles.map((handle, index) => (
        <div className="workflow-source-handle" style={{ top: `${((index + 1) * 100) / (handles.length + 1)}%` }} key={handle.id}>
          {handle.label ? <span>{handle.label}</span> : null}
          <Handle id={handle.id} type="source" position={Position.Right} />
        </div>
      ))}
    </div>
  );
}

const nodeTypes = { "workflow-card": WorkflowCard };
const cloneDefaults = () => defaultNodes.map((node) => ({ ...node, position: { ...node.position }, data: structuredClone(node.data) }));
const cloneEdges = () => defaultEdges.map((edge) => ({ ...edge }));
const displayJson = (value: unknown) => { try { return JSON.stringify(value, null, 2); } catch { return String(value); } };
const parseJson = (value: string, fallback: unknown): unknown => { try { return JSON.parse(value); } catch { return fallback; } };

function editorNode(node: WorkflowDefinition["nodes"][number], index: number): WorkflowNode {
  const type = node.type;
  const position = node.position;
  const resolvedPosition = position && typeof position === "object" && "x" in position && "y" in position && typeof position.x === "number" && typeof position.y === "number"
    ? { x: position.x, y: position.y }
    : { x: 80 + index * 250, y: 180 + (index % 2) * 80 };
  const defaults = initialData(type);
  if (type === "input" && !Array.isArray(node.fields)) defaults.fields = [];
  return {
    id: node.id,
    type: "workflow-card",
    position: resolvedPosition,
    data: { ...defaults, ...Object.fromEntries(Object.entries(node).filter(([key]) => !["id", "type", "position"].includes(key))), label: node.label || defaults.label, workflowType: type },
  };
}

function JsonEditor({ label, value, onChange, placeholder, options, editorId, onValidityChange }: { label: string; value: unknown; onChange: (value: unknown) => void; placeholder?: string; options?: VariableOption[]; editorId: string; onValidityChange: (editorId: string, valid: boolean) => void }) {
  const [text, setText] = useState(displayJson(value));
  const [valid, setValid] = useState(true);
  const serialized = displayJson(value);
  const externalValue = useRef(serialized);
  useEffect(() => {
    if (serialized === externalValue.current) return;
    externalValue.current = serialized;
    setText(serialized);
    setValid(true);
  }, [serialized]);
  useEffect(() => { onValidityChange(editorId, valid); }, [editorId, onValidityChange, valid]);
  useEffect(() => () => onValidityChange(editorId, true), [editorId, onValidityChange]);
  function update(next: string) {
    setText(next);
    const parsed = parseJson(next, undefined);
    const nextValid = parsed !== undefined;
    setValid(nextValid);
    if (nextValid) onChange(parsed);
  }
  if (options) return <div className={`json-editor-wrap ${valid ? "" : "is-invalid"}`}><VariableInput label={label} value={text} placeholder={placeholder} options={options} onChange={update} />{valid ? <small className="json-editor-status is-valid">✓ 参数已实时应用</small> : <small className="json-editor-status">JSON 尚未完成，当前修改不会用于运行</small>}</div>;
  return <label className={`field json-editor-wrap ${valid ? "" : "is-invalid"}`}><span>{label}</span><textarea value={text} placeholder={placeholder} onChange={(event) => update(event.target.value)} />{valid ? <small className="json-editor-status is-valid">✓ 参数已实时应用</small> : <small className="json-editor-status">JSON 尚未完成，当前修改不会用于运行</small>}</label>;
}

function VariableInput({ label, value, onChange, options, placeholder, multiline = true, compact = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; options: VariableOption[]; placeholder?: string; multiline?: boolean; compact?: boolean; className?: string }) {
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null);
  const groups = useMemo(() => [...new Set(options.map((option) => option.group))], [options]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!wrapperRef.current?.contains(event.target as globalThis.Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function openFromKey(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key !== "/" && event.key !== "{") return;
    setTriggerPosition(Math.max(0, event.currentTarget.selectionStart ?? value.length) - 1);
    setOpen(true);
  }

  function insertVariable(token: string) {
    const control = controlRef.current;
    const selectionStart = control?.selectionStart ?? value.length;
    const selectionEnd = control?.selectionEnd ?? selectionStart;
    const replaceTrigger = triggerPosition !== null && ["/", "{"].includes(value.charAt(triggerPosition));
    const start = replaceTrigger ? triggerPosition : selectionStart;
    const end = replaceTrigger ? triggerPosition + 1 : selectionEnd;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    setOpen(false);
    setTriggerPosition(null);
    window.requestAnimationFrame(() => { control?.focus(); control?.setSelectionRange(start + token.length, start + token.length); });
  }

  const common = {
    value,
    placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onKeyUp: openFromKey,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (event.key === "Escape") setOpen(false); },
  };
  const captureControl = (element: HTMLInputElement | HTMLTextAreaElement | null) => { controlRef.current = element; };
  return <div ref={wrapperRef} className={`field variable-field ${compact ? "is-compact" : ""} ${className}`}>{compact ? null : <span>{label}</span>}<div className="variable-control">{multiline ? <textarea {...common} ref={captureControl} aria-label={compact ? label : undefined} /> : <input {...common} ref={captureControl} aria-label={compact ? label : undefined} />}<button className={open ? "is-active" : ""} type="button" aria-label={`${label}变量选择`} title="插入之前节点的数据" disabled={!options.length} onClick={() => { setTriggerPosition(null); setOpen((current) => !current); }}>⌄</button>{open ? <div className="variable-menu"><div className="variable-menu-heading"><strong>插入变量</strong><small>来自当前节点之前的数据</small></div>{groups.map((group) => <section key={group}><span>{group}</span>{options.filter((option) => option.group === group).map((option) => <button type="button" key={option.token} onMouseDown={(event) => event.preventDefault()} onClick={() => insertVariable(option.token)}><span><strong>{option.label}</strong><code>{option.token}</code></span>{option.preview ? <em>{option.preview}</em> : null}</button>)}</section>)}</div> : null}</div>{compact ? null : <small className="variable-field-help">输入 <kbd>/</kbd> 或 <kbd>{"{"}</kbd>，也可点击右侧按钮选择之前节点的数据</small>}</div>;
}

function FieldSchemaEditor({ fields, onChange, title = "字段" }: { fields: WorkflowField[]; onChange: (fields: WorkflowField[]) => void; title?: string }) {
  return (
    <div className="schema-editor">
      <div className="schema-heading"><span>{title}</span><button type="button" onClick={() => onChange([...fields, { name: `field_${fields.length + 1}`, label: "新字段", type: "string" }])}>＋ 添加</button></div>
      {fields.map((field, index) => (
        <div className="schema-row" key={index}>
          <input value={field.name} placeholder="变量名" onChange={(event) => onChange(fields.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value.replace(/[^A-Za-z0-9_]/gu, "_") } : item))} />
          <select value={field.type} onChange={(event) => onChange(fields.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as FieldType } : item))}>{(["string", "number", "boolean", "object", "array", "file", "any"] as const).map((type) => <option key={type}>{type}</option>)}</select>
          <label className="schema-required"><input type="checkbox" checked={field.required || false} onChange={(event) => onChange(fields.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} />必填</label>
          <button className="schema-remove" type="button" onClick={() => onChange(fields.filter((_item, itemIndex) => itemIndex !== index))}>×</button>
          <input className="schema-description" value={field.description || ""} placeholder="给 Agent 看的字段说明" onChange={(event) => onChange(fields.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
        </div>
      ))}
    </div>
  );
}

export function Workflows({ apiFetch, connected, onNotify, refreshVersion = 0 }: { apiFetch: ApiFetch; connected: boolean; onNotify: (message: string) => void; refreshVersion?: number }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [knowledgeCollections, setKnowledgeCollections] = useState<KnowledgeCollection[]>([]);
  const [screen, setScreen] = useState<"manager" | "editor">("manager");
  const [managerQuery, setManagerQuery] = useState("");
  const [workflowId, setWorkflowId] = useState("");
	const [workflowRevision, setWorkflowRevision] = useState("");
  const [name, setName] = useState("新工作流");
  const [description, setDescription] = useState("");
  const [toolName, setToolName] = useState("project_workflow");
  const [nodes, setNodes] = useState<WorkflowNode[]>(cloneDefaults);
  const [edges, setEdges] = useState<Edge[]>(cloneEdges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const [selectedNodeId, setSelectedNodeId] = useState("input");
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState('{\n  "query": "请帮我查找相关资料"\n}');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<WorkflowRun | null>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"properties" | "run">("properties");
  const [lastRunLabel, setLastRunLabel] = useState("未运行");
  const [invalidJsonEditors, setInvalidJsonEditors] = useState<Set<string>>(() => new Set());
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowNode, Edge> | null>(null);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId]);
  const activeWorkflow = useMemo(() => workflows.find((workflow) => workflow.id === workflowId), [workflowId, workflows]);
  const variableOptions = useMemo<VariableOption[]>(() => {
    if (!selectedNode) return [];
    const upstream = upstreamNodeIds(selectedNode.id, edges);
    const input = nodes.find((node) => node.data.workflowType === "input");
    const options: VariableOption[] = (input?.data.fields || []).map((field) => ({ token: `{{input.${field.name}}}`, label: field.label || field.name, group: "工作流输入", preview: field.description || field.type }));
    const incoming = edges.filter((edge) => edge.target === selectedNode.id).map((edge) => edge.source);
    if (incoming.length) options.push({ token: "{{previous}}", label: incoming.length === 1 ? "上一步输出" : "前置节点输出集合", group: "快捷引用" });
    for (const node of nodes.filter((item) => upstream.has(item.id) && item.data.workflowType !== "input")) {
      const trace = testResult?.trace?.find((item) => item.nodeId === node.id && item.status === "succeeded");
      const output = trace?.output ?? testResult?.nodeOutputs?.[node.id];
      const paths = output === undefined ? expectedOutputFields(node.data) : valuePaths(output);
      options.push({ token: `{{nodes.${node.id}}}`, label: `${node.data.label} · 完整输出`, group: "之前的节点", preview: output === undefined ? nodeMeta[node.data.workflowType].hint : compactValue(output, 34) });
      for (const path of paths) options.push({ token: `{{nodes.${node.id}.${path}}}`, label: `${node.data.label} · ${path}`, group: "之前的节点", preview: output === undefined ? "预期字段" : compactValue(path.split(".").reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, output), 28) });
    }
    return options.filter((option, index, list) => list.findIndex((item) => item.token === option.token) === index);
  }, [edges, nodes, selectedNode, testResult]);
  const codeVariableOptions = useMemo(() => variableOptions.map((option) => ({ ...option, token: codeVariableToken(option.token) })), [variableOptions]);
  const filteredWorkflows = useMemo(() => workflows.filter((workflow) => `${workflow.name}${workflow.description}${workflow.toolName}`.toLocaleLowerCase().includes(managerQuery.trim().toLocaleLowerCase())), [managerQuery, workflows]);
  const parametersAreValid = invalidJsonEditors.size === 0;
  const onJsonValidityChange = useCallback((editorId: string, valid: boolean) => {
    setInvalidJsonEditors((current) => {
      const contains = current.has(editorId);
      if ((valid && !contains) || (!valid && contains)) return current;
      const next = new Set(current);
      if (valid) next.delete(editorId); else next.add(editorId);
      return next;
    });
  }, []);

	const loadResources = useCallback(async () => {
	  if (!connected) return [];
    const [workflowResponse, knowledgeResponse] = await Promise.all([apiFetch("/api/workflows"), apiFetch("/api/knowledge")]);
    const workflowData = (await workflowResponse.json()) as { workflows?: Workflow[] };
    const knowledgeData = (await knowledgeResponse.json()) as { collections?: KnowledgeCollection[] };
    setWorkflows(workflowData.workflows || []);
    setKnowledgeCollections(knowledgeData.collections || []);
	return workflowData.workflows || [];
  }, [apiFetch, connected]);

	useEffect(() => { const timer = window.setTimeout(() => void loadResources().catch((error) => onNotify(error instanceof Error ? error.message : "工作流加载失败")), 0); return () => window.clearTimeout(timer); }, [loadResources, onNotify]);
	useEffect(() => { nodesRef.current = nodes; }, [nodes]);
	useEffect(() => { edgesRef.current = edges; }, [edges]);
	useEffect(() => {
	  if (refreshVersion === 0) return;
	  const timer = window.setTimeout(() => {
		void loadResources().then((items) => {
		  const latest = items.find((item) => item.id === workflowId);
		  if (workflowId && !latest) onNotify("当前工作流已被 Agent 删除");
		  else if (latest && workflowRevision && latest.revision !== workflowRevision) onNotify("Agent 已修改当前工作流；你的画布草稿已保留，保存前请重新加载");
		}).catch((error) => onNotify(error instanceof Error ? error.message : "工作流刷新失败"));
	  }, 0);
	  return () => window.clearTimeout(timer);
	}, [loadResources, onNotify, refreshVersion, workflowId, workflowRevision]);
  const onNodesChange = useCallback((changes: NodeChange<WorkflowNode>[]) => setNodes((current) => {
    const nextNodes = applyNodeChanges(changes.filter((change) => change.type !== "remove" || !["input", "output"].includes(change.id)), current);
    nodesRef.current = nextNodes;
    return nextNodes;
  }), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((current) => {
    const nextEdges = applyEdgeChanges(changes, current);
    edgesRef.current = nextEdges;
    return nextEdges;
  }), []);
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return false;
    if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target && (edge.sourceHandle || "success") === (connection.sourceHandle || "success"))) return false;
    const outgoing = new Map<string, string[]>();
    for (const edge of edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
    const queue = [connection.target];
    const visited = new Set<string>();
    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      if (current === connection.source) return false;
      visited.add(current);
      queue.push(...(outgoing.get(current) || []));
    }
    return true;
  }, [edges]);
  const onConnect = useCallback((connection: Connection) => {
    if (!isValidConnection(connection)) return;
    setEdges((current) => {
      const nextEdges = addEdge({ ...connection, id: `${connection.source}-${connection.sourceHandle || "success"}-${connection.target}-${Date.now()}`, markerEnd: { type: MarkerType.ArrowClosed }, label: connection.sourceHandle && connection.sourceHandle !== "success" ? connection.sourceHandle.replace("case:", "") : undefined }, current);
      edgesRef.current = nextEdges;
      return nextEdges;
    });
    setTestResult(null);
  }, [isValidConnection]);

  function selectWorkflow(workflow: Workflow) {
	setWorkflowId(workflow.id); setWorkflowRevision(workflow.revision); setName(workflow.name); setDescription(workflow.description); setToolName(workflow.toolName);
    const nextNodes = workflow.definition.nodes.map(editorNode);
    const nextEdges = workflow.definition.edges.map((edge) => ({ ...edge, label: edge.sourceHandle && edge.sourceHandle !== "success" ? edge.sourceHandle.replace("case:", "") : undefined, markerEnd: { type: MarkerType.ArrowClosed } }));
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(workflow.definition.nodes[0]?.id || ""); setTestResult(null); setLastRunLabel("未运行"); setScreen("editor");
  }
	function createWorkflow() { const nextNodes = cloneDefaults(); const nextEdges = cloneEdges(); nodesRef.current = nextNodes; edgesRef.current = nextEdges; setWorkflowId(""); setWorkflowRevision(""); setName("新工作流"); setDescription(""); setToolName(`project_workflow_${workflows.length + 1}`); setNodes(nextNodes); setEdges(nextEdges); setSelectedNodeId("input"); setTestResult(null); setLastRunLabel("未运行"); setScreen("editor"); }
  function addNode(workflowType: Exclude<WorkflowNodeType, "input" | "output">, position?: { x: number; y: number }) {
    const prefix = workflowType.replaceAll("-", "_"); let sequence = nodes.length + 1;
    while (nodes.some((node) => node.id === `${prefix}_${sequence}`)) sequence += 1;
    const id = `${prefix}_${sequence}`;
    const data = initialData(workflowType);
    if (workflowType === "knowledge-search") data.collectionId = knowledgeCollections[0]?.id || "";
    setNodes((current) => {
      const nextNodes = [...current, { id, type: "workflow-card" as const, position: position || { x: 310, y: 80 + current.length * 54 }, data }];
      nodesRef.current = nextNodes;
      return nextNodes;
    });
    setSelectedNodeId(id); setTestResult(null); setInspectorTab("properties");
  }
  function onPaletteDragStart(event: DragEvent<HTMLButtonElement>, workflowType: WorkflowNodeType) {
    event.dataTransfer.setData("application/pi-workflow-node", workflowType);
    event.dataTransfer.effectAllowed = "move";
  }
  function onCanvasDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const workflowType = event.dataTransfer.getData("application/pi-workflow-node") as WorkflowNodeType;
    if (!flowInstance || !paletteTypes.includes(workflowType)) return;
    addNode(workflowType as Exclude<WorkflowNodeType, "input" | "output">, flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: true }));
  }
  function updateSelectedNode(patch: Partial<WorkflowNodeData>) {
    const nextNodes = nodesRef.current.map((node) => node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node);
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    setTestResult(null);
    setLastRunLabel("参数已更新");
  }
  function toDefinition(): WorkflowDefinition {
    const latestNodes = nodesRef.current;
    const latestEdges = edgesRef.current;
    return { version: 2, nodes: latestNodes.map((node) => { const { workflowType, label, ...data } = node.data; const configuration = Object.fromEntries(Object.entries(data).filter(([key]) => !["resultState", "resultElapsedMs", "selectedHandle", "resultPreview"].includes(key))); return { id: node.id, type: workflowType, label, position: node.position, ...configuration }; }), edges: latestEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}), ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}) })) };
  }
  async function saveWorkflow(): Promise<Workflow> {
    setSaving(true);
    try {
	  const response = await apiFetch("/api/workflows", { method: "PUT", body: JSON.stringify({ ...(workflowId ? { id: workflowId, expectedRevision: workflowRevision } : {}), name, description, toolName, definition: toDefinition() }) });
      const data = (await response.json()) as { workflow: Workflow };
	  setWorkflowId(data.workflow.id); setWorkflowRevision(data.workflow.revision); await loadResources(); return data.workflow;
    } finally { setSaving(false); }
  }
  async function onSave(event: FormEvent) { event.preventDefault(); if (!parametersAreValid) { onNotify("请先完成红框中的 JSON 参数"); return; } await saveWorkflow(); setLastRunLabel("已保存"); onNotify("工作流草稿已保存"); }
	async function publishWorkflow() { if (!parametersAreValid) { onNotify("请先完成红框中的 JSON 参数"); return; } const saved = await saveWorkflow(); const response = await apiFetch(`/api/workflows/${encodeURIComponent(saved.id)}/publish`, { method: "POST" }); const data = (await response.json()) as { published: { version: number; toolName: string } }; const items = await loadResources(); const latest = items.find((item) => item.id === saved.id); if (latest) setWorkflowRevision(latest.revision); onNotify(`已发布 ${data.published.toolName} v${data.published.version}，Agent 现在可以按字段调用`); }
  async function runWorkflow(mode: "workflow" | "from-node" | "single-node" = "workflow") {
    if (!parametersAreValid) { onNotify("请先完成红框中的 JSON 参数，避免运行旧值"); return; }
    const input = parseJson(testInput, undefined);
    if (!input || typeof input !== "object" || Array.isArray(input)) { onNotify("测试输入必须是有效 JSON 对象"); return; }
    if (mode !== "workflow" && !selectedNodeId) { onNotify("请先选择一个节点"); return; }
    const runningNodeIds = new Set<string>();
    if (mode === "workflow") nodes.forEach((node) => runningNodeIds.add(node.id));
    else if (selectedNodeId) {
      runningNodeIds.add(selectedNodeId);
      if (mode === "from-node") {
        const queue = [selectedNodeId];
        while (queue.length) {
          const source = queue.shift();
          edges.filter((edge) => edge.source === source).forEach((edge) => { if (!runningNodeIds.has(edge.target)) { runningNodeIds.add(edge.target); queue.push(edge.target); } });
        }
      }
    }
    setTestRunning(true); setTestResult(null);
    setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, resultState: runningNodeIds.has(node.id) ? "running" : "idle", resultElapsedMs: undefined, selectedHandle: undefined, resultPreview: runningNodeIds.has(node.id) ? "正在执行…" : undefined } })));
    setLastRunLabel(mode === "workflow" ? "运行全部" : mode === "from-node" ? "从节点运行" : "单节点运行");
    try {
      const saved = await saveWorkflow(); const response = await apiFetch(`/api/workflows/${encodeURIComponent(saved.id)}/run`, { method: "POST", body: JSON.stringify({ input, mode, ...(mode === "workflow" ? {} : { startNodeId: selectedNodeId }) }) }); const data = (await response.json()) as { result: WorkflowRun };
      setTestResult(data.result); const traceMap = new Map((data.result.trace || []).map((item) => [item.nodeId, item]));
      setNodes((current) => current.map((node) => { const trace = traceMap.get(node.id); return { ...node, data: { ...node.data, resultState: trace ? trace.status === "succeeded" ? "success" : trace.status : "idle", resultElapsedMs: trace?.elapsedMs, selectedHandle: trace?.selectedHandle, resultPreview: trace ? compactValue(trace.error || trace.output, 54) : undefined } }; })); setLastRunLabel("运行完成"); setInspectorTab("run"); onNotify("工作流测试完成");
    } catch (error) { setLastRunLabel("运行失败"); setNodes((current) => current.map((node) => node.data.resultState === "running" ? { ...node, data: { ...node.data, resultState: "idle", resultPreview: undefined } } : node)); onNotify(error instanceof Error ? error.message : "工作流运行失败"); } finally { setTestRunning(false); }
  }
	async function deleteWorkflow(target: Workflow | null = activeWorkflow || null) { if (!target || !window.confirm(`删除“${target.name}”及其发布版本？此操作无法撤销。`)) return; await apiFetch(`/api/workflows/${encodeURIComponent(target.id)}`, { method: "DELETE", headers: { "X-Resource-Revision": target.revision } }); if (target.id === workflowId) { setWorkflowId(""); setWorkflowRevision(""); setScreen("manager"); } await loadResources(); onNotify("工作流已删除"); }
	async function duplicateWorkflow(workflow: Workflow) { let sequence = 1; let copyName = `${workflow.name} 副本`; while (workflows.some((item) => item.name === copyName)) { sequence += 1; copyName = `${workflow.name} 副本 ${sequence}`; } const toolBase = `${workflow.toolName}_copy`.replace(/[^a-z0-9_]/gu, "_").slice(0, 58); let copyToolName = toolBase; while (workflows.some((item) => item.toolName === copyToolName)) { copyToolName = `${toolBase}_${sequence}`.slice(0, 64); sequence += 1; } await apiFetch("/api/workflows", { method: "PUT", body: JSON.stringify({ name: copyName, description: workflow.description, toolName: copyToolName, definition: workflow.definition }) }); await loadResources(); onNotify(`已复制为“${copyName}”`); }
  function deleteSelectedNode() {
    if (!selectedNode || ["input", "output"].includes(selectedNode.data.workflowType)) return;
    setNodes((current) => { const nextNodes = current.filter((node) => node.id !== selectedNode.id); nodesRef.current = nextNodes; return nextNodes; });
    setEdges((current) => { const nextEdges = current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id); edgesRef.current = nextEdges; return nextEdges; });
    setSelectedNodeId(""); setTestResult(null);
  }

  const filteredPalette = paletteTypes.filter((type) => `${nodeMeta[type].label}${nodeMeta[type].hint}${nodeMeta[type].group}`.toLocaleLowerCase().includes(paletteQuery.toLocaleLowerCase()));
  if (screen === "manager") return (
    <section className="system-tools-view workflow-manager-view">
      <header className="workflow-manager-header"><div><span className="eyebrow">AGENT AUTOMATION</span><h1>工作流</h1><p>创建、管理并发布可被 Agent 调用的自动化工具。</p></div><button className="primary-button" type="button" onClick={createWorkflow}>＋ 新建工作流</button></header>
      <div className="workflow-manager-content">
        <section className="workflow-manager-summary"><article><span>全部工作流</span><strong>{workflows.length}</strong><small>保存在本机</small></article><article><span>已发布工具</span><strong>{workflows.filter((workflow) => workflow.publishedVersion).length}</strong><small>Agent 可以直接调用</small></article><article><span>草稿</span><strong>{workflows.filter((workflow) => !workflow.publishedVersion).length}</strong><small>等待完善或发布</small></article></section>
        <div className="workflow-manager-toolbar"><div><strong>我的工作流</strong><small>打开后进入可视化编排器</small></div><label><span>⌕</span><input value={managerQuery} placeholder="搜索名称、说明或工具名" onChange={(event) => setManagerQuery(event.target.value)} /></label></div>
        {filteredWorkflows.length ? <div className="workflow-manager-grid">{filteredWorkflows.map((workflow) => <article className="workflow-manager-card" key={workflow.id}><button className="workflow-card-open" type="button" onClick={() => selectWorkflow(workflow)}><span className="workflow-card-icon">⌘</span><span className="workflow-card-title"><strong>{workflow.name}</strong><small>{workflow.description || "还没有填写工作流说明"}</small></span><em className={workflow.publishedVersion ? "is-published" : ""}>{workflow.publishedVersion ? `已发布 v${workflow.publishedVersion}` : "草稿"}</em><span className="workflow-card-stats"><b>{workflow.definition.nodes.length} 个节点</b><b>{workflow.definition.edges.length} 条连线</b><b>{formatWorkflowDate(workflow.updatedAt)}</b></span><code>{workflow.toolName}</code></button><div className="workflow-card-actions"><button type="button" onClick={() => selectWorkflow(workflow)}>打开编排</button><button type="button" onClick={() => void duplicateWorkflow(workflow)}>复制</button><button className="danger-link" type="button" onClick={() => void deleteWorkflow(workflow)}>删除</button></div></article>)}</div> : <div className="workflow-manager-empty"><span>⌘</span><strong>{managerQuery ? "没有匹配的工作流" : "创建第一个工作流"}</strong><p>{managerQuery ? "换一个关键词试试。" : "用可视化节点编排能力，然后发布为 Agent 工具。"}</p>{!managerQuery ? <button className="primary-button" type="button" onClick={createWorkflow}>新建工作流</button> : null}</div>}
      </div>
    </section>
  );
  return (
    <section className="system-tools-view workflow-view">
      <form className="workflow-header" onSubmit={onSave}>
        <div className="workflow-title-block"><div className="workflow-breadcrumb"><span>工作流</span><span>/</span>{activeWorkflow?.publishedVersion ? <em className="publish-status is-published">已发布 v{activeWorkflow.publishedVersion}</em> : <em className="publish-status">V2 草稿</em>}</div><input className="workflow-name" value={name} aria-label="工作流名称" onChange={(event) => setName(event.target.value)} /><input className="workflow-description" value={description} placeholder="告诉 Agent 这个工具能解决什么问题" aria-label="工作流描述" onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="workflow-actions"><span className={`workflow-run-status ${testRunning ? "is-running" : testResult ? "is-complete" : ""}`}>{testRunning ? "运行中" : lastRunLabel}</span><button className="secondary-button" type="button" onClick={() => setScreen("manager")}>← 工作流管理</button><button className="secondary-button" type="button" onClick={createWorkflow}>新建</button><button className="secondary-button" type="submit" title={parametersAreValid ? "保存最新参数" : "请先完成红框中的 JSON 参数"} disabled={!connected || saving || !parametersAreValid}>{saving ? "保存中…" : "保存"}</button><button className="primary-button" type="button" title={parametersAreValid ? "保存并发布最新参数" : "请先完成红框中的 JSON 参数"} disabled={!connected || saving || !parametersAreValid} onClick={publishWorkflow}>发布为工具</button></div>
      </form>
      <div className="workflow-shell">
        <aside className="workflow-list-panel">
          <div className="workflow-palette-heading"><div><strong>组件库</strong><small>拖到画布，或点击添加</small></div><button type="button" title="返回工作流管理" onClick={() => setScreen("manager")}>⌂</button></div><div className="workflow-palette-body"><input className="palette-search" value={paletteQuery} placeholder="搜索节点" onChange={(event) => setPaletteQuery(event.target.value)} /><div className="node-palette-scroll">{filteredPalette.map((workflowType, index) => { const previousGroup = filteredPalette[index - 1] ? nodeMeta[filteredPalette[index - 1] as WorkflowNodeType].group : ""; const group = nodeMeta[workflowType].group; return <div className="palette-entry" key={workflowType}>{group !== previousGroup ? <small className="palette-group">{group}</small> : null}<button className={`palette-node palette-${workflowType}`} type="button" draggable onDragStart={(event) => onPaletteDragStart(event, workflowType)} onClick={() => addNode(workflowType as Exclude<WorkflowNodeType, "input" | "output">)}><span className="palette-icon">{nodeMeta[workflowType].icon}</span><span><strong>{nodeMeta[workflowType].label}</strong><small>{nodeMeta[workflowType].hint}</small></span><b>⋮⋮</b></button></div>; })}</div></div>
        </aside>
        <div className="workflow-center">
          <div className="workflow-canvas" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={onCanvasDrop}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setFlowInstance} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={isValidConnection} onBeforeDelete={async ({ nodes: deletingNodes, edges: deletingEdges }) => ({ nodes: deletingNodes.filter((node) => !["input", "output"].includes(node.data.workflowType)), edges: deletingEdges })} onNodeClick={(_event, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId("")} snapToGrid snapGrid={[10, 10]} deleteKeyCode={["Backspace", "Delete"]} fitView minZoom={0.2} maxZoom={1.8} defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}><Background gap={20} size={1.2} color="#d8d8d2" /><Controls showInteractive={false} /></ReactFlow><div className="canvas-stage-label"><span>编排画布</span><em>{nodes.length} 个节点 · {edges.length} 条连线</em></div><div className="canvas-help">拖入节点 · 从端口连接 · Delete 删除连线 · 右侧调试</div></div>
        </div>
        <aside className="workflow-inspector">
          <section className="workflow-run-control"><div className="run-control-heading"><div><strong>调试运行</strong><small>{selectedNode ? `已选择：${selectedNode.data.label}` : "选择节点可局部运行"}</small></div><span className={testRunning ? "is-running" : testResult ? "is-complete" : ""}>{testRunning ? "运行中" : lastRunLabel}</span></div><label><span>输入 JSON</span><textarea value={testInput} spellCheck={false} onChange={(event) => setTestInput(event.target.value)} /></label><button className="primary-button run-all-button" type="button" disabled={!connected || testRunning || !parametersAreValid} onClick={() => runWorkflow("workflow")}>{testRunning ? "运行中…" : "▶ 运行全部"}</button><div className="partial-run-actions"><button type="button" disabled={!connected || testRunning || !selectedNode || !parametersAreValid} onClick={() => runWorkflow("from-node")}>从此节点运行</button><button type="button" disabled={!connected || testRunning || !selectedNode || !parametersAreValid} onClick={() => runWorkflow("single-node")}>仅运行此节点</button></div></section>
          <div className="workflow-right-tabs"><button className={inspectorTab === "properties" ? "is-active" : ""} type="button" onClick={() => setInspectorTab("properties")}>属性</button><button className={inspectorTab === "run" ? "is-active" : ""} type="button" onClick={() => setInspectorTab("run")}>运行结果{testResult?.trace?.length ? <em>{testResult.trace.length}</em> : null}</button></div>
          <div className="workflow-inspector-body">
          {inspectorTab === "properties" ? <><div className="panel-label">节点配置</div>{selectedNode ? <Fragment key={selectedNode.id}><div className={`inspector-node-heading node-${selectedNode.data.workflowType}`}><span>{nodeMeta[selectedNode.data.workflowType].icon}</span><div><strong>{nodeMeta[selectedNode.data.workflowType].label}</strong><small>{selectedNode.id}</small></div></div><label className="field"><span>显示名称</span><input value={selectedNode.data.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} /></label><div className="variable-source-summary"><span>可引用数据</span><strong>{variableOptions.length}</strong><small>{selectedNode.data.workflowType === "input" ? "输入节点不依赖前置数据" : "仅展示连线关系中当前节点之前的数据"}</small></div>
            {selectedNode.data.workflowType === "input" ? <FieldSchemaEditor title="工具输入字段" fields={selectedNode.data.fields || []} onChange={(fields) => updateSelectedNode({ fields })} /> : null}
            {selectedNode.data.workflowType === "template" ? <VariableInput label="文本模板" value={selectedNode.data.template || ""} options={variableOptions} onChange={(template) => updateSelectedNode({ template })} /> : null}
            {selectedNode.data.workflowType === "knowledge-search" ? <><VariableInput label="查询表达式" value={selectedNode.data.query || ""} options={variableOptions} onChange={(query) => updateSelectedNode({ query })} /><label className="field"><span>知识库</span><select value={selectedNode.data.collectionId || ""} onChange={(event) => updateSelectedNode({ collectionId: event.target.value })}><option value="">全部知识库</option>{knowledgeCollections.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}</select></label><label className="field"><span>检索模式</span><select value={selectedNode.data.retrievalMode || "inherit"} onChange={(event) => updateSelectedNode({ retrievalMode: event.target.value as "inherit" | "fast" | "smart" })}><option value="inherit">跟随知识库</option><option value="fast">本地快速检索</option><option value="smart">LLM 智能检索</option></select></label><label className="field"><span>返回片段数</span><input type="number" min="1" max="20" value={selectedNode.data.topK || 5} onChange={(event) => updateSelectedNode({ topK: Number(event.target.value) || 5 })} /></label></> : null}
            {selectedNode.data.workflowType === "llm" ? <><VariableInput label="提示词" value={selectedNode.data.prompt || ""} options={variableOptions} onChange={(prompt) => updateSelectedNode({ prompt })} /><VariableInput label="系统提示" value={selectedNode.data.systemPrompt || ""} options={variableOptions} onChange={(systemPrompt) => updateSelectedNode({ systemPrompt })} /><FieldSchemaEditor title="结构化输出（可选）" fields={selectedNode.data.outputSchema || []} onChange={(outputSchema) => updateSelectedNode({ outputSchema })} /></> : null}
            {selectedNode.data.workflowType === "if-else" ? <><label className="field"><span>逻辑关系</span><select value={selectedNode.data.logicalOperator || "and"} onChange={(event) => updateSelectedNode({ logicalOperator: event.target.value as "and" | "or" })}><option value="and">全部满足 AND</option><option value="or">任一满足 OR</option></select></label>{(selectedNode.data.conditions || []).map((condition, index) => <div className="condition-row" key={index}><VariableInput label={`条件 ${index + 1} 左值`} value={String(condition.left ?? "")} placeholder="{{input.query}}" multiline={false} compact options={variableOptions} onChange={(left) => updateSelectedNode({ conditions: (selectedNode.data.conditions || []).map((item, itemIndex) => itemIndex === index ? { ...item, left } : item) })} /><select value={condition.operator} onChange={(event) => updateSelectedNode({ conditions: (selectedNode.data.conditions || []).map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) })}>{conditionOperators.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><VariableInput label={`条件 ${index + 1} 右值`} value={String(condition.right ?? "")} placeholder="比较值" multiline={false} compact options={variableOptions} onChange={(right) => updateSelectedNode({ conditions: (selectedNode.data.conditions || []).map((item, itemIndex) => itemIndex === index ? { ...item, right: parseJson(right, right) } : item) })} /></div>)}<button className="small-add-button" type="button" onClick={() => updateSelectedNode({ conditions: [...(selectedNode.data.conditions || []), { left: "{{previous}}", operator: "equals", right: "" }] })}>＋ 添加条件</button></> : null}
            {selectedNode.data.workflowType === "question-classifier" ? <><VariableInput label="分类输入" value={String(selectedNode.data.input || "")} options={variableOptions} onChange={(input) => updateSelectedNode({ input })} /><VariableInput label="分类指令" value={selectedNode.data.instruction || ""} options={variableOptions} onChange={(instruction) => updateSelectedNode({ instruction })} /><div className="class-list">{(selectedNode.data.classes || []).map((item, index) => <div key={item.id}><input value={item.id} placeholder="id" onChange={(event) => updateSelectedNode({ classes: (selectedNode.data.classes || []).map((entry, itemIndex) => itemIndex === index ? { ...entry, id: event.target.value.replace(/[^A-Za-z0-9_-]/gu, "_") } : entry) })} /><input value={item.name} placeholder="类别名称" onChange={(event) => updateSelectedNode({ classes: (selectedNode.data.classes || []).map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry) })} /></div>)}<button className="small-add-button" type="button" onClick={() => updateSelectedNode({ classes: [...(selectedNode.data.classes || []), { id: `class_${(selectedNode.data.classes || []).length + 1}`, name: "新类别" }] })}>＋ 添加类别</button></div></> : null}
            {selectedNode.data.workflowType === "parameter-extractor" ? <><VariableInput label="提取来源" value={String(selectedNode.data.input || "")} options={variableOptions} onChange={(input) => updateSelectedNode({ input })} /><VariableInput label="提取指令" value={selectedNode.data.instruction || ""} options={variableOptions} onChange={(instruction) => updateSelectedNode({ instruction })} /><FieldSchemaEditor title="提取参数" fields={selectedNode.data.parameters || []} onChange={(parameters) => updateSelectedNode({ parameters })} /></> : null}
            {selectedNode.data.workflowType === "variable-assigner" ? <JsonEditor editorId={`${selectedNode.id}:assignments`} onValidityChange={onJsonValidityChange} label="变量赋值" value={Object.fromEntries((selectedNode.data.assignments || []).map((item) => [item.name, item.value]))} options={variableOptions} onChange={(value) => { if (value && typeof value === "object" && !Array.isArray(value)) updateSelectedNode({ assignments: Object.entries(value).map(([name, assignmentValue]) => ({ name, value: assignmentValue })) }); }} /> : null}
            {selectedNode.data.workflowType === "variable-aggregator" ? <JsonEditor editorId={`${selectedNode.id}:variables`} onValidityChange={onJsonValidityChange} label="候选变量数组" value={selectedNode.data.variables || []} options={variableOptions} onChange={(variables) => { if (Array.isArray(variables)) updateSelectedNode({ variables }); }} /> : null}
            {selectedNode.data.workflowType === "list-operator" ? <><VariableInput label="列表变量" value={String(selectedNode.data.input || "")} options={variableOptions} onChange={(input) => updateSelectedNode({ input })} /><label className="field"><span>操作</span><select value={selectedNode.data.operation || "first"} onChange={(event) => updateSelectedNode({ operation: event.target.value as WorkflowNodeData["operation"] })}>{["filter", "sort", "slice", "first", "last", "join", "length"].map((operation) => <option key={operation}>{operation}</option>)}</select></label>{selectedNode.data.operation === "join" ? <label className="field"><span>分隔符</span><input value={selectedNode.data.separator || ""} onChange={(event) => updateSelectedNode({ separator: event.target.value })} /></label> : null}</> : null}
            {selectedNode.data.workflowType === "http-request" ? <><label className="field"><span>请求方法</span><select value={selectedNode.data.method || "GET"} onChange={(event) => updateSelectedNode({ method: event.target.value as WorkflowNodeData["method"] })}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method}>{method}</option>)}</select></label><VariableInput label="URL" value={selectedNode.data.url || ""} options={variableOptions} multiline={false} onChange={(url) => updateSelectedNode({ url })} /><JsonEditor editorId={`${selectedNode.id}:headers`} onValidityChange={onJsonValidityChange} label="Headers" value={selectedNode.data.headers || {}} options={variableOptions} onChange={(headers) => { if (headers && typeof headers === "object" && !Array.isArray(headers)) updateSelectedNode({ headers: headers as Record<string, unknown> }); }} /><JsonEditor editorId={`${selectedNode.id}:body`} onValidityChange={onJsonValidityChange} label="Body" value={selectedNode.data.body ?? {}} options={variableOptions} onChange={(body) => updateSelectedNode({ body })} /></> : null}
            {selectedNode.data.workflowType === "tool" ? <><label className="field"><span>工具名称</span><input value={selectedNode.data.toolName || ""} onChange={(event) => updateSelectedNode({ toolName: event.target.value })} /></label><JsonEditor editorId={`${selectedNode.id}:arguments`} onValidityChange={onJsonValidityChange} label="工具参数" value={selectedNode.data.arguments || {}} options={variableOptions} onChange={(args) => { if (args && typeof args === "object" && !Array.isArray(args)) updateSelectedNode({ arguments: args as Record<string, unknown> }); }} /></> : null}
            {selectedNode.data.workflowType === "code" ? <VariableInput label="JavaScript（使用 return 返回结果）" value={selectedNode.data.code || ""} options={codeVariableOptions} className="code-variable-field" onChange={(code) => updateSelectedNode({ code })} /> : null}
            {selectedNode.data.workflowType === "iteration" ? <><VariableInput label="数组变量" value={String(selectedNode.data.input || "")} options={variableOptions} onChange={(input) => updateSelectedNode({ input })} /><label className="check-field"><input type="checkbox" checked={selectedNode.data.parallel || false} onChange={(event) => updateSelectedNode({ parallel: event.target.checked })} />并行执行</label><JsonEditor editorId={`${selectedNode.id}:definition`} onValidityChange={onJsonValidityChange} label="子工作流定义" value={selectedNode.data.definition || emptySubflow()} onChange={(definition) => { if (definition && typeof definition === "object" && !Array.isArray(definition)) updateSelectedNode({ definition: definition as WorkflowDefinition }); }} /></> : null}
            {selectedNode.data.workflowType === "loop" ? <><JsonEditor editorId={`${selectedNode.id}:initialVariables`} onValidityChange={onJsonValidityChange} label="初始循环变量" value={selectedNode.data.initialVariables || {}} options={variableOptions} onChange={(initialVariables) => { if (initialVariables && typeof initialVariables === "object" && !Array.isArray(initialVariables)) updateSelectedNode({ initialVariables: initialVariables as Record<string, unknown> }); }} /><JsonEditor editorId={`${selectedNode.id}:condition`} onValidityChange={onJsonValidityChange} label="循环条件" value={selectedNode.data.condition || { left: "{{loop.done}}", operator: "not-equals", right: true }} options={variableOptions} onChange={(condition) => { if (condition && typeof condition === "object" && !Array.isArray(condition)) updateSelectedNode({ condition: condition as WorkflowNodeData["condition"] }); }} /><label className="field"><span>最大循环次数</span><input type="number" min="1" max="100" value={selectedNode.data.maxIterations || 10} onChange={(event) => updateSelectedNode({ maxIterations: Number(event.target.value) || 10 })} /></label><JsonEditor editorId={`${selectedNode.id}:definition`} onValidityChange={onJsonValidityChange} label="子工作流定义" value={selectedNode.data.definition || emptySubflow()} onChange={(definition) => { if (definition && typeof definition === "object" && !Array.isArray(definition)) updateSelectedNode({ definition: definition as WorkflowDefinition }); }} /></> : null}
            {selectedNode.data.workflowType === "output" ? <><JsonEditor editorId={`${selectedNode.id}:value`} onValidityChange={onJsonValidityChange} label="输出值" value={selectedNode.data.value ?? "{{previous}}"} options={variableOptions} onChange={(value) => updateSelectedNode({ value })} /><div className="inspector-tip">也可以用对象，例如 <code>{'{"answer":"{{nodes.llm_3}}"}'}</code>。</div></> : null}
            {!(["input", "output", "if-else", "question-classifier"] as WorkflowNodeType[]).includes(selectedNode.data.workflowType) ? <><label className="field"><span>失败处理</span><select value={selectedNode.data.errorPolicy?.mode || "stop"} onChange={(event) => updateSelectedNode({ errorPolicy: { ...selectedNode.data.errorPolicy, mode: event.target.value as ErrorMode } })}><option value="stop">终止工作流</option><option value="default-value">使用默认值</option><option value="fail-branch">进入失败分支</option></select></label>{selectedNode.data.errorPolicy?.mode === "default-value" ? <JsonEditor editorId={`${selectedNode.id}:errorDefault`} onValidityChange={onJsonValidityChange} label="默认输出" value={selectedNode.data.errorPolicy.defaultValue ?? null} onChange={(defaultValue) => updateSelectedNode({ errorPolicy: { mode: "default-value", defaultValue } })} /> : null}</> : null}
            {!(["input", "output"] as WorkflowNodeType[]).includes(selectedNode.data.workflowType) ? <button className="danger-link inspector-delete" type="button" onClick={deleteSelectedNode}>删除节点</button> : null}</Fragment> : <div className="mini-empty">选择一个节点以编辑配置。</div>}
          <div className="tool-publish-card"><div className="tool-card-heading"><span>Agent 工具</span><em>{activeWorkflow?.publishedVersion ? "已启用" : "待发布"}</em></div><label><span>工具名</span><input value={toolName} pattern="[a-z][a-z0-9_]{1,63}" onChange={(event) => setToolName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></label><small>输入节点会生成工具 JSON Schema，Agent 只能按已定义字段调用。</small></div>{workflowId ? <button className="danger-link workflow-delete" type="button" onClick={() => void deleteWorkflow()}>删除工作流</button> : null}</> : <section className="workflow-run-results"><div className="panel-label">最终输出</div>{testResult ? <pre className="run-final-output">{displayJson(testResult.output)}</pre> : <div className="test-empty">运行后在这里查看输出和每个节点的执行明细。</div>}<div className="panel-label trace-label">节点轨迹</div><div className="workflow-trace-list">{testResult?.trace?.map((trace) => <details key={trace.nodeId} open={trace.status === "failed"}><summary className={`trace-${trace.status}`}><span>{trace.status === "succeeded" ? "✓" : trace.status === "skipped" ? "—" : "!"}</span><strong>{nodes.find((node) => node.id === trace.nodeId)?.data.label || trace.nodeId}</strong><em>{trace.elapsedMs}ms</em></summary><pre>{displayJson(trace.error || trace.output)}</pre></details>)}</div>{testResult ? <small className="run-result-meta">共执行 {testResult.trace?.length || 0} 个节点</small> : null}</section>}
          </div>
        </aside>
      </div>
    </section>
  );
}
