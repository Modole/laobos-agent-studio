/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */
(() => {
  // node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
  function createLazyMeasurementsView(count, flat, getItemKey) {
    const cache = new Array(count);
    return new Proxy(cache, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          const c = prop.charCodeAt(0);
          if (c >= 48 && c <= 57) {
            const i = +prop;
            if (Number.isInteger(i) && i >= 0 && i < count) {
              let v = target[i];
              if (!v) {
                const s = flat[i * 2];
                v = target[i] = {
                  index: i,
                  key: getItemKey(i),
                  start: s,
                  size: flat[i * 2 + 1],
                  end: s + flat[i * 2 + 1],
                  lane: 0
                };
              }
              return v;
            }
          }
          if (prop === "length") return count;
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  // node_modules/@tanstack/virtual-core/dist/esm/utils.js
  function memo(getDeps, fn, opts) {
    let deps = opts.initialDeps ?? [];
    let result;
    let isInitial = true;
    function memoizedFunction() {
      var _a;
      const debugEnabled = false;
      let depTime = 0;
      if (debugEnabled) depTime = Date.now();
      const newDeps = getDeps();
      const depsChanged = newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep);
      if (!depsChanged) {
        return result;
      }
      deps = newDeps;
      let resultTime = 0;
      if (debugEnabled) resultTime = Date.now();
      result = fn(...newDeps);
      if (debugEnabled) {
        const depEndTime = Math.round((Date.now() - depTime) * 100) / 100;
        const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100;
        const resultFpsPercentage = resultEndTime / 16;
        const pad = (str, num) => {
          str = String(str);
          while (str.length < num) {
            str = " " + str;
          }
          return str;
        };
        console.info(
          `%c⏱ ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`,
          `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(
            0,
            Math.min(120 - 120 * resultFpsPercentage, 120)
          )}deg 100% 31%);`,
          opts == null ? void 0 : opts.key
        );
      }
      if ((opts == null ? void 0 : opts.onChange) && !(isInitial && opts.skipInitialOnChange)) {
        opts.onChange(result);
      }
      isInitial = false;
      return result;
    }
    memoizedFunction.updateDeps = (newDeps) => {
      deps = newDeps;
    };
    return memoizedFunction;
  }
  function notUndefined(value, msg) {
    if (value === void 0) {
      throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ""}`);
    } else {
      return value;
    }
  }
  var approxEqual = (a, b) => Math.abs(a - b) < 1.01;
  var debounce = (targetWindow, fn, ms) => {
    let timeoutId;
    return Object.assign(
      function(...args) {
        targetWindow.clearTimeout(timeoutId);
        timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
      },
      {
        // The handle is closure-local, so a caller that has already
        // unsubscribed has no way to stop a queued call. Teardown paths use
        // this to drop the pending invocation instead of letting it land.
        cancel: () => {
          targetWindow.clearTimeout(timeoutId);
        }
      }
    );
  };

  // node_modules/@tanstack/virtual-core/dist/esm/index.js
  var _isIOSResult;
  var isIOSWebKit = () => {
    if (_isIOSResult !== void 0) return _isIOSResult;
    if (typeof navigator === "undefined") return _isIOSResult = false;
    if (/iP(hone|od|ad)/.test(navigator.userAgent)) return _isIOSResult = true;
    const mtp = navigator.maxTouchPoints;
    return _isIOSResult = navigator.platform === "MacIntel" && mtp !== void 0 && mtp > 0;
  };
  var getRect = (element) => {
    const { offsetWidth, offsetHeight } = element;
    return { width: offsetWidth, height: offsetHeight };
  };
  var defaultKeyExtractor = (index) => index;
  var defaultRangeExtractor = (range) => {
    const start = Math.max(range.startIndex - range.overscan, 0);
    const end = Math.min(range.endIndex + range.overscan, range.count - 1);
    const len = end - start + 1;
    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = start + i;
    }
    return arr;
  };
  var observeElementRect = (instance, cb) => {
    const element = instance.scrollElement;
    if (!element) {
      return;
    }
    const targetWindow = instance.targetWindow;
    if (!targetWindow) {
      return;
    }
    const handler = (rect) => {
      const { width, height } = rect;
      cb({ width: Math.round(width), height: Math.round(height) });
    };
    handler(getRect(element));
    if (!targetWindow.ResizeObserver) {
      return () => {
      };
    }
    const observer = new targetWindow.ResizeObserver((entries) => {
      const run = () => {
        const entry = entries[0];
        if (entry == null ? void 0 : entry.borderBoxSize) {
          const box = entry.borderBoxSize[0];
          if (box) {
            handler({ width: box.inlineSize, height: box.blockSize });
            return;
          }
        }
        handler(getRect(element));
      };
      instance.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
    });
    observer.observe(element, { box: "border-box" });
    return () => {
      observer.unobserve(element);
    };
  };
  var addEventListenerOptions = {
    passive: true
  };
  var supportsScrollend = typeof window == "undefined" ? true : "onscrollend" in window;
  var observeOffset = (instance, cb, readOffset) => {
    const element = instance.scrollElement;
    if (!element) {
      return;
    }
    const targetWindow = instance.targetWindow;
    if (!targetWindow) {
      return;
    }
    const registerScrollendEvent = instance.options.useScrollendEvent && supportsScrollend;
    let offset = 0;
    const fallback = registerScrollendEvent ? null : debounce(
      targetWindow,
      () => cb(offset, false),
      instance.options.isScrollingResetDelay
    );
    const createHandler = (isScrolling) => () => {
      offset = readOffset(element);
      fallback == null ? void 0 : fallback();
      cb(offset, isScrolling);
    };
    const handler = createHandler(true);
    const endHandler = createHandler(false);
    element.addEventListener("scroll", handler, addEventListenerOptions);
    if (registerScrollendEvent) {
      element.addEventListener("scrollend", endHandler, addEventListenerOptions);
    }
    return () => {
      element.removeEventListener("scroll", handler);
      if (registerScrollendEvent) {
        element.removeEventListener("scrollend", endHandler);
      }
      fallback == null ? void 0 : fallback.cancel();
    };
  };
  var observeElementOffset = (instance, cb) => observeOffset(instance, cb, (el) => {
    const { horizontal, isRtl } = instance.options;
    return horizontal ? el.scrollLeft * (isRtl && -1 || 1) : el.scrollTop;
  });
  var measureElement = (element, entry, instance) => {
    if (instance.options.useCachedMeasurements) {
      const index = instance.indexFromElement(element);
      const key = instance.options.getItemKey(index);
      return instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index);
    }
    if (entry == null ? void 0 : entry.borderBoxSize) {
      const box = entry.borderBoxSize[0];
      if (box) {
        const size = Math.round(
          box[instance.options.horizontal ? "inlineSize" : "blockSize"]
        );
        return size;
      }
    }
    if (!entry) {
      const index = instance.indexFromElement(element);
      const key = instance.options.getItemKey(index);
      const cachedSize = instance.itemSizeCache.get(key);
      if (cachedSize !== void 0) {
        return cachedSize;
      }
    }
    return element[instance.options.horizontal ? "offsetWidth" : "offsetHeight"];
  };
  var scrollWithAdjustments = (offset, {
    adjustments = 0,
    behavior
  }, instance) => {
    var _a, _b;
    (_b = (_a = instance.scrollElement) == null ? void 0 : _a.scrollTo) == null ? void 0 : _b.call(_a, {
      [instance.options.horizontal ? "left" : "top"]: offset + adjustments,
      behavior
    });
  };
  var elementScroll = scrollWithAdjustments;
  var Virtualizer = class {
    constructor(opts) {
      this.unsubs = [];
      this.scrollElement = null;
      this.targetWindow = null;
      this.isScrolling = false;
      this.scrollState = null;
      this.measurementsCache = [];
      this._flatMeasurements = null;
      this.itemSizeCache = /* @__PURE__ */ new Map();
      this.itemSizeCacheVersion = 0;
      this.laneAssignments = /* @__PURE__ */ new Map();
      this.pendingMin = null;
      this.prevLanes = void 0;
      this.lanesChangedFlag = false;
      this.lanesSettling = false;
      this.pendingScrollAnchor = null;
      this.scrollRect = null;
      this.scrollOffset = null;
      this.scrollDirection = null;
      this.scrollAdjustments = 0;
      this._iosDeferredAdjustment = 0;
      this._iosTouching = false;
      this._iosJustTouchEnded = false;
      this._iosTouchEndTimerId = null;
      this._intendedScrollOffset = null;
      this.elementsCache = /* @__PURE__ */ new Map();
      this.now = () => {
        var _a, _b, _c;
        return ((_c = (_b = (_a = this.targetWindow) == null ? void 0 : _a.performance) == null ? void 0 : _b.now) == null ? void 0 : _c.call(_b)) ?? Date.now();
      };
      this.observer = /* @__PURE__ */ (() => {
        let _ro = null;
        const get = () => {
          if (_ro) {
            return _ro;
          }
          if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
            return null;
          }
          return _ro = new this.targetWindow.ResizeObserver((entries) => {
            entries.forEach((entry) => {
              const run = () => {
                const node = entry.target;
                const index = this.indexFromElement(node);
                if (!node.isConnected) {
                  this.observer.unobserve(node);
                  for (const [cacheKey, cachedNode] of this.elementsCache) {
                    if (cachedNode === node) {
                      this.elementsCache.delete(cacheKey);
                      break;
                    }
                  }
                  return;
                }
                if (!this.isIndexInRange(index)) return;
                if (this.shouldMeasureDuringScroll(index)) {
                  this.resizeItem(
                    index,
                    this.options.measureElement(node, entry, this)
                  );
                }
              };
              this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
            });
          });
        };
        return {
          disconnect: () => {
            var _a;
            (_a = get()) == null ? void 0 : _a.disconnect();
            _ro = null;
          },
          observe: (target) => {
            var _a;
            return (_a = get()) == null ? void 0 : _a.observe(target, { box: "border-box" });
          },
          unobserve: (target) => {
            var _a;
            return (_a = get()) == null ? void 0 : _a.unobserve(target);
          }
        };
      })();
      this.range = null;
      this.setOptions = (opts2) => {
        var _a, _b;
        const merged = {
          debug: false,
          initialOffset: 0,
          overscan: 1,
          paddingStart: 0,
          paddingEnd: 0,
          scrollPaddingStart: 0,
          scrollPaddingEnd: 0,
          horizontal: false,
          getItemKey: defaultKeyExtractor,
          rangeExtractor: defaultRangeExtractor,
          onChange: () => {
          },
          measureElement,
          initialRect: { width: 0, height: 0 },
          scrollMargin: 0,
          gap: 0,
          indexAttribute: "data-index",
          initialMeasurementsCache: [],
          lanes: 1,
          anchorTo: "start",
          followOnAppend: false,
          scrollEndThreshold: 1,
          isScrollingResetDelay: 150,
          enabled: true,
          isRtl: false,
          useScrollendEvent: false,
          useAnimationFrameWithResizeObserver: false,
          laneAssignmentMode: "estimate",
          useCachedMeasurements: false
        };
        for (const key in opts2) {
          const v = opts2[key];
          if (v !== void 0) merged[key] = v;
        }
        const prevOptions = this.options;
        let anchor = null;
        let followOnAppend = null;
        let edgeKeysChanged = false;
        if (prevOptions !== void 0 && prevOptions.enabled && merged.enabled && merged.anchorTo === "end" && this.scrollElement !== null) {
          const prevCount = prevOptions.count;
          const nextCount = merged.count;
          const measurements = this.getMeasurements();
          const prevFirstKey = prevCount > 0 ? ((_a = measurements[0]) == null ? void 0 : _a.key) ?? prevOptions.getItemKey(0) : null;
          const prevLastKey = prevCount > 0 ? ((_b = measurements[prevCount - 1]) == null ? void 0 : _b.key) ?? prevOptions.getItemKey(prevCount - 1) : null;
          const didCountChange = nextCount !== prevCount;
          const didEdgeKeysChange = didCountChange || prevCount > 0 && nextCount > 0 && (merged.getItemKey(0) !== prevFirstKey || merged.getItemKey(nextCount - 1) !== prevLastKey);
          if (didEdgeKeysChange) {
            edgeKeysChanged = true;
            const item = prevCount > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0] : null;
            if (item) {
              anchor = [item.key, this.getScrollOffset() - item.start];
            }
            const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
            if (behavior && nextCount > prevCount && this.isAtEnd(prevOptions.scrollEndThreshold) && (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)) {
              followOnAppend = behavior;
            }
          }
        }
        this.options = merged;
        if (edgeKeysChanged) {
          this.pendingMin = 0;
          this.itemSizeCacheVersion++;
        }
        let anchorResolved = false;
        let anchorDelta = 0;
        if (anchor && this.scrollOffset !== null) {
          const [anchorKey, anchorOffset] = anchor;
          const newMeasurements = this.getMeasurements();
          const { count, getItemKey } = this.options;
          let idx = 0;
          while (idx < count && getItemKey(idx) !== anchorKey) {
            idx++;
          }
          if (idx < count) {
            const anchorItem = newMeasurements[idx];
            if (anchorItem) {
              const newOffset = Math.max(0, anchorItem.start + anchorOffset);
              if (newOffset !== this.scrollOffset) {
                anchorDelta = newOffset - this.scrollOffset;
                this.scrollOffset = newOffset;
                anchorResolved = true;
              }
            }
          }
        }
        if (anchorResolved || followOnAppend) {
          this.pendingScrollAnchor = [
            anchorResolved ? anchor[0] : null,
            anchorResolved ? anchor[1] : 0,
            followOnAppend,
            anchorDelta
          ];
        }
      };
      this.notify = (sync) => {
        var _a, _b;
        (_b = (_a = this.options).onChange) == null ? void 0 : _b.call(_a, this, sync);
      };
      this.maybeNotify = memo(
        () => {
          this.calculateRange();
          return [
            this.isScrolling,
            this.range ? this.range.startIndex : null,
            this.range ? this.range.endIndex : null
          ];
        },
        (isScrolling) => {
          this.notify(isScrolling);
        },
        {
          key: false,
          debug: () => this.options.debug,
          initialDeps: [
            this.isScrolling,
            this.range ? this.range.startIndex : null,
            this.range ? this.range.endIndex : null
          ]
        }
      );
      this.cleanup = () => {
        this.unsubs.filter(Boolean).forEach((d) => d());
        this.unsubs = [];
        this.observer.disconnect();
        if (this.rafId != null && this.targetWindow) {
          this.targetWindow.cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        this.scrollState = null;
        this.isScrolling = false;
        this.scrollDirection = null;
        this._iosDeferredAdjustment = 0;
        this._iosTouching = false;
        this._iosJustTouchEnded = false;
        this.scrollElement = null;
        this.targetWindow = null;
      };
      this._didMount = () => {
        return () => {
          this.cleanup();
        };
      };
      this._willUpdate = () => {
        var _a;
        const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
        if (this.scrollElement !== scrollElement) {
          this.cleanup();
          if (!scrollElement) {
            this.maybeNotify();
            return;
          }
          this.scrollElement = scrollElement;
          if (this.scrollElement && "ownerDocument" in this.scrollElement) {
            this.targetWindow = this.scrollElement.ownerDocument.defaultView;
          } else {
            this.targetWindow = ((_a = this.scrollElement) == null ? void 0 : _a.window) ?? null;
          }
          this.elementsCache.forEach((cached) => {
            this.observer.observe(cached);
          });
          this.unsubs.push(
            this.options.observeElementRect(this, (rect) => {
              this.scrollRect = rect;
              this.maybeNotify();
            })
          );
          this.unsubs.push(
            this.options.observeElementOffset(this, (offset, isScrolling) => {
              if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset) {
                return;
              }
              if (this._intendedScrollOffset !== null && Math.abs(offset - this._intendedScrollOffset) < 1.5) {
                offset = this._intendedScrollOffset;
              }
              this._intendedScrollOffset = null;
              this.scrollAdjustments = 0;
              const prevOffset = this.getScrollOffset();
              this.scrollDirection = isScrolling ? prevOffset === offset ? this.scrollDirection : prevOffset < offset ? "forward" : "backward" : null;
              this.scrollOffset = offset;
              this.isScrolling = isScrolling;
              this._flushIosDeferredIfReady();
              if (this.scrollState) {
                this.scheduleScrollReconcile();
              }
              this.maybeNotify();
            })
          );
          if ("addEventListener" in this.scrollElement) {
            const scrollEl = this.scrollElement;
            const onTouchStart = () => {
              this._iosTouching = true;
              this._iosJustTouchEnded = false;
              if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
                this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
                this._iosTouchEndTimerId = null;
              }
            };
            const onTouchEnd = () => {
              this._iosTouching = false;
              if (!isIOSWebKit() || this.targetWindow == null) {
                return;
              }
              this._iosJustTouchEnded = true;
              this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
                this._iosJustTouchEnded = false;
                this._iosTouchEndTimerId = null;
                this._flushIosDeferredIfReady();
              }, 150);
            };
            scrollEl.addEventListener(
              "touchstart",
              onTouchStart,
              addEventListenerOptions
            );
            scrollEl.addEventListener(
              "touchend",
              onTouchEnd,
              addEventListenerOptions
            );
            this.unsubs.push(() => {
              scrollEl.removeEventListener("touchstart", onTouchStart);
              scrollEl.removeEventListener("touchend", onTouchEnd);
              if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
                this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
                this._iosTouchEndTimerId = null;
              }
            });
          }
          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: void 0,
            behavior: void 0
          });
        }
        const anchor = this.pendingScrollAnchor;
        this.pendingScrollAnchor = null;
        if (anchor && this.scrollElement && this.options.enabled) {
          const [key, _offset, followOnAppend, anchorDelta] = anchor;
          if (key !== null && !followOnAppend) {
            if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
              if (anchorDelta !== 0) {
                this._iosDeferredAdjustment += anchorDelta;
              }
            } else {
              this._scrollToOffset(this.getScrollOffset(), {
                adjustments: void 0,
                behavior: void 0
              });
            }
          }
          if (followOnAppend) {
            this.scrollToEnd({ behavior: followOnAppend });
          }
        }
      };
      this._flushIosDeferredIfReady = () => {
        if (this._iosDeferredAdjustment === 0) return;
        if (this.isScrolling) return;
        if (this._iosTouching) return;
        if (this._iosJustTouchEnded) return;
        const cur = this.getScrollOffset();
        const max = this.getMaxScrollOffset();
        if (cur < 0 || cur > max) return;
        if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
          this._iosDeferredAdjustment = 0;
          return;
        }
        const delta = this._iosDeferredAdjustment;
        this._iosDeferredAdjustment = 0;
        this._scrollToOffset(cur, {
          adjustments: this.scrollAdjustments += delta,
          behavior: void 0
        });
      };
      this.rafId = null;
      this.getSize = () => {
        if (!this.options.enabled) {
          this.scrollRect = null;
          return 0;
        }
        this.scrollRect = this.scrollRect ?? this.options.initialRect;
        return this.scrollRect[this.options.horizontal ? "width" : "height"];
      };
      this.getScrollOffset = () => {
        if (!this.options.enabled) {
          this.scrollOffset = null;
          return 0;
        }
        this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset === "function" ? this.options.initialOffset() : this.options.initialOffset);
        return this.scrollOffset;
      };
      this.getMeasurementOptions = memo(
        () => [
          this.options.count,
          this.options.paddingStart,
          this.options.scrollMargin,
          this.options.getItemKey,
          this.options.enabled,
          this.options.lanes,
          this.options.laneAssignmentMode,
          this.options.gap
        ],
        (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
          const lanesChanged = this.prevLanes !== void 0 && this.prevLanes !== lanes;
          if (lanesChanged) {
            this.lanesChangedFlag = true;
          }
          this.prevLanes = lanes;
          this.pendingMin = null;
          return {
            count,
            paddingStart,
            scrollMargin,
            getItemKey,
            enabled,
            lanes,
            laneAssignmentMode,
            gap
          };
        },
        {
          key: false
        }
      );
      this.isIndexInRange = (index) => index >= 0 && index < this.options.count;
      this.getMeasurements = memo(
        () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
        ({
          count,
          paddingStart,
          scrollMargin,
          getItemKey,
          enabled,
          lanes,
          laneAssignmentMode,
          gap
        }, _itemSizeCacheVersion) => {
          const itemSizeCache = this.itemSizeCache;
          if (!enabled) {
            this.measurementsCache = [];
            this.itemSizeCache.clear();
            this.laneAssignments.clear();
            return [];
          }
          if (this.laneAssignments.size > count) {
            for (const index of this.laneAssignments.keys()) {
              if (index >= count) {
                this.laneAssignments.delete(index);
              }
            }
          }
          if (this.lanesChangedFlag) {
            this.lanesChangedFlag = false;
            this.lanesSettling = true;
            this.measurementsCache = [];
            this.itemSizeCache.clear();
            this.laneAssignments.clear();
            this.pendingMin = null;
          }
          if (this.measurementsCache.length === 0 && !this.lanesSettling) {
            this.measurementsCache = this.options.initialMeasurementsCache;
            this.measurementsCache.forEach((item) => {
              this.itemSizeCache.set(item.key, item.size);
            });
          }
          const min = this.lanesSettling ? 0 : this.pendingMin ?? 0;
          this.pendingMin = null;
          if (this.lanesSettling && this.measurementsCache.length === count) {
            this.lanesSettling = false;
          }
          if (lanes === 1) {
            const need = count * 2;
            let flat = this._flatMeasurements;
            if (!flat || flat.length < need) {
              const next = new Float64Array(need);
              if (flat && min > 0) next.set(flat.subarray(0, min * 2));
              flat = next;
              this._flatMeasurements = flat;
            }
            let runningStart;
            if (min === 0) {
              runningStart = paddingStart + scrollMargin;
            } else {
              const prevIdx = min - 1;
              runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
            }
            for (let i = min; i < count; i++) {
              const key = getItemKey(i);
              const measuredSize = itemSizeCache.get(key);
              const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
              flat[i * 2] = runningStart;
              flat[i * 2 + 1] = size;
              runningStart += size + gap;
            }
            const view = createLazyMeasurementsView(count, flat, getItemKey);
            this.measurementsCache = view;
            return view;
          }
          const measurements = this.measurementsCache.slice(0, min);
          const laneLastIndex = new Array(lanes).fill(
            void 0
          );
          const laneEnds = new Float64Array(lanes);
          let filledLanes = 0;
          for (let m = 0; m < min; m++) {
            const item = measurements[m];
            if (item) {
              if (laneLastIndex[item.lane] === void 0) filledLanes++;
              laneLastIndex[item.lane] = m;
              laneEnds[item.lane] = item.end;
            }
          }
          for (let i = min; i < count; i++) {
            const key = getItemKey(i);
            const cachedLane = this.laneAssignments.get(i);
            let lane;
            let start;
            const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key);
            if (cachedLane !== void 0 && this.options.lanes > 1) {
              lane = cachedLane;
              const prevIndex = laneLastIndex[lane];
              const prevInLane = prevIndex !== void 0 ? measurements[prevIndex] : void 0;
              start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
            } else if (filledLanes === lanes) {
              let bestLane = 0;
              let bestEnd = laneEnds[0];
              let bestIdx = laneLastIndex[0];
              for (let l = 1; l < lanes; l++) {
                const e = laneEnds[l];
                if (e < bestEnd || e === bestEnd && laneLastIndex[l] < bestIdx) {
                  bestLane = l;
                  bestEnd = e;
                  bestIdx = laneLastIndex[l];
                }
              }
              lane = bestLane;
              start = bestEnd + gap;
              if (shouldCacheLane) {
                this.laneAssignments.set(i, lane);
              }
            } else {
              lane = i % this.options.lanes;
              start = paddingStart + scrollMargin;
              if (shouldCacheLane) {
                this.laneAssignments.set(i, lane);
              }
            }
            const measuredSize = itemSizeCache.get(key);
            const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
            const end = start + size;
            measurements[i] = {
              index: i,
              start,
              size,
              end,
              key,
              lane
            };
            if (laneLastIndex[lane] === void 0) filledLanes++;
            laneLastIndex[lane] = i;
            laneEnds[lane] = end;
          }
          this.measurementsCache = measurements;
          return measurements;
        },
        {
          key: false,
          debug: () => this.options.debug
        }
      );
      this.calculateRange = memo(
        () => [
          this.getMeasurements(),
          this.getSize(),
          this.getScrollOffset(),
          this.options.lanes
        ],
        (measurements, outerSize, scrollOffset, lanes) => {
          if (measurements.length === 0 || outerSize === 0) {
            this.range = null;
            return null;
          }
          this.range = calculateRangeImpl(
            measurements,
            outerSize,
            scrollOffset,
            lanes,
            // Pass the typed array so binary search + forward-walk can read
            // start/end directly from Float64Array, skipping the Proxy traps.
            lanes === 1 && this._flatMeasurements != null ? this._flatMeasurements : null
          );
          return this.range;
        },
        {
          key: false,
          debug: () => this.options.debug
        }
      );
      this.getVirtualIndexes = memo(
        () => {
          let startIndex = null;
          let endIndex = null;
          const range = this.calculateRange();
          if (range) {
            startIndex = range.startIndex;
            endIndex = range.endIndex;
          }
          this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex]);
          return [
            this.options.rangeExtractor,
            this.options.overscan,
            this.options.count,
            startIndex,
            endIndex
          ];
        },
        (rangeExtractor, overscan, count, startIndex, endIndex) => {
          return startIndex === null || endIndex === null ? [] : rangeExtractor({
            startIndex,
            endIndex,
            overscan,
            count
          });
        },
        {
          key: false,
          debug: () => this.options.debug
        }
      );
      this.indexFromElement = (node) => {
        const attributeName = this.options.indexAttribute;
        const indexStr = node.getAttribute(attributeName);
        if (!indexStr) {
          console.warn(
            `Missing attribute name '${attributeName}={index}' on measured element.`
          );
          return -1;
        }
        return parseInt(indexStr, 10);
      };
      this.shouldMeasureDuringScroll = (index) => {
        var _a;
        if (!this.scrollState || this.scrollState.behavior !== "smooth") {
          return true;
        }
        const scrollIndex = this.scrollState.index ?? ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null ? void 0 : _a.index);
        if (scrollIndex !== void 0 && this.range) {
          const bufferSize = Math.max(
            this.options.overscan,
            Math.ceil((this.range.endIndex - this.range.startIndex) / 2)
          );
          const minIndex = Math.max(0, scrollIndex - bufferSize);
          const maxIndex = Math.min(
            this.options.count - 1,
            scrollIndex + bufferSize
          );
          return index >= minIndex && index <= maxIndex;
        }
        return true;
      };
      this.measureElement = (node) => {
        if (!node) {
          this.elementsCache.forEach((cached, key2) => {
            if (!cached.isConnected) {
              this.observer.unobserve(cached);
              this.elementsCache.delete(key2);
            }
          });
          return;
        }
        const index = this.indexFromElement(node);
        if (!this.isIndexInRange(index)) return;
        const key = this.options.getItemKey(index);
        const prevNode = this.elementsCache.get(key);
        if (prevNode !== node) {
          if (prevNode) {
            this.observer.unobserve(prevNode);
          }
          this.observer.observe(node);
          this.elementsCache.set(key, node);
        }
        if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index)) {
          this.resizeItem(index, this.options.measureElement(node, void 0, this));
        }
      };
      this.resizeItem = (index, size) => {
        var _a, _b;
        if (!this.isIndexInRange(index)) return;
        let cachedSize;
        let itemStart;
        let key;
        const flat = this._flatMeasurements;
        if (this.options.lanes === 1 && flat !== null) {
          key = this.options.getItemKey(index);
          itemStart = flat[index * 2];
          cachedSize = flat[index * 2 + 1];
        } else {
          const item = this.measurementsCache[index];
          if (!item) return;
          key = item.key;
          itemStart = item.start;
          cachedSize = item.size;
        }
        const itemSize = this.itemSizeCache.get(key) ?? cachedSize;
        const delta = size - itemSize;
        if (delta !== 0) {
          const wasAtEnd = this.options.anchorTo === "end" && ((_a = this.scrollState) == null ? void 0 : _a.behavior) !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
          const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
          const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
          const isFirstMeasure = !this.itemSizeCache.has(key);
          const defaultShouldAdjust = isFirstMeasure ? (
            // First measurement: compensate any item whose top sits above the
            // fold — the estimate→actual delta must be corrected regardless of
            // scroll direction, since the whole estimated block was above it.
            itemStart < scrollOffsetWithAdj
          ) : (
            // Re-measurement: only compensate an item that is ENTIRELY above the
            // fold. An item that merely *spans* the fold (top above, bottom
            // below — e.g. a streaming chat message growing at its bottom)
            // changes size *below* the anchor point, so shifting scrollTop by the
            // delta would drag the viewport downward on every growth (#1218).
            // Also skip during backward scroll to avoid the "items jump while
            // scrolling up" cascade.
            itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward"
          );
          const shouldAdjustScroll = ((_b = this.scrollState) == null ? void 0 : _b.behavior) !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange !== void 0 ? this.shouldAdjustScrollPositionOnItemSizeChange(
            // The callback expects a VirtualItem; build one lazily only
            // when the consumer actually supplied a custom predicate.
            this.measurementsCache[index] ?? {
              index,
              key,
              start: itemStart,
              size: cachedSize,
              end: itemStart + cachedSize,
              lane: 0
            },
            delta,
            this
          ) : defaultShouldAdjust);
          if (this.pendingMin === null || index < this.pendingMin) {
            this.pendingMin = index;
          }
          this.itemSizeCache.set(key, size);
          this.itemSizeCacheVersion++;
          let adjustedSync = false;
          if (wasAtEnd) {
            adjustedSync = this.applyScrollAdjustment(
              this.getTotalSize() - prevTotalSize
            );
          } else if (shouldAdjustScroll) {
            adjustedSync = this.applyScrollAdjustment(delta);
          }
          this.notify(adjustedSync);
        }
      };
      this.getVirtualItems = memo(
        () => [this.getVirtualIndexes(), this.getMeasurements()],
        (indexes, measurements) => {
          const virtualItems = [];
          for (let k = 0, len = indexes.length; k < len; k++) {
            const i = indexes[k];
            const measurement = measurements[i];
            virtualItems.push(measurement);
          }
          return virtualItems;
        },
        {
          key: false,
          debug: () => this.options.debug
        }
      );
      this.getVirtualItemForOffset = (offset) => {
        const measurements = this.getMeasurements();
        if (measurements.length === 0) {
          return void 0;
        }
        const flat = this._flatMeasurements;
        const useFlat = this.options.lanes === 1 && flat != null;
        const idx = findNearestBinarySearch(
          0,
          measurements.length - 1,
          useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start,
          offset
        );
        return notUndefined(measurements[idx]);
      };
      this.getMaxScrollOffset = () => {
        if (!this.scrollElement) return 0;
        if ("scrollHeight" in this.scrollElement) {
          return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
        } else {
          const doc = this.scrollElement.document.documentElement;
          return this.options.horizontal ? doc.scrollWidth - this.scrollElement.innerWidth : doc.scrollHeight - this.scrollElement.innerHeight;
        }
      };
      this.getVirtualDistanceFromEnd = () => {
        return Math.max(
          this.getTotalSize() - this.getSize() - this.getScrollOffset(),
          0
        );
      };
      this.getDistanceFromEnd = () => {
        return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
      };
      this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
        return this.getDistanceFromEnd() <= threshold;
      };
      this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
        if (!this.scrollElement) return 0;
        const size = this.getSize();
        const scrollOffset = this.getScrollOffset();
        if (align === "auto") {
          align = toOffset >= scrollOffset + size ? "end" : "start";
        }
        if (align === "center") {
          toOffset += (itemSize - size) / 2;
        } else if (align === "end") {
          toOffset -= size;
        }
        const maxOffset = this.getMaxScrollOffset();
        return Math.max(Math.min(maxOffset, toOffset), 0);
      };
      this.getOffsetForIndex = (index, align = "auto") => {
        index = Math.max(0, Math.min(index, this.options.count - 1));
        const size = this.getSize();
        const scrollOffset = this.getScrollOffset();
        const item = this.measurementsCache[index];
        if (!item) return;
        if (align === "auto") {
          if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
            align = "end";
          } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
            align = "start";
          } else {
            return [scrollOffset, align];
          }
        }
        if (align === "end" && index === this.options.count - 1) {
          return [this.getMaxScrollOffset(), align];
        }
        const toOffset = align === "end" ? item.end + this.options.scrollPaddingEnd : item.start - this.options.scrollPaddingStart;
        return [
          this.getOffsetForAlignment(toOffset, align, item.size),
          align
        ];
      };
      this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
        this._iosDeferredAdjustment = 0;
        const offset = this.getOffsetForAlignment(toOffset, align);
        const now = this.now();
        this.scrollState = {
          index: null,
          align,
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: void 0, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollToIndex = (index, {
        align: initialAlign = "auto",
        behavior = "auto"
      } = {}) => {
        this._iosDeferredAdjustment = 0;
        index = Math.max(0, Math.min(index, this.options.count - 1));
        const offsetInfo = this.getOffsetForIndex(index, initialAlign);
        if (!offsetInfo) {
          return;
        }
        const [offset, align] = offsetInfo;
        const now = this.now();
        this.scrollState = {
          index,
          align,
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: void 0, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollBy = (delta, { behavior = "auto" } = {}) => {
        const offset = this.getScrollOffset() + delta;
        const now = this.now();
        this.scrollState = {
          index: null,
          align: "start",
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: void 0, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollToEnd = ({ behavior = "auto" } = {}) => {
        if (this.options.count > 0) {
          this.scrollToIndex(this.options.count - 1, {
            align: "end",
            behavior
          });
          return;
        }
        this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
          behavior
        });
      };
      this.getTotalSize = () => {
        var _a;
        const measurements = this.getMeasurements();
        let end;
        if (measurements.length === 0) {
          end = this.options.paddingStart;
        } else if (this.options.lanes === 1) {
          const lastIdx = measurements.length - 1;
          const flat = this._flatMeasurements;
          if (flat != null) {
            end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
          } else {
            end = ((_a = measurements[lastIdx]) == null ? void 0 : _a.end) ?? 0;
          }
        } else {
          const endByLane = Array(this.options.lanes).fill(null);
          let endIndex = measurements.length - 1;
          while (endIndex >= 0 && endByLane.some((val) => val === null)) {
            const item = measurements[endIndex];
            if (endByLane[item.lane] === null) {
              endByLane[item.lane] = item.end;
            }
            endIndex--;
          }
          end = Math.max(...endByLane.filter((val) => val !== null));
        }
        return Math.max(
          end - this.options.scrollMargin + this.options.paddingEnd,
          0
        );
      };
      this.takeSnapshot = () => {
        const snapshot = [];
        if (this.itemSizeCache.size === 0) return snapshot;
        const m = this.getMeasurements();
        for (const item of m) {
          if (item && this.itemSizeCache.has(item.key)) {
            snapshot.push({
              index: item.index,
              key: item.key,
              start: item.start,
              size: item.size,
              end: item.end,
              lane: item.lane
            });
          }
        }
        return snapshot;
      };
      this._scrollToOffset = (offset, {
        adjustments,
        behavior
      }) => {
        this._intendedScrollOffset = offset + (adjustments ?? 0);
        this.options.scrollToFn(offset, { behavior, adjustments }, this);
      };
      this.measure = () => {
        this.pendingMin = null;
        this.itemSizeCache.clear();
        this.laneAssignments.clear();
        this.itemSizeCacheVersion++;
        this.notify(false);
      };
      this.setOptions(opts);
    }
    // Returns `true` when it performed a synchronous `scrollTop` write this
    // tick, `false` when the delta was zero or the write was deferred (iOS).
    // `resizeItem` uses that to decide whether the follow-up `notify` must be
    // synchronous so the grown transforms commit in the same paint (#1227).
    applyScrollAdjustment(delta, behavior) {
      if (delta === 0) return false;
      if (false) {
        console.info("correction", delta);
      }
      if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
        this._iosDeferredAdjustment += delta;
        return false;
      } else {
        this._scrollToOffset(this.getScrollOffset(), {
          adjustments: this.scrollAdjustments += delta,
          behavior
        });
        if (this.scrollOffset !== null) {
          this.scrollOffset += this.scrollAdjustments;
          if (this.scrollOffset < 0) this.scrollOffset = 0;
          this.scrollAdjustments = 0;
        }
        return true;
      }
    }
    scheduleScrollReconcile() {
      if (!this.targetWindow) {
        this.scrollState = null;
        return;
      }
      if (this.rafId != null) return;
      this.rafId = this.targetWindow.requestAnimationFrame(() => {
        this.rafId = null;
        this.reconcileScroll();
      });
    }
    reconcileScroll() {
      if (!this.scrollState) return;
      const el = this.scrollElement;
      if (!el) return;
      const MAX_RECONCILE_MS = 5e3;
      if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
        this.scrollState = null;
        return;
      }
      const offsetInfo = this.scrollState.index != null ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align) : void 0;
      const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
      const STABLE_FRAMES = 1;
      const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
      if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
        this.scrollState.stableFrames++;
        if (this.scrollState.stableFrames >= STABLE_FRAMES) {
          if (this.getScrollOffset() !== targetOffset) {
            this._scrollToOffset(targetOffset, {
              adjustments: void 0,
              behavior: "auto"
            });
          }
          this.scrollState = null;
          return;
        }
      } else {
        this.scrollState.stableFrames = 0;
        if (targetChanged) {
          const viewport = this.getSize() || 600;
          const distance = Math.abs(targetOffset - this.getScrollOffset());
          const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
          this.scrollState.lastTargetOffset = targetOffset;
          if (!keepSmooth) {
            this.scrollState.behavior = "auto";
          }
          this._scrollToOffset(targetOffset, {
            adjustments: void 0,
            behavior: keepSmooth ? "smooth" : "auto"
          });
        }
      }
      this.scheduleScrollReconcile();
    }
  };
  var findNearestBinarySearch = (low, high, getCurrentValue, value) => {
    while (low <= high) {
      const middle = (low + high) / 2 | 0;
      const currentValue = getCurrentValue(middle);
      if (currentValue < value) {
        low = middle + 1;
      } else if (currentValue > value) {
        high = middle - 1;
      } else {
        return middle;
      }
    }
    if (low > 0) {
      return low - 1;
    } else {
      return 0;
    }
  };
  function findNearestBinarySearchFlat(flat, high, value) {
    let low = 0;
    while (low <= high) {
      const middle = (low + high) / 2 | 0;
      const currentValue = flat[middle * 2];
      if (currentValue < value) {
        low = middle + 1;
      } else if (currentValue > value) {
        high = middle - 1;
      } else {
        return middle;
      }
    }
    return low > 0 ? low - 1 : 0;
  }
  function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
    const lastIndex = measurements.length - 1;
    if (measurements.length <= lanes) {
      return { startIndex: 0, endIndex: lastIndex };
    }
    if (lanes === 1 && flat !== null) {
      const startIndex2 = findNearestBinarySearchFlat(
        flat,
        lastIndex,
        scrollOffset
      );
      let endIndex2 = startIndex2;
      const limit = scrollOffset + outerSize;
      while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit) {
        endIndex2++;
      }
      return { startIndex: startIndex2, endIndex: endIndex2 };
    }
    const getStart = (index) => measurements[index].start;
    let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
    let endIndex = startIndex;
    if (lanes === 1) {
      while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize) {
        endIndex++;
      }
    } else if (lanes > 1) {
      const endPerLane = Array(lanes).fill(0);
      while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
        const item = measurements[endIndex];
        endPerLane[item.lane] = item.end;
        endIndex++;
      }
      const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
      while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
        const item = measurements[startIndex];
        startPerLane[item.lane] = item.start;
        startIndex--;
      }
      startIndex = Math.max(0, startIndex - startIndex % lanes);
      endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - endIndex % lanes));
    }
    return { startIndex, endIndex };
  }

  // packages/laobos-performance/src/chat-window.mjs
  var CHAT_VIRTUAL_THRESHOLD = 40;
  var CHAT_VIRTUAL_OVERSCAN = 6;
  var CHAT_ROW_ESTIMATE_PX = 112;
  var CHAT_BOTTOM_THRESHOLD_PX = 25;
  function isNearChatBottom(scrollHeight, scrollTop, clientHeight, threshold = CHAT_BOTTOM_THRESHOLD_PX) {
    return Math.max(0, scrollHeight - scrollTop - clientHeight) <= threshold;
  }
  function virtualChatPadding(items, totalSize, scrollMargin = 0) {
    if (items.length === 0) return { top: 0, bottom: 0 };
    return {
      top: Math.max(0, items[0].start - scrollMargin),
      bottom: Math.max(
        0,
        totalSize + scrollMargin - items[items.length - 1].end
      )
    };
  }
  function chatAnchorScrollTop(measurement, anchorTop) {
    if (measurement === void 0) return void 0;
    return Math.max(0, measurement.start - Math.max(0, anchorTop));
  }

  // packages/laobos-performance/src/client.jsx
  window.__ModuleLoader__.load({
    id: "@laobos/dsh-performance",
    factory: (require2) => {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
      const React = require2("react");
      const Primitives = require2("@deepseek-ai/dsh-client-ui-primitives");
      const {
        memo: memo2,
        useCallback,
        useEffect,
        useLayoutEffect,
        useMemo,
        useReducer,
        useRef,
        useState
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
      if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="@laobos/dsh-performance/chat-window"]') === null) {
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
          onChange: (instance2, sync) => {
            rerender();
            optionsRef.current.onChange?.(instance2, sync);
          }
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
        const visibleBottom = scrollport.querySelector("[data-composer-seat]")?.getBoundingClientRect().top || viewport.bottom;
        const rows = [...list.querySelectorAll("[data-chat-anchor-key]")];
        return rows.find((row) => {
          const rect = row.getBoundingClientRect();
          return rect.bottom > viewport.top && rect.top < visibleBottom;
        }) || rows[0] || null;
      }
      function scrollPosition(list, scrollport) {
        const row = pagingAnchor(list, scrollport);
        const anchorKey = row?.dataset.chatAnchorKey;
        if (row === null || anchorKey === void 0) return null;
        return {
          anchorKey,
          anchorTop: flowTop(row, scrollport),
          scrollTop: scrollport.scrollTop
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
          if (turn.status === "open" && turn.start !== void 0) latest = turn.start.time;
        }
        return latest;
      }
      const TASK_PROCESS_KINDS = /* @__PURE__ */ new Set([
        "assistant-step",
        "tool-call",
        "command",
        "manual-compaction",
        "model-retry"
      ]);
      function chatNodeTurn(node) {
        const location = node?.location;
        if (location?.kind === "turn" || location?.kind === "step") {
          const turn2 = location.turn?.turn ?? location.turn;
          if (turn2 !== void 0 && turn2 !== null) return String(turn2);
        }
        const turn = node?.data?.turn;
        return turn === void 0 || turn === null ? null : String(turn);
      }
      function taskTurnMetadata(order, nodeStore) {
        const byTurn = /* @__PURE__ */ new Map();
        for (const nodeKey of order) {
          const node = nodeStore.get(nodeKey);
          const turn = chatNodeTurn(node);
          if (turn === null) continue;
          let meta = byTurn.get(turn);
          if (meta === void 0) {
            meta = {
              completed: false,
              finalKey: null,
              finalSeq: null,
              processCount: 0,
              toolCount: 0
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
          const meta = turn === null ? void 0 : byTurn.get(turn);
          if (meta?.finalSeq !== null && node.data?.finalNode?.seq === meta.finalSeq) {
            meta.finalKey = nodeKey;
            meta.processCount = Math.max(0, meta.processCount - 1);
          }
        }
        return byTurn;
      }
      function formatRunDuration(ms, t) {
        const total = Math.max(0, Math.floor(ms / 1e3));
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return minutes > 0 ? t("duration.minutes", { minutes, seconds: String(seconds).padStart(2, "0") }) : t("duration.seconds", { seconds });
      }
      function TurnStatus({ startTime, t }) {
        const [mountedAt] = useState(() => Date.now());
        const anchor = startTime || mountedAt;
        const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - anchor));
        useEffect(() => {
          const tick = () => setElapsedMs(Math.max(0, Date.now() - anchor));
          tick();
          const id = window.setInterval(tick, 1e3);
          return () => window.clearInterval(id);
        }, [anchor]);
        return /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-status", role: "status", "aria-live": "polite" }, "Deep diving...", elapsedMs >= 15e3 ? /* @__PURE__ */ React.createElement("span", { className: "lbs-chat-window-clock", "aria-hidden": "true" }, formatRunDuration(elapsedMs, t)) : null);
      }
      function contentParts(content) {
        const texts = [];
        const images = [];
        const rest = [];
        for (const block of Array.isArray(content) ? content : []) {
          if (block?.type === "text" && typeof block.text === "string") texts.push(block.text);
          else if (block?.type === "image" && block.attachment !== void 0) {
            images.push({ attachment: block.attachment });
          } else rest.push(block);
        }
        return { text: texts.join(""), images, rest };
      }
      function PendingSteeringBubble({ content, renderMessageImages, t }) {
        const { text, images, rest } = contentParts(content);
        return /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-pending", "data-pending-steering": "true", "data-time-hover-root": "true" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-pending-stack" }, renderMessageImages({ images, align: "end" }), text !== "" || rest.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-pending-bubble" }, /* @__PURE__ */ React.createElement(Primitives.MessageText, { text }), rest.map((block, index) => /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-pending-extra", key: index }, /* @__PURE__ */ React.createElement(
          Primitives.JsonBlock,
          {
            label: t("message.extraBlock"),
            payload: block,
            truncatedLabel: (total) => t("json.truncated", { total })
          }
        )))) : null));
      }
      const ChatNodeSeat = memo2(function ChatNodeSeat2({
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
        t
      }) {
        const node = useSession((snapshot) => snapshot.chat.nodes.get(nodeKey));
        const owner = useMemo(() => node === void 0 ? null : {
          node,
          selectedCallId,
          cwd,
          openFile,
          inspectCall,
          forkAt,
          renderMessageImages,
          fileMentions
        }, [
          node,
          selectedCallId,
          cwd,
          openFile,
          inspectCall,
          forkAt,
          renderMessageImages,
          fileMentions
        ]);
        if (owner === null) return null;
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            "data-chat-anchor-key": node.key,
            "data-chat-flow-key": node.key,
            "data-chat-flow-kind": node.kind
          },
          renderSlot("conversation.chat.node", owner, {
            entryKey: node.kind,
            hookContext: nodeKey,
            fallback: /* @__PURE__ */ React.createElement(
              Primitives.JsonBlock,
              {
                label: t("message.unknownSurface", { type: node.kind }),
                payload: node.data,
                truncatedLabel: (total) => t("json.truncated", { total })
              }
            )
          })
        );
      });
      function FileOpenErrorDialog({ path, message, busy, onClose, onRetry, t }) {
        return /* @__PURE__ */ React.createElement(
          Primitives.Modal,
          {
            open: true,
            onClose,
            closeLabel: t("close"),
            title: t(isFolderOpenPath(path) ? "fileOpen.folderTitle" : "fileOpen.title"),
            description: message,
            footer: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Primitives.Button, { variant: "outline", className: "lbs-chat-window-modal-action", onClick: onClose }, t("cancel")), /* @__PURE__ */ React.createElement(Primitives.Button, { variant: "primary", className: "lbs-chat-window-modal-action", disabled: busy, onClick: onRetry }, t("retry")))
          }
        );
      }
      const navigationViews = /* @__PURE__ */ new Map();
      const navigationBridge = {
        version: 1,
        forSession: (sessionId) => navigationViews.get(sessionId)
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
        chatKit
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
                t(isFolderOpenPath(path) ? "fileOpen.folderUnknown" : "fileOpen.unknown")
              )
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
          [inbox]
        );
        const renderMessageImages = useCallback((owner) => renderSlot(
          "conversation.message.images",
          { ...owner, loadImage }
        ), [loadImage, renderSlot]);
        const runningTurnStart = useMemo(() => runningTurnStartTime(timeline), [timeline]);
        const taskTurns = useMemo(
          () => taskTurnMetadata(order, nodeStore),
          [nodeStore, order]
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
          []
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
          scrollMargin
        });
        const virtualItems = virtualizationEnabled ? virtualizer.getVirtualItems() : [];
        const padding = virtualChatPadding(
          virtualItems,
          virtualizationEnabled ? virtualizer.getTotalSize() : 0,
          scrollMargin
        );
        useLayoutEffect(() => {
          const local = listRef.current;
          const virtualList = virtualListRef.current;
          if (local === null || virtualList === null || !virtualizationEnabled) return;
          const scrollport = scrollerOf(local);
          const margin = virtualList.getBoundingClientRect().top - scrollport.getBoundingClientRect().top + scrollport.scrollTop;
          const normalized = Math.max(0, margin);
          setScrollMargin((current) => Math.abs(current - normalized) < 0.5 ? current : normalized);
        }, [hasMore, loadingOlder, openState, virtualizationEnabled]);
        const firstKey = order[0];
        const firstSeq = firstKey === void 0 ? null : nodeStore.get(firstKey)?.anchorSeq ?? null;
        const lastKey = order.at(-1) || null;
        const lastNode = lastKey === null ? void 0 : nodeStore.get(lastKey);
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
            if (target !== void 0) element.scrollTop = target;
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
          if (anchorRef.current !== null && firstSeq !== null && firstSeqRef.current !== null && firstSeq < firstSeqRef.current) {
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
          if (appendedUser || appendedSteering || tipMoved && atBottomRef.current) toBottom(element);
        }, [
          chatScroll,
          firstSeq,
          followSig,
          lastKey,
          lastNode?.kind,
          lastSteeringId,
          openState,
          restoreAnchor,
          toBottom
        ]);
        const onScrollRef = useRef(() => {
        });
        onScrollRef.current = () => {
          const local = listRef.current;
          if (local === null) return;
          const element = scrollerOf(local);
          const floor = Math.max(0, element.scrollHeight - element.clientHeight);
          const movedByReader = Math.abs(element.scrollTop - Math.min(observedTopRef.current, floor)) > 0.5;
          const bottom = movedByReader ? isNearChatBottom(element.scrollHeight, element.scrollTop, element.clientHeight) : atBottomRef.current;
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
          if (local === null) return void 0;
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
          if (column === null || local === null || typeof ResizeObserver === "undefined") return void 0;
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
            if (row?.dataset.chatAnchorKey !== void 0) {
              anchorRef.current = { key: row.dataset.chatAnchorKey, top: flowTop(row, element) };
            }
          }
          loadOlder();
        };
        navigationRef.current = {
          scrollTo: ({ key, seq }) => {
            let index = typeof key === "string" ? order.indexOf(key) : -1;
            if (index < 0 && Number.isFinite(seq)) {
              index = order.findIndex((nodeKey2) => {
                const node = nodeStore.get(nodeKey2);
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
          }
        };
        useEffect(() => publishNavigationView(sessionId, {
          scrollTo: (target) => navigationRef.current?.scrollTo(target) === true
        }), [sessionId]);
        const renderNode = (nodeKey, index, measure) => {
          const node = nodeStore.get(nodeKey);
          const turn = chatNodeTurn(node);
          const taskTurn = turn === null ? void 0 : taskTurns.get(turn);
          return /* @__PURE__ */ React.createElement(
            "div",
            {
              className: "lbs-chat-window-row",
              "data-chat-flow-row": "",
              "data-chat-flow-turn": turn ?? void 0,
              "data-chat-flow-completed": taskTurn?.completed ? "true" : void 0,
              "data-chat-flow-final": taskTurn?.finalKey === nodeKey ? "true" : void 0,
              "data-chat-flow-process-count": taskTurn?.processCount,
              "data-chat-flow-tool-count": taskTurn?.toolCount,
              "data-index": measure ? index : void 0,
              ref: measure ? virtualizer.measureElement : void 0,
              key: nodeKey
            },
            /* @__PURE__ */ React.createElement(
              NodeSeat,
              {
                nodeKey,
                useSession,
                selectedCallId,
                cwd,
                openFile: requestOpenFile,
                inspectCall,
                forkAt,
                renderMessageImages,
                fileMentions,
                renderSlot,
                t
              }
            )
          );
        };
        return /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-root" }, /* @__PURE__ */ React.createElement("div", { ref: listRef, className: "lbs-chat-window-scroll" }, /* @__PURE__ */ React.createElement(
          "div",
          {
            ref: columnRef,
            className: "lbs-chat-window-column",
            "data-chat-flow": "",
            "data-chat-session-id": sessionId,
            "data-chat-windowed": virtualizationEnabled ? "true" : "false",
            "data-chat-rendered-count": virtualizationEnabled ? virtualItems.length : order.length
          },
          /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-prelude" }, openState === "loading" ? /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-hint" }, t("chat.loadingHistory")) : null, openState === "error" && openError !== null ? /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-error" }, t("chat.loadError", { message: openError.message, code: openError.code })) : null, hasMore ? /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-older" }, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: loadingOlder, onClick: loadOlderAnchored }, loadingOlder ? t("loading") : t("chat.loadOlder"))) : null),
          virtualizationEnabled ? /* @__PURE__ */ React.createElement("div", { ref: virtualListRef, className: "lbs-chat-window-list", "data-chat-flow-host": "" }, /* @__PURE__ */ React.createElement("div", { "aria-hidden": "true", style: { height: padding.top } }), virtualItems.map((item) => renderNode(order[item.index], item.index, true)), /* @__PURE__ */ React.createElement("div", { "aria-hidden": "true", style: { height: padding.bottom } })) : /* @__PURE__ */ React.createElement("div", { ref: virtualListRef, className: "lbs-chat-window-list", "data-chat-flow-host": "" }, order.map((nodeKey, index) => renderNode(nodeKey, index, false))),
          /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-tail" }, running ? /* @__PURE__ */ React.createElement(RunningStatus, { startTime: runningTurnStart, t }) : null, pendingSteering.map((item) => /* @__PURE__ */ React.createElement(
            PendingBubble,
            {
              content: item.content,
              renderMessageImages,
              t,
              key: item.id
            }
          )))
        ), !atBottom ? /* @__PURE__ */ React.createElement("div", { className: "lbs-chat-window-bottom-slot" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "lbs-chat-window-bottom",
            "aria-label": t("chat.toBottom"),
            onClick: () => {
              if (listRef.current !== null) toBottom(scrollerOf(listRef.current));
            }
          },
          /* @__PURE__ */ React.createElement(Primitives.IconChevronDownOutline14, null)
        )) : null), fileOpenError !== null ? /* @__PURE__ */ React.createElement(
          OpenErrorDialog,
          {
            path: fileOpenError.path,
            message: fileOpenError.message,
            busy: fileOpenBusy,
            onClose: closeFileOpenError,
            onRetry: () => requestOpenFile(fileOpenError.path),
            t
          }
        ) : null);
      }
      const chatPerformanceRegistration = Object.freeze({
        version: 1,
        ChatView: OptimizedChatView
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
    }
  });
})();
