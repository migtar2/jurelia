"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { openHelpDrawer } from "@/components/HelpDrawer";
import { useRouter } from "next/navigation";
import * as compareStore from "@/lib/compare/store";
import type { CompareDecision, ComparisonResult } from "@/lib/compare/types";
import * as workspaceStore from "@/lib/workspace/store";
import { formatComparisonAsText, copyToClipboard, downloadJSON } from "@/lib/export-utils";
import ToastContainer, { showToast } from "@/components/Toast";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const PROVENANCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  AI_GENERATED: { bg: "bg-secondary-container", text: "text-on-secondary-container", label: "Generado por IA" },
  SOURCE_FACT: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", label: "Dato verificado" },
  INFERRED: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", label: "Inferido" },
};

const EVIDENCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FULL_TEXT: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", label: "Texto completo" },
  OFFICIAL_SUMMARY: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", label: "Resumen oficial" },
  METADATA_ONLY: { bg: "bg-surface-container", text: "text-on-surface-variant", label: "Solo metadatos" },
};

export default function ComparePage() {
  const router = useRouter();
  const [selection, setSelection] = useState<{ a: CompareDecision | null; b: CompareDecision | null }>({ a: null, b: null });
  const [query, setQuery] = useState("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressPhase, setProgressPhase] = useState("");

  useEffect(() => {
    const sel = compareStore.getSelection();
    setSelection(sel);
  }, []);

  const handleRemove = (pos: "a" | "b") => {
    compareStore.remove(pos);
    setSelection(compareStore.getSelection());
    setResult(null);
    setError(null);
  };

  const handleCompare = async () => {
    if (!selection.a || !selection.b) return;
    if (comparing) return;

    setComparing(true);
    setError(null);
    setResult(null);
    setProgressPhase("Obteniendo textos...");

    try {
      setProgressPhase("Generando comparación jurídica...");
      const res = await fetch("/api/cendoj/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_a: selection.a,
          decision_b: selection.b,
          query: query.trim() || undefined,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("Timeout") ? "Timeout: la comparación tardó más de 2 minutos." : `Error: ${msg}`);
    } finally {
      setComparing(false);
      setProgressPhase("");
    }
  };

  const hasA = selection.a !== null;
  const hasB = selection.b !== null;
  const bothSelected = hasA && hasB;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Comparar resoluciones</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/proposition" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs">
              <M name="policy" className="!text-base" />
              <span className="hidden sm:inline">Proposición</span>
            </Link>
            <Link href="/workspace" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs">
              <M name="workspaces" className="!text-base" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">
              <M name="search" className="!text-sm" />
              <span className="hidden sm:inline">Buscar</span>
            </Link>
            <button
              onClick={() => openHelpDrawer()}
              aria-label="Abrir ayuda"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors text-xs"
            >
              <M name="help_outline" className="!text-base" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-4 lg:px-8 py-5 lg:py-6">

        {/* Selection Summary */}
        {!result && (
          <div className="mb-6">
            <h1 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
              <M name="compare" className="!text-xl text-primary" />
              Comparación de resoluciones
            </h1>
            <p className="text-xs text-secondary mb-5">Selecciona dos resoluciones para generar un análisis comparativo estructurado con IA.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* Decision A */}
              <DecisionCard label="Resolución A" position="a" decision={selection.a} onRemove={() => handleRemove("a")} />
              {/* Decision B */}
              <DecisionCard label="Resolución B" position="b" decision={selection.b} onRemove={() => handleRemove("b")} />
            </div>

            {/* Query context (optional) */}
            {bothSelected && (
              <div className="mb-4">
                <label className="block text-[10px] font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                  <M name="context" className="!text-xs mr-0.5" />
                  Contexto de la comparación (opcional)
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej: Comparar la doctrina sobre cláusulas suelo..."
                  className="w-full px-3 py-2.5 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCompare}
                disabled={!bothSelected || comparing}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {comparing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {progressPhase || "Comparando..."}
                  </>
                ) : (
                  <>
                    <M name="compare" className="!text-lg" />
                    Comparar resoluciones
                  </>
                )}
              </button>

              {!bothSelected && (
                <Link href="/" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <M name="search" className="!text-sm" />
                  Buscar resoluciones para comparar
                </Link>
              )}
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

        {/* Comparison Results */}
        {result && (
          <ComparisonResultView
            result={result}
            decisionA={selection.a!}
            decisionB={selection.b!}
            onBack={() => { setResult(null); setError(null); }}
          />
        )}
      </main>

      <ToastContainer />
    </div>
  );
}

/* ── Decision Card (selection slot) ── */
function DecisionCard({ label, position, decision, onRemove }: {
  label: string;
  position: "a" | "b";
  decision: CompareDecision | null;
  onRemove: () => void;
}) {
  const colorA = position === "a" ? "border-primary/40" : "border-secondary/40";
  const accentA = position === "a" ? "text-primary" : "text-secondary";
  const bgA = position === "a" ? "bg-primary/5" : "bg-secondary-container/30";

  if (!decision) {
    return (
      <div className={`bg-surface-container-lowest rounded-xl shadow-sm border-2 border-dashed border-outline-variant p-5 flex flex-col items-center justify-center min-h-[140px]`}>
        <M name="add_circle_outline" className="!text-3xl text-outline-variant mb-2" />
        <p className="text-sm font-semibold text-on-surface-variant mb-1">{label}</p>
        <p className="text-xs text-secondary text-center">Selecciona una resolución desde los resultados de búsqueda o el workspace</p>
      </div>
    );
  }

  return (
    <div className={`bg-surface-container-lowest rounded-xl shadow-sm border-2 ${colorA} p-4 relative`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${bgA} ${accentA}`}>
          {label}
        </span>
        <button onClick={onRemove} className="ml-auto text-on-surface-variant hover:text-error transition-colors" title="Quitar">
          <M name="close" className="!text-base" />
        </button>
      </div>
      <h3 className="text-sm font-semibold text-on-surface mb-2 line-clamp-2">{decision.titulo}</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary mb-1.5">
        {decision.organo && <span className="flex items-center gap-1"><M name="account_balance" className="!text-xs" />{decision.organo}</span>}
        {decision.fecha && <span className="flex items-center gap-1"><M name="calendar_today" className="!text-xs" />{decision.fecha}</span>}
        {decision.ponente && <span className="flex items-center gap-1"><M name="person" className="!text-xs" />{decision.ponente}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {decision.roj && <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {decision.roj}</span>}
        {decision.ecli && <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {decision.ecli}</span>}
      </div>
      {decision.resumen && <p className="text-[11px] text-on-surface-variant mt-2 line-clamp-2">{decision.resumen}</p>}
    </div>
  );
}

/* ── Comparison Result View ── */
function ComparisonResultView({ result, decisionA, decisionB, onBack }: {
  result: ComparisonResult;
  decisionA: CompareDecision;
  decisionB: CompareDecision;
  onBack: () => void;
}) {
  const mc = result.metadata_comparison;
  const [savedToWs, setSavedToWs] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [wsFolders, setWsFolders] = useState<string[]>([]);
  const [wsTags, setWsTags] = useState<string[]>([]);
  const [wsNotes, setWsNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [wsFoldersList, setWsFoldersList] = useState<string[]>([]);

  useEffect(() => {
    workspaceStore.listFolders().then(setWsFoldersList);
  }, []);

  const handleSaveToWorkspace = async () => {
    const compData = {
      decisionA: { roj: decisionA.roj, titulo: decisionA.titulo, organo: decisionA.organo, fecha: decisionA.fecha },
      decisionB: { roj: decisionB.roj, titulo: decisionB.titulo, organo: decisionB.organo, fecha: decisionB.fecha },
      sections: result.sections.map((s) => ({ key: s.key, label: s.label, comparison: s.comparison })),
      similarities: result.similarities,
      differences: result.differences,
      relevant_distinction: result.relevant_distinction,
      evidence_summary: result.evidence_summary,
      uncertainty: result.uncertainty,
    };
    const res = await workspaceStore.addComparison(
      compData.decisionA,
      compData.decisionB,
      compData,
      { folders: wsFolders, tags: wsTags, notes: wsNotes }
    );
    if (res.ok) {
      setSavedToWs(true);
      setShowSavePanel(false);
      showToast("Comparación guardada en workspace");
    } else if (res.reason === "duplicate") {
      showToast("Ya existe esta comparación en el workspace", "info");
      setSavedToWs(true);
      setShowSavePanel(false);
    } else {
      showToast("Límite de 500 elementos alcanzado", "error");
    }
  };

  const handleCopy = async () => {
    const text = formatComparisonAsText({
      decisionA: { roj: decisionA.roj, titulo: decisionA.titulo, organo: decisionA.organo, fecha: decisionA.fecha },
      decisionB: { roj: decisionB.roj, titulo: decisionB.titulo, organo: decisionB.organo, fecha: decisionB.fecha },
      sections: result.sections,
      similarities: result.similarities,
      differences: result.differences,
      relevant_distinction: result.relevant_distinction,
      evidence_summary: result.evidence_summary,
      uncertainty: result.uncertainty,
    });
    const ok = await copyToClipboard(text);
    showToast(ok ? "Copiado al portapapeles" : "Error al copiar", ok ? "success" : "error");
  };

  const handleExport = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON({
      type: "comparison",
      exportedAt: new Date().toISOString(),
      decisionA: { roj: decisionA.roj, titulo: decisionA.titulo, organo: decisionA.organo, fecha: decisionA.fecha },
      decisionB: { roj: decisionB.roj, titulo: decisionB.titulo, organo: decisionB.organo, fecha: decisionB.fecha },
      result,
    }, `jurelia-comparacion-${date}.json`);
    showToast("Exportado como JSON", "info");
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !wsTags.includes(t)) { setWsTags([...wsTags, t]); setTagInput(""); }
  };

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} className="mb-4 text-xs text-primary hover:underline flex items-center gap-1">
        <M name="arrow_back" className="!text-sm" />
        Nueva comparación
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
            <M name="auto_awesome" className="!text-sm" />
            Comparación generada por IA
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-on-surface mb-1">Análisis comparativo</h1>
            <p className="text-xs text-secondary">
              {decisionA.roj || decisionA.titulo} vs. {decisionB.roj || decisionB.titulo}
            </p>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="content_copy" className="!text-sm" />
              Copiar
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="download" className="!text-sm" />
              Exportar
            </button>
            <button
              onClick={() => setShowSavePanel(!showSavePanel)}
              disabled={savedToWs}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                savedToWs ? "bg-primary/10 text-primary cursor-default" : "bg-primary text-on-primary hover:bg-primary-container"
              }`}
            >
              <M name={savedToWs ? "check" : "bookmark_add"} className="!text-sm" />
              {savedToWs ? "Guardado" : "Guardar en workspace"}
            </button>
          </div>
        </div>

        {/* Save to workspace panel */}
        {showSavePanel && !savedToWs && (
          <div className="mt-3 p-4 bg-surface-container-low rounded-xl border border-outline-variant">
            <h4 className="text-xs font-semibold text-on-surface mb-2 flex items-center gap-1.5">
              <M name="bookmark_add" className="!text-sm text-primary" />
              Guardar comparación en workspace
            </h4>
            {wsFoldersList.length > 0 && (
              <div className="mb-2">
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1 block">Carpetas</label>
                <div className="flex flex-wrap gap-1">
                  {wsFoldersList.map((f) => (
                    <button
                      key={f}
                      onClick={() => setWsFolders(wsFolders.includes(f) ? wsFolders.filter((x) => x !== f) : [...wsFolders, f])}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        wsFolders.includes(f) ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >{f}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-2">
              <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1 block">Etiquetas</label>
              <div className="flex gap-1 mb-1 flex-wrap">
                {wsTags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-medium flex items-center gap-1">
                    {t}<button onClick={() => setWsTags(wsTags.filter((x) => x !== t))} className="hover:text-error">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Añadir etiqueta..." className="flex-1 px-2 py-1 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
                <button onClick={addTag} className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">+</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1 block">Notas</label>
              <textarea value={wsNotes} onChange={(e) => setWsNotes(e.target.value)} placeholder="Notas privadas..." rows={2} className="w-full px-2 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveToWorkspace} className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5">
                <M name="save" className="!text-sm" />
                Guardar
              </button>
              <button onClick={() => setShowSavePanel(false)} className="px-4 py-2 rounded-lg bg-surface-container text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Comparison Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-5">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="table_chart" className="!text-sm text-primary" />
          Metadatos comparados
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left py-2 pr-3 text-[10px] font-semibold text-secondary uppercase tracking-wider w-[120px]">Campo</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-primary uppercase tracking-wider">Resolución A</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-secondary uppercase tracking-wider">Resolución B</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: "tribunal", label: "Tribunal" },
                { key: "sala", label: "Sala" },
                { key: "jurisdiccion", label: "Jurisdicción" },
                { key: "fecha", label: "Fecha" },
                { key: "roj", label: "ROJ", mono: true },
                { key: "ecli", label: "ECLI", mono: true },
                { key: "n_resolucion", label: "Nº Resolución" },
                { key: "n_recurso", label: "Nº Recurso" },
                { key: "ponente", label: "Ponente" },
                { key: "tipo", label: "Tipo" },
              ].map(({ key, label, mono }) => {
                const vals = mc[key as keyof typeof mc];
                if (!vals) return null;
                const same = vals.a === vals.b && vals.a !== "—";
                return (
                  <tr key={key} className="border-b border-surface-container last:border-0">
                    <td className="py-2 pr-3 text-on-surface-variant font-medium">{label}</td>
                    <td className={`py-2 px-3 ${mono ? "font-mono" : ""} text-on-surface`}>
                      {vals.a}
                      {same && <M name="check" className="!text-xs text-[#16a34a] ml-1" />}
                    </td>
                    <td className={`py-2 px-3 ${mono ? "font-mono" : ""} text-on-surface`}>{vals.b}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-column decision summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <SummaryCard label="Resolución A" decision={decisionA} />
        <SummaryCard label="Resolución B" decision={decisionB} />
      </div>

      {/* Structured Comparison Sections */}
      <div className="space-y-4 mb-5">
        {result.sections.map((section) => (
          <ComparisonSectionCard key={section.key} section={section} />
        ))}
      </div>

      {/* Evidence / Provenance Panel */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-5">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="verified" className="!text-sm text-primary" />
          Evidencia y procedencia
        </h2>
        <div className="space-y-2.5">
          <EvidenceLine icon="description" label="Resolución A" text={result.evidence_summary.decision_a} />
          <EvidenceLine icon="description" label="Resolución B" text={result.evidence_summary.decision_b} />
          <EvidenceLine icon="analytics" label="Base del análisis" text={result.evidence_summary.analysis_basis} />
          <EvidenceLine icon="speed" label="Confianza" text={result.evidence_summary.confidence} />
        </div>
      </div>

      {/* Uncertainty */}
      {result.uncertainty && (
        <div className="mb-5 p-3 rounded-lg bg-surface-container-low border-l-2 border-yellow-500 flex items-start gap-2">
          <M name="info" className="!text-sm text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-on-surface-variant leading-relaxed">{result.uncertainty}</p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-outline leading-relaxed mb-4">
        Esta comparación es orientativa y generada automáticamente por IA. No constituye asesoramiento jurídico ni sustituye el análisis profesional de las resoluciones. Los identificadores mostrados proceden de CENDOJ. Las conclusiones marcadas como &quot;AI_GENERATED&quot; son generaciones del modelo y no datos verificados directamente del texto judicial.
      </p>
    </div>
  );
}

/* ── Summary Card ── */
function SummaryCard({ label, decision }: { label: string; decision: CompareDecision }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider px-2 py-0.5 rounded bg-secondary-container">{label}</span>
      </div>
      <h3 className="text-sm font-semibold text-on-surface mb-2 line-clamp-3">{decision.titulo}</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary mb-1.5">
        {decision.organo && <span className="flex items-center gap-1"><M name="account_balance" className="!text-xs" />{decision.organo}</span>}
        {decision.fecha && <span className="flex items-center gap-1"><M name="calendar_today" className="!text-xs" />{decision.fecha}</span>}
        {decision.ponente && <span className="flex items-center gap-1"><M name="person" className="!text-xs" />{decision.ponente}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {decision.roj && <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {decision.roj}</span>}
        {decision.ecli && <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {decision.ecli}</span>}
      </div>
      {decision.resumen && (
        <div className="bg-surface-container-low rounded-lg p-2.5 border-l-2 border-primary">
          <p className="text-[11px] text-on-surface-variant leading-relaxed">{decision.resumen}</p>
        </div>
      )}
      <a href={decision.url_pdf} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
        <M name="open_in_new" className="!text-xs" />
        Abrir PDF
      </a>
    </div>
  );
}

/* ── Comparison Section Card ── */
function ComparisonSectionCard({ section }: { section: ComparisonResult["sections"][number] }) {
  const eb = EVIDENCE_BADGE[section.evidence_level] || EVIDENCE_BADGE.METADATA_ONLY;
  const pb = PROVENANCE_BADGE[section.provenance] || PROVENANCE_BADGE.AI_GENERATED;

  return (
    <details open className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden group">
      <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-on-surface flex items-center gap-2 hover:bg-surface-container-low transition-colors select-none">
        <M name={section.icon} className="!text-base text-primary" />
        {section.label}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${eb.bg} ${eb.text}`}>{eb.label}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${pb.bg} ${pb.text}`}>{pb.label}</span>
          <M name="expand_more" className="!text-sm text-secondary group-open:rotate-180 transition-transform" />
        </div>
      </summary>
      <div className="px-5 pb-4 pt-1">
        {/* Side by side content (if both have content) */}
        {(section.content_a || section.content_b) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            {section.content_a && (
              <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary">
                <p className="text-[9px] font-bold text-primary uppercase tracking-wider mb-1">Resolución A</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{section.content_a}</p>
              </div>
            )}
            {section.content_b && (
              <div className="bg-secondary-container/30 rounded-lg p-3 border-l-2 border-secondary">
                <p className="text-[9px] font-bold text-secondary uppercase tracking-wider mb-1">Resolución B</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{section.content_b}</p>
              </div>
            )}
          </div>
        )}
        {/* Comparison analysis */}
        {section.comparison && (
          <div className="bg-surface-container-low rounded-lg p-3">
            <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1">
              <M name="compare" className="!text-xs text-primary" />
              Análisis comparativo
            </p>
            <p className="text-xs text-on-surface leading-relaxed">{section.comparison}</p>
          </div>
        )}
      </div>
    </details>
  );
}

/* ── Evidence Line ── */
function EvidenceLine({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <M name={icon} className="!text-sm text-secondary shrink-0 mt-0.5" />
      <div>
        <span className="text-[10px] font-semibold text-on-surface-variant">{label}:</span>
        <p className="text-xs text-on-surface leading-relaxed">{text}</p>
      </div>
    </div>
  );
}