"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiaStateId } from "@/lib/lia/lia-states";
import { LIA_STATES, getLiaState } from "@/lib/lia/lia-states";

/* ─── Feature flags ────────────────────────────────────── */
const LIA_ENABLED = process.env.NEXT_PUBLIC_LIA_ENABLED !== "false";
const LIA_AUTO_MOVE = process.env.NEXT_PUBLIC_LIA_AUTO_MOVE !== "false";

/* ─── Sizes ────────────────────────────────────────────── */
const LIA_SIZES = {
  desktop: { w: 110, h: 136 },
  laptop: { w: 100, h: 124 },
  tablet: { w: 90, h: 111 },
  mobile: { w: 78, h: 96 },
} as const;

/* ─── Movement config ──────────────────────────────────── */
const MOVE_MIN_DURATION = 1500;
const MOVE_MAX_DURATION = 3000;
const AUTO_MOVE_INTERVAL_MIN = 25000;
const AUTO_MOVE_INTERVAL_MAX = 60000;
const MARGIN = 20;

/* ─── Helpers ──────────────────────────────────────────── */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function getLiaSize() {
  if (typeof window === "undefined") return LIA_SIZES.desktop;
  const w = window.innerWidth;
  if (w < 520) return LIA_SIZES.mobile;
  if (w < 850) return LIA_SIZES.tablet;
  if (w < 1200) return LIA_SIZES.laptop;
  return LIA_SIZES.desktop;
}

/* ─── Component ────────────────────────────────────────── */
export default function LiaAssistant() {
  if (!LIA_ENABLED) return null;
  return <LiaInner />;
}

function LiaInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoMoveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStateRef = useRef<LiaStateId>("idle");

  const [currentState, setCurrentState] = useState<LiaStateId>("idle");
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "lia"; text: string }[]
  >([{ role: "lia", text: "Hola, soy LIA. ¿En qué puedo ayudarte?" }]);
  const [inputText, setInputText] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(LIA_AUTO_MOVE);
  const [isQaVisible, setIsQaVisible] = useState(false);
  const [liaSize, setLiaSize] = useState(getLiaSize());
  const [isClient, setIsClient] = useState(false);

  // Detect dev mode for QA
  const isDev = process.env.NODE_ENV === "development";

  /* ── Client-side mount ─────────────────────────────── */
  useEffect(() => {
    setIsClient(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);

    const onResize = () => setLiaSize(getLiaSize());
    window.addEventListener("resize", onResize);

    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* ── DotLottie init ────────────────────────────────── */
  useEffect(() => {
    if (!isClient || !canvasRef.current) return;

    let destroyed = false;
    let wasmReady = false;
    let animLoaded = false;

    (async () => {
      const { DotLottie } = await import("@lottiefiles/dotlottie-web");
      if (destroyed || !canvasRef.current) return;

      // Self-host WASM to avoid CDN failures in production
      DotLottie.setWasmUrl("/dotlottie-player.wasm");

      const runtime = new DotLottie({
        canvas: canvasRef.current,
        src: "/lia-bot.json",
        autoplay: false,
        loop: true,
        layout: { fit: "contain", align: [0.5, 0.5] },
        renderConfig: {
          autoResize: true,
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          freezeOnOffscreen: false,
        },
      });

      runtimeRef.current = runtime;

      // Only apply idle when BOTH WASM is ready AND animation is loaded
      const tryActivate = () => {
        if (destroyed || !wasmReady || !animLoaded) return;
        applyState("idle");
      };

      // Error handling
      runtime.addEventListener("loadError", (e: any) => {
        if (destroyed) return;
        console.error("[LIA] loadError:", e?.error ?? e);
      });

      runtime.addEventListener("renderError", (e: any) => {
        if (destroyed) return;
        console.error("[LIA] renderError:", e?.error ?? e);
      });

      // Complete → return to idle for one-shot states
      runtime.addEventListener("complete", () => {
        if (destroyed) return;
        const s = getLiaState(currentStateRef.current);
        if (s.returnToIdle) applyState("idle");
      });

      // ready = WASM module initialized
      runtime.addEventListener("ready", () => {
        if (destroyed) return;
        wasmReady = true;
        tryActivate();
      });

      // load = animation data fetched and parsed
      runtime.addEventListener("load", () => {
        if (destroyed) return;
        animLoaded = true;
        tryActivate();
      });

      // Fallback: if neither event fires within 5s, try anyway
      fallbackTimerRef.current = setTimeout(() => {
        if (!destroyed && runtimeRef.current) {
          try { applyState("idle"); } catch {}
        }
      }, 5000);
    })();

    return () => {
      destroyed = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      runtimeRef.current?.destroy?.();
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  /* ── State control ─────────────────────────────────── */
  const applyState = useCallback(
    (id: LiaStateId) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const s = getLiaState(id);
      currentStateRef.current = id;
      setCurrentState(id);
      runtime.pause?.();
      runtime.setLoop?.(s.loop);
      runtime.setSegment?.(...s.segment);
      runtime.setFrame?.(s.segment[0]);
      runtime.play?.();
    },
    []
  );

  /* ── Movement ──────────────────────────────────────── */
  const getBounds = useCallback(() => {
    const size = getLiaSize();
    return {
      minX: MARGIN,
      minY: MARGIN,
      maxX: window.innerWidth - size.w - MARGIN,
      maxY: window.innerHeight - size.h - MARGIN - (isDev ? 48 : 0),
    };
  }, [isDev]);

  const moveLiaTo = useCallback(
    (x: number, y: number, duration?: number) => {
      const el = containerRef.current;
      if (!el) return;

      const bounds = getBounds();
      x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
      y = Math.max(bounds.minY, Math.min(bounds.maxY, y));

      const rect = el.getBoundingClientRect();
      const dist = Math.hypot(x - rect.left, y - rect.top);
      const dur =
        duration ??
        Math.min(
          MOVE_MAX_DURATION,
          Math.max(MOVE_MIN_DURATION, dist * 2.5)
        );

      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      setIsMoving(true);

      el.style.transition = reducedMotion
        ? "left 0.1s, top 0.1s, right auto, bottom auto"
        : `left ${dur}ms cubic-bezier(.25,.46,.45,.94), top ${dur}ms cubic-bezier(.25,.46,.45,.94)`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      moveTimerRef.current = setTimeout(() => {
        setIsMoving(false);
        moveTimerRef.current = null;
      }, dur);
    },
    [getBounds, reducedMotion]
  );

  const moveHome = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    setIsMoving(true);
    el.style.transition = reducedMotion
      ? "left 0.1s, top 0.1s"
      : "left 1.2s cubic-bezier(.34,1.56,.64,1), top 1.2s cubic-bezier(.34,1.56,.64,1)";
    el.style.left = "auto";
    el.style.top = "auto";
    el.style.right = "24px";
    el.style.bottom = "24px";
    setTimeout(() => setIsMoving(false), 1200);
  }, [reducedMotion]);

  /* ── Auto-move ─────────────────────────────────────── */
  useEffect(() => {
    if (!isClient || !autoMoveEnabled || reducedMotion || chatOpen) {
      if (autoMoveRef.current) clearTimeout(autoMoveRef.current);
      return;
    }

    const schedule = () => {
      const delay =
        AUTO_MOVE_INTERVAL_MIN +
        Math.random() * (AUTO_MOVE_INTERVAL_MAX - AUTO_MOVE_INTERVAL_MIN);
      autoMoveRef.current = setTimeout(() => {
        if (chatOpen) return;
        const bounds = getBounds();
        const roll = Math.random();
        if (roll < 0.4) {
          // move to other bottom corner
          const currentRight =
            containerRef.current?.style.right !== "auto";
          if (currentRight) {
            moveLiaTo(bounds.minX + 20, bounds.maxY);
          } else {
            moveHome();
          }
        } else if (roll < 0.7) {
          // random position
          moveLiaTo(
            bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
            bounds.maxY - Math.random() * 80
          );
        } else {
          moveHome();
        }
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      if (autoMoveRef.current) clearTimeout(autoMoveRef.current);
    };
  }, [isClient, autoMoveEnabled, reducedMotion, chatOpen, getBounds, moveLiaTo, moveHome]);

  /* ── Chat ──────────────────────────────────────────── */
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const clean = text.trim().slice(0, 200);

      // Clear previous timers
      for (const t of chatTimersRef.current) clearTimeout(t);
      chatTimersRef.current.clear();

      setMessages((prev) => [...prev, { role: "user", text: clean }]);
      applyState("thinking");

      const t1 = setTimeout(() => {
        applyState("talking");
        setMessages((prev) => [
          ...prev,
          {
            role: "lia",
            text: "Entendido. Déjame revisar la información disponible y te respondo en un momento.",
          },
        ]);
      }, 1600);

      const t2 = setTimeout(() => {
        applyState("idle");
      }, 4600);

      chatTimersRef.current.add(t1);
      chatTimersRef.current.add(t2);
    },
    [applyState]
  );

  /* ── Keyboard ──────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && chatOpen) setChatOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chatOpen]);

  /* ── Cleanup ───────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      if (autoMoveRef.current) clearTimeout(autoMoveRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      for (const t of chatTimersRef.current) clearTimeout(t);
    };
  }, []);

  /* ── Visibility: pause when tab hidden ─────────────── */
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        runtimeRef.current?.pause?.();
      } else {
        runtimeRef.current?.play?.();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  if (!isClient) return null;

  const size = liaSize;

  return (
    <>
      {/* ── LIA floating avatar ─────────────────────────── */}
      <div
        ref={containerRef}
        onClick={() => {
          if (!isMoving) {
            setChatOpen((v) => !v);
            if (!chatOpen) applyState("hello");
          }
        }}
        className="lia-float-container"
        style={{
          position: "fixed",
          zIndex: 900,
          right: 24,
          bottom: 24,
          width: size.w,
          height: size.h,
          cursor: "pointer",
          transition: "transform 0.2s ease",
          filter: "drop-shadow(0 4px 12px rgba(20,103,243,.15))",
        }}
        title="Click para abrir chat con LIA"
        role="button"
        aria-label="Abrir chat con LIA"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setChatOpen((v) => !v);
            if (!chatOpen) applyState("hello");
          }
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20,103,243,.1), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <canvas
          ref={canvasRef}
          width={500}
          height={620}
          style={{ display: "block", width: "100%", height: "100%" }}
          aria-label="Animación de LIA"
        />
      </div>

      {/* ── Chat panel ──────────────────────────────────── */}
      {chatOpen && (
        <div
          className="lia-chat-panel"
          style={{
            position: "fixed",
            zIndex: 899,
            bottom: 24 + size.h + 12,
            right: 24,
            width: Math.min(340, window.innerWidth - 48),
            maxHeight: Math.min(420, window.innerHeight - size.h - 80),
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(20,55,111,.18)",
            border: "1px solid #e2e8f3",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "lia-panel-in 0.25s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #e2e8f3",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#28c995",
                flexShrink: 0,
              }}
            />
            <strong style={{ fontSize: 13, flex: 1 }}>LIA — Asistente</strong>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setChatOpen(false);
              }}
              style={{
                background: "none",
                border: 0,
                fontSize: 16,
                color: "#6b7a96",
                cursor: "pointer",
                padding: "2px 6px",
                lineHeight: 1,
              }}
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: 12,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  maxWidth: "85%",
                  padding: "8px 10px",
                  borderRadius: 12,
                  ...(msg.role === "lia"
                    ? {
                        background: "#f3f6fc",
                        border: "1px solid #e3e9f3",
                        borderTopLeftRadius: 4,
                        color: "#354666",
                        alignSelf: "flex-start",
                      }
                    : {
                        background:
                          "linear-gradient(135deg, #1768f2, #0f92ee)",
                        color: "#fff",
                        borderTopRightRadius: 4,
                        alignSelf: "flex-end",
                      }),
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: ".08em",
                    opacity: 0.6,
                    marginBottom: 2,
                  }}
                >
                  {msg.role === "lia" ? "LIA" : "TÚ"}
                </span>
                {msg.text}
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputText);
              setInputText("");
            }}
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 12px",
              borderTop: "1px solid #e2e8f3",
            }}
          >
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe un mensaje…"
              maxLength={200}
              style={{
                flex: 1,
                border: "1px solid #e2e8f3",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12,
                outline: "none",
                minWidth: 0,
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "#1467f3")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "#e2e8f3")
              }
            />
            <button
              type="submit"
              aria-label="Enviar"
              style={{
                background: "#1467f3",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                width: 34,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      {/* ── QA controls (dev only) ──────────────────────── */}
      {isDev && (
        <>
          <button
            onClick={() => setIsQaVisible((v) => !v)}
            style={{
              position: "fixed",
              zIndex: 950,
              bottom: 4,
              right: 4,
              background: "rgba(12,26,58,.7)",
              color: "#aaa",
              border: 0,
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 9,
              cursor: "pointer",
            }}
          >
            LIA QA
          </button>
          {isQaVisible && (
            <div
              style={{
                position: "fixed",
                zIndex: 950,
                bottom: 0,
                left: 0,
                right: 0,
                background: "rgba(12,26,58,.92)",
                backdropFilter: "blur(8px)",
                color: "#c5d0e6",
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "#fff", marginRight: 4 }}>
                LIA QA
              </strong>
              <span>Estados:</span>
              {(
                [
                  "idle",
                  "blink",
                  "hello",
                  "thinking",
                  "talking",
                ] as LiaStateId[]
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => applyState(s)}
                  style={{
                    background:
                      currentState === s
                        ? "#1467f3"
                        : "rgba(255,255,255,.1)",
                    border:
                      currentState === s
                        ? "1px solid #1467f3"
                        : "1px solid rgba(255,255,255,.15)",
                    color: "#fff",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
              <span style={{ margin: "0 4px" }}>|</span>
              <span>Mover:</span>
              <button
                onClick={moveHome}
                style={qaBtnStyle}
              >
                Home
              </button>
              <button
                onClick={() => {
                  const rect =
                    containerRef.current?.getBoundingClientRect();
                  if (rect) moveLiaTo(rect.left - 200, rect.top);
                }}
                style={qaBtnStyle}
              >
                ← Izq
              </button>
              <button
                onClick={() => {
                  const rect =
                    containerRef.current?.getBoundingClientRect();
                  if (rect) moveLiaTo(rect.left + 200, rect.top);
                }}
                style={qaBtnStyle}
              >
                Der →
              </button>
              <button
                onClick={() => {
                  const b = getBounds();
                  moveLiaTo(
                    b.minX + Math.random() * (b.maxX - b.minX),
                    b.minY + Math.random() * (b.maxY - b.minY)
                  );
                }}
                style={qaBtnStyle}
              >
                Random
              </button>
              <span style={{ margin: "0 4px" }}>|</span>
              <button
                onClick={() => setAutoMoveEnabled((v) => !v)}
                style={{
                  ...qaBtnStyle,
                  background: autoMoveEnabled
                    ? "#16a34a"
                    : "rgba(255,255,255,.1)",
                }}
              >
                Auto: {autoMoveEnabled ? "ON" : "OFF"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Animation keyframe ──────────────────────────── */}
      <style>{`
        @keyframes lia-panel-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        .lia-float-container:hover {
          transform: scale(1.05);
        }
      `}</style>
    </>
  );
}

const qaBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.1)",
  border: "1px solid rgba(255,255,255,.15)",
  color: "#fff",
  borderRadius: 4,
  padding: "3px 10px",
  fontSize: 10,
  cursor: "pointer",
};