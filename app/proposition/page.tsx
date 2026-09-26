"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import * as workspaceStore from "@/lib/workspace/store";
import { formatPropositionAsText, copyToClipboard, downloadJSON } from "@/lib/export-utils";
import ToastContainer, { showToast } from "@/components/Toast";

/* ── Types ── */

type RelationshipType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "DISTINGUISHES"
  | "NEUTRAL"
  | "INSUFFICIENT_EVIDENCE";

interface AnalyzedDecision {
  roj: string;
  ecli?: string;
  organo?: string;
  fecha?: string;
  titulo: string;
  ponente?: string;
  url_pdf: string;
  resumen?: string;
  n_recurso?: string;
  n_resolucion?: string;
  sede?: string;
  relationship: RelationshipType;
  evidence_basis: string;
  reasoning: string;
  evidence_level: string;
  provenance: string;
}

interface PropositionResult {
  proposition: string;
  search_query_used: string;
  total_decisions_found: number;
  total_analyzed: number;
  supporting: AnalyzedDecision[];
  contradicting: AnalyzedDecision[];
  distinguishing: AnalyzedDecision[];
  neutral: AnalyzedDecision[];
  insufficient_evidence: AnalyzedDecision[];
  provenance: string;
  uncertainty: string | null;
  disclaimer: string;
}

/* ── Constants ── */

const RELATIONSHIP_CONFIG: Record<RelationshipType, { bg: string; text: string; border: string; label: string; icon: string }> = {
  SUPPORTS:              { bg: "bg-[#dcfce7]", text: "text-[#15803d]", border: "border-[#16a34a]", label: "APOYA ESTA INTERPRETACIÓN", icon: "thumb_up" },
  CONTRADICTS:           { bg: "bg-[#fecaca]", text: "text-[#991b1b]", border: "border-[#dc2626]", label: "JURISPRUDENCIA CONTRARIA O LIMITATIVA", icon: "thumb_down" },
  DISTINGUISHES:         { bg: "bg-[#fef9c3]", text: "text-[#854d0e]", border: "border-[#ca8a04]", label: "DISTINGUE O LIMITA", icon: "tune" },
  NEUTRAL:               { bg: "bg-surface-container", text: "text-secondary", border: "border-outline-variant", label: "NEUTRAL", icon: "remove" },
  INSUFFICIENT_EVIDENCE: { bg: "bg-secondary-container", text: "text-on-secondary-container", border: "border-primary", label: "EVIDENCIA INSUFICIENTE", icon: "help_outline" },
};

const EVIDENCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FULL_TEXT: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", label: "Texto completo" },
  OFFICIAL_SUMMARY: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", label: "Resumen oficial" },
  METADATA_ONLY: { bg: "bg-surface-container", text: "text-on-surface-variant", label: "Solo metadatos" },
};

const COURT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos los tribunales" },
  { value: "tribunal_supremo", label: "Tribunal Supremo" },
  { value: "tribunal_supremo.civil", label: "  · Sala de lo Civil" },
  { value: "tribunal_supremo.penal", label: "  · Sala de lo Penal" },
  { value: "tribunal_supremo.contencioso", label: "  · Sala de lo Contencioso-Administrativo" },
  { value: "tribunal_supremo.social", label: "  · Sala de lo Social" },
  { value: "audiencia_nacional", label: "Audiencia Nacional" },
  { value: "tribunal_superior", label: "Tribunal Superior de Justicia" },
  { value: "audiencia_provincial", label: "Audiencia Provincial" },
  { value: "juzgados", label: "Juzgados" },
];

const EXAMPLE_PROPOSITIONS = [
  "La pensión compensatoria debe extinguirse cuando desaparece el desequilibrio económico.",
  "La cláusula suelo es nula por falta de transparencia en la información precontractual.",
  "La responsabilidad patrimonial de la Administración requiere antijuridicidad y lesión efectiva.",
  "El despido disciplinario por absentismo laboral injustificado procede cuando supera el umbral establecido.",
];

/* ── Helper ── */

function M({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

/* ── Main Page ── */

export default function PropositionPage() {
  const [proposition, setProposition] = useState("");
  const [courtFilter, setCourtFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PropositionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressPhase, setProgressPhase] = useState("");

  const handleAnalyze = async () => {
    if (!proposition.trim() || analyzing) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);
    setProgressPhase("Extrayendo términos jurídicos...");

    try {
      setProgressPhase("Buscando en CENDOJ y analizando resoluciones...");
      const res = await fetch("/api/cendoj/proposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposition: proposition.trim(),
          court_filter: courtFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        signal: AbortSignal.timeout(180_000),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setResult(data);
      showToast("Análisis completado");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("Timeout") ? "Timeout: el análisis tardó más de 3 minutos." : `Error: ${msg}`);
    } finally {
      setAnalyzing(false);
      setProgressPhase("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && proposition.trim().length >= 10) {
      e.preventDefault();
      handleAnalyze();
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
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Proposición jurídica</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/compare" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs">
              <M name="compare" className="!text-base" />
              <span className="hidden sm:inline">Comparar</span>
            </Link>
            <Link href="/workspace" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs">
              <M name="workspaces" className="!text-base" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">
              <M name="search" className="!text-sm" />
              <span className="hidden sm:inline">Buscar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-4 lg:px-8 py-5 lg:py-6">
        {!result && (
          <div className="mb-6">
            {/* Title */}
            <div className="mb-5">
              <h1 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
                <M name="policy" className="!text-xl text-primary" />
                Análisis de proposición jurídica
              </h1>
              <p className="text-xs text-secondary">
                Introduce un criterio jurídico y el sistema buscará jurisprudencia que lo apoye o contradiga, con análisis objetivo por IA.
              </p>
            </div>

            {/* Input */}
            <div className="mb-4">
              <label className="block text-[10px] font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                <M name="edit_note" className="!text-xs mr-0.5" />
                ¿Qué criterio quieres defender o comprobar?
              </label>
              <textarea
                value={proposition}
                onChange={(e) => setProposition(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: La pensión compensatoria debe extinguirse cuando desaparece el desequilibrio económico."
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2.5 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-outline">{proposition.length}/1000 caracteres</span>
                {proposition.trim().length > 0 && proposition.trim().length < 10 && (
                  <span className="text-[10px] text-error">Mínimo 10 caracteres</span>
                )}
              </div>
            </div>

            {/* Example propositions */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                <M name="lightbulb" className="!text-xs mr-0.5" />
                Ejemplos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROPOSITIONS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setProposition(ex)}
                    className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-[11px] text-on-surface-variant hover:text-on-surface transition-colors text-left"
                  >
                    {ex.length > 70 ? ex.slice(0, 70) + "…" : ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters toggle */}
            <div className="mb-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <M name={showFilters ? "expand_less" : "expand_more"} className="!text-sm" />
                {showFilters ? "Ocultar filtros" : "Filtros opcionales (tribunal, fechas)"}
              </button>

              {showFilters && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div>
                    <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Tribunal</label>
                    <select
                      value={courtFilter}
                      onChange={(e) => setCourtFilter(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {COURT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Fecha desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Fecha hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleAnalyze}
                disabled={!proposition.trim() || proposition.trim().length < 10 || analyzing}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {progressPhase || "Analizando..."}
                  </>
                ) : (
                  <>
                    <M name="policy" className="!text-lg" />
                    Analizar proposición
                  </>
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-error-container rounded-xl text-sm flex items-start gap-2">
                <M name="error" className="!text-base text-error shrink-0 mt-0.5" />
                <span className="text-on-surface">{error}</span>
              </div>
            )}

            {/* Info box */}
            <div className="mt-5 p-3 rounded-lg bg-surface-container-low border-l-2 border-primary">
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                <M name="info" className="!text-xs mr-0.5" />
                <strong>Cómo funciona:</strong> El sistema extrae términos jurídicos de tu proposición, busca resoluciones relevantes en CENDOJ, y analiza cada una para determinar si apoya, contradice, distingue o es neutral respecto a tu criterio. El análisis es objetivo y busca activamente evidencia contraria.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <PropositionResultView result={result} onBack={() => { setResult(null); setError(null); }} />
        )}
      </main>

      <ToastContainer />
    </div>
  );
}

/* ── Results View ── */

function PropositionResultView({ result, onBack }: { result: PropositionResult; onBack: () => void }) {
  const [viewMode, setViewMode] = useState<"list" | "matrix">("matrix");
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

  const supporting = result.supporting;
  const contradicting = result.contradicting;
  const distinguishing = result.distinguishing;
  const neutral = result.neutral;
  const insufficient = result.insufficient_evidence;

  const totalClassified = supporting.length + contradicting.length + distinguishing.length + neutral.length + insufficient.length;

  const handleSaveToWorkspace = async () => {
    const propData = {
      proposition: result.proposition,
      search_query_used: result.search_query_used,
      total_decisions_found: result.total_decisions_found,
      total_analyzed: totalClassified,
      counts: {
        supporting: supporting.length,
        contradicting: contradicting.length,
        distinguishing: distinguishing.length,
        neutral: neutral.length,
        insufficient_evidence: insufficient.length,
      },
      decisions: [...supporting, ...contradicting, ...distinguishing, ...neutral, ...insufficient].map((d) => ({
        roj: d.roj,
        titulo: d.titulo,
        organo: d.organo,
        fecha: d.fecha,
        relationship: d.relationship,
        evidence_basis: d.evidence_basis,
        reasoning: d.reasoning,
      })),
      uncertainty: result.uncertainty,
    };
    const res = await workspaceStore.addProposition(
      result.proposition,
      propData,
      { folders: wsFolders, tags: wsTags, notes: wsNotes }
    );
    if (res.ok) {
      setSavedToWs(true);
      setShowSavePanel(false);
      showToast("Proposición guardada en workspace");
    } else if (res.reason === "duplicate") {
      showToast("Ya existe esta proposición en el workspace", "info");
      setSavedToWs(true);
      setShowSavePanel(false);
    } else {
      showToast("Límite de 500 elementos alcanzado", "error");
    }
  };

  const handleCopy = async () => {
    const text = formatPropositionAsText({
      proposition: result.proposition,
      search_query_used: result.search_query_used,
      total_decisions_found: result.total_decisions_found,
      total_analyzed: totalClassified,
      supporting,
      contradicting,
      distinguishing,
      neutral,
      insufficient_evidence: insufficient,
      uncertainty: result.uncertainty,
    });
    const ok = await copyToClipboard(text);
    showToast(ok ? "Copiado al portapapeles" : "Error al copiar", ok ? "success" : "error");
  };

  const handleExport = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON({
      type: "proposition",
      exportedAt: new Date().toISOString(),
      proposition: result.proposition,
      result,
    }, `jurelia-proposicion-${date}.json`);
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
        Nueva proposición
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
            <M name="auto_awesome" className="!text-sm" />
            Análisis generado por IA
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-on-surface mb-2">Resultado del análisis</h1>
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4 mb-4">
              <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Proposición analizada</p>
              <p className="text-sm text-on-surface leading-relaxed italic">&ldquo;{result.proposition}&rdquo;</p>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors" title="Copiar como texto">
              <M name="content_copy" className="!text-sm" />
              Copiar
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors" title="Exportar como JSON">
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
          <div className="mb-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant">
            <h4 className="text-xs font-semibold text-on-surface mb-2 flex items-center gap-1.5">
              <M name="bookmark_add" className="!text-sm text-primary" />
              Guardar proposición en workspace
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

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <StatCard icon="thumb_up" count={supporting.length} label="Apoyan" color="text-[#16a34a]" bg="bg-[#dcfce7]" />
          <StatCard icon="thumb_down" count={contradicting.length} label="Contradicen" color="text-[#dc2626]" bg="bg-[#fecaca]" />
          <StatCard icon="tune" count={distinguishing.length} label="Distinguen" color="text-[#ca8a04]" bg="bg-[#fef9c3]" />
          <StatCard icon="remove" count={neutral.length} label="Neutrales" color="text-secondary" bg="bg-surface-container" />
          <StatCard icon="help_outline" count={insufficient.length} label="Insuficiente" color="text-on-secondary-container" bg="bg-secondary-container" />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("matrix")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "matrix" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <M name="dashboard" className="!text-sm" />
            Matriz de argumentos
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "list" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <M name="view_list" className="!text-sm" />
            Lista
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "matrix" ? (
        <ArgumentMatrix result={result} />
      ) : (
        <PropositionListView result={result} />
      )}

      {/* Evidence Summary */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-5 mt-5">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="verified" className="!text-sm text-primary" />
          Resumen del análisis
        </h2>
        <div className="space-y-2 text-xs text-on-surface-variant">
          <p><strong>Búsqueda:</strong> {result.search_query_used}</p>
          <p><strong>Resoluciones encontradas:</strong> {result.total_decisions_found}</p>
          <p><strong>Resoluciones analizadas:</strong> {totalClassified}</p>
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
        {result.disclaimer}
      </p>
    </div>
  );
}

/* ── Argument Matrix View (F04-08) ── */

function ArgumentMatrix({ result }: { result: PropositionResult }) {
  const groups: { key: RelationshipType; label: string; decisions: AnalyzedDecision[]; color: string; icon: string; collapsed: boolean }[] = [
    { key: "SUPPORTS", label: "Apoyan", decisions: result.supporting, color: "#16a34a", icon: "thumb_up", collapsed: false },
    { key: "CONTRADICTS", label: "Contradicen", decisions: result.contradicting, color: "#dc2626", icon: "thumb_down", collapsed: false },
    { key: "DISTINGUISHES", label: "Distinguen", decisions: result.distinguishing, color: "#ca8a04", icon: "tune", collapsed: true },
    { key: "NEUTRAL", label: "Neutrales", decisions: result.neutral, color: "#6b7280", icon: "remove", collapsed: true },
    { key: "INSUFFICIENT_EVIDENCE", label: "Evidencia insuficiente", decisions: result.insufficient_evidence, color: "#9333ea", icon: "help_outline", collapsed: true },
  ];

  const nonEmpty = groups.filter((g) => g.decisions.length > 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
        <h2 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <M name="dashboard" className="!text-sm text-primary" />
          Matriz de argumentos — {result.total_analyzed} resoluciones analizadas
        </h2>
        <div className="flex gap-1 h-5 rounded-full overflow-hidden">
          {groups.map((g) =>
            g.decisions.length > 0 ? (
              <div
                key={g.key}
                style={{ flex: g.decisions.length, backgroundColor: g.color }}
                className="transition-all relative group/bar"
                title={`${g.label}: ${g.decisions.length}`}
              />
            ) : null
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5">
          {groups.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: g.color }} />
              {g.label}: <strong className="text-on-surface">{g.decisions.length}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Grouped sections */}
      {nonEmpty.map((g) => {
        const cfg = RELATIONSHIP_CONFIG[g.key];
        return (
          <div key={g.key}>
            <details open={!g.collapsed} className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden group">
              <summary className="cursor-pointer px-5 py-3.5 text-sm font-bold flex items-center gap-2 hover:bg-surface-container-low transition-colors select-none">
                <M name={cfg.icon} className={`!text-base`} style={{ color: g.color }} />
                <span style={{ color: g.color }}>{g.label}</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${g.color}18`, color: g.color }}>
                  {g.decisions.length}
                </span>
                <M name="expand_more" className="!text-sm text-secondary ml-auto group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-5 pb-4 space-y-3">
                {g.decisions.map((d, i) => (
                  <ArgumentMatrixCard key={d.roj || i} decision={d} />
                ))}
              </div>
            </details>
          </div>
        );
      })}

      {nonEmpty.length === 0 && (
        <div className="p-6 text-center text-sm text-secondary bg-surface-container-lowest rounded-xl border border-outline-variant">
          No se encontraron resoluciones para analizar.
        </div>
      )}
    </div>
  );
}

/* ── Argument Matrix Card ── */

function ArgumentMatrixCard({ decision }: { decision: AnalyzedDecision }) {
  const cfg = RELATIONSHIP_CONFIG[decision.relationship] || RELATIONSHIP_CONFIG.INSUFFICIENT_EVIDENCE;
  const eb = EVIDENCE_BADGE[decision.evidence_level] || EVIDENCE_BADGE.METADATA_ONLY;

  return (
    <div className={`bg-surface-container-lowest rounded-xl shadow-sm border-l-4 ${cfg.border} border border-outline-variant p-4`}>
      {/* Header: badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} text-[9px] font-bold uppercase tracking-wider`}>
          <M name={cfg.icon} className="!text-xs" />
          {cfg.label}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${eb.bg} ${eb.text} text-[9px] font-bold uppercase tracking-wider`}>
          {eb.label}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[9px] font-bold uppercase tracking-wider">
          Generado por IA
        </span>
      </div>

      {/* Title + meta */}
      <h3 className="text-sm font-semibold text-on-surface mb-2 line-clamp-2">{decision.titulo}</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary mb-1.5">
        {decision.organo && <span className="flex items-center gap-1"><M name="account_balance" className="!text-xs" />{decision.organo}</span>}
        {decision.fecha && <span className="flex items-center gap-1"><M name="calendar_today" className="!text-xs" />{decision.fecha}</span>}
        {decision.ponente && <span className="flex items-center gap-1"><M name="person" className="!text-xs" />{decision.ponente}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {decision.roj && <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {decision.roj}</span>}
        {decision.ecli && <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {decision.ecli}</span>}
      </div>

      {/* Evidence basis */}
      <div className="bg-surface-container-low rounded-lg p-2.5 border-l-2 border-primary mb-2">
        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1">
          <M name="format_quote" className="!text-xs text-primary" />
          Base de la clasificación
        </p>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">{decision.evidence_basis}</p>
      </div>

      {/* Reasoning */}
      <div className="bg-surface-container-low rounded-lg p-2.5">
        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1">
          <M name="psychology" className="!text-xs text-primary" />
          Razonamiento
        </p>
        <p className="text-[11px] text-on-surface leading-relaxed">{decision.reasoning}</p>
      </div>

      {/* Link */}
      {decision.url_pdf && (
        <a href={decision.url_pdf} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
          <M name="open_in_new" className="!text-xs" />
          Abrir PDF
        </a>
      )}
    </div>
  );
}

/* ── List View (original two-column layout) ── */

function PropositionListView({ result }: { result: PropositionResult }) {
  const supporting = result.supporting;
  const contradicting = result.contradicting;
  const distinguishing = result.distinguishing;
  const neutral = result.neutral;
  const insufficient = result.insufficient_evidence;

  return (
    <div>
      {/* Two-column: Supporting vs Contradicting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5 mt-5">
        {/* Supporting column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <M name="thumb_up" className="!text-base text-[#16a34a]" />
            <h2 className="text-sm font-bold text-[#15803d] uppercase tracking-wider">
              Jurisprudencia favorable ({supporting.length})
            </h2>
          </div>
          <p className="text-[10px] text-secondary mb-3">
            Resoluciones que apoyan la interpretación propuesta. Etiqueta: &ldquo;APOYA ESTA INTERPRETACIÓN&rdquo;
          </p>
          {supporting.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant text-xs text-secondary text-center">
              No se encontraron resoluciones que apoyen esta proposición.
            </div>
          ) : (
            <div className="space-y-3">
              {supporting.map((d, i) => (
                <DecisionCard key={d.roj || i} decision={d} />
              ))}
            </div>
          )}
        </div>

        {/* Contradicting column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <M name="thumb_down" className="!text-base text-[#dc2626]" />
            <h2 className="text-sm font-bold text-[#991b1b] uppercase tracking-wider">
              Jurisprudencia contraria o limitativa ({contradicting.length + distinguishing.length})
            </h2>
          </div>
          <p className="text-[10px] text-secondary mb-3">
            Resoluciones que contradicen, limitan o distinguen la interpretación propuesta.
          </p>
          {contradicting.length === 0 && distinguishing.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant text-xs text-secondary text-center">
              No se encontraron resoluciones contrarias ni limitativas.
            </div>
          ) : (
            <div className="space-y-3">
              {contradicting.map((d, i) => (
                <DecisionCard key={d.roj || i} decision={d} />
              ))}
              {distinguishing.map((d, i) => (
                <DecisionCard key={d.roj || `d-${i}`} decision={d} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Neutral & Insufficient (collapsed) */}
      {(neutral.length > 0 || insufficient.length > 0) && (
        <div className="mb-5">
          <details className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-on-surface flex items-center gap-2 hover:bg-surface-container-low transition-colors select-none">
              <M name="more_horiz" className="!text-base text-secondary" />
              Neutrales ({neutral.length}) · Evidencia insuficiente ({insufficient.length})
              <M name="expand_more" className="!text-sm text-secondary ml-auto" />
            </summary>
            <div className="px-5 pb-4 space-y-3">
              {neutral.map((d, i) => (
                <DecisionCard key={d.roj || `n-${i}`} decision={d} />
              ))}
              {insufficient.map((d, i) => (
                <DecisionCard key={d.roj || `ins-${i}`} decision={d} />
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ── */

function StatCard({ icon, count, label, color, bg }: { icon: string; count: number; label: string; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <M name={icon} className={`!text-base ${color} mb-0.5`} />
      <p className={`text-lg font-bold ${color}`}>{count}</p>
      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ── Decision Card (List view) ── */

function DecisionCard({ decision }: { decision: AnalyzedDecision }) {
  const config = RELATIONSHIP_CONFIG[decision.relationship] || RELATIONSHIP_CONFIG.INSUFFICIENT_EVIDENCE;
  const eb = EVIDENCE_BADGE[decision.evidence_level] || EVIDENCE_BADGE.METADATA_ONLY;

  return (
    <div className={`bg-surface-container-lowest rounded-xl shadow-sm border-l-4 ${config.border} border border-outline-variant p-4`}>
      {/* Header: relationship badge + evidence */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.text} text-[9px] font-bold uppercase tracking-wider`}>
          <M name={config.icon} className="!text-xs" />
          {config.label}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${eb.bg} ${eb.text} text-[9px] font-bold uppercase tracking-wider`}>
          {eb.label}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[9px] font-bold uppercase tracking-wider">
          Generado por IA
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-on-surface mb-2 line-clamp-2">{decision.titulo}</h3>

      {/* Metadata */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary mb-1.5">
        {decision.organo && (
          <span className="flex items-center gap-1">
            <M name="account_balance" className="!text-xs" />{decision.organo}
          </span>
        )}
        {decision.fecha && (
          <span className="flex items-center gap-1">
            <M name="calendar_today" className="!text-xs" />{decision.fecha}
          </span>
        )}
        {decision.ponente && (
          <span className="flex items-center gap-1">
            <M name="person" className="!text-xs" />{decision.ponente}
          </span>
        )}
      </div>

      {/* Identifiers */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {decision.roj && (
          <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">
            ROJ: {decision.roj}
          </span>
        )}
        {decision.ecli && (
          <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">
            ECLI: {decision.ecli}
          </span>
        )}
      </div>

      {/* Evidence basis */}
      <div className="bg-surface-container-low rounded-lg p-2.5 border-l-2 border-primary mb-2">
        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1">
          <M name="format_quote" className="!text-xs text-primary" />
          Base de la clasificación
        </p>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">{decision.evidence_basis}</p>
      </div>

      {/* Reasoning */}
      <div className="bg-surface-container-low rounded-lg p-2.5">
        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1">
          <M name="psychology" className="!text-xs text-primary" />
          Razonamiento
        </p>
        <p className="text-[11px] text-on-surface leading-relaxed">{decision.reasoning}</p>
      </div>

      {/* Link */}
      {decision.url_pdf && (
        <a href={decision.url_pdf} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
          <M name="open_in_new" className="!text-xs" />
          Abrir PDF
        </a>
      )}
    </div>
  );
}