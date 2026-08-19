"use client";

import Image from "next/image";
import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { KnowledgeBase } from "./knowledge";
import { Workflows } from "./workflows";
import "./studio.css";

type View =
  | "chat"
  | "workflows"
  | "knowledge"
  | "prompt"
  | "memory"
  | "skills"
  | "providers"
  | "tools";
type Role = "user" | "assistant";
type StudioMode = "studio" | "chat-widget";

type ToolRun = {
  id: string;
  name: string;
  label: string;
  detail: string;
  status: "running" | "done" | "error";
};

type AgentConfirmationRequest = {
  id: string;
  sessionId: string;
  title: string;
  message: string;
};

type AttachmentKind = "image" | "file";

type MessageAttachment = {
  id: string;
  batchId?: string;
  name: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  downloadPath?: string;
  previewUrl?: string;
};

type PendingAttachment = MessageAttachment & {
  file: File;
  data?: string;
  status: "reading" | "ready" | "uploading" | "error";
  error?: string;
};

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  attachments?: MessageAttachment[];
  tools?: ToolRun[];
  error?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

type StudioSettings = {
  workspacePath: string;
  projectTrust: boolean;
  memoryEnabled: boolean;
  defaultProvider: string;
  defaultModel: string;
  thinkingLevel: string;
  allowedTools: string[];
};

type Skill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  scope: "global" | "project";
  path: string;
  relativePath: string;
  enabled: boolean;
};

type Provider = {
  id: string;
  name: string;
  env: string;
  accent: string;
  configured: boolean;
  source: "auth.json" | "environment" | "models.json" | null;
  credentialType: string | null;
  custom: boolean;
  baseUrl?: string;
  defaultBaseUrl?: string;
  endpointCustomized?: boolean;
  api?: string;
  models?: {
    id: string;
    name: string;
    reasoning: boolean;
    vision: boolean;
    contextWindow: number;
    maxTokens: number;
  }[];
};

type CustomModelDraft = {
  rowId: string;
  id: string;
  name: string;
  reasoning: boolean;
  vision: boolean;
  contextWindow: string;
  maxTokens: string;
};

type CustomProviderDraft = {
  originalId: string;
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  key: string;
  localNoKey: boolean;
  models: CustomModelDraft[];
};

type PiModel = {
  provider: string;
  id: string;
  name?: string;
  reasoning?: boolean;
  thinkingLevels?: string[];
  contextWindow?: number;
  input?: string[];
};

type EngineIntegration = {
  managed: boolean;
  available: boolean;
  ready: boolean;
  state: "ready" | "needs-configuration" | "not-project-bound" | "unavailable";
  defaultModel: {
    provider: string;
    id: string;
    thinkingLevel?: string;
  } | null;
  checks: {
    id: string;
    ready: boolean;
    code?: string;
    message: string;
  }[];
  thinkingLevelAdjustment?: {
    from: string;
    to: string;
    reason: "unsupported-by-model";
  };
  message?: string;
};

type BridgeConfig = {
  settings: StudioSettings;
  prompts: { global: string; project: string };
  memory: string;
  skills: Skill[];
  providers: Provider[];
  engineIntegration: EngineIntegration;
  studioControl: {
    canShutdown: boolean;
  };
  paths: {
    agentDir: string;
    authPath: string;
    globalPromptPath: string;
    projectPromptPath: string;
    memoryPath: string;
    modelsPath: string;
  };
};

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:31415";
const VITE_ENV =
  (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env || {};
const NEXT_PUBLIC_ENV =
  typeof process !== "undefined"
    ? process.env
    : ({} as Record<string, string | undefined>);
const AUTO_BRIDGE_URL =
  VITE_ENV.VITE_PI_STUDIO_BRIDGE_URL ||
  NEXT_PUBLIC_ENV.NEXT_PUBLIC_PI_STUDIO_BRIDGE_URL ||
  "";
const AUTO_BRIDGE_TOKEN =
  VITE_ENV.VITE_PI_STUDIO_BRIDGE_TOKEN ||
  NEXT_PUBLIC_ENV.NEXT_PUBLIC_PI_STUDIO_BRIDGE_TOKEN ||
  "";
const LOCAL_KEY = "pi-studio-state-v1";
const CONNECTION_KEY = "pi-studio-connection-v1";
const FALLBACK_SESSION_ID = "3f6e0b9a-a425-4b42-b867-bb18738fd71f";
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".zip",
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
].join(",");
const supportedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "你好，我是运行在劳博士 Agent 引擎上的本地助手。\n\n连接本机 Agent Bridge 后，我可以在你授权的工作目录里读写代码、运行命令，并按需加载 Skills。",
};

const initialConversation: Conversation = {
  id: FALLBACK_SESSION_ID,
  title: "开始使用劳博士",
  updatedAt: 0,
  messages: [welcomeMessage],
};

const navItems: { id: View; label: string; icon: string; group: string }[] = [
  { id: "chat", label: "对话", icon: "⌁", group: "workspace" },
  { id: "workflows", label: "工作流", icon: "⌘", group: "workspace" },
  { id: "knowledge", label: "知识库", icon: "▤", group: "workspace" },
  { id: "prompt", label: "系统提示词", icon: "¶", group: "workspace" },
  { id: "memory", label: "长期记忆", icon: "◫", group: "workspace" },
  { id: "skills", label: "Skills", icon: "◇", group: "agent" },
  { id: "providers", label: "AI Keys", icon: "⌘", group: "agent" },
  { id: "tools", label: "引擎与工具", icon: "⌗", group: "agent" },
];

const builtInTools = [
  { id: "read", label: "Read", description: "读取文件内容" },
  { id: "bash", label: "Bash", description: "运行终端命令" },
  { id: "edit", label: "Edit", description: "精确编辑文件" },
  { id: "write", label: "Write", description: "创建或覆盖文件" },
  { id: "grep", label: "Grep", description: "搜索文件内容" },
  { id: "find", label: "Find", description: "查找文件路径" },
  { id: "ls", label: "List", description: "浏览目录结构" },
];

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function newCustomModel(model: Partial<CustomModelDraft> = {}): CustomModelDraft {
  return {
    rowId: newId(),
    id: "",
    name: "",
    reasoning: false,
    vision: false,
    contextWindow: "128000",
    maxTokens: "16384",
    ...model,
  };
}

function emptyCustomProvider(): CustomProviderDraft {
  return {
    originalId: "",
    id: "",
    name: "",
    baseUrl: "",
    api: "openai-completions",
    key: "",
    localNoKey: false,
    models: [newCustomModel()],
  };
}

function timeLabel(timestamp: number) {
  if (!timestamp) return "刚刚";
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function splitModel(value: string) {
  const slash = value.indexOf("/");
  if (slash === -1) return { provider: "", modelId: value };
  return { provider: value.slice(0, slash), modelId: value.slice(slash + 1) };
}

function toolResultText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: { type?: string; text?: string }[] }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .join("\n")
    .slice(0, 1400);
}

function messageTitle(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 28 ? `${clean.slice(0, 28)}…` : clean || "New task";
}

function attachmentKind(mimeType: string): AttachmentKind {
  return supportedImageTypes.has(mimeType.toLowerCase()) ? "image" : "file";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

function fileExtension(fileName: string) {
  const extension = fileName.split(".").pop();
  if (!extension || extension === fileName) return "FILE";
  return extension.slice(0, 5).toUpperCase();
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取该文件。"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma === -1) {
        reject(new Error("文件编码失败。"));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

type MarkdownRendererProps = {
  loadLocalImage: (filePath: string) => Promise<string>;
};

type MarkdownImageSource = {
  kind: "remote" | "local";
  src: string;
};

const imagePathPattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const inlineMarkdownPattern =
  /(!?\[([^\]]*)\]\(([^)\n]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|_([^_\n]+)_)/g;

function markdownDestination(value: string) {
  const destination = value.trim();
  return destination.startsWith("<") && destination.endsWith(">")
    ? destination.slice(1, -1).trim()
    : destination;
}

function getMarkdownImageSource(value: string): MarkdownImageSource | null {
  const source = markdownDestination(value);
  if (/^https?:\/\/\S+$/i.test(source)) return { kind: "remote", src: source };
  if (source.startsWith("file://")) {
    try {
      const url = new URL(source);
      if (url.protocol === "file:" && (!url.host || url.host === "localhost")) {
        return { kind: "local", src: decodeURIComponent(url.pathname) };
      }
    } catch {
      return null;
    }
  }
  return source.startsWith("/") ? { kind: "local", src: source } : null;
}

function isStandaloneImage(value: string) {
  const source = getMarkdownImageSource(value);
  if (!source) return false;
  try {
    return imagePathPattern.test(
      source.kind === "remote" ? new URL(source.src).pathname : source.src,
    );
  } catch {
    return imagePathPattern.test(source.src);
  }
}

function MarkdownImage({
  source,
  alt,
  loadLocalImage,
}: MarkdownRendererProps & { source: string; alt: string }) {
  const image = getMarkdownImageSource(source);
  const [localUrl, setLocalUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const localPath = image?.kind === "local" ? image.src : "";

  useEffect(() => {
    if (!localPath) return;

    let active = true;
    let objectUrl = "";
    void loadLocalImage(localPath)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setLocalUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loadLocalImage, localPath]);

  if (!image) {
    return <code className="markdown-image-invalid">{source}</code>;
  }
  const resolvedSource = image.kind === "remote" ? image.src : localUrl;
  if (failed) {
    return <span className="markdown-image-error">图片无法加载：{alt || source}</span>;
  }
  if (!resolvedSource) {
    return <span className="markdown-image-loading">正在加载图片…</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Markdown supports authenticated local blob URLs.
    <img
      className="markdown-image"
      src={resolvedSource}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function safeMarkdownLink(value: string) {
  const destination = markdownDestination(value);
  return /^(?:https?:\/\/|mailto:)/i.test(destination) ? destination : "";
}

function renderInlineMarkdown(
  text: string,
  props: MarkdownRendererProps,
  keyPrefix: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(inlineMarkdownPattern);

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const [token, label, destination, inlineCode, strongA, strongB, deleted, emphasisA, emphasisB] = match;
    const key = `${keyPrefix}-${match.index}`;
    if (destination !== undefined) {
      if (token.startsWith("!")) {
        nodes.push(
          <MarkdownImage
            key={`${key}-${destination}`}
            source={destination}
            alt={label || ""}
            loadLocalImage={props.loadLocalImage}
          />,
        );
      } else {
        const href = safeMarkdownLink(destination);
        nodes.push(
          href ? (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {renderInlineMarkdown(label || href, props, `${key}-label`)}
            </a>
          ) : (
            <span key={key}>{label || destination}</span>
          ),
        );
      }
    } else if (inlineCode !== undefined) {
      nodes.push(<code key={key}>{inlineCode}</code>);
    } else if (strongA !== undefined || strongB !== undefined) {
      nodes.push(
        <strong key={key}>
          {renderInlineMarkdown(strongA ?? strongB, props, `${key}-strong`)}
        </strong>,
      );
    } else if (deleted !== undefined) {
      nodes.push(
        <del key={key}>{renderInlineMarkdown(deleted, props, `${key}-deleted`)}</del>,
      );
    } else if (emphasisA !== undefined || emphasisB !== undefined) {
      nodes.push(
        <em key={key}>
          {renderInlineMarkdown(emphasisA ?? emphasisB, props, `${key}-emphasis`)}
        </em>,
      );
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderInlineLines(
  lines: string[],
  props: MarkdownRendererProps,
  keyPrefix: string,
) {
  return lines.flatMap((line, index) => [
    ...renderInlineMarkdown(line, props, `${keyPrefix}-${index}`),
    ...(index < lines.length - 1 ? [<br key={`${keyPrefix}-break-${index}`} />] : []),
  ]);
}

function isMarkdownBlockStart(line: string) {
  return /^(?:```|#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+|(?:---+|\*\*\*+|___+)\s*$)/.test(
    line,
  );
}

function MarkdownText({ text, loadLocalImage }: { text: string } & MarkdownRendererProps) {
  const props = { loadLocalImage };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```\s*([^\s`]*)?.*$/);
    if (fence) {
      const start = index;
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <div className="code-block" key={`code-${start}`}>
          {fence[1] ? <div className="code-label">{fence[1]}</div> : null}
          <pre>{code.join("\n")}</pre>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInlineMarkdown(heading[2], props, `heading-${index}`);
      const key = `heading-${index}`;
      if (level === 1) blocks.push(<h1 key={key}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={key}>{content}</h2>);
      else if (level === 3) blocks.push(<h3 key={key}>{content}</h3>);
      else if (level === 4) blocks.push(<h4 key={key}>{content}</h4>);
      else if (level === 5) blocks.push(<h5 key={key}>{content}</h5>);
      else blocks.push(<h6 key={key}>{content}</h6>);
      index += 1;
      continue;
    }

    if (/^(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const start = index;
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${start}`}>
          {renderInlineLines(quote, props, `quote-${start}`)}
        </blockquote>,
      );
      continue;
    }

    const unordered = line.match(/^[-+*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const start = index;
      const items: string[] = [];
      const itemPattern = unordered ? /^[-+*]\s+(.+)$/ : /^\d+[.)]\s+(.+)$/;
      while (index < lines.length) {
        const item = lines[index].match(itemPattern);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      const List = unordered ? "ul" : "ol";
      blocks.push(
        <List key={`list-${start}`}>
          {items.map((item, itemIndex) => (
            <li key={`list-${start}-${itemIndex}`}>
              {renderInlineMarkdown(item, props, `list-${start}-${itemIndex}`)}
            </li>
          ))}
        </List>,
      );
      continue;
    }

    if (isStandaloneImage(line.trim())) {
      blocks.push(
        <MarkdownImage
          key={`image-${index}-${line.trim()}`}
          source={line.trim()}
          alt=""
          loadLocalImage={loadLocalImage}
        />,
      );
      index += 1;
      continue;
    }

    const start = index;
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      (index === start || !isMarkdownBlockStart(lines[index]))
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${start}`}>
        {renderInlineLines(paragraph, props, `paragraph-${start}`)}
      </p>,
    );
  }

  return <div className="markdown-content">{blocks}</div>;
}

function AttachmentCard({
  attachment,
  loadPreview,
  onOpen,
  onDownload,
}: {
  attachment: MessageAttachment;
  loadPreview: (attachment: MessageAttachment) => Promise<string>;
  onOpen: (attachment: MessageAttachment, url: string) => void;
  onDownload: (attachment: MessageAttachment) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(attachment.previewUrl || "");
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (
      attachment.kind !== "image" ||
      attachment.previewUrl ||
      !attachment.downloadPath
    ) {
      return;
    }
    let active = true;
    let createdUrl = "";
    void loadPreview(attachment)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (active) setPreviewFailed(true);
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment, loadPreview]);

  useEffect(
    () => () => {
      if (attachment.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    },
    [attachment.previewUrl],
  );

  if (attachment.kind === "image") {
    return (
      <button
        className="message-attachment image-attachment"
        type="button"
        aria-label={`预览图片 ${attachment.name}`}
        onClick={() => {
          if (previewUrl) onOpen(attachment, previewUrl);
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated local blob URL
          <img src={previewUrl} alt={attachment.name} />
        ) : (
          <span className="attachment-loading">{previewFailed ? "无法预览" : "载入中…"}</span>
        )}
        <span className="image-attachment-name">{attachment.name}</span>
      </button>
    );
  }

  return (
    <button
      className="message-attachment file-attachment"
      type="button"
      onClick={() => onDownload(attachment)}
    >
      <span className="attachment-file-icon">{fileExtension(attachment.name)}</span>
      <span className="attachment-copy">
        <strong>{attachment.name}</strong>
        <small>{formatFileSize(attachment.size)} · 点击下载</small>
      </span>
      <span className="attachment-download" aria-hidden="true">
        ↓
      </span>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "is-on" : ""}`}
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function EmptyState({
  glyph,
  title,
  description,
  action,
}: {
  glyph: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-glyph">{glyph}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function PiStudio({ mode = "studio" }: { mode?: StudioMode }) {
  const chatOnly = mode === "chat-widget";
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([initialConversation]);
  const [activeId, setActiveId] = useState(FALLBACK_SESSION_ID);
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    attachment: MessageAttachment;
    url: string;
  } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState(DEFAULT_BRIDGE_URL);
  const [bridgeToken, setBridgeToken] = useState("");
  const [desktopManaged, setDesktopManaged] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [models, setModels] = useState<PiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [promptScope, setPromptScope] = useState<"global" | "project">("global");
  const [promptDraft, setPromptDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState<Partial<Skill>>({
    scope: "global",
    enabled: true,
    name: "",
    description: "",
    instructions: "# 使用说明\n\n描述这个 Skill 应该怎样完成任务。",
  });
  const [providerOpen, setProviderOpen] = useState<Provider | null>(null);
  const [providerKey, setProviderKey] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [customProviderOpen, setCustomProviderOpen] = useState(false);
  const [customProviderDraft, setCustomProviderDraft] =
    useState<CustomProviderDraft>(emptyCustomProvider);
  const [toast, setToast] = useState("");
	const [agentConfirmation, setAgentConfirmation] = useState<AgentConfirmationRequest | null>(null);
	const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
	const [resourceRefreshVersion, setResourceRefreshVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ||
    conversations[0] ||
    initialConversation;

  const pendingAttachmentsReady =
    pendingAttachments.length > 0 &&
    pendingAttachments.every((attachment) => attachment.status === "ready");
  const canSend =
    !isStreaming &&
    !isUploading &&
    (Boolean(draft.trim()) || pendingAttachments.length > 0) &&
    (pendingAttachments.length === 0 || pendingAttachmentsReady);
  const configuredProviderCount =
    config?.providers.filter((provider) => provider.configured).length || 0;
  const engineIssue = config?.engineIntegration?.checks.find(
    (check) => !check.ready,
  );
  const defaultModelInfo = models.find(
    (model) =>
      model.provider === config?.settings.defaultProvider &&
      model.id === config?.settings.defaultModel,
  );

  const apiFetch = useCallback(
    async (pathname: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (!desktopManaged) {
        headers.set("X-Pi-Bridge-Token", bridgeToken);
      }
      const response = await fetch(`${bridgeUrl.replace(/\/$/, "")}${pathname}`, {
        ...init,
        headers,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `请求失败（${response.status}）`);
      }
      return response;
    },
    [bridgeToken, bridgeUrl, desktopManaged],
  );

  const loadAttachmentPreview = useCallback(
    async (attachment: MessageAttachment) => {
      if (!attachment.downloadPath) throw new Error("附件地址不可用。");
      const response = await apiFetch(attachment.downloadPath);
      return URL.createObjectURL(await response.blob());
    },
    [apiFetch],
  );

  const loadMarkdownImage = useCallback(
    async (filePath: string) => {
      const response = await apiFetch(
        `/api/files/image?path=${encodeURIComponent(filePath)}`,
      );
      return URL.createObjectURL(await response.blob());
    },
    [apiFetch],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

	const respondToAgentConfirmation = useCallback(
	  async (confirmed: boolean) => {
		if (!agentConfirmation) return;
		setConfirmationSubmitting(true);
		try {
		  await apiFetch(`/api/chat/${agentConfirmation.sessionId}/ui-response`, {
			method: "POST",
			body: JSON.stringify({ id: agentConfirmation.id, confirmed }),
		  });
		  setAgentConfirmation(null);
		} catch (error) {
		  showToast(error instanceof Error ? error.message : "无法提交确认结果");
		} finally {
		  setConfirmationSubmitting(false);
		}
	  },
	  [agentConfirmation, apiFetch, showToast],
	);

  const downloadAttachment = useCallback(
    async (attachment: MessageAttachment) => {
      try {
        const url =
          attachment.previewUrl ||
          (attachment.downloadPath
            ? URL.createObjectURL(
                await (await apiFetch(attachment.downloadPath)).blob(),
              )
            : "");
        if (!url) throw new Error("附件地址不可用。");
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = attachment.name;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        if (!attachment.previewUrl) {
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "下载附件失败");
      }
    },
    [apiFetch, showToast],
  );

  const loadConfig = useCallback(async () => {
    const response = await apiFetch("/api/config");
    const data = (await response.json()) as BridgeConfig;
    setConfig(data);
    setMemoryDraft(data.memory);
    if (data.settings.defaultProvider && data.settings.defaultModel) {
      setSelectedModel(`${data.settings.defaultProvider}/${data.settings.defaultModel}`);
    }
    return data;
  }, [apiFetch]);

  const loadModels = useCallback(async () => {
    try {
      const response = await apiFetch("/api/models");
      const data = await response.json();
      const available = Array.isArray(data.models) ? data.models : [];
      setModels(available);
      return available;
    } catch {
      setModels([]);
      return [];
    }
  }, [apiFetch]);

  const loadSessions = useCallback(async () => {
    const response = await apiFetch("/api/sessions");
    const data = (await response.json()) as {
      sessions?: { id: string; title: string; updatedAt: number }[];
    };
    if (!data.sessions?.length) return [];

    const restored = data.sessions.map((session) => ({
      ...session,
      messages: [],
    }));
    setConversations(restored);
    setActiveId((current) =>
      restored.some((conversation) => conversation.id === current)
        ? current
        : restored[0].id,
    );
    return restored;
  }, [apiFetch]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setPendingAttachments((current) => {
        for (const attachment of current) {
          if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
        }
        return [];
      });
      setDraft("");
      setPreviewImage(null);
      setActiveId(conversationId);
      setView("chat");
      setSidebarOpen(false);

      try {
        const response = await apiFetch(`/api/chat/${conversationId}`);
        const data = (await response.json()) as {
          messages?: {
            role?: string;
            text?: string;
            attachments?: MessageAttachment[];
          }[];
        };
        const restoredMessages = (data.messages || [])
          .filter(
            (
              message,
            ): message is {
              role: Role;
              text: string;
              attachments?: MessageAttachment[];
            } =>
              (message.role === "user" || message.role === "assistant") &&
              typeof message.text === "string" &&
              (Boolean(message.text) || Boolean(message.attachments?.length)),
          )
          .map((message, index) => ({
            id: `${conversationId}-${index}`,
            role: message.role,
            text: message.text,
            attachments: message.attachments,
          }));

        updateConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: restoredMessages.length ? restoredMessages : [welcomeMessage],
        }));
      } catch (error) {
        showToast(error instanceof Error ? error.message : "读取会话失败");
      }
    },
    [apiFetch, showToast],
  );

  const connectBridge = useCallback(
    async (quiet = false) => {
      setConnecting(true);
      setConnectionError("");
      try {
        const healthResponse = await fetch(
          `${bridgeUrl.replace(/\/$/, "")}/api/health`,
        );
        if (!healthResponse.ok) throw new Error("Bridge 没有响应。");
        const [, sessions] = await Promise.all([loadConfig(), loadSessions()]);
        if (sessions.length) {
          await loadConversation(sessions[0].id);
        }
        setConnected(true);
        setConnectOpen(false);
        if (!window.piDesktop) {
          localStorage.setItem(
            CONNECTION_KEY,
            JSON.stringify({ bridgeUrl, bridgeToken }),
          );
        }
        void loadModels();
        if (!quiet) showToast("已连接本机 Agent Bridge");
      } catch (error) {
        const message = error instanceof Error ? error.message : "连接失败";
        setConnected(false);
        setConnectionError(message);
        if (!quiet || desktopManaged) showToast(message);
      } finally {
        setConnecting(false);
      }
    },
    [
      bridgeToken,
      bridgeUrl,
      desktopManaged,
      loadConfig,
      loadConversation,
      loadModels,
      loadSessions,
      showToast,
    ],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const savedState = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
        if (Array.isArray(savedState.conversations) && savedState.conversations.length) {
          setConversations(savedState.conversations);
          setActiveId(savedState.activeId || savedState.conversations[0].id);
        }
        if (window.piDesktop) {
          setDesktopManaged(true);
          const managedBridgeUrl = await window.piDesktop.getBridgeUrl();
          if (!managedBridgeUrl) {
            throw new Error("桌面服务没有返回连接地址。");
          }
          if (active) {
            setBridgeUrl(managedBridgeUrl);
            setBridgeToken("desktop-managed");
          }
        } else {
          if (active && AUTO_BRIDGE_URL && AUTO_BRIDGE_TOKEN) {
            setBridgeUrl(AUTO_BRIDGE_URL);
            setBridgeToken(AUTO_BRIDGE_TOKEN);
          } else {
            const savedConnection = JSON.parse(
              localStorage.getItem(CONNECTION_KEY) || "{}",
            );
            if (active && savedConnection.bridgeUrl) {
              setBridgeUrl(savedConnection.bridgeUrl);
            }
            if (active && savedConnection.bridgeToken) {
              setBridgeToken(savedConnection.bridgeToken);
            }
          }
        }
      } catch (error) {
        if (active && window.piDesktop) {
          const message =
            error instanceof Error ? error.message : "桌面服务启动失败";
          setConnectionError(message);
          showToast(message);
        }
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (!hydrated) return;
    const durableConversations = conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        attachments: message.attachments?.map((attachment) => ({
          id: attachment.id,
          batchId: attachment.batchId,
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          kind: attachment.kind,
          downloadPath: attachment.downloadPath,
        })),
      })),
    }));
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ conversations: durableConversations, activeId }),
    );
  }, [activeId, conversations, hydrated]);

  useEffect(() => {
    if (!hydrated || !bridgeToken) return;
    const timer = window.setTimeout(() => connectBridge(true), 80);
    return () => window.clearTimeout(timer);
  }, [bridgeToken, connectBridge, hydrated]);

  useEffect(() => {
    if (!config) return;
    setPromptDraft(config.prompts[promptScope]);
  }, [config, promptScope]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [activeConversation.messages, isStreaming]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [draft]);

  function updateConversation(
    id: string,
    updater: (conversation: Conversation) => Conversation,
  ) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? updater(conversation) : conversation)),
    );
  }

  function discardPendingAttachments() {
    setPendingAttachments((current) => {
      for (const attachment of current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
      return [];
    });
  }

  async function preparePendingAttachment(id: string, file: File) {
    setPendingAttachments((current) =>
      current.map((attachment) =>
        attachment.id === id
          ? { ...attachment, status: "reading", error: undefined }
          : attachment,
      ),
    );
    try {
      const data = await readFileAsBase64(file);
      setPendingAttachments((current) =>
        current.map((attachment) =>
          attachment.id === id
            ? { ...attachment, data, status: "ready", error: undefined }
            : attachment,
        ),
      );
    } catch (error) {
      setPendingAttachments((current) =>
        current.map((attachment) =>
          attachment.id === id
            ? {
                ...attachment,
                status: "error",
                error: error instanceof Error ? error.message : "读取失败",
              }
            : attachment,
        ),
      );
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;

    const availableSlots = Math.max(
      0,
      MAX_ATTACHMENT_COUNT - pendingAttachments.length,
    );
    const existingBytes = pendingAttachments.reduce(
      (total, attachment) => total + attachment.size,
      0,
    );
    let nextBytes = existingBytes;
    const accepted: PendingAttachment[] = [];
    const rejected: string[] = [];

    for (const file of files.slice(0, availableSlots)) {
      if (file.size === 0) {
        rejected.push(`${file.name} 是空文件`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        rejected.push(`${file.name} 超过 20 MB`);
        continue;
      }
      if (nextBytes + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
        rejected.push("附件总大小超过 25 MB");
        break;
      }
      nextBytes += file.size;
      const kind = attachmentKind(file.type);
      accepted.push({
        id: newId(),
        name: file.name || "attachment",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        kind,
        file,
        status: "reading",
        previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      });
    }

    if (files.length > availableSlots) {
      rejected.push(`每次最多添加 ${MAX_ATTACHMENT_COUNT} 个附件`);
    }
    if (accepted.length) {
      setPendingAttachments((current) => [...current, ...accepted]);
      for (const attachment of accepted) {
        void preparePendingAttachment(attachment.id, attachment.file);
      }
    }
    if (rejected.length) showToast([...new Set(rejected)].join("；"));
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  function onComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = event.clipboardData.files;
    if (!files.length) return;
    if (!event.clipboardData.getData("text")) event.preventDefault();
    addFiles(files);
  }

  function onFileDragEnter(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function onFileDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onFileDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }

  function onFileDrop(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addFiles(event.dataTransfer.files);
  }

  function createConversation() {
    discardPendingAttachments();
    setDraft("");
    setPreviewImage(null);
    const conversation: Conversation = {
      id: newId(),
      title: "New task",
      updatedAt: Date.now(),
      messages: [welcomeMessage],
    };
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setView("chat");
    setSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function sendMessage() {
    const text = draft.trim();
    if (isStreaming || isUploading) return;
    if (!text && !pendingAttachments.length) return;
    if (!pendingAttachments.every((attachment) => attachment.status === "ready")) {
      showToast(
        pendingAttachments.some((attachment) => attachment.status === "error")
          ? "请移除或重试读取失败的附件"
          : "附件仍在处理中，请稍候",
      );
      return;
    }
    if (!connected) {
      if (!desktopManaged) setConnectOpen(true);
      showToast(
        desktopManaged
          ? connectionError || "内置劳博士服务正在启动，请稍候"
          : "请先连接本机 Agent Bridge",
      );
      return;
    }

    const selectedModelInfo = models.find(
      (model) => `${model.provider}/${model.id}` === selectedModel,
    );
    const imagesAsFiles = Boolean(
      pendingAttachments.some((attachment) => attachment.kind === "image") &&
      selectedModelInfo?.input &&
      !selectedModelInfo.input.includes("image"),
    );

    const conversationId = activeConversation.id;
    const assistantId = newId();
    let attachmentBatchId: string | undefined;
    let messageAttachments: MessageAttachment[] = [];
    if (pendingAttachments.length) {
      setIsUploading(true);
      setPendingAttachments((current) =>
        current.map((attachment) => ({ ...attachment, status: "uploading" })),
      );
      try {
        const uploadResponse = await apiFetch(
          `/api/chat/${conversationId}/attachments`,
          {
            method: "POST",
            body: JSON.stringify({
              imageMode: imagesAsFiles ? "file" : "multimodal",
              attachments: pendingAttachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                mimeType: attachment.mimeType,
                size: attachment.size,
                data: attachment.data,
              })),
            }),
          },
        );
        const upload = (await uploadResponse.json()) as {
          batchId: string;
          attachments: MessageAttachment[];
        };
        attachmentBatchId = upload.batchId;
        messageAttachments = upload.attachments.map((attachment) => ({
          ...attachment,
          previewUrl: pendingAttachments.find(
            (pending) => pending.id === attachment.id,
          )?.previewUrl,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传附件失败";
        setPendingAttachments((current) =>
          current.map((attachment) => ({
            ...attachment,
            status: "error",
            error: message,
          })),
        );
        showToast(message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const titleSource = text || messageAttachments[0]?.name || "附件";
    const shouldRename =
      activeConversation.title === "New task" ||
      activeConversation.title === "开始使用劳博士";

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: shouldRename ? messageTitle(titleSource) : conversation.title,
      updatedAt: Date.now(),
      messages: [
        ...conversation.messages,
        {
          id: newId(),
          role: "user",
          text,
          attachments: messageAttachments,
        },
        { id: assistantId, role: "assistant", text: "" },
      ],
    }));
    setDraft("");
    setPendingAttachments([]);
    setIsStreaming(true);

    const model = splitModel(selectedModel);
    try {
      const response = await apiFetch(`/api/chat/${conversationId}/prompt`, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          title: shouldRename
            ? messageTitle(titleSource)
            : activeConversation.title,
          attachmentBatchId,
          provider: model.provider || undefined,
          modelId: model.provider ? model.modelId : undefined,
          thinkingLevel: config?.settings.thinkingLevel || "medium",
        }),
      });
      if (!response.body) throw new Error("Bridge 没有返回流式响应。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false;

      const applyEvent = (event: Record<string, unknown>) => {
		if (event.type === "extension_ui_request" && event.method === "confirm") {
		  setAgentConfirmation({
			id: String(event.id || ""),
			sessionId: conversationId,
			title: String(event.title || "需要确认"),
			message: String(event.message || "Agent 请求执行一项敏感操作。"),
		  });
		}

		if (event.type === "resource_changed") {
		  setResourceRefreshVersion((current) => current + 1);
		  showToast(event.resourceType === "workflow" ? "Agent 已更新工作流" : "Agent 已更新知识库");
		}
        if (event.type === "message_update") {
          const update = event.assistantMessageEvent as
            | { type?: string; delta?: string }
            | undefined;
          if (update?.type === "text_delta" && update.delta) {
            updateConversation(conversationId, (conversation) => ({
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === assistantId
                  ? { ...message, text: message.text + update.delta }
                  : message,
              ),
            }));
          }
        }

        if (event.type === "tool_execution_start") {
          const tool = {
            id: String(event.toolCallId || newId()),
            name: String(event.toolName || "tool"),
            label: `运行 ${String(event.toolName || "tool")}`,
            detail: JSON.stringify(event.args || {}, null, 2),
            status: "running" as const,
          };
          updateConversation(conversationId, (conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantId
                ? { ...message, tools: [...(message.tools || []), tool] }
                : message,
            ),
          }));
        }

        if (event.type === "tool_execution_update" || event.type === "tool_execution_end") {
          const toolId = String(event.toolCallId || "");
          const result =
            event.type === "tool_execution_end" ? event.result : event.partialResult;
          updateConversation(conversationId, (conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    tools: (message.tools || []).map((tool) =>
                      tool.id === toolId
                        ? {
                            ...tool,
                            detail: toolResultText(result) || tool.detail,
                            status:
                              event.type === "tool_execution_end"
                                ? event.isError
                                  ? "error"
                                  : "done"
                                : "running",
                          }
                        : tool,
                    ),
                  }
                : message,
            ),
          }));
        }

        if (event.type === "bridge_error") {
          updateConversation(conversationId, (conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    text: message.text || `无法完成请求：${String(event.message || "未知错误")}`,
                    error: true,
                  }
                : message,
            ),
          }));
        }
		if (event.type === "agent_settled") {
		  settled = true;
		  setAgentConfirmation((current) => current?.sessionId === conversationId ? null : current);
		}
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (line.trim()) {
            try {
              applyEvent(JSON.parse(line));
            } catch {
              // Ignore malformed diagnostic lines.
            }
          }
          newline = buffer.indexOf("\n");
        }
        if (done) break;
      }

      if (!settled) {
        updateConversation(conversationId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantId && !message.text
              ? { ...message, text: "劳博士会话已结束，但没有返回文本。", error: true }
              : message,
          ),
        }));
      }
    } catch (error) {
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                text: `连接劳博士失败：${error instanceof Error ? error.message : "未知错误"}`,
                error: true,
              }
            : message,
        ),
      }));
      setConnected(false);
    } finally {
      setIsStreaming(false);
    }
  }

  async function abortMessage() {
    try {
      await apiFetch(`/api/chat/${activeConversation.id}/abort`, { method: "POST" });
    } catch {
      // The process may already be settled.
    }
    setIsStreaming(false);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function refreshConfig(message?: string) {
    const [data] = await Promise.all([loadConfig(), loadModels()]);
    if (message) showToast(message);
    return data;
  }

  async function savePrompt() {
    try {
      await apiFetch("/api/system-prompt", {
        method: "PUT",
        body: JSON.stringify({ scope: promptScope, content: promptDraft }),
      });
      await refreshConfig("系统提示词已保存，新会话将立即生效");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function saveMemory() {
    try {
      await apiFetch("/api/memory", {
        method: "PUT",
        body: JSON.stringify({ content: memoryDraft }),
      });
      await refreshConfig("长期记忆已保存");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function saveProviderKey(event: FormEvent) {
    event.preventDefault();
    if (!providerOpen || !providerBaseUrl.trim()) return;
    try {
      await apiFetch("/api/providers/key", {
        method: "PUT",
        body: JSON.stringify({
          provider: providerOpen.id,
          key: providerKey,
          baseUrl: providerBaseUrl,
        }),
      });
      await refreshConfig(
        providerKey.trim()
          ? `${providerOpen.name} Key 已保存；还需在“引擎与工具”选择默认模型`
          : `${providerOpen.name} 请求地址已保存；引擎不会自动测试凭据`,
      );
      setProviderOpen(null);
      setProviderKey("");
      setProviderBaseUrl("");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function deleteProviderKey(provider: Provider) {
    if (!window.confirm(`确认移除 ${provider.name} 的本地凭据？`)) return;
    try {
      await apiFetch("/api/providers/key", {
        method: "DELETE",
        body: JSON.stringify({ provider: provider.id }),
      });
      await refreshConfig(`${provider.name} 凭据已移除`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "移除失败");
    }
  }

  function openCustomProvider(provider?: Provider) {
    if (!provider) {
      setCustomProviderDraft(emptyCustomProvider());
    } else {
      setCustomProviderDraft({
        originalId: provider.id,
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl || "",
        api: provider.api || "openai-completions",
        key: "",
        localNoKey: false,
        models: provider.models?.length
          ? provider.models.map((model) =>
              newCustomModel({
                id: model.id,
                name: model.name === model.id ? "" : model.name,
                reasoning: model.reasoning,
                vision: model.vision,
                contextWindow: String(model.contextWindow),
                maxTokens: String(model.maxTokens),
              }),
            )
          : [newCustomModel()],
      });
    }
    setCustomProviderOpen(true);
  }

  function updateCustomModel(rowId: string, patch: Partial<CustomModelDraft>) {
    setCustomProviderDraft((current) => ({
      ...current,
      models: current.models.map((model) =>
        model.rowId === rowId ? { ...model, ...patch } : model,
      ),
    }));
  }

  async function saveCustomProvider(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/providers/custom", {
        method: "PUT",
        body: JSON.stringify({
          ...customProviderDraft,
          models: customProviderDraft.models.map((model) => ({
            id: model.id,
            name: model.name || model.id,
            reasoning: model.reasoning,
            vision: model.vision,
            contextWindow: Number(model.contextWindow),
            maxTokens: Number(model.maxTokens),
          })),
        }),
      });
      await refreshConfig(
        customProviderDraft.originalId
          ? "第三方模型已更新；请核对“引擎与工具”的默认模型"
          : "第三方模型已添加；还需在“引擎与工具”选择默认模型",
      );
      setCustomProviderOpen(false);
      setCustomProviderDraft(emptyCustomProvider());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存第三方模型失败");
    }
  }

  async function deleteCustomProvider(provider: Provider) {
    if (!window.confirm(`确认删除第三方 Provider“${provider.name}”及其本地凭据？`)) {
      return;
    }
    try {
      await apiFetch("/api/providers/custom", {
        method: "DELETE",
        body: JSON.stringify({ provider: provider.id }),
      });
      if (selectedModel.startsWith(`${provider.id}/`)) setSelectedModel("");
      await refreshConfig(`${provider.name} 已删除`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除第三方模型失败");
    }
  }

  async function saveSkill(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/skills/save", {
        method: "POST",
        body: JSON.stringify(skillDraft),
      });
      await refreshConfig(skillDraft.path ? "Skill 已更新" : "Skill 已创建");
      setSkillOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function toggleSkill(skill: Skill, enabled: boolean) {
    try {
      await apiFetch("/api/skills/toggle", {
        method: "POST",
        body: JSON.stringify({ path: skill.path, enabled }),
      });
      await refreshConfig(enabled ? "Skill 已启用" : "Skill 已停用");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败");
    }
  }

  async function deleteSkill(skill: Skill) {
    if (!window.confirm(`确认删除 Skill「${skill.name}」？此操作不可撤销。`)) return;
    try {
      await apiFetch("/api/skills", {
        method: "DELETE",
        body: JSON.stringify({ path: skill.path }),
      });
      await refreshConfig("Skill 已删除");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function saveSettings(patch: Partial<StudioSettings>, successMessage?: string) {
    if (!config) return;
    const optimistic = { ...config.settings, ...patch };
    setConfig({ ...config, settings: optimistic });
    try {
      const response = await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify(optimistic),
      });
      const data = await response.json();
      setConfig((current) =>
        current
          ? {
              ...current,
              settings: data.settings,
              engineIntegration: data.engineIntegration,
            }
          : current,
      );
      if (successMessage) {
        const thinkingAdjustment = data.engineIntegration?.thinkingLevelAdjustment;
        showToast(
          thinkingAdjustment
            ? `${successMessage}；当前模型不支持 ${thinkingAdjustment.from}，已调整为 ${thinkingAdjustment.to}`
            : data.engineIntegration?.ready
              ? `${successMessage}，嵌入式引擎已就绪`
              : successMessage,
        );
      }
    } catch (error) {
      await loadConfig().catch(() => undefined);
      showToast(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function shutdownStudio() {
    if (
      !window.confirm(
        "确认关闭开发 Studio？嵌入式 Agent API 不会因此被删除；需要再次核验时可重新运行 npm run dev:full。",
      )
    ) {
      return;
    }
    try {
      await apiFetch("/api/studio/shutdown", { method: "POST" });
      showToast("正在关闭开发 Studio…");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "关闭 Studio 失败");
    }
  }

  const filteredSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    return (config?.skills || []).filter(
      (skill) =>
        !query ||
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query),
    );
  }, [config?.skills, skillQuery]);

  function openNewSkill() {
    setSkillDraft({
      scope: "global",
      enabled: true,
      name: "",
      description: "",
      instructions: "# 使用说明\n\n描述这个 Skill 应该怎样完成任务。",
    });
    setSkillOpen(true);
  }

  function openEditSkill(skill: Skill) {
    setSkillDraft(skill);
    setSkillOpen(true);
  }

  function selectView(nextView: View) {
    setView(nextView);
    setSidebarOpen(false);
  }

  return (
    <div className={`studio-shell ${chatOnly ? "is-chat-widget" : ""}`}>
      <aside
        className={`sidebar ${chatOnly ? "chat-history-sidebar" : ""} ${
          sidebarOpen ? "is-open" : ""
        }`}
      >
        <div className="brand-row">
          <button className="brand" type="button" onClick={() => selectView("chat")}>
            <Image
              className="brand-mark"
              src="/laobos-logo.png"
              alt=""
              width={26}
              height={26}
              priority
            />
            <span>劳博士</span>
          </button>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="关闭侧栏"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <button className="new-task" type="button" onClick={createConversation}>
          <span className="new-task-icon">＋</span>
          <span>New task</span>
          {!chatOnly ? <span className="shortcut">⌘ K</span> : null}
        </button>

        {!chatOnly ? (
          <nav className="primary-nav" aria-label="工作台">
            <div className="nav-caption">WORKSPACE</div>
            {navItems
              .filter((item) => item.group === "workspace")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${view === item.id ? "is-active" : ""}`}
                  onClick={() => selectView(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            <div className="nav-caption agent-caption">AGENT</div>
            {navItems
              .filter((item) => item.group === "agent")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${view === item.id ? "is-active" : ""}`}
                  onClick={() => selectView(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.id === "skills" && config?.skills.length ? (
                    <span className="nav-count">{config.skills.length}</span>
                  ) : null}
                </button>
              ))}
          </nav>
        ) : null}

        <div className="history">
          <div className="history-heading">
            <span>{chatOnly ? "CONVERSATION HISTORY" : "RECENT TASKS"}</span>
            <button type="button" aria-label="搜索任务">
              ⌕
            </button>
          </div>
          <div className="history-list">
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={`history-item ${
                  view === "chat" && conversation.id === activeId ? "is-active" : ""
                }`}
                onClick={() => void loadConversation(conversation.id)}
              >
                <span className="history-title">{conversation.title}</span>
                <span className="history-time">{timeLabel(conversation.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>

        {desktopManaged ? (
          <div className="connection-card" aria-live="polite">
            <span className={`status-dot ${connected ? "is-connected" : ""}`} />
            <span className="connection-copy">
              <strong>
                {connected
                  ? "劳博士已就绪"
                  : connectionError
                    ? "劳博士启动失败"
                    : "正在启动劳博士"}
              </strong>
              <small>
                {connected
                  ? config?.settings.workspacePath
                  : connectionError || "内置服务自动连接中…"}
              </small>
            </span>
          </div>
        ) : (
          <button
            className="connection-card"
            type="button"
            onClick={() => setConnectOpen(true)}
          >
            <span className={`status-dot ${connected ? "is-connected" : ""}`} />
            <span className="connection-copy">
              <strong>{connected ? "Agent Bridge 已连接" : "连接本机劳博士"}</strong>
              <small>
                {connected ? config?.settings.workspacePath : "localhost:31415"}
              </small>
            </span>
            <span className="connection-arrow">›</span>
          </button>
        )}
      </aside>

      {sidebarOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="关闭侧栏"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="main-panel">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label={chatOnly ? "打开历史会话" : "打开侧栏"}
            onClick={() => setSidebarOpen(true)}
          >
            {chatOnly ? "☷" : "☰"}
          </button>
          <div className="topbar-title">
            <span>
              {view === "chat"
                ? activeConversation.title
                : navItems.find((item) => item.id === view)?.label}
            </span>
            {view === "chat" ? (
              <span className={`topbar-status ${connected ? "online" : ""}`}>
                {desktopManaged
                  ? connected
                    ? "劳博士 ready"
                    : "Starting 劳博士…"
                  : connected
                    ? "Local runtime"
                    : "Preview mode"}
              </span>
            ) : null}
          </div>
          <div className="topbar-actions">
            {chatOnly ? (
              <button
                className="icon-button widget-new-task"
                type="button"
                aria-label="新建对话"
                title="新建对话"
                onClick={createConversation}
              >
                ＋
              </button>
            ) : null}
            {view === "chat" ? (
              <label className="model-select-wrap">
                <span className="model-spark">✦</span>
                <select
                  aria-label="选择模型"
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                >
                  <option value="">劳博士默认模型</option>
                  {models.map((model) => (
                    <option
                      key={`${model.provider}/${model.id}`}
                      value={`${model.provider}/${model.id}`}
                    >
                      {model.name || model.id} · {model.provider}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!desktopManaged ? (
              <button
                className={`bridge-pill ${connected ? "is-connected" : ""}`}
                type="button"
                onClick={() => setConnectOpen(true)}
              >
                <span />
                {connected ? "Connected" : "Connect"}
              </button>
            ) : null}
          </div>
        </header>

        {view === "chat" ? (
          <section
            className={`chat-view ${isDraggingFiles ? "is-dragging-files" : ""}`}
            onDragEnter={onFileDragEnter}
            onDragOver={onFileDragOver}
            onDragLeave={onFileDragLeave}
            onDrop={onFileDrop}
          >
            {isDraggingFiles ? (
              <div className="file-drop-overlay" aria-hidden="true">
                <div>
                  <span>＋</span>
                  <strong>把文件放到这里</strong>
                  <small>支持图片、文档、表格、代码与压缩包</small>
                </div>
              </div>
            ) : null}
            <div className="message-scroll">
              <div className="message-column">
                {activeConversation.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message ${message.role} ${message.error ? "is-error" : ""}`}
                  >
                    <div className="message-avatar">
                      {message.role === "assistant" ? "劳" : "你"}
                    </div>
                    <div className="message-body">
                      <div className="message-author">
                        {message.role === "assistant" ? "劳博士" : "你"}
                      </div>
                      {message.attachments?.length ? (
                        <div className="message-attachments">
                          {message.attachments.map((attachment) => (
                            <AttachmentCard
                              key={`${attachment.batchId || "local"}-${attachment.id}`}
                              attachment={attachment}
                              loadPreview={loadAttachmentPreview}
                              onOpen={(item, url) =>
                                setPreviewImage({ attachment: item, url })
                              }
                              onDownload={(item) => void downloadAttachment(item)}
                            />
                          ))}
                        </div>
                      ) : null}
                      {message.text || message.role === "assistant" ? (
                        <div className="message-text">
                          {message.text ? (
                          <MarkdownText
                            text={message.text}
                            loadLocalImage={loadMarkdownImage}
                          />
                          ) : (
                            <span className="typing-indicator">
                              <i />
                              <i />
                              <i />
                            </span>
                          )}
                        </div>
                      ) : null}
                      {message.tools?.length ? (
                        <div className="tool-runs">
                          {message.tools.map((tool) => (
                            <details className="tool-run" key={tool.id}>
                              <summary>
                                <span
                                  className={`tool-state ${tool.status}`}
                                  aria-hidden="true"
                                >
                                  {tool.status === "running"
                                    ? "↻"
                                    : tool.status === "error"
                                      ? "!"
                                      : "✓"}
                                </span>
                                <span>{tool.label}</span>
                                <small>{tool.status === "running" ? "运行中" : "完成"}</small>
                              </summary>
                              <pre>{tool.detail}</pre>
                            </details>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="composer-zone">
              {!connected ? (
                desktopManaged ? (
                  <div className="offline-banner" aria-live="polite">
                    <span className="offline-icon">↻</span>
                    <span>
                      {connectionError
                        ? `内置劳博士服务启动失败：${connectionError}`
                        : "正在启动内置劳博士服务…"}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="offline-banner"
                    onClick={() => setConnectOpen(true)}
                  >
                    <span className="offline-icon">↯</span>
                    <span>
                      当前是界面预览。连接本机 Agent Bridge 后即可调用真实劳博士 Agent。
                    </span>
                    <strong>连接</strong>
                  </button>
                )
              ) : null}
              <div className="composer">
                {pendingAttachments.length ? (
                  <div className="pending-attachments" aria-live="polite">
                    {pendingAttachments.map((attachment) => (
                      <div
                        className={`pending-attachment ${attachment.kind} is-${attachment.status}`}
                        key={attachment.id}
                      >
                        {attachment.kind === "image" && attachment.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local file preview URL
                          <img src={attachment.previewUrl} alt="" />
                        ) : (
                          <span className="pending-file-icon">
                            {fileExtension(attachment.name)}
                          </span>
                        )}
                        <span className="pending-attachment-copy">
                          <strong>{attachment.name}</strong>
                          <small>
                            {attachment.status === "reading"
                              ? "正在读取…"
                              : attachment.status === "uploading"
                                ? "正在上传…"
                                : attachment.status === "error"
                                  ? attachment.error || "读取失败"
                                  : formatFileSize(attachment.size)}
                          </small>
                        </span>
                        {attachment.status === "error" ? (
                          <button
                            className="pending-retry"
                            type="button"
                            aria-label={`重试 ${attachment.name}`}
                            onClick={() =>
                              void preparePendingAttachment(
                                attachment.id,
                                attachment.file,
                              )
                            }
                          >
                            ↻
                          </button>
                        ) : null}
                        <button
                          className="pending-remove"
                          type="button"
                          aria-label={`移除 ${attachment.name}`}
                          disabled={attachment.status === "uploading"}
                          onClick={() => removePendingAttachment(attachment.id)}
                        >
                          ×
                        </button>
                        {attachment.status === "reading" ||
                        attachment.status === "uploading" ? (
                          <span className="attachment-progress" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  rows={1}
                  placeholder={
                    pendingAttachments.length
                      ? "说明希望劳博士如何处理这些附件…"
                      : "给劳博士一个任务…"
                  }
                  aria-label="消息"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  onPaste={onComposerPaste}
                />
                <div className="composer-footer">
                  <div className="composer-tools">
                    <input
                      ref={fileInputRef}
                      className="visually-hidden"
                      type="file"
                      multiple
                      accept={ACCEPTED_ATTACHMENT_TYPES}
                      onChange={(event) => {
                        if (event.target.files) addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      aria-label="添加文件或图片"
                      title="添加文件或图片"
                      disabled={isUploading || isStreaming}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      ＋
                    </button>
                    <span className="workspace-chip">
                      <span>⌂</span>
                      {config?.settings.workspacePath
                        ? config.settings.workspacePath.split("/").filter(Boolean).at(-1)
                        : "workspace"}
                    </span>
                    <span className="context-chip">
                      {config?.settings.thinkingLevel || "medium"} reasoning
                    </span>
                  </div>
                  {isStreaming ? (
                    <button
                      className="send-button stop"
                      type="button"
                      aria-label="停止生成"
                      onClick={abortMessage}
                    >
                      ■
                    </button>
                  ) : (
                    <button
                      className="send-button"
                      type="button"
                      aria-label="发送消息"
                      disabled={!canSend}
                      onClick={sendMessage}
                    >
                      ↑
                    </button>
                  )}
                </div>
              </div>
              <div className="composer-hint">
                劳博士可能会执行命令或修改文件。请检查重要变更。
              </div>
            </div>
          </section>
        ) : null}

        {view === "workflows" ? (
		  <Workflows apiFetch={apiFetch} connected={connected} onNotify={showToast} refreshVersion={resourceRefreshVersion} />
        ) : null}

        {view === "knowledge" ? (
		  <KnowledgeBase apiFetch={apiFetch} connected={connected} onNotify={showToast} refreshVersion={resourceRefreshVersion} />
        ) : null}

        {view === "prompt" ? (
          <section className="settings-view">
            <div className="settings-header">
              <div>
                <span className="eyebrow">BEHAVIOR</span>
                <h1>系统提示词</h1>
                <p>定义劳博士的角色、约束和工作方式。保存后，新启动的会话立即生效。</p>
              </div>
              <button className="primary-button" type="button" onClick={savePrompt}>
                保存提示词
              </button>
            </div>
            <div className="scope-tabs">
              <button
                type="button"
                className={promptScope === "global" ? "is-active" : ""}
                onClick={() => setPromptScope("global")}
              >
                全局
                <small>所有项目</small>
              </button>
              <button
                type="button"
                className={promptScope === "project" ? "is-active" : ""}
                onClick={() => setPromptScope("project")}
              >
                当前项目
                <small>仅此工作区</small>
              </button>
            </div>
            <div className="editor-card">
              <div className="editor-toolbar">
                <div className="editor-file">
                  <span className="file-dot" />
                  {promptScope === "global"
                    ? config?.paths.globalPromptPath || "~/.pi/agent/SYSTEM.md"
                    : config?.paths.projectPromptPath || ".pi/SYSTEM.md"}
                </div>
                <span>{promptDraft.length.toLocaleString()} 字符</span>
              </div>
              <textarea
                className="prompt-editor"
                value={promptDraft}
                spellCheck={false}
                placeholder="# Role&#10;&#10;你是一个谨慎、清晰的编程助手…"
                onChange={(event) => setPromptDraft(event.target.value)}
              />
            </div>
            {promptScope === "project" && !config?.settings.projectTrust ? (
              <div className="warning-card">
                <span>!</span>
                <div>
                  <strong>项目资源当前未被信任</strong>
                  <p>劳博士会忽略项目级系统提示词和 Skills。可在“引擎与工具”中开启。</p>
                </div>
                <button type="button" onClick={() => selectView("tools")}>
                  前往设置
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {view === "memory" ? (
          <section className="settings-view">
            <div className="settings-header">
              <div>
                <span className="eyebrow">CONTEXT</span>
                <h1>长期记忆</h1>
                <p>由你明确管理的持久上下文。它会追加到每个新的劳博士会话系统提示中。</p>
              </div>
              <button className="primary-button" type="button" onClick={saveMemory}>
                保存记忆
              </button>
            </div>
            <div className="memory-summary">
              <div className="memory-orbit">
                <span>劳</span>
              </div>
              <div>
                <strong>{config?.settings.memoryEnabled ? "记忆已启用" : "记忆已暂停"}</strong>
                <p>
                  {memoryDraft.length
                    ? `当前包含 ${memoryDraft.length.toLocaleString()} 个字符`
                    : "还没有保存长期记忆"}
                </p>
              </div>
              <Toggle
                checked={config?.settings.memoryEnabled || false}
                label="启用长期记忆"
                onChange={(checked) =>
                  void saveSettings({ memoryEnabled: checked }, checked ? "记忆已启用" : "记忆已暂停")
                }
              />
            </div>
            <div className="editor-card memory-editor-card">
              <div className="editor-toolbar">
                <div className="editor-file">
                  <span className="file-dot purple" />
                  {config?.paths.memoryPath || "~/.pi/agent/MEMORY.md"}
                </div>
                <span>Markdown</span>
              </div>
              <textarea
                className="prompt-editor memory-editor"
                value={memoryDraft}
                spellCheck={false}
                placeholder={"# 关于我\n\n- 我偏好 TypeScript\n- 回答使用中文\n\n# 当前项目\n\n- …"}
                onChange={(event) => setMemoryDraft(event.target.value)}
              />
            </div>
            <p className="footnote">
              劳博士原生会话通过 JSONL 和压缩摘要保留上下文；这里增加的是显式、可审阅的跨会话记忆，不会自动收集隐私信息。
            </p>
          </section>
        ) : null}

        {view === "skills" ? (
          <section className="settings-view">
            <div className="settings-header">
              <div>
                <span className="eyebrow">CAPABILITIES</span>
                <h1>Skills</h1>
                <p>按需注入的专业工作流。劳博士先读取描述，匹配任务时再加载完整内容。</p>
              </div>
              <button className="primary-button" type="button" onClick={openNewSkill}>
                ＋ 新建 Skill
              </button>
            </div>
            <div className="filter-row">
              <label className="search-field">
                <span>⌕</span>
                <input
                  value={skillQuery}
                  placeholder="搜索 Skills"
                  onChange={(event) => setSkillQuery(event.target.value)}
                />
              </label>
              <div className="filter-meta">
                {(config?.skills || []).filter((skill) => skill.enabled).length} 个已启用
              </div>
            </div>
            {!connected ? (
              <EmptyState
                glyph="◇"
                title={
                  desktopManaged ? "正在载入本机 Skills" : "连接后管理本机 Skills"
                }
                description={
                  connectionError ||
                  "Skills 保存在劳博士的全局目录或当前项目目录，不会上传到云端。"
                }
                action={
                  desktopManaged ? null : (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setConnectOpen(true)}
                    >
                      连接 Bridge
                    </button>
                  )
                }
              />
            ) : filteredSkills.length ? (
              <div className="skill-grid">
                {filteredSkills.map((skill) => (
                  <article className={`skill-card ${!skill.enabled ? "is-disabled" : ""}`} key={skill.id}>
                    <div className="skill-card-top">
                      <div className="skill-symbol">{skill.name.slice(0, 1).toUpperCase()}</div>
                      <Toggle
                        checked={skill.enabled}
                        label={`${skill.enabled ? "停用" : "启用"} ${skill.name}`}
                        onChange={(checked) => void toggleSkill(skill, checked)}
                      />
                    </div>
                    <div className="skill-scope">{skill.scope === "global" ? "GLOBAL" : "PROJECT"}</div>
                    <h3>{skill.name}</h3>
                    <p>{skill.description}</p>
                    <div className="skill-footer">
                      <button type="button" onClick={() => openEditSkill(skill)}>
                        编辑
                      </button>
                      <button className="danger-link" type="button" onClick={() => void deleteSkill(skill)}>
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                glyph="◇"
                title={skillQuery ? "没有匹配的 Skill" : "还没有 Skills"}
                description={
                  skillQuery
                    ? "换一个关键词试试。"
                    : "创建第一个 Skill，让劳博士掌握可复用的专业工作流。"
                }
                action={
                  !skillQuery ? (
                    <button className="secondary-button" type="button" onClick={openNewSkill}>
                      新建 Skill
                    </button>
                  ) : undefined
                }
              />
            )}
          </section>
        ) : null}

        {view === "providers" ? (
          <section className="settings-view">
            <div className="settings-header">
              <div>
                <span className="eyebrow">MODEL ACCESS</span>
                <h1>AI Keys</h1>
                <p>管理内置 Provider，或添加兼容 OpenAI、Anthropic、Google API 的第三方模型。</p>
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={!connected}
                onClick={() => openCustomProvider()}
              >
                ＋ 添加第三方模型
              </button>
            </div>
            <div className="security-note">
              <span className="security-lock">⌾</span>
              <div>
                <strong>Local-only credentials</strong>
                <p>Bridge 监听 127.0.0.1，并要求随机 Token。已保存的 Key 以掩码状态展示。</p>
              </div>
            </div>
            {configuredProviderCount > 0 && !config?.engineIntegration?.ready ? (
              <div className="warning-card provider-next-step">
                <span>!</span>
                <div>
                  <strong>Key 已保存，但嵌入式 Agent 还没有就绪</strong>
                  <p>
                    Studio 不会自动试用凭据。请由你在“引擎与工具”明确选择默认
                    Provider/模型，保存后才会同步到 Agent Engine。
                  </p>
                </div>
                <button type="button" onClick={() => setView("tools")}>
                  选择默认模型
                </button>
              </div>
            ) : null}
            <div className="provider-list">
              {(config?.providers || []).map((provider) => (
                <div className="provider-row" key={provider.id}>
                  <div className="provider-logo" style={{ background: provider.accent }}>
                    {provider.name.slice(0, 1)}
                  </div>
                  <div className="provider-name">
                    <strong>{provider.name}</strong>
                    <small>
                      {provider.custom
                        ? `${provider.models?.length || 0} 个模型 · ${provider.baseUrl}`
                        : `${provider.env} · ${provider.baseUrl}`}
                    </small>
                  </div>
                  <div className="provider-state">
                    <span className={provider.configured ? "configured" : ""}>
                      {provider.configured
                        ? provider.source === "environment"
                          ? "来自环境变量"
                          : provider.source === "models.json"
                            ? "models.json 已配置"
                          : provider.credentialType === "oauth"
                            ? "OAuth 已登录"
                            : "Key 已保存"
                        : "未配置"}
                    </span>
                  </div>
                  <div className="provider-actions">
                    {provider.custom ? (
                      <>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={() => openCustomProvider(provider)}
                        >
                          编辑
                        </button>
                        <button
                          className="icon-button subtle-danger"
                          type="button"
                          aria-label={`删除 ${provider.name}`}
                          onClick={() => void deleteCustomProvider(provider)}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={() => {
                            setProviderKey("");
                            setProviderBaseUrl(
                              provider.baseUrl || provider.defaultBaseUrl || "",
                            );
                            setProviderOpen(provider);
                          }}
                        >
                          {provider.configured ? "更新" : "添加 Key"}
                        </button>
                        {provider.configured && provider.source === "auth.json" ? (
                          <button
                            className="icon-button subtle-danger"
                            type="button"
                            aria-label={`移除 ${provider.name} 凭据`}
                            onClick={() => void deleteProviderKey(provider)}
                          >
                            ×
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!connected ? (
              <div className="inline-empty">
                <span>
                  {desktopManaged
                    ? connectionError || "正在载入本机 Provider 状态…"
                    : "未连接 Bridge，Provider 状态尚不可用。"}
                </span>
                {!desktopManaged ? (
                  <button type="button" onClick={() => setConnectOpen(true)}>
                    连接
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {view === "tools" ? (
          <section className="settings-view">
            <div className="settings-header">
              <div>
                <span className="eyebrow">RUNTIME</span>
                <h1>引擎与工具</h1>
                <p>设置劳博士的工作目录、推理级别以及可供 Agent 调用的内置工具。</p>
              </div>
              <span className={`runtime-badge ${connected ? "online" : ""}`}>
                <i />
                {desktopManaged
                  ? connected
                    ? "劳博士 ready"
                    : "劳博士 starting"
                  : connected
                    ? "Engine online"
                    : "Engine offline"}
              </span>
            </div>
            <div
              className={`engine-readiness-card ${
                config?.engineIntegration?.ready ? "is-ready" : "needs-setup"
              }`}
              aria-live="polite"
            >
              <span>{config?.engineIntegration?.ready ? "✓" : "!"}</span>
              <div>
                <strong>
                  {config?.engineIntegration?.ready
                    ? "嵌入式 Agent Engine 已就绪"
                    : "嵌入式 Agent Engine 尚未就绪"}
                </strong>
                <p>
                  {config?.engineIntegration?.ready
                    ? `${config.engineIntegration.defaultModel?.provider}/${config.engineIntegration.defaultModel?.id} 已同步；这里只做本地配置核验，不会发送测试请求。`
                    : config?.engineIntegration?.message ||
                      (engineIssue?.code === "ENGINE_DEFAULT_MODEL_REQUIRED"
                        ? "请明确选择默认 Provider/模型。只保存 Key 不会自动选择或试用模型。"
                        : engineIssue?.code === "ENGINE_THINKING_LEVEL_UNSUPPORTED"
                          ? "当前模型不支持所选推理级别。请改为 off，或重新保存默认模型让 Studio 自动校正。"
                        : engineIssue?.message ||
                          "正在读取项目中的 Agent Engine 配置。")}
                </p>
              </div>
            </div>
            <div className="settings-card">
              <div className="setting-row vertical-mobile">
                <div>
                  <strong>工作目录</strong>
                  <p>劳博士的文件工具和终端命令都从这里开始。</p>
                </div>
                <input
                  className="path-input"
                  value={config?.settings.workspacePath || ""}
                  placeholder="/path/to/project"
                  onChange={(event) =>
                    setConfig((current) =>
                      current
                        ? {
                            ...current,
                            settings: {
                              ...current.settings,
                              workspacePath: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  onBlur={() =>
                    config &&
                    void saveSettings(
                      { workspacePath: config.settings.workspacePath },
                      "工作目录已更新",
                    )
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>信任项目资源</strong>
                  <p>允许加载项目内的 .pi 配置、系统提示词、扩展和 Skills。</p>
                </div>
                <Toggle
                  checked={config?.settings.projectTrust || false}
                  label="信任项目资源"
                  onChange={(checked) =>
                    void saveSettings(
                      { projectTrust: checked },
                      checked ? "项目资源已信任" : "项目资源已隔离",
                    )
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>默认推理级别</strong>
                  <p>更高的级别通常更慢，也会消耗更多 Token。</p>
                </div>
                <select
                  className="setting-select"
                  value={config?.settings.thinkingLevel || "medium"}
                  onChange={(event) =>
                    void saveSettings(
                      { thinkingLevel: event.target.value },
                      "推理级别已更新",
                    )
                  }
                >
                  {["off", "minimal", "low", "medium", "high", "xhigh", "max"].map(
                    (level) => (
                      <option
                        value={level}
                        key={level}
                        disabled={
                          Array.isArray(defaultModelInfo?.thinkingLevels)
                            ? !defaultModelInfo.thinkingLevels.includes(level)
                            : defaultModelInfo?.reasoning === false && level !== "off"
                        }
                      >
                        {level}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="setting-row vertical-mobile">
                <div>
                  <strong>默认模型</strong>
                  <p>这是嵌入式 Agent 的必选项；Studio 不会替你猜测或测试模型。</p>
                </div>
                <select
                  className="setting-select model-setting"
                  value={
                    config?.settings.defaultProvider && config?.settings.defaultModel
                      ? `${config.settings.defaultProvider}/${config.settings.defaultModel}`
                      : ""
                  }
                  onChange={(event) => {
                    const model = splitModel(event.target.value);
                    void saveSettings(
                      {
                        defaultProvider: model.provider,
                        defaultModel: model.modelId,
                      },
                      "默认模型已更新",
                    );
                  }}
                >
                  <option value="">请选择默认 Provider / 模型</option>
                  {models.map((model) => (
                    <option
                      key={`${model.provider}/${model.id}`}
                      value={`${model.provider}/${model.id}`}
                    >
                      {model.name || model.id} · {model.provider}
                    </option>
                  ))}
                </select>
              </div>
              {config?.studioControl.canShutdown ? (
                <div className="setting-row">
                  <div>
                    <strong>开发 Studio</strong>
                    <p>核验完成后可关闭完整 Studio；项目中的 Agent API 和配置会保留。</p>
                  </div>
                  <button
                    className="secondary-button studio-shutdown-button"
                    type="button"
                    onClick={() => void shutdownStudio()}
                  >
                    关闭开发 Studio
                  </button>
                </div>
              ) : null}
            </div>

            <div className="section-title-row">
              <div>
                <h2>Built-in tools</h2>
                <p>每次启动 RPC 会话时传给劳博士的工具白名单。</p>
              </div>
              <span>{config?.settings.allowedTools.length || 0} / {builtInTools.length}</span>
            </div>
            <div className="tool-grid">
              {builtInTools.map((tool) => {
                const enabled = config?.settings.allowedTools.includes(tool.id) || false;
                return (
                  <button
                    type="button"
                    className={`tool-card ${enabled ? "is-enabled" : ""}`}
                    key={tool.id}
                    onClick={() => {
                      const current = config?.settings.allowedTools || [];
                      const allowedTools = enabled
                        ? current.filter((item) => item !== tool.id)
                        : [...current, tool.id];
                      void saveSettings({ allowedTools }, "工具权限已更新");
                    }}
                  >
                    <span className="tool-card-icon">{enabled ? "✓" : "·"}</span>
                    <span>
                      <strong>{tool.label}</strong>
                      <small>{tool.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mcp-card">
              <div className="mcp-icon">M</div>
              <div>
                <strong>MCP 连接</strong>
                <p>
                  劳博士当前没有原生 MCP 客户端。可通过 Extension 注册 MCP 工具；客户端不会伪装成已经接入。
                </p>
              </div>
              <span className="coming-soon">EXTENSION</span>
            </div>
          </section>
        ) : null}
      </main>

	  {agentConfirmation ? (
		<div className="modal-layer" role="presentation">
		  <button
			className="modal-backdrop"
			type="button"
			aria-label="取消操作"
			disabled={confirmationSubmitting}
			onClick={() => void respondToAgentConfirmation(false)}
		  />
		  <section className="modal-card agent-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="agent-confirm-title">
			<div className="modal-heading">
			  <div className="modal-symbol destructive">!</div>
			  <div>
				<h2 id="agent-confirm-title">{agentConfirmation.title}</h2>
				<p>此请求由当前 Agent 发起，只有你的本次确认才能继续。</p>
			  </div>
			</div>
			<p className="agent-confirm-message">{agentConfirmation.message}</p>
			<div className="modal-actions">
			  <button className="secondary-button" type="button" disabled={confirmationSubmitting} onClick={() => void respondToAgentConfirmation(false)}>取消</button>
			  <button className="destructive-button" type="button" disabled={confirmationSubmitting} onClick={() => void respondToAgentConfirmation(true)}>{confirmationSubmitting ? "处理中…" : "确认删除"}</button>
			</div>
		  </section>
		</div>
	  ) : null}

      {connectOpen && !desktopManaged ? (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="关闭"
            onClick={() => setConnectOpen(false)}
          />
          <section className="modal-card connect-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div className="modal-symbol">劳</div>
              <div>
                <h2>连接本机 Agent Bridge</h2>
                <p>Bridge 只监听 localhost，负责安全地连接网页与劳博士引擎。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setConnectOpen(false)}>
                ×
              </button>
            </div>
            {desktopManaged ? (
              <div className="terminal-tip">
                <span>✓</span>
                <code>桌面服务已自动管理</code>
                <small>无需填写地址或 Token</small>
              </div>
            ) : (
              <>
                <label className="field">
                  <span>Bridge 地址</span>
                  <input
                    value={bridgeUrl}
                    onChange={(event) => setBridgeUrl(event.target.value)}
                    placeholder={DEFAULT_BRIDGE_URL}
                  />
                </label>
                <label className="field">
                  <span>Bridge Token</span>
                  <input
                    type="password"
                    value={bridgeToken}
                    autoComplete="off"
                    onChange={(event) => setBridgeToken(event.target.value)}
                    placeholder="从 Bridge 终端复制"
                  />
                </label>
                <div className="terminal-tip">
                  <span>$</span>
                  <code>npm run bridge</code>
                  <small>在 pi-client 目录运行</small>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setConnectOpen(false)}>
                稍后
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!bridgeToken || connecting}
                onClick={() => void connectBridge()}
              >
                {connecting ? "连接中…" : "连接"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {skillOpen ? (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭" onClick={() => setSkillOpen(false)} />
          <form className="modal-card skill-modal" onSubmit={saveSkill}>
            <div className="modal-heading">
              <div className="modal-symbol neutral">◇</div>
              <div>
                <h2>{skillDraft.path ? "编辑 Skill" : "新建 Skill"}</h2>
                <p>生成符合 Agent Skills 规范的 SKILL.md。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSkillOpen(false)}>
                ×
              </button>
            </div>
            <div className="two-fields">
              <label className="field">
                <span>名称</span>
                <input
                  required
                  disabled={Boolean(skillDraft.path)}
                  value={skillDraft.name || ""}
                  pattern="[a-z0-9][a-z0-9-]{0,63}"
                  placeholder="code-review"
                  onChange={(event) => setSkillDraft({ ...skillDraft, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>范围</span>
                <select
                  disabled={Boolean(skillDraft.path)}
                  value={skillDraft.scope || "global"}
                  onChange={(event) =>
                    setSkillDraft({
                      ...skillDraft,
                      scope: event.target.value as "global" | "project",
                    })
                  }
                >
                  <option value="global">全局</option>
                  <option value="project">当前项目</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>描述</span>
              <input
                required
                value={skillDraft.description || ""}
                placeholder="这个 Skill 做什么，以及应该在什么时候使用"
                onChange={(event) =>
                  setSkillDraft({ ...skillDraft, description: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>工作流说明</span>
              <textarea
                required
                className="skill-editor"
                value={skillDraft.instructions || ""}
                onChange={(event) =>
                  setSkillDraft({ ...skillDraft, instructions: event.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setSkillOpen(false)}>
                取消
              </button>
              <button className="primary-button" type="submit">
                保存 Skill
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {customProviderOpen ? (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="关闭"
            onClick={() => setCustomProviderOpen(false)}
          />
          <form
            className="modal-card custom-provider-modal"
            onSubmit={saveCustomProvider}
          >
            <div className="modal-heading">
              <div className="modal-symbol neutral">＋</div>
              <div>
                <h2>
                  {customProviderDraft.originalId
                    ? "编辑第三方模型"
                    : "添加第三方模型"}
                </h2>
                <p>配置劳博士原生 models.json；API Key 单独保存在仅当前用户可读写的本机凭据文件。</p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCustomProviderOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="two-fields equal-fields">
              <label className="field">
                <span>Provider 名称</span>
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={customProviderDraft.name}
                  placeholder="例如：公司 AI Gateway"
                  onChange={(event) =>
                    setCustomProviderDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Provider ID</span>
                <input
                  required
                  pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?"
                  value={customProviderDraft.id}
                  placeholder="company-gateway"
                  onChange={(event) =>
                    setCustomProviderDraft((current) => ({
                      ...current,
                      id: event.target.value.toLowerCase(),
                    }))
                  }
                />
              </label>
            </div>

            <div className="two-fields">
              <label className="field">
                <span>Base URL</span>
                <input
                  required
                  type="url"
                  value={customProviderDraft.baseUrl}
                  placeholder="https://api.example.com/v1"
                  onChange={(event) =>
                    setCustomProviderDraft((current) => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>API 协议</span>
                <select
                  value={customProviderDraft.api}
                  onChange={(event) =>
                    setCustomProviderDraft((current) => ({
                      ...current,
                      api: event.target.value,
                    }))
                  }
                >
                  <option value="openai-completions">OpenAI Chat Completions</option>
                  <option value="openai-responses">OpenAI Responses</option>
                  <option value="anthropic-messages">Anthropic Messages</option>
                  <option value="google-generative-ai">Google Generative AI</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>API Key</span>
              <input
                required={
                  !customProviderDraft.originalId &&
                  !customProviderDraft.localNoKey
                }
                disabled={customProviderDraft.localNoKey}
                type="password"
                autoComplete="new-password"
                value={customProviderDraft.key}
                placeholder={
                  customProviderDraft.originalId
                    ? "留空则保留当前 Key"
                    : "保存后不会再次显示"
                }
                onChange={(event) =>
                  setCustomProviderDraft((current) => ({
                    ...current,
                    key: event.target.value,
                  }))
                }
              />
            </label>
            <div className="inline-toggle-row">
              <div>
                <strong>本地服务无需 API Key</strong>
                <small>适用于 Ollama、LM Studio 或本机 vLLM。</small>
              </div>
              <Toggle
                checked={customProviderDraft.localNoKey}
                label="本地服务无需 API Key"
                onChange={(localNoKey) =>
                  setCustomProviderDraft((current) => ({
                    ...current,
                    localNoKey,
                    key: localNoKey ? "" : current.key,
                  }))
                }
              />
            </div>

            <div className="custom-model-heading">
              <div>
                <strong>模型</strong>
                <small>模型 ID 会原样发送给第三方接口。</small>
              </div>
              <button
                className="secondary-button compact"
                type="button"
                onClick={() =>
                  setCustomProviderDraft((current) => ({
                    ...current,
                    models: [...current.models, newCustomModel()],
                  }))
                }
              >
                ＋ 添加模型
              </button>
            </div>

            <div className="custom-model-list">
              {customProviderDraft.models.map((model, index) => (
                <div className="custom-model-card" key={model.rowId}>
                  <div className="custom-model-card-title">
                    <strong>模型 {index + 1}</strong>
                    {customProviderDraft.models.length > 1 ? (
                      <button
                        className="danger-link"
                        type="button"
                        onClick={() =>
                          setCustomProviderDraft((current) => ({
                            ...current,
                            models: current.models.filter(
                              (candidate) => candidate.rowId !== model.rowId,
                            ),
                          }))
                        }
                      >
                        移除
                      </button>
                    ) : null}
                  </div>
                  <div className="two-fields equal-fields">
                    <label className="field">
                      <span>模型 ID</span>
                      <input
                        required
                        value={model.id}
                        placeholder="model-id"
                        onChange={(event) =>
                          updateCustomModel(model.rowId, { id: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>显示名称（可选）</span>
                      <input
                        value={model.name}
                        placeholder={model.id || "模型名称"}
                        onChange={(event) =>
                          updateCustomModel(model.rowId, {
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="two-fields equal-fields">
                    <label className="field">
                      <span>上下文长度</span>
                      <input
                        required
                        min="1"
                        step="1"
                        type="number"
                        value={model.contextWindow}
                        onChange={(event) =>
                          updateCustomModel(model.rowId, {
                            contextWindow: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>最大输出 Token</span>
                      <input
                        required
                        min="1"
                        step="1"
                        type="number"
                        value={model.maxTokens}
                        onChange={(event) =>
                          updateCustomModel(model.rowId, {
                            maxTokens: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="model-capability-row">
                    <div>
                      <span>推理模型</span>
                      <Toggle
                        checked={model.reasoning}
                        label={`${model.id || "模型"}支持推理`}
                        onChange={(reasoning) =>
                          updateCustomModel(model.rowId, { reasoning })
                        }
                      />
                    </div>
                    <div>
                      <span>支持图片输入</span>
                      <Toggle
                        checked={model.vision}
                        label={`${model.id || "模型"}支持图片`}
                        onChange={(vision) =>
                          updateCustomModel(model.rowId, { vision })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="key-destination">
              <span>配置文件</span>
              <code>
                {config
                  ? `${config.paths.modelsPath} + ${config.paths.authPath}`
                  : "~/.pi/agent/models.json + auth.json"}
              </code>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCustomProviderOpen(false)}
              >
                取消
              </button>
              <button className="primary-button" type="submit">
                保存第三方模型
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {providerOpen ? (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭" onClick={() => setProviderOpen(null)} />
          <form className="modal-card provider-modal" onSubmit={saveProviderKey}>
            <div className="modal-heading">
              <div className="provider-logo large" style={{ background: providerOpen.accent }}>
                {providerOpen.name.slice(0, 1)}
              </div>
              <div>
                <h2>{providerOpen.name}</h2>
                <p>保存 API Key，并按需覆盖该渠道的请求地址。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setProviderOpen(null)}>
                ×
              </button>
            </div>
            <label className="field">
              <span>API Key</span>
              <input
                autoFocus
                required={!providerOpen.configured}
                type="password"
                autoComplete="new-password"
                value={providerKey}
                onChange={(event) => setProviderKey(event.target.value)}
                placeholder={
                  providerOpen.configured
                    ? "留空则保留当前 Key"
                    : "粘贴 Key；保存后不会再次显示"
                }
              />
            </label>
            <label className="field">
              <span>请求地址（Base URL）</span>
              <input
                required
                type="url"
                value={providerBaseUrl}
                onChange={(event) => setProviderBaseUrl(event.target.value)}
                placeholder={providerOpen.defaultBaseUrl || "https://api.example.com/v1"}
              />
              <small className="field-hint">
                默认地址：{providerOpen.defaultBaseUrl || providerOpen.baseUrl}
              </small>
            </label>
            <div className="key-destination">
              <span>写入</span>
              <code>
                {config
                  ? `${config.paths.authPath} + ${config.paths.modelsPath}`
                  : "~/.pi/agent/auth.json + models.json"}
              </code>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setProviderOpen(null)}>
                取消
              </button>
              <button className="primary-button" type="submit">
                安全保存
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {previewImage ? (
        <div className="attachment-lightbox" role="dialog" aria-modal="true">
          <button
            className="attachment-lightbox-backdrop"
            type="button"
            aria-label="关闭图片预览"
            onClick={() => setPreviewImage(null)}
          />
          <div className="attachment-lightbox-content">
            <div className="attachment-lightbox-header">
              <span>{previewImage.attachment.name}</span>
              <div>
                <button
                  type="button"
                  onClick={() => void downloadAttachment(previewImage.attachment)}
                >
                  下载
                </button>
                <button
                  type="button"
                  aria-label="关闭图片预览"
                  onClick={() => setPreviewImage(null)}
                >
                  ×
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated local blob URL */}
            <img src={previewImage.url} alt={previewImage.attachment.name} />
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
