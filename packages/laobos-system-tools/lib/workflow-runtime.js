import { createContext, Script } from "node:vm";

export class WorkflowError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new WorkflowError(code, message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serialize(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "null";
}

function getPath(value, path) {
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

export function resolveValue(value, context) {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, context));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveValue(item, context)]),
    );
  }
  if (typeof value !== "string") return value;
  const exact = value.match(/^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/u);
  if (exact) return structuredClone(getPath(context, exact[1]));
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_match, expression) => {
    const resolved = getPath(context, expression);
    return resolved === undefined || resolved === null ? "" : serialize(resolved);
  });
}

function empty(value) {
  return value === undefined || value === null || value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.keys(value).length === 0);
}

function evaluate(condition, context) {
  const left = resolveValue(condition.left, context);
  const right = resolveValue(condition.right, context);
  switch (condition.operator) {
    case "equals": return left === right || String(left) === String(right);
    case "not-equals": return !(left === right || String(left) === String(right));
    case "contains": return Array.isArray(left) ? left.includes(right) : String(left ?? "").includes(String(right ?? ""));
    case "not-contains": return !evaluate({ ...condition, operator: "contains" }, context);
    case "starts-with": return String(left ?? "").startsWith(String(right ?? ""));
    case "ends-with": return String(left ?? "").endsWith(String(right ?? ""));
    case "greater-than": return Number(left) > Number(right);
    case "greater-than-or-equal": return Number(left) >= Number(right);
    case "less-than": return Number(left) < Number(right);
    case "less-than-or-equal": return Number(left) <= Number(right);
    case "is-empty": return empty(left);
    case "is-not-empty": return !empty(left);
    case "exists": return left !== undefined && left !== null;
    case "not-exists": return left === undefined || left === null;
    default: fail("WORKFLOW_CONDITION_INVALID", `不支持条件 ${condition.operator}。`);
  }
}

function validateInput(input, fields = []) {
  if (!isRecord(input)) fail("WORKFLOW_INPUT_INVALID", "工作流输入必须是对象。");
  if (fields.length === 0) return structuredClone(input);
  const result = {};
  for (const field of fields) {
    const value = Object.hasOwn(input, field.name) ? input[field.name] : field.default;
    if ((value === undefined || value === null) && field.required) {
      fail("WORKFLOW_INPUT_INVALID", `缺少必填输入 ${field.name}。`);
    }
    if (value !== undefined) result[field.name] = structuredClone(value);
  }
  return result;
}

export function validateWorkflowDefinition(definition) {
  if (!isRecord(definition) || !Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
    fail("WORKFLOW_INVALID", "工作流必须包含 nodes 与 edges 数组。");
  }
  if (definition.nodes.length < 2 || definition.nodes.length > 64) {
    fail("WORKFLOW_INVALID", "工作流节点数必须在 2 到 64 之间。");
  }
  const ids = new Set();
  for (const node of definition.nodes) {
    if (!isRecord(node) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(node.id) || typeof node.type !== "string") {
      fail("WORKFLOW_INVALID", "工作流包含无效节点。");
    }
    if (ids.has(node.id)) fail("WORKFLOW_INVALID", `节点 ${node.id} 重复。`);
    ids.add(node.id);
  }
  if (definition.nodes.filter((node) => node.type === "input").length !== 1 ||
      definition.nodes.filter((node) => node.type === "output").length !== 1) {
    fail("WORKFLOW_INVALID", "工作流必须且只能包含一个输入节点和一个输出节点。");
  }
  for (const edge of definition.edges) {
    if (!isRecord(edge) || typeof edge.id !== "string" || !ids.has(edge.source) || !ids.has(edge.target)) {
      fail("WORKFLOW_INVALID", "工作流包含无效连线。");
    }
  }
  return structuredClone(definition);
}

async function executeNode(node, context, variables, options, depth) {
  switch (node.type) {
    case "input": return { output: structuredClone(context.input), handle: "success" };
    case "template": return { output: resolveValue(node.template, context), handle: "success" };
    case "knowledge-search": {
      const query = resolveValue(node.query, context);
      const collectionId = node.collectionId ? resolveValue(node.collectionId, context) : undefined;
      return {
        output: options.knowledgeStore.searchKnowledge({
          query: typeof query === "string" ? query : serialize(query),
          ...(typeof collectionId === "string" && collectionId ? { collectionId } : {}),
          ...(node.topK ? { topK: node.topK } : {}),
        }),
        handle: "success",
      };
    }
    case "llm": {
      if (!options.completePrompt) fail("WORKFLOW_LLM_UNAVAILABLE", "当前运行环境未提供工作流 LLM 调用。");
      const output = await options.completePrompt({
        prompt: serialize(resolveValue(node.prompt, context)),
        systemPrompt: node.systemPrompt ? serialize(resolveValue(node.systemPrompt, context)) : undefined,
        signal: options.signal,
      });
      return { output, handle: "success" };
    }
    case "question-classifier":
    case "parameter-extractor":
      fail("WORKFLOW_LLM_UNAVAILABLE", `${node.type} 需要工作流 LLM 调用。`);
    case "if-else": {
      const values = (node.conditions || []).map((item) => evaluate(item, context));
      const matched = (node.logicalOperator || "and") === "and" ? values.every(Boolean) : values.some(Boolean);
      return { output: { matched }, handle: matched ? "true" : "false" };
    }
    case "variable-assigner":
      for (const assignment of node.assignments || []) {
        variables[assignment.name] = resolveValue(assignment.value, context);
      }
      return { output: structuredClone(variables), handle: "success" };
    case "variable-aggregator": {
      const values = (node.variables || []).map((item) => resolveValue(item, context));
      return { output: values.find((item) => item !== undefined && item !== null), handle: "success" };
    }
    case "list-operator": {
      const input = resolveValue(node.input, context);
      if (!Array.isArray(input)) fail("WORKFLOW_LIST_INPUT_INVALID", "列表操作输入必须是数组。");
      let output;
      if (node.operation === "filter") output = input.filter((item, index) => evaluate(node.condition, { ...context, item, index }));
      else if (node.operation === "sort") output = [...input].sort((a, b) =>
        String(node.field ? getPath(a, node.field) : a).localeCompare(
          String(node.field ? getPath(b, node.field) : b),
          undefined,
          { numeric: true },
        ) * (node.direction === "desc" ? -1 : 1),
      );
      else if (node.operation === "slice") output = input.slice(node.start || 0, node.end);
      else if (node.operation === "first") output = input[0];
      else if (node.operation === "last") output = input.at(-1);
      else if (node.operation === "join") output = input.map(serialize).join(node.separator || "\n");
      else if (node.operation === "length") output = input.length;
      else fail("WORKFLOW_LIST_OPERATION_INVALID", `不支持列表操作 ${node.operation}。`);
      return { output, handle: "success" };
    }
    case "http-request": {
      const url = resolveValue(node.url, context);
      if (typeof url !== "string" || !/^https?:\/\//iu.test(url)) fail("WORKFLOW_HTTP_URL_INVALID", "HTTP URL 无效。");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(Math.max(node.timeoutMs || 30_000, 100), 120_000));
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await fetch(url, {
          method: node.method || "GET",
          headers: resolveValue(node.headers || {}, context),
          ...((node.method || "GET") === "GET" || node.body === undefined ? {} : { body: serialize(resolveValue(node.body, context)) }),
          signal: controller.signal,
        });
        const text = await response.text();
        let body = text;
        try { body = JSON.parse(text); } catch {}
        if (!response.ok) fail("WORKFLOW_HTTP_FAILED", `HTTP 请求失败：${response.status}。`);
        return { output: { status: response.status, body }, handle: "success" };
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      }
    }
    case "tool": {
      if (!options.invokeTool) fail("WORKFLOW_TOOL_UNAVAILABLE", "当前运行环境未提供工具调用。");
      return {
        output: await options.invokeTool({
          name: resolveValue(node.toolName, context),
          arguments: resolveValue(node.arguments || {}, context),
        }),
        handle: "success",
      };
    }
    case "code": {
      const sandbox = {
        input: structuredClone(context.input),
        nodes: structuredClone(context.nodes),
        variables: structuredClone(variables),
        previous: structuredClone(context.previous),
        result: undefined,
      };
      const script = new Script(`"use strict"; result = (() => {\n${node.code}\n})();`);
      script.runInContext(createContext(sandbox, { codeGeneration: { strings: false, wasm: false } }), { timeout: 1_000 });
      return { output: sandbox.result, handle: "success" };
    }
    case "iteration": {
      const input = resolveValue(node.input, context);
      if (!Array.isArray(input)) fail("WORKFLOW_ITERATION_INPUT_INVALID", "迭代输入必须是数组。");
      const output = [];
      for (const [index, item] of input.entries()) {
        output.push((await executeWorkflow(node.definition, { item, index }, options, depth + 1)).output);
      }
      return { output, handle: "success" };
    }
    case "loop": {
      let state = resolveValue(node.initialVariables || {}, context);
      const limit = Math.min(Math.max(node.maxIterations || 10, 1), 100);
      let iterations = 0;
      while (evaluate(node.condition, { ...context, loop: state, iteration: iterations })) {
        if (iterations >= limit) fail("WORKFLOW_LOOP_LIMIT", `循环超过 ${limit} 次。`);
        const result = await executeWorkflow(node.definition, { ...state, iteration: iterations }, options, depth + 1);
        if (!isRecord(result.output)) fail("WORKFLOW_LOOP_OUTPUT_INVALID", "循环子工作流必须返回对象。");
        state = { ...state, ...result.output };
        iterations += 1;
      }
      return { output: { ...state, iterations }, handle: "success" };
    }
    case "output":
      return {
        output: node.outputs?.length
          ? Object.fromEntries(node.outputs.map((item) => [item.name, resolveValue(item.value, context)]))
          : node.value !== undefined ? resolveValue(node.value, context) : context.previous,
        handle: "success",
      };
    default: fail("WORKFLOW_NODE_UNSUPPORTED", `不支持节点类型 ${node.type}。`);
  }
}

export async function executeWorkflow(definitionValue, suppliedInput, options = {}, depth = 0) {
  if (depth > 4) fail("WORKFLOW_NESTING_LIMIT", "工作流嵌套超过 4 层。");
  const definition = validateWorkflowDefinition(definitionValue);
  const inputNode = definition.nodes.find((node) => node.type === "input");
  const outputNode = definition.nodes.find((node) => node.type === "output");
  const input = validateInput(suppliedInput, inputNode.fields);
  const nodeMap = new Map(definition.nodes.map((node) => [node.id, node]));
  const nodes = {};
  const variables = {};
  const trace = [];
  const queue = [inputNode.id];
  const queued = new Set(queue);

  while (queue.length > 0) {
    if (options.signal?.aborted) fail("WORKFLOW_ABORTED", "工作流已取消。");
    const id = queue.shift();
    const node = nodeMap.get(id);
    const incoming = definition.edges.filter((edge) => edge.target === id && Object.hasOwn(nodes, edge.source));
    const previous = incoming.length === 1
      ? nodes[incoming[0].source]
      : Object.fromEntries(incoming.map((edge) => [edge.source, nodes[edge.source]]));
    const context = { input, inputs: input, nodes, variables, previous };
    const started = Date.now();
    let result;
    try {
      result = await executeNode(node, context, variables, options, depth);
      nodes[id] = structuredClone(result.output);
      trace.push({ nodeId: id, nodeType: node.type, status: "completed", elapsedMs: Date.now() - started });
    } catch (error) {
      if (node.errorPolicy?.mode === "default-value") {
        result = { output: structuredClone(node.errorPolicy.defaultValue), handle: "success" };
        nodes[id] = result.output;
      } else if (node.errorPolicy?.mode === "fail-branch") {
        result = { output: { error_type: error.code || "WORKFLOW_NODE_FAILED", error_message: error.message }, handle: "error" };
        nodes[id] = result.output;
      } else throw error;
      trace.push({ nodeId: id, nodeType: node.type, status: "failed", elapsedMs: Date.now() - started });
    }
    for (const edge of definition.edges.filter((item) => item.source === id)) {
      if (edge.sourceHandle && edge.sourceHandle !== result.handle) continue;
      if (!edge.sourceHandle && result.handle !== "success") continue;
      if (!queued.has(edge.target)) {
        queued.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  if (!Object.hasOwn(nodes, outputNode.id)) fail("WORKFLOW_OUTPUT_UNREACHABLE", "输出节点不可达。");
  return { output: nodes[outputNode.id], nodeOutputs: nodes, trace };
}
