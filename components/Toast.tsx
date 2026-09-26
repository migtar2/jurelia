"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ToastMsg { id: number; text: string; type: "success" | "error" | "info" }

let _addToast: ((text: string, type?: ToastMsg["type"]) => void) | null = null;

export function showToast(text: string, type: ToastMsg["type"] = "success") {
  if (_addToast) _addToast(text, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  let nextId = 0;

  useEffect(() => {
    _addToast = (text, type = "success") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };
    return () => { _addToast = null; };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-[slideIn_.2s_ease-out] ${
            t.type === "error"
              ? "bg-error text-on-error"
              : t.type === "info"
              ? "bg-surface-container-highest text-on-surface"
              : "bg-primary text-on-primary"
          }`}
          style={{ animationFillMode: "forwards" }}
        >
          <span className="material-symbols-outlined !text-sm">
            {t.type === "error" ? "error" : t.type === "info" ? "info" : "check_circle"}
          </span>
          {t.text}
        </div>
      ))}
      <style>{`@keyframes slideIn{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>,
    document.body
  );
}