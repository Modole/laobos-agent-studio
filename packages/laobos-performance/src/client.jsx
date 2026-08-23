/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS module factory */
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from "@tanstack/virtual-core";
import {
  CHAT_BOTTOM_THRESHOLD_PX,
  CHAT_ROW_ESTIMATE_PX,
  CHAT_VIRTUAL_OVERSCAN,
  CHAT_VIRTUAL_THRESHOLD,
  chatAnchorScrollTop,
  isNearChatBottom,
  virtualChatPadding,
} from "./chat-window.mjs";

window.__ModuleLoader__.load({
  id: "@laobos/dsh-performance",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const Primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const {
      memo,
      useCallback,
      useEffect,
      useLayoutEffect,
      useMemo,
      useReducer,
      useRef,
      useState,
    } = React;

    const css = `
      .lbs-chat-window-root{display:flex;flex:auto;flex-direction:column;min-height:0;position:relative}
      .lbs-chat-window-scroll{flex:auto;min-height:0;overflow-y:auto;padding:16px calc(var(--dsh-composer-side-clearance) + 16px)}
      [data-conversation-scroll] .lbs-chat-window-root{flex:none;height:auto;min-height:auto}
      [data-conversation-scroll] .lbs-chat-window-scroll{flex:none;min-height:auto;overflow:visible}
      .lbs-chat-window-column{display:flex;flex-direction:column;margin:0 auto;max-width:var(--dsh-chat-content-width);min-width:0;width:100%}
      .lbs-chat-window-prelude{display:flex;flex-direction:column;gap:16px}
      .lbs-chat-window-list{min-width:0;width:100%}
      .lbs-chat-window-row{box-sizing:border-box;min-width:0;padding-bottom:16px;width:100%}
      .lbs-chat-window-row:empty{display:none}
      .lbs-chat-window-tail{display:flex;flex-direction:column;gap:16px}
      .lbs-chat-window-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .lbs-chat-window-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
      .lbs-chat-window-older{display:flex;justify-content:center;padding-bottom:16px}
      .lbs-chat-window-older button{background:var(--dsw-alias-interactive-bg-hover-solid);border:0;border-radius:14px;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;padding:4px 12px}
      .lbs-chat-window-older button:disabled{cursor:default;opacity:.6}
      .lbs-chat-window-status{align-items:center;align-self:flex-start;background:linear-gradient(90deg,var(--dsw-static-deepseek-500) 0%,var(--dsw-static-deepseek-500) 40%,var(--dsw-static-deepseek-200) 50%,var(--dsw-static-deepseek-500) 60%,var(--dsw-static-deepseek-500) 100%);background-clip:text;background-position:100% 0;background-size:250% 100%;color:transparent;display:inline-flex;flex:none;font:var(--dsw-font-s-strong-14);height:26px;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:lbs-chat-window-shimmer 1.8s linear infinite;white-space:nowrap}
      .lbs-chat-window-clock{color:var(--dsw-alias-label-caption);font:var(--dsw-font-xs-13);font-variant-numeric:tabular-nums;font-weight:400;margin-left:8px;-webkit-text-fill-color:var(--dsw-alias-label-caption)}
      .lbs-chat-window-bottom-slot{bottom:16px;display:flex;height:0;justify-content:flex-end;padding-right:max(0px,calc((100% - var(--dsh-chat-content-width))/2));pointer-events:none;position:sticky;z-index:8}
      [data-conversation-scroll] .lbs-chat-window-bottom-slot{bottom:calc(var(--dsh-composer-height,152px) + 16px)}
      .lbs-chat-window-bottom{align-items:center;background:var(--dsw-alias-button-floating-fill);border:1px solid var(--dsw-alias-border-l2);border-radius:100px;box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);cursor:pointer;display:flex;height:34px;justify-content:center;margin-top:-34px;padding:0;pointer-events:auto;width:34px}
      .lbs-chat-window-bottom:hover{background:var(--dsw-alias-button-floating-hover)}
      .lbs-chat-window-pending{align-items:flex-end;display:flex;flex-direction:column;gap:6px;opacity:.82}
      .lbs-chat-window-pending-stack{align-items:flex-end;display:flex;flex-direction:column;gap:8px;max-width:min(525px,82%);min-width:0}
      .lbs-chat-window-pending-bubble{background:var(--dsw-specific-bubble);border-radius:22px;color:var(--dsw-alias-label-primary);font-size:16px;line-height:24px;max-width:100%;padding:10px 16px}
      .lbs-chat-window-pending-extra{margin-top:8px}
      .lbs-chat-window-modal-action{min-width:72px}
      @keyframes lbs-chat-window-shimmer{to{background-position:0 0}}
      @media(prefers-reduced-motion:reduce){.lbs-chat-window-status{animation:none;background-position:0 0;background-size:100% 100%}}
    `;
    if (
      typeof document !== "undefined"
      && document.querySelector('style[data-plugin-css="@laobos/dsh-performance/chat-window"]') === null
    ) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-performance/chat-window";
      style.textContent = css;
      document.head.append(style);
    }

    function useElementVirtualizer(options) {
      const [, rerender] = useReducer((value) => value + 1, 0);
      const optionsRef = useRef(options);
      optionsRef.current = options;
      const resolved = {
        ...options,
        observeElementRect,
        observeElementOffset,
        scrollToFn: elementScroll,
        onChange: (instance, sync) => {
          rerender();
          optionsRef.current.onChange?.(instance, sync);
        },
      };
      const [instance] = useState(() => new Virtualizer(resolved));
      instance.setOptions(resolved);
      useLayoutEffect(() => instance._didMount(), [instance]);
      useLayoutEffect(() => instance._willUpdate());
      return instance;
    }

    function scrollerOf(from) {
      return from.closest("[data-conversation-scroll]") || from;
    }

    function anchorElement(list, key) {
      for (const row of list.querySelectorAll("[data-chat-anchor-key]")) {
        if (row.dataset.chatAnchorKey === key) return row;
      }
      return null;
    }

    function flowTop(row, scrollport) {
      return row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top;
    }

    function pagingAnchor(list, scrollport) {
      const viewport = scrollport.getBoundingClientRect();
      const visibleBottom = scrollport.querySelector("[data-composer-seat]")?.getBoundingClientRect().top
        || viewport.bottom;
      const rows = [...list.querySelectorAll("[data-chat-anchor-key]")];
      return rows.find((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom > viewport.top && rect.top < visibleBottom;
      }) || rows[0] || null;
    }

    function scrollPosition(list, scrollport) {
      const row = pagingAnchor(list, scrollport);
      const anchorKey = row?.dataset.chatAnchorKey;
      if (row === null || anchorKey === undefined) return null;
      return {
        anchorKey,
        anchorTop: flowTop(row, scrollport),
        scrollTop: scrollport.scrollTop,
      };
    }

    function openFailureMessage(error, fallback) {
      const message = error instanceof Error ? error.message : String(error);
      return message === "" ? fallback : message;
    }

    function isFolderOpenPath(path) {
      return path === ".";
    }

    function runningTurnStartTime(timeline) {
      let latest = null;
      for (const turn of timeline.turns.values()) {
        if (turn.status === "open" && turn.start !== undefined) latest = turn.start.time;
      }
      return latest;
    }

    const TASK_PROCESS_KINDS = new Set([
      "assistant-step",
      "tool-call",
      "command",
      "manual-compaction",
      "model-retry",
    ]);

    function chatNodeTurn(node) {
      const location = node?.location;
      if (location?.kind === "turn" || location?.kind === "step") {
        const turn = location.turn?.turn ?? location.turn;
        if (turn !== undefined && turn !== null) return String(turn);
      }
      const turn = node?.data?.turn;
      return turn === undefined || turn === null ? null : String(turn);
    }

    function taskTurnMetadata(order, nodeStore) {
      const byTurn = new Map();
      for (const nodeKey of order) {
        const node = nodeStore.get(nodeKey);
        const turn = chatNodeTurn(node);
        if (turn === null) continue;
        let meta = byTurn.get(turn);
        if (meta === undefined) {
          meta = {
            completed: false,
            finalKey: null,
            finalSeq: null,
            processCount: 0,
            toolCount: 0,
          };
          byTurn.set(turn, meta);
        }
        if (node.kind === "tool-call") meta.toolCount += 1;
        if (TASK_PROCESS_KINDS.has(node.kind)) meta.processCount += 1;
        if (node.kind === "turn-tail") {
          meta.completed = true;
          meta.finalSeq = node.data?.closing?.finalNode?.seq ?? null;
        }
      }
      for (const nodeKey of order) {
        const node = nodeStore.get(nodeKey);
        if (node?.kind !== "assistant-step") continue;
        const turn = chatNodeTurn(node);
        const meta = turn === null ? undefined : byTurn.get(turn);
        if (
          meta?.finalSeq !== null &&
          node.data?.finalNode?.seq === meta.finalSeq
        ) {
          meta.finalKey = nodeKey;
          meta.processCount = Math.max(0, meta.processCount - 1);
        }
      }
      return byTurn;
    }

    function formatRunDuration(ms, t) {
      const total = Math.max(0, Math.floor(ms / 1_000));
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return minutes > 0
        ? t("duration.minutes", { minutes, seconds: String(seconds).padStart(2, "0") })
        : t("duration.seconds", { seconds });
    }

    function TurnStatus({ startTime, t }) {
      const [mountedAt] = useState(() => Date.now());
      const anchor = startTime || mountedAt;
      const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - anchor));
      useEffect(() => {
        const tick = () => setElapsedMs(Math.max(0, Date.now() - anchor));
        tick();
        const id = window.setInterval(tick, 1_000);
        return () => window.clearInterval(id);
      }, [anchor]);
      return (
        <div className="lbs-chat-window-status" role="status" aria-live="polite">
          Deep diving...
          {elapsedMs >= 15_000 ? (
            <span className="lbs-chat-window-clock" aria-hidden="true">
              {formatRunDuration(elapsedMs, t)}
            </span>
          ) : null}
        </div>
      );
    }

    function contentParts(content) {
      const texts = [];
      const images = [];
      const rest = [];
      for (const block of Array.isArray(content) ? content : []) {
        if (block?.type === "text" && typeof block.text === "string") texts.push(block.text);
        else if (block?.type === "image" && block.attachment !== undefined) {
          images.push({ attachment: block.attachment });
        } else rest.push(block);
      }
      return { text: texts.join(""), images, rest };
    }

    function PendingSteeringBubble({ content, renderMessageImages, t }) {
      const { text, images, rest } = contentParts(content);
      return (
        <div className="lbs-chat-window-pending" data-pending-steering="true" data-time-hover-root="true">
          <div className="lbs-chat-window-pending-stack">
            {renderMessageImages({ images, align: "end" })}
            {text !== "" || rest.length > 0 ? (
              <div className="lbs-chat-window-pending-bubble">
                <Primitives.MessageText text={text} />
                {rest.map((block, index) => (
                  <div className="lbs-chat-window-pending-extra" key={index}>
                    <Primitives.JsonBlock
                      label={t("message.extraBlock")}
                      payload={block}
                      truncatedLabel={(total) => t("json.truncated", { total })}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    const ChatNodeSeat = memo(function ChatNodeSeat({
      nodeKey,
      selectedCallId,
      cwd,
      openFile,
      inspectCall,
      forkAt,
      renderMessageImages,
      fileMentions,
      useSession,
      renderSlot,
      t,
    }) {
      const node = useSession((snapshot) => snapshot.chat.nodes.get(nodeKey));
      const owner = useMemo(() => node === undefined ? null : {
        node,
        selectedCallId,
        cwd,
        openFile,
        inspectCall,
        forkAt,
        renderMessageImages,
        fileMentions,
      }, [
        node,
        selectedCallId,
        cwd,
        openFile,
        inspectCall,
        forkAt,
        renderMessageImages,
        fileMentions,
      ]);
      if (owner === null) return null;
      return (
        <div
          data-chat-anchor-key={node.key}
          data-chat-flow-key={node.key}
          data-chat-flow-kind={node.kind}
        >
          {renderSlot("conversation.chat.node", owner, {
            entryKey: node.kind,
            hookContext: nodeKey,
            fallback: (
              <Primitives.JsonBlock
                label={t("message.unknownSurface", { type: node.kind })}
                payload={node.data}
                truncatedLabel={(total) => t("json.truncated", { total })}
              />
            ),
          })}
        </div>
      );
    });

    function FileOpenErrorDialog({ path, message, busy, onClose, onRetry, t }) {
      return (
        <Primitives.Modal
          open
          onClose={onClose}
          closeLabel={t("close")}
          title={t(isFolderOpenPath(path) ? "fileOpen.folderTitle" : "fileOpen.title")}
          description={message}
          footer={(
            <>
              <Primitives.Button variant="outline" className="lbs-chat-window-modal-action" onClick={onClose}>
                {t("cancel")}
              </Primitives.Button>
              <Primitives.Button variant="primary" className="lbs-chat-window-modal-action" disabled={busy} onClick={onRetry}>
                {t("retry")}
              </Primitives.Button>
            </>
          )}
        />
      );
    }

    const navigationViews = new Map();
    const navigationBridge = {
      version: 1,
      forSession: (sessionId) => navigationViews.get(sessionId),
    };

    function publishNavigationView(sessionId, view) {
      navigationViews.set(sessionId, view);
      window.__laobosChatWindowing = navigationBridge;
      return () => {
        if (navigationViews.get(sessionId) === view) navigationViews.delete(sessionId);
        if (navigationViews.size === 0 && window.__laobosChatWindowing === navigationBridge) {
          delete window.__laobosChatWindowing;
        }
      };
    }

    function OptimizedChatView({
      useSession,
      useSessions,
      useStore,
      renderSlot,
      sessionId,
      openFile,
      loadOlder,
      loadImage,
      inspectCall,
      chatScroll,
      forkAt,
      fileMentions,
      t,
      chatKit,
    }) {
      const order = useSession((snapshot) => snapshot.chat.order);
      const nodeStore = useSession((snapshot) => snapshot.chat.nodes);
      const timeline = useSession((snapshot) => snapshot.chat.timeline);
      const inbox = useSession((snapshot) => snapshot.queue);
      const cwd = useSessions((snapshot) => snapshot.byId[sessionId]?.cwd);
      const running = useSession((snapshot) => snapshot.running);
      const openState = useSession((snapshot) => snapshot.openState);
      const openError = useSession((snapshot) => snapshot.openError);
      const hasMore = useSession((snapshot) => snapshot.hasMore);
      const loadingOlder = useSession((snapshot) => snapshot.loadingOlder);
      const selectedCallId = useStore((snapshot) => snapshot.selection?.callId);
      const NodeSeat = chatKit?.ChatNodeSeat || ChatNodeSeat;
      const PendingBubble = chatKit?.PendingSteeringBubble || PendingSteeringBubble;
      const RunningStatus = chatKit?.TurnStatus || TurnStatus;
      const OpenErrorDialog = chatKit?.FileOpenErrorDialog || FileOpenErrorDialog;

      const [fileOpenError, setFileOpenError] = useState(null);
      const [fileOpenBusy, setFileOpenBusy] = useState(false);
      const fileOpenRequest = useRef(0);
      const requestOpenFile = useCallback((path) => {
        const id = ++fileOpenRequest.current;
        setFileOpenBusy(true);
        Promise.resolve(openFile(path)).then(() => {
          if (id !== fileOpenRequest.current) return;
          setFileOpenError(null);
          setFileOpenBusy(false);
        }, (error) => {
          if (id !== fileOpenRequest.current) return;
          setFileOpenError({
            path,
            message: openFailureMessage(
              error,
              t(isFolderOpenPath(path) ? "fileOpen.folderUnknown" : "fileOpen.unknown"),
            ),
          });
          setFileOpenBusy(false);
        });
      }, [openFile, t]);
      const closeFileOpenError = useCallback(() => {
        fileOpenRequest.current += 1;
        setFileOpenError(null);
        setFileOpenBusy(false);
      }, []);

      const pendingSteering = useMemo(
        () => inbox.filter((item) => item.placement === "steering"),
        [inbox],
      );
      const renderMessageImages = useCallback((owner) => renderSlot(
        "conversation.message.images",
        { ...owner, loadImage },
      ), [loadImage, renderSlot]);
      const runningTurnStart = useMemo(() => runningTurnStartTime(timeline), [timeline]);
      const taskTurns = useMemo(
        () => taskTurnMetadata(order, nodeStore),
        [nodeStore, order],
      );

      const listRef = useRef(null);
      const columnRef = useRef(null);
      const virtualListRef = useRef(null);
      const atBottomRef = useRef(true);
      const [atBottom, setAtBottom] = useState(true);
      const observedTopRef = useRef(0);
      const anchorRef = useRef(null);
      const firstSeqRef = useRef(null);
      const openedRef = useRef(false);
      const lastKeyRef = useRef(null);
      const lastSteeringIdRef = useRef(null);
      const followSigRef = useRef(null);
      const navigationRef = useRef(null);
      const scrollFrameRef = useRef(0);
      const [scrollMargin, setScrollMargin] = useState(0);

      const virtualizationEnabled = order.length > CHAT_VIRTUAL_THRESHOLD;
      const getScrollElement = useCallback(
        () => listRef.current === null ? null : scrollerOf(listRef.current),
        [],
      );
      const estimateSize = useCallback(() => CHAT_ROW_ESTIMATE_PX, []);
      const getItemKey = useCallback((index) => order[index] || index, [order]);
      const virtualizer = useElementVirtualizer({
        count: virtualizationEnabled ? order.length : 0,
        enabled: virtualizationEnabled,
        estimateSize,
        getItemKey,
        getScrollElement,
        initialRect: { width: 0, height: 720 },
        anchorTo: "end",
        overscan: CHAT_VIRTUAL_OVERSCAN,
        scrollEndThreshold: CHAT_BOTTOM_THRESHOLD_PX,
        scrollMargin,
      });
      const virtualItems = virtualizationEnabled ? virtualizer.getVirtualItems() : [];
      const padding = virtualChatPadding(
        virtualItems,
        virtualizationEnabled ? virtualizer.getTotalSize() : 0,
        scrollMargin,
      );

      useLayoutEffect(() => {
        const local = listRef.current;
        const virtualList = virtualListRef.current;
        if (local === null || virtualList === null || !virtualizationEnabled) return;
        const scrollport = scrollerOf(local);
        const margin = virtualList.getBoundingClientRect().top
          - scrollport.getBoundingClientRect().top
          + scrollport.scrollTop;
        const normalized = Math.max(0, margin);
        setScrollMargin((current) => Math.abs(current - normalized) < 0.5 ? current : normalized);
      }, [hasMore, loadingOlder, openState, virtualizationEnabled]);

      const firstKey = order[0];
      const firstSeq = firstKey === undefined ? null : nodeStore.get(firstKey)?.anchorSeq ?? null;
      const lastKey = order.at(-1) || null;
      const lastNode = lastKey === null ? undefined : nodeStore.get(lastKey);
      const lastSteeringId = pendingSteering.at(-1)?.id || null;
      const followSig = `${openState}:${firstSeq}:${lastKey}:${order.length}:${running ? 1 : 0}:${lastSteeringId || ""}`;

      const toBottom = useCallback((element) => {
        anchorRef.current = null;
        element.scrollTop = element.scrollHeight;
        observedTopRef.current = element.scrollTop;
        atBottomRef.current = true;
        setAtBottom(true);
        chatScroll.save(null);
      }, [chatScroll]);

      const restoreAnchor = useCallback((anchor, element) => {
        const index = order.indexOf(anchor.key);
        if (index < 0) return false;
        if (virtualizationEnabled) {
          const target = chatAnchorScrollTop(virtualizer.getMeasurements()[index], anchor.top);
          if (target !== undefined) element.scrollTop = target;
          else virtualizer.scrollToIndex(index, { align: "start" });
        }
        window.requestAnimationFrame(() => {
          const local = listRef.current;
          if (local === null) return;
          const currentScroller = scrollerOf(local);
          const row = anchorElement(local, anchor.key);
          if (row !== null) currentScroller.scrollTop += flowTop(row, currentScroller) - anchor.top;
          observedTopRef.current = currentScroller.scrollTop;
        });
        observedTopRef.current = element.scrollTop;
        return true;
      }, [order, virtualizationEnabled, virtualizer]);

      useLayoutEffect(() => {
        const local = listRef.current;
        if (local === null) return;
        const element = scrollerOf(local);
        if (openState === "open" && !openedRef.current) {
          openedRef.current = true;
          const saved = chatScroll.read();
          if (saved === null) toBottom(element);
          else {
            element.scrollTop = saved.scrollTop;
            restoreAnchor({ key: saved.anchorKey, top: saved.anchorTop }, element);
            const bottom = isNearChatBottom(element.scrollHeight, element.scrollTop, element.clientHeight);
            atBottomRef.current = bottom;
            setAtBottom(bottom);
            if (bottom) chatScroll.save(null);
          }
          firstSeqRef.current = firstSeq;
          lastKeyRef.current = lastKey;
          lastSteeringIdRef.current = lastSteeringId;
          followSigRef.current = followSig;
          return;
        }
        if (
          anchorRef.current !== null
          && firstSeq !== null
          && firstSeqRef.current !== null
          && firstSeq < firstSeqRef.current
        ) {
          const anchor = anchorRef.current;
          anchorRef.current = null;
          restoreAnchor(anchor, element);
          firstSeqRef.current = firstSeq;
          lastKeyRef.current = lastKey;
          lastSteeringIdRef.current = lastSteeringId;
          followSigRef.current = followSig;
          return;
        }
        firstSeqRef.current = firstSeq;
        const appendedUser = lastKey !== lastKeyRef.current && lastNode?.kind === "user";
        const appendedSteering = lastSteeringId !== null && lastSteeringId !== lastSteeringIdRef.current;
        const tipMoved = followSigRef.current !== followSig;
        lastKeyRef.current = lastKey;
        lastSteeringIdRef.current = lastSteeringId;
        followSigRef.current = followSig;
        if (appendedUser || appendedSteering || (tipMoved && atBottomRef.current)) toBottom(element);
      }, [
        chatScroll,
        firstSeq,
        followSig,
        lastKey,
        lastNode?.kind,
        lastSteeringId,
        openState,
        restoreAnchor,
        toBottom,
      ]);

      const onScrollRef = useRef(() => {});
      onScrollRef.current = () => {
        const local = listRef.current;
        if (local === null) return;
        const element = scrollerOf(local);
        const floor = Math.max(0, element.scrollHeight - element.clientHeight);
        const movedByReader = Math.abs(element.scrollTop - Math.min(observedTopRef.current, floor)) > 0.5;
        const bottom = movedByReader
          ? isNearChatBottom(element.scrollHeight, element.scrollTop, element.clientHeight)
          : atBottomRef.current;
        atBottomRef.current = bottom;
        setAtBottom((current) => current === bottom ? current : bottom);
        const position = bottom ? null : scrollPosition(local, element);
        if (bottom) anchorRef.current = null;
        else if (anchorRef.current !== null && position !== null) {
          anchorRef.current = { key: position.anchorKey, top: position.anchorTop };
        }
        if (bottom) chatScroll.save(null);
        else if (position !== null) chatScroll.save(position);
        observedTopRef.current = element.scrollTop;
      };

      useEffect(() => {
        const local = listRef.current;
        if (local === null) return undefined;
        const element = scrollerOf(local);
        const onScroll = () => {
          if (scrollFrameRef.current !== 0) return;
          scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = 0;
            onScrollRef.current();
          });
        };
        element.addEventListener("scroll", onScroll, { passive: true });
        return () => {
          element.removeEventListener("scroll", onScroll);
          if (scrollFrameRef.current !== 0) window.cancelAnimationFrame(scrollFrameRef.current);
          scrollFrameRef.current = 0;
        };
      }, []);

      const followRef = useRef(null);
      followRef.current = () => {
        const local = listRef.current;
        if (local !== null && atBottomRef.current) toBottom(scrollerOf(local));
      };
      useEffect(() => {
        const column = columnRef.current;
        const local = listRef.current;
        if (column === null || local === null || typeof ResizeObserver === "undefined") return undefined;
        const composer = scrollerOf(local).querySelector("[data-composer-seat]");
        const observer = new ResizeObserver(() => followRef.current?.());
        observer.observe(column);
        if (composer !== null) observer.observe(composer);
        return () => observer.disconnect();
      }, []);

      useEffect(() => {
        if (!loadingOlder) anchorRef.current = null;
      }, [loadingOlder]);

      const loadOlderAnchored = () => {
        const local = listRef.current;
        if (local !== null) {
          const element = scrollerOf(local);
          const row = pagingAnchor(local, element);
          if (row?.dataset.chatAnchorKey !== undefined) {
            anchorRef.current = { key: row.dataset.chatAnchorKey, top: flowTop(row, element) };
          }
        }
        loadOlder();
      };

      navigationRef.current = {
        scrollTo: ({ key, seq }) => {
          let index = typeof key === "string" ? order.indexOf(key) : -1;
          if (index < 0 && Number.isFinite(seq)) {
            index = order.findIndex((nodeKey) => {
              const node = nodeStore.get(nodeKey);
              return Number(node?.data?.seq ?? node?.anchorSeq) === seq;
            });
          }
          if (index < 0) return false;
          const local = listRef.current;
          if (local === null) return false;
          const element = scrollerOf(local);
          const nodeKey = order[index];
          atBottomRef.current = false;
          setAtBottom(false);
          chatScroll.save({ anchorKey: nodeKey, anchorTop: 18, scrollTop: element.scrollTop });
          if (virtualizationEnabled) virtualizer.scrollToIndex(index, { align: "start" });
          else {
            const row = anchorElement(local, nodeKey);
            if (row !== null) element.scrollTop += flowTop(row, element) - 18;
          }
          window.requestAnimationFrame(() => {
            const row = anchorElement(local, nodeKey);
            if (row !== null) element.scrollTop += flowTop(row, element) - 18;
            observedTopRef.current = element.scrollTop;
            const position = scrollPosition(local, element);
            if (position !== null) chatScroll.save(position);
          });
          return true;
        },
      };
      useEffect(() => publishNavigationView(sessionId, {
        scrollTo: (target) => navigationRef.current?.scrollTo(target) === true,
      }), [sessionId]);

      const renderNode = (nodeKey, index, measure) => {
        const node = nodeStore.get(nodeKey);
        const turn = chatNodeTurn(node);
        const taskTurn = turn === null ? undefined : taskTurns.get(turn);
        return (
          <div
            className="lbs-chat-window-row"
            data-chat-flow-row=""
            data-chat-flow-turn={turn ?? undefined}
            data-chat-flow-completed={taskTurn?.completed ? "true" : undefined}
            data-chat-flow-final={taskTurn?.finalKey === nodeKey ? "true" : undefined}
            data-chat-flow-process-count={taskTurn?.processCount}
            data-chat-flow-tool-count={taskTurn?.toolCount}
            data-index={measure ? index : undefined}
            ref={measure ? virtualizer.measureElement : undefined}
            key={nodeKey}
          >
            <NodeSeat
              nodeKey={nodeKey}
              useSession={useSession}
              selectedCallId={selectedCallId}
              cwd={cwd}
              openFile={requestOpenFile}
              inspectCall={inspectCall}
              forkAt={forkAt}
              renderMessageImages={renderMessageImages}
              fileMentions={fileMentions}
              renderSlot={renderSlot}
              t={t}
            />
          </div>
        );
      };

      return (
        <div className="lbs-chat-window-root">
          <div ref={listRef} className="lbs-chat-window-scroll">
            <div
              ref={columnRef}
              className="lbs-chat-window-column"
              data-chat-flow=""
              data-chat-session-id={sessionId}
              data-chat-windowed={virtualizationEnabled ? "true" : "false"}
              data-chat-rendered-count={virtualizationEnabled ? virtualItems.length : order.length}
            >
              <div className="lbs-chat-window-prelude">
                {openState === "loading" ? (
                  <div className="lbs-chat-window-hint">{t("chat.loadingHistory")}</div>
                ) : null}
                {openState === "error" && openError !== null ? (
                  <div className="lbs-chat-window-error">
                    {t("chat.loadError", { message: openError.message, code: openError.code })}
                  </div>
                ) : null}
                {hasMore ? (
                  <div className="lbs-chat-window-older">
                    <button type="button" disabled={loadingOlder} onClick={loadOlderAnchored}>
                      {loadingOlder ? t("loading") : t("chat.loadOlder")}
                    </button>
                  </div>
                ) : null}
              </div>
              {virtualizationEnabled ? (
                <div ref={virtualListRef} className="lbs-chat-window-list" data-chat-flow-host="">
                  <div aria-hidden="true" style={{ height: padding.top }} />
                  {virtualItems.map((item) => renderNode(order[item.index], item.index, true))}
                  <div aria-hidden="true" style={{ height: padding.bottom }} />
                </div>
              ) : (
                <div ref={virtualListRef} className="lbs-chat-window-list" data-chat-flow-host="">
                  {order.map((nodeKey, index) => renderNode(nodeKey, index, false))}
                </div>
              )}
              <div className="lbs-chat-window-tail">
                {running ? <RunningStatus startTime={runningTurnStart} t={t} /> : null}
                {pendingSteering.map((item) => (
                  <PendingBubble
                    content={item.content}
                    renderMessageImages={renderMessageImages}
                    t={t}
                    key={item.id}
                  />
                ))}
              </div>
            </div>
            {!atBottom ? (
              <div className="lbs-chat-window-bottom-slot">
                <button
                  type="button"
                  className="lbs-chat-window-bottom"
                  aria-label={t("chat.toBottom")}
                  onClick={() => {
                    if (listRef.current !== null) toBottom(scrollerOf(listRef.current));
                  }}
                >
                  <Primitives.IconChevronDownOutline14 />
                </button>
              </div>
            ) : null}
          </div>
          {fileOpenError !== null ? (
            <OpenErrorDialog
              path={fileOpenError.path}
              message={fileOpenError.message}
              busy={fileOpenBusy}
              onClose={closeFileOpenError}
              onRetry={() => requestOpenFile(fileOpenError.path)}
              t={t}
            />
          ) : null}
        </div>
      );
    }

    const chatPerformanceRegistration = Object.freeze({
      version: 1,
      ChatView: OptimizedChatView,
    });
    window.__laobosChatPerformance = chatPerformanceRegistration;
    window.dispatchEvent(new Event("laobos:chat-performance-change"));

    const inject = [];
    function apply() {
      window.__laobosChatPerformance = chatPerformanceRegistration;
      window.dispatchEvent(new Event("laobos:chat-performance-change"));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
