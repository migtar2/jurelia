"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { openHelpDrawer } from "@/components/HelpDrawer";
import type { NewsComparisonResult, ExtractedClaim, ClaimStatus, HeadlineAccuracy } from "@/lib/news/compare-types";
import ToastContainer, { showToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/context";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const CLAIM_STATUS_STYLES: Record<ClaimStatus, { bg: string; border: string; text: string; icon: string; label: string }> = {
  SUPPORTED: { bg: "bg-[#dcfce7]", border: "border-[#16a34a]", text: "text-[#15803d]", icon: "check_circle", label: "Confirmada" },
  PARTIALLY_SUPPORTED: { bg: "bg-[#fef9c3]", border: "border-[#ca8a04]", text: "text-[#a16207]", icon: "info", label: "Parcialmente confirmada" },
  NOT_SUPPORTED: { bg: "bg-[#fee2e2]", border: "border-[#dc2626]", text: "text-[#dc2626]", icon: "cancel", label: "No confirmada" },
  CANNOT_VERIFY: { bg: "bg-surface-container-low", border: "border-outline-variant", text: "text-on-surface-variant", icon: "help_outline", label: "No verificable" },
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  holding: "Doctrina",
  factual: "Hecho",
  procedural: "Procesal",
  opinion: "Opinión",
};

const HEADLINE_STYLES: Record<HeadlineAccuracy, { bg: string; text: string; icon: string; label: string }> = {
  SUPPORTED: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", icon: "check_circle", label: "Titular respaldado" },
  OVERSTATED: { bg: "bg-[#fee2e2]", text: "text-[#dc2626]", icon: "warning", label: "Titular exagerado" },
  PARTIAL: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", icon: "info", label: "Titular parcial" },
  CANNOT_VERIFY: { bg: "bg-surface-container-low", text: "text-on-surface-variant", icon: "help_outline", label: "No verificable" },
};

const BASIS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FULL_TEXT: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", label: "Texto completo" },
  OFFICIAL_SUMMARY: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", label: "Resumen oficial" },
  METADATA_ONLY: { bg: "bg-surface-container", text: "text-on-surface-variant", label: "Solo metadatos" },
};

const PROVENANCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  AI_GENERATED: { bg: "bg-secondary-container", text: "text-on-secondary-container", label: "Generado por IA" },
  SOURCE_FACT: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", label: "Dato verificado" },
  INFERRED: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", label: "Inferido" },
};

export default function NewsComparePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-surface-container-highest border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <NewsComparePage />
    </Suspense>
  );
}

function NewsComparePage() {
  const searchParams = useSearchParams();
  const [articleUrl, setArticleUrl] = useState("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<NewsComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState("");
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-start if URL param present
  const initializedRef = useState({ current: false })[0];
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setArticleUrl(urlParam);
      // Trigger comparison after state is set
      setTimeout(() => {
        handleCompare(urlParam);
      }, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompare = async (url?: string) => {
    const targetUrl = url || articleUrl.trim();
    if (!targetUrl) return;
    if (comparing) return;

    setComparing(true);
    setError(null);
    setResult(null);
    setPhase("Extrayendo artículo y buscando resolución...");

    try {
      setPhase("Comparando afirmaciones con datos oficiales...");
      const res = await fetch("/api/news/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_url: targetUrl }),
        signal: AbortSignal.timeout(180_000),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("Timeout") ? "Timeout: el análisis tardó más de 3 minutos." : `Error: ${msg}`);
    } finally {
      setComparing(false);
      setPhase("");
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const id = result.identification;
    const lines: string[] = [];
    lines.push("# Informe de contraste — JURELIA");
    lines.push("");
    lines.push(`**Fecha:** ${new Date().toLocaleDateString("es-ES")}`);
    lines.push("");
    lines.push("## 1. Identificación");
    lines.push(`- **Noticia:** ${id.article.title || "—"}`);
    lines.push(`  - Fuente: ${id.article.publication || "—"}`);
    lines.push(`  - Fecha: ${id.article.date || "—"}`);
    lines.push(`  - URL: ${id.article.url}`);
    lines.push(`- **Resolución:** ${id.decision.titulo}`);
    if (id.decision.roj) lines.push(`  - ROJ: ${id.decision.roj}`);
    if (id.decision.ecli) lines.push(`  - ECLI: ${id.decision.ecli}`);
    if (id.decision.organo) lines.push(`  - Órgano: ${id.decision.organo}`);
    if (id.decision.fecha) lines.push(`  - Fecha resolución: ${id.decision.fecha}`);
    lines.push(`- **Base del análisis:** ${BASIS_BADGE[result.analysis_basis].label}`);
    lines.push(`- **Procedencia:** AI_GENERATED`);
    lines.push("");
    if (result.matches.length > 0) {
      lines.push("## 2. Coincidencias");
      result.matches.forEach((m) => lines.push(`- ✅ ${m}`));
      lines.push("");
    }
    lines.push("## 3. Afirmaciones");
    result.claims.forEach((c) => {
      const icon = c.status === "SUPPORTED" ? "✅" : c.status === "PARTIALLY_SUPPORTED" ? "⚠️" : c.status === "NOT_SUPPORTED" ? "❌" : "❓";
      lines.push(`- ${icon} **[${CLAIM_STATUS_STYLES[c.status].label}]** ${c.text}`);
      lines.push(`  - Tipo: ${CLAIM_TYPE_LABELS[c.type] || c.type} · Confianza: ${Math.round(c.confidence * 100)}% · Procedencia: AI_GENERATED`);
      if (c.evidence) lines.push(`  - Evidencia: ${c.evidence}`);
    });
    if (result.nuances.length > 0) {
      lines.push("");
      lines.push("## 4. Matices omitidos o imprecisos");
      result.nuances.forEach((n) => lines.push(`- ⚠️ ${n}`));
    }
    lines.push("");
    lines.push("## 5. Conclusión");
    lines.push(`**Titular:** ${HEADLINE_STYLES[result.headline_accuracy].label}`);
    if (result.headline_accuracy_explanation) lines.push(`> ${result.headline_accuracy_explanation}`);
    lines.push("");
    lines.push(result.conclusion);
    if (result.uncertainty) {
      lines.push("");
      lines.push(`> **Incertidumbre:** ${result.uncertainty}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("*Informe generado por JURELIA — análisis orientativo con IA. No constituye asesoramiento jurídico.*");
    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("Informe copiado al portapapeles");
  };

  const handleExport = () => {
    if (!result) return;
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tool: "JURELIA",
      provenance: "AI_GENERATED",
      result,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `jurelia-informe-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Informe exportado");
  };

  const handleShare = async () => {
    if (!result) return;
    const params = new URLSearchParams();
    params.set("url", result.identification.article.url);
    const shareUrl = `${window.location.origin}/news-compare?${params.toString()}`;
    await navigator.clipboard.writeText(shareUrl);
    showToast("Enlace copiado al portapapeles");
  };

  const handleSave = async () => {
    if (!result || !user) {
      showToast("Debes iniciar sesión para guardar", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_url: result.identification.article.url,
          article_title: result.identification.article.title,
          publication: result.identification.article.publication,
          published_at: result.identification.article.date,
          decision_roj: result.identification.decision.roj,
          decision_ecli: result.identification.decision.ecli,
          match_status: result.headline_accuracy === "SUPPORTED" ? "VERIFIED"
            : result.headline_accuracy === "PARTIAL" ? "PROBABLE"
            : result.headline_accuracy === "OVERSTATED" ? "AMBIGUOUS"
            : "NOT_FOUND",
          match_confidence: result.claims.length > 0
            ? result.claims.reduce((sum, c) => sum + c.confidence, 0) / result.claims.length
            : null,
          analysis_basis: result.analysis_basis,
          comparison_result: result,
        }),
      });

      if (res.ok) {
        setSaved(true);
        showToast("Análisis guardado en Workspace");
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setSaved(true);
          showToast("Este análisis ya estaba guardado", "info");
        } else {
          showToast(data.error || "Error al guardar", "error");
        }
      }
    } catch {
      showToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Contraste noticia vs resolución</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/workspace" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs">
              <M name="workspaces" className="!text-sm" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs">
              <M name="search" className="!text-sm" />
              <span className="hidden sm:inline">Buscar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-4 lg:px-8 py-5 lg:py-6">
        {/* ── Input Section (when no result) ── */}
        {!result && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
              <M name="fact_check" className="!text-xl text-primary" />
              Contraste de noticia jurídica
            </h1>
            <p className="text-xs text-secondary mb-5">
              Compara las afirmaciones de un artículo periodístico con los datos oficiales de la resolución judicial en CENDOJ.
            </p>

            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
              <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 block flex items-center gap-1">
                <M name="link" className="!text-xs" />
                URL del artículo jurídico
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCompare()}
                  placeholder="elpais.com/espana/tribunales/..."
                  className="flex-1 h-10 px-3 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={comparing}
                />
                <button
                  onClick={() => handleCompare()}
                  disabled={comparing || !articleUrl.trim()}
                  className="px-5 h-10 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {comparing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {phase || "Analizando..."}
                    </>
                  ) : (
                    <>
                      <M name="fact_check" className="!text-lg" />
                      Contrastar
                    </>
                  )}
                </button>
              </div>
              <div className="mt-3 flex gap-1.5 flex-wrap">
                <span className="text-[10px] text-outline self-center">Ejemplo:</span>
                {[
                  { l: "TS · Cláusulas suelo", u: "https://cincodias.elpais.com/legal/2024/02/tribunal-supremo-clausulas-suelo-retroactividad.html" },
                ].map((s) => (
                  <button
                    key={s.l}
                    onClick={() => { setArticleUrl(s.u); handleCompare(s.u); }}
                    disabled={comparing}
                    className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-[10px] font-medium text-on-surface-variant transition-colors"
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              {[
                { icon: "newspaper", title: "Extraer afirmaciones", desc: "La IA identifica las afirmaciones clave del artículo sobre la resolución." },
                { icon: "verified", title: "Cotejar con CENDOJ", desc: "Cada afirmación se contrasta con los datos oficiales de la resolución." },
                { icon: "analytics", title: "Informe estructurado", desc: "Resultado con código de colores: confirmada, parcial, no confirmada." },
              ].map((c, i) => (
                <div key={i} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
                  <M name={c.icon} className="!text-2xl text-primary mb-2" />
                  <h3 className="text-xs font-semibold text-on-surface mb-1">{c.title}</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-error-container rounded-xl text-sm flex items-start gap-2">
                <M name="error" className="!text-base text-error shrink-0 mt-0.5" />
                <span className="text-on-surface">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Result View ── */}
        {result && (
          <ComparisonResultView result={result} onBack={() => { setResult(null); setError(null); setArticleUrl(""); setSaved(false); }} onCopy={handleCopy} onExport={handleExport} onShare={handleShare} onSave={handleSave} saving={saving} saved={saved} />
        )}
      </main>

      <ToastContainer />
    </div>
  );
}

/* ── Comparison Result View ── */

function ComparisonResultView({
  result,
  onBack,
  onCopy,
  onExport,
  onShare,
  onSave,
  saving,
  saved,
}: {
  result: NewsComparisonResult;
  onBack: () => void;
  onCopy: () => void;
  onExport: () => void;
  onShare: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const { identification: id, claims } = result;
  const ha = HEADLINE_STYLES[result.headline_accuracy];
  const bb = BASIS_BADGE[result.analysis_basis];

  return (
    <div>
      {/* Print-only header */}
      <div className="print-header items-center justify-between border-b border-outline-variant pb-3 mb-5">
        <div className="flex items-center gap-2.5">
          <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
          <span className="text-sm font-semibold tracking-tight">JURELIA — Informe de contraste</span>
        </div>
        <span className="text-xs text-on-surface-variant">{new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>

      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <button onClick={onBack} className="text-xs text-primary hover:underline flex items-center gap-1">
          <M name="arrow_back" className="!text-sm" />
          Nueva comparación
        </button>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${bb.bg} ${bb.text}`}>
            {bb.label}
          </span>
          <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
            <M name="content_copy" className="!text-sm" />
            Copiar análisis
          </button>
          <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
            <M name="download" className="!text-sm" />
            Exportar informe
          </button>
          <button onClick={onShare} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
            <M name="share" className="!text-sm" />
            Compartir
          </button>
          <button
            onClick={onSave}
            disabled={saving || saved}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              saved
                ? "bg-[#dcfce7] text-[#15803d] cursor-default"
                : saving
                  ? "bg-primary/50 text-on-primary/50 cursor-wait"
                  : "bg-primary text-on-primary hover:bg-primary-container"
            }`}
          >
            <M name={saved ? "check" : saving ? "hourglass_empty" : "bookmark_add"} className="!text-sm" />
            {saved ? "Guardado" : saving ? "Guardando..." : "Guardar en Workspace"}
          </button>
        </div>
      </div>

      {/* 1. Identificación — Two-column layout */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="fingerprint" className="!text-sm text-primary" />
          1. Identificación
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Article */}
          <div className="p-3 rounded-lg bg-surface-container-low border-l-2 border-primary">
            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Noticia</span>
            {id.article.title && <h3 className="text-sm font-semibold text-on-surface mt-1 mb-1">{id.article.title}</h3>}
            <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
              {id.article.publication && <span className="font-medium text-on-surface">{id.article.publication}</span>}
              {id.article.date && <span>· {id.article.date}</span>}
            </div>
            <a href={id.article.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
              <M name="open_in_new" className="!text-xs" />
              Abrir noticia
            </a>
          </div>
          {/* Right: Decision */}
          <div className="p-3 rounded-lg bg-surface-container-low border-l-2 border-secondary">
            <span className="text-[9px] font-bold text-secondary uppercase tracking-wider">Resolución / CENDOJ</span>
            <h3 className="text-sm font-semibold text-on-surface mt-1 mb-1">{id.decision.titulo}</h3>
            <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
              {id.decision.organo && <span>{id.decision.organo}</span>}
              {id.decision.fecha && <span>· {id.decision.fecha}</span>}
              {id.decision.ponente && <span>· Ponente: {id.decision.ponente}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {id.decision.roj && <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {id.decision.roj}</span>}
              {id.decision.ecli && <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {id.decision.ecli}</span>}
            </div>
            {id.decision.url_pdf && (
              <a href={id.decision.url_pdf} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
                <M name="open_in_new" className="!text-xs" />
                Abrir PDF
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 2. Coincidencias */}
      {result.matches.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
          <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <M name="check_circle" className="!text-sm text-[#16a34a]" />
            2. Coincidencias
          </h2>
          <ul className="space-y-1.5">
            {result.matches.map((m, i) => (
              <li key={i} className="text-xs text-on-surface flex gap-2 items-start">
                <M name="check" className="!text-xs text-[#16a34a] shrink-0 mt-0.5" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Afirmaciones de la noticia */}
      {claims.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
          <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <M name="format_list_bulleted" className="!text-sm text-primary" />
            3. Afirmaciones de la noticia
          </h2>
          <div className="space-y-3">
            {claims.map((claim) => {
              const cs = CLAIM_STATUS_STYLES[claim.status];
              return (
                <div key={claim.id} className={`p-3 rounded-lg ${cs.bg} border-l-4 ${cs.border}`}>
                  <div className="flex items-start gap-2 mb-1.5">
                    <M name={cs.icon} className={`!text-sm ${cs.text} shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${cs.text}`}>{cs.label}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-[9px] font-medium text-on-surface-variant">
                          {CLAIM_TYPE_LABELS[claim.type] || claim.type}
                        </span>
                        <span className="text-[9px] text-outline">
                          Confianza: {Math.round(claim.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-on-surface leading-relaxed">{claim.text}</p>
                      {claim.evidence && (
                        <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                          <M name="info" className="!text-xs mr-0.5" />
                          {claim.evidence}
                        </p>
                      )}
                    </div>
                    <ProvenanceTag provenance={claim.provenance} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Evidencia oficial */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="verified" className="!text-sm text-primary" />
          4. Evidencia oficial
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Base del análisis", value: bb.label, badge: bb },
            { label: "Resolución", value: id.decision.roj || id.decision.ecli || id.decision.titulo },
            { label: "Órgano", value: id.decision.organo || "—" },
            { label: "Fecha", value: id.decision.fecha || "—" },
          ].map((item, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-surface-container-low">
              <span className="text-[9px] text-secondary uppercase tracking-wider font-semibold">{item.label}</span>
              <div className="text-xs font-medium text-on-surface mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-2.5 rounded-lg bg-surface-container-low border-l-2 border-yellow-500 flex items-start gap-2">
          <M name="info" className="!text-sm text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            {result.analysis_basis === "METADATA_ONLY"
              ? "El análisis se basa únicamente en metadatos procesales. Las conclusiones pueden ser limitadas."
              : result.analysis_basis === "OFFICIAL_SUMMARY"
                ? "El análisis se basa en el resumen oficial de CENDOJ. Para mayor precisión se necesita el texto completo."
                : "El análisis se basa en el texto completo de la resolución."}
          </p>
        </div>
      </div>

      {/* 5. Matices */}
      {result.nuances.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
          <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <M name="lightbulb" className="!text-sm text-[#ca8a04]" />
            5. Matices omitidos o imprecisos
          </h2>
          <ul className="space-y-1.5">
            {result.nuances.map((n, i) => (
              <li key={i} className="text-xs text-on-surface flex gap-2 items-start">
                <M name="warning" className="!text-xs text-[#ca8a04] shrink-0 mt-0.5" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 6. Conclusión */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="summarize" className="!text-sm text-primary" />
          6. Conclusión
        </h2>

        {/* Headline Accuracy */}
        <div className={`p-3 rounded-lg ${ha.bg} mb-3 flex items-center gap-2`}>
          <M name={ha.icon} className={`!text-base ${ha.text}`} />
          <div>
            <span className={`text-xs font-bold ${ha.text}`}>{ha.label}</span>
            {result.headline_accuracy_explanation && (
              <p className="text-[11px] text-on-surface-variant mt-0.5">{result.headline_accuracy_explanation}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-on-surface leading-relaxed">{result.conclusion}</p>

        {/* Uncertainty */}
        {result.uncertainty && (
          <div className="mt-3 p-2.5 rounded-lg bg-surface-container-low border-l-2 border-yellow-500 flex items-start gap-2">
            <M name="info" className="!text-sm text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-on-surface-variant leading-relaxed">{result.uncertainty}</p>
          </div>
        )}
      </div>

      {/* 7. Fuentes */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="link" className="!text-sm text-primary" />
          7. Fuentes
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <M name="newspaper" className="!text-sm text-primary" />
            <span className="text-on-surface-variant">Artículo:</span>
            <a href={id.article.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
              {id.article.url}
            </a>
          </div>
          {id.decision.url_pdf && (
            <div className="flex items-center gap-2 text-xs">
              <M name="description" className="!text-sm text-secondary" />
              <span className="text-on-surface-variant">Resolución:</span>
              <a href={id.decision.url_pdf} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                {id.decision.url_pdf}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <M name="auto_awesome" className="!text-sm text-secondary" />
            <span className="text-on-surface-variant">Procedencia:</span>
            <ProvenanceTag provenance={result.provenance} />
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-surface-container-low flex gap-2 items-start text-[10px]">
        <M name="lock" className="!text-sm text-secondary shrink-0 mt-0.5" />
        <span className="text-on-surface-variant leading-relaxed">
          <strong className="text-on-surface">Nota:</strong> Este análisis es orientativo y generado automáticamente mediante IA. No constituye asesoramiento jurídico ni sustituye la lectura íntegra de la resolución. Los datos oficiales proceden de CENDOJ (CGPJ).
        </span>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function ProvenanceTag({ provenance }: { provenance: string }) {
  const pb = PROVENANCE_BADGE[provenance] || PROVENANCE_BADGE.AI_GENERATED;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${pb.bg} ${pb.text}`}>
      {pb.label}
    </span>
  );
}