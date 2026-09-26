"use client";

import { useState, useEffect } from "react";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const FEEDBACK_TYPES = [
  { value: "wrong_decision", label: "Resolución incorrecta" },
  { value: "wrong_classification", label: "Clasificación errónea" },
  { value: "bad_summary", label: "Resumen deficiente" },
  { value: "bad_match", label: "Coincidencia incorrecta" },
  { value: "missing_jurisprudence", label: "Falta jurisprudencia" },
  { value: "other", label: "Otro" },
] as const;

interface FeedbackButtonProps {
  context: {
    page: string;
    query?: string;
    resultId?: string;
    resultTitle?: string;
    [key: string]: unknown;
  };
  className?: string;
}

export default function FeedbackButton({ context, className = "" }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAuthed(!!d.user))
      .catch(() => setIsAuthed(false));
  }, []);

  const handleSubmit = async () => {
    if (!feedbackType) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: feedbackType,
          description: description.trim() || undefined,
          context,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar");
        return;
      }
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setFeedbackType("");
        setDescription("");
      }, 1500);
    } catch {
      setError("Error de conexión");
    } finally {
      setSending(false);
    }
  };

  if (isAuthed === false) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors text-xs ${className}`}
      >
        <M name="flag" className="!text-sm" />
        <span className="hidden sm:inline">Reportar</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-inverse-surface/30 backdrop-blur-sm p-4"
          onClick={() => {
            if (!sending) {
              setOpen(false);
              setSent(false);
              setError(null);
            }
          }}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-2">
                <M name="flag" className="!text-lg text-error" />
                <h3 className="text-sm font-semibold text-on-surface">
                  Reportar resultado incorrecto
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <M name="close" className="!text-lg" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {sent ? (
                <div className="text-center py-6">
                  <M name="check_circle" className="!text-3xl text-[#16a34a] mb-2" />
                  <p className="text-sm font-semibold text-on-surface">Gracias por tu reporte</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Nos ayuda a mejorar JURELIA.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
                      Tipo de problema
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FEEDBACK_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setFeedbackType(t.value)}
                          className={`px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                            feedbackType === t.value
                              ? "bg-primary text-on-primary font-semibold"
                              : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1 block">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe brevemente el problema..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {error && (
                    <div className="p-2 bg-error-container rounded-lg text-xs text-on-error-container flex items-center gap-2">
                      <M name="error" className="!text-sm" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!feedbackType || sending}
                    className="w-full h-10 rounded-xl bg-error text-on-primary text-xs font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <M name="send" className="!text-sm" />
                        Enviar reporte
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}