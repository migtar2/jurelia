"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface FeedbackRow {
  id: string;
  userId: string;
  feedbackType: string;
  description: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  wrong_decision: "Resolución incorrecta",
  wrong_classification: "Clasificación errónea",
  bad_summary: "Resumen deficiente",
  bad_match: "Coincidencia incorrecta",
  missing_jurisprudence: "Falta jurisprudencia",
  other: "Otro",
};

const TYPE_COLORS: Record<string, string> = {
  wrong_decision: "bg-error-container text-on-error-container",
  wrong_classification: "bg-[#fef9c3] text-[#a16207]",
  bad_summary: "bg-secondary-container text-on-secondary-container",
  bad_match: "bg-surface-container text-on-surface-variant",
  missing_jurisprudence: "bg-[#dcfce7] text-[#15803d]",
  other: "bg-surface-container-low text-on-surface-variant",
};

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => {
        if (r.status === 401) {
          setError("Acceso no autorizado. Inicie sesión.");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.feedback) setFeedback(data.feedback);
        else if (data?.error) setError(data.error);
      })
      .catch(() => setError("Error al cargar feedback"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter
    ? feedback.filter((f) => f.feedbackType === filter)
    : feedback;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <M name="admin_panel_settings" className="!text-lg text-primary" />
            <span className="text-sm font-semibold tracking-tight text-on-surface">
              Panel de feedback — Beta
            </span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs"
          >
            <M name="arrow_back" className="!text-base" />
            <span className="hidden sm:inline">Volver</span>
          </Link>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-4 lg:px-8 py-6">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-surface-container-highest border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-secondary">Cargando reportes...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto text-center py-16">
            <M name="lock" className="!text-3xl text-error mb-3" />
            <p className="text-sm font-semibold text-on-surface mb-1">{error}</p>
            <Link href="/auth/login" className="text-xs text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {[
                { label: "Total", count: feedback.length, type: "" },
                ...Object.entries(TYPE_LABELS).map(([type, label]) => ({
                  label,
                  count: feedback.filter((f) => f.feedbackType === type).length,
                  type,
                })),
              ].slice(0, 4)
                .map((s) => (
                <button
                  key={s.type}
                  onClick={() => setFilter(filter === s.type ? "" : s.type)}
                  className={`p-3 rounded-xl border transition-colors text-left ${
                    filter === s.type
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low"
                  }`}
                >
                  <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                    {s.label}
                  </span>
                  <div className="text-lg font-bold text-on-surface">{s.count}</div>
                </button>
              ))}
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setFilter("")}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                  filter === ""
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Todos ({feedback.length})
              </button>
              {Object.entries(TYPE_LABELS).map(([type, label]) => {
                const count = feedback.filter((f) => f.feedbackType === type).length;
                if (count === 0) return null;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(filter === type ? "" : type)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      filter === type
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <M name="inbox" className="!text-3xl text-outline mb-2" />
                <p className="text-xs text-secondary">No hay reportes{filter ? " de este tipo" : ""}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((f) => (
                  <div
                    key={f.id}
                    className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            TYPE_COLORS[f.feedbackType] || TYPE_COLORS.other
                          }`}
                        >
                          {TYPE_LABELS[f.feedbackType] || f.feedbackType}
                        </span>
                        <span className="text-[10px] text-outline font-mono">
                          {f.id.slice(0, 8)}
                        </span>
                      </div>
                      <span className="text-[10px] text-outline shrink-0">
                        {new Date(f.createdAt).toLocaleString("es-ES")}
                      </span>
                    </div>

                    {f.description && (
                      <p className="text-xs text-on-surface-variant leading-relaxed mb-2">
                        {f.description}
                      </p>
                    )}

                    {f.context && (
                      <details className="group">
                        <summary className="cursor-pointer text-[10px] text-secondary hover:text-primary transition-colors flex items-center gap-1">
                          <M name="expand_more" className="!text-sm group-open:rotate-180 transition-transform" />
                          Contexto
                        </summary>
                        <pre className="mt-1 p-2 bg-surface-container-low rounded-lg text-[10px] text-on-surface-variant overflow-auto max-h-32 font-mono">
                          {JSON.stringify(f.context, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}