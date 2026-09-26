"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SaveButton from "@/components/SaveButton";
import ToastContainer, { showToast } from "@/components/Toast";
import { openHelpDrawer } from "@/components/HelpDrawer";
import * as compareStore from "@/lib/compare/store";
import FeedbackButton from "@/components/FeedbackButton";

/* ─── Types ─────────────────────────────────────────────── */

interface CendojResult {
  id: string;
  titulo: string;
  fecha?: string;
  organo?: string;
  sede?: string;
  ponente?: string;
  n_recurso?: string;
  n_resolucion?: string;
  roj?: string;
  ecli?: string;
  url_pdf: string;
  resumen?: string;
}

interface SearchData {
  total: number;
  results: CendojResult[];
  _elapsed_ms?: number;
  _endpoint?: string;
}

interface DecisionData {
  url: string;
  text: string;
  _elapsed_ms?: number;
}

interface AISummary {
  facts_summary: string;
  legal_question: string;
  court_reasoning: string;
  holding: string;
  result: string;
  relevant_excerpt: string;
  excerpt_location: string;
  source_identifiers: { roj?: string; ecli?: string; organo?: string; fecha?: string };
  provenance: "AI_GENERATED";
  uncertainty: string | null;
}

interface DiagInfo {
  endpoint?: string;
  httpStatus?: number;
  elapsed_ms?: number;
  totalResults?: number;
  error?: string;
  rawJson?: unknown;
}

interface LegalField<T> { value: T; source: "explicit" | "inferred"; }
interface LegalMetadata {
  court: LegalField<string> | null;
  chamber: LegalField<string> | null;
  jurisdiction: LegalField<string> | null;
  decision_date: LegalField<string> | null;
  resolution_number: LegalField<string> | null;
  appeal_number: LegalField<string> | null;
  roj: LegalField<string> | null;
  ecli: LegalField<string> | null;
  judge: LegalField<string> | null;
  legal_topics: LegalField<string[]>;
  laws: LegalField<string[]>;
  quoted_phrases: LegalField<string[]>;
  entities: LegalField<string[]>;
  summary: LegalField<string> | null;
}

interface SearchAttempt {
  attempt: number;
  type: string;
  params: Record<string, string>;
  result_count: number;
  duration_ms: number;
}

interface EvidenceItem {
  field: string;
  status: "match" | "mismatch" | "missing";
  article_value?: string;
  candidate_value?: string;
  confidence: number;
}

interface NewsCandidate {
  id: string;
  titulo: string;
  fecha?: string;
  organo?: string;
  sede?: string;
  ponente?: string;
  n_recurso?: string;
  n_resolucion?: string;
  roj?: string;
  ecli?: string;
  url_pdf: string;
  resumen?: string;
  match_score: number;
  match_reasons: string[];
  match_status: string;
  rejected_reason?: string;
}

interface NewsMatchResult {
  status: "VERIFIED" | "PROBABLE" | "AMBIGUOUS" | "NOT_FOUND";
  confidence: number;
  candidate: NewsCandidate | null;
  candidates: NewsCandidate[];
  evidence: string[];
  evidence_items: EvidenceItem[];
  search_attempts: SearchAttempt[];
  explanation: string;
  source_level: "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";
}

interface NewsAnalysisResult {
  request_id: string;
  article: {
    url: string;
    title: string | null;
    publication: string | null;
    author: string | null;
    publication_date: string | null;
    article_text: string;
    extraction_method: string;
  };
  legal_metadata: LegalMetadata;
  match: NewsMatchResult;
  diagnostics: {
    url: string;
    http_status: number;
    extractor: string;
    extraction_ms: number;
    search_ms: number;
    verification_ms: number;
    total_ms: number;
    errors: string[];
  };
}

/* ─── Filter constants ─────────────────────────────────── */

const COURT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "tribunal_supremo", label: "Tribunal Supremo" },
  { value: "tribunal_supremo.civil", label: "  · Sala de lo Civil" },
  { value: "tribunal_supremo.penal", label: "  · Sala de lo Penal" },
  { value: "tribunal_supremo.contencioso", label: "  · Sala de lo Contencioso-Administrativo" },
  { value: "tribunal_supremo.social", label: "  · Sala de lo Social" },
  { value: "tribunal_supremo.militar", label: "  · Sala de lo Militar" },
  { value: "audiencia_nacional", label: "Audiencia Nacional" },
  { value: "tribunal_superior", label: "Tribunal Superior de Justicia" },
  { value: "audiencia_provincial", label: "Audiencia Provincial" },
  { value: "juzgados", label: "Juzgados" },
];

const COURT_VALUE_TO_PARAMS: Record<string, { tipo_organopub: string[]; sala?: string }> = {
  "": { tipo_organopub: [] },
  "tribunal_supremo": { tipo_organopub: ["Tribunal Supremo"] },
  "tribunal_supremo.civil": { tipo_organopub: ["Tribunal Supremo. Sala de lo Civil"] },
  "tribunal_supremo.penal": { tipo_organopub: ["Tribunal Supremo. Sala de lo Penal"] },
  "tribunal_supremo.contencioso": { tipo_organopub: ["Tribunal Supremo. Sala de lo Contencioso-Administrativo"] },
  "tribunal_supremo.social": { tipo_organopub: ["Tribunal Supremo. Sala de lo Social"] },
  "tribunal_supremo.militar": { tipo_organopub: ["Tribunal Supremo. Sala de lo Militar"] },
  "audiencia_nacional": { tipo_organopub: ["Audiencia Nacional"] },
  "tribunal_superior": { tipo_organopub: ["Tribunal Superior de Justicia"] },
  "audiencia_provincial": { tipo_organopub: ["Audiencia Provincial"] },
  "juzgados": { tipo_organopub: ["Juzgados"] },
};

const COURT_LABEL_MAP: Record<string, string> = Object.fromEntries(
  COURT_OPTIONS.filter(o => o.value).map(o => [o.value, o.label.trim()])
);

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "SENTENCIA", label: "Sentencia" },
  { value: "SENTENCIA CASACION", label: "Sentencia de casación" },
  { value: "SENTENCIA OTRAS", label: "Otras sentencias" },
  { value: "AUTO", label: "Auto" },
  { value: "AUTO ACLARATORIO", label: "Auto aclaratorio" },
  { value: "AUTO RECURSO", label: "Auto de recurso" },
  { value: "AUTO ADMISION", label: "Auto de admisión" },
  { value: "AUTO INADMISION", label: "Auto de inadmisión" },
  { value: "AUTO OTROS", label: "Otros autos" },
  { value: "ACUERDO", label: "Acuerdo" },
];

const TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
);

const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "2", label: "Segunda" },
  { value: "3", label: "Tercera" },
  { value: "4", label: "Cuarta" },
  { value: "1", label: "Quinta" },
];

const SECTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SECTION_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
);

const CCAA_OPTIONS = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunidad Valenciana",
  "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra", "País Vasco",
];

/* ─── Main Page ─────────────────────────────────────────── */

type TabMode = "manual" | "noticia";

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  VERIFIED:  { bg: "bg-[#dcfce7]", text: "text-[#15803d]", border: "border-[#16a34a]", label: "SENTENCIA LOCALIZADA · VERIFIED MATCH", icon: "task_alt" },
  PROBABLE:  { bg: "bg-[#fef9c3]", text: "text-[#a16207]", border: "border-[#ca8a04]", label: "MATCH PROBABLE", icon: "warning" },
  AMBIGUOUS: { bg: "bg-secondary-container", text: "text-on-secondary-container", border: "border-primary", label: "RESULTADOS AMBIGUOS", icon: "help_outline" },
  NOT_FOUND: { bg: "bg-surface-container-low", text: "text-secondary", border: "border-outline-variant", label: "RESOLUCIÓN NO LOCALIZADA", icon: "search_off" },
};

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-surface-container-highest border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [tab, setTab] = useState<TabMode>("manual");

  // Manual search state
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [jurisdiccion, setJurisdiccion] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [roj, setRoj] = useState("");
  const [ecli, setEcli] = useState("");
  const [ponente, setPonente] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [selectedResult, setSelectedResult] = useState<CendojResult | null>(null);
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [loadingDecision, setLoadingDecision] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [diag, setDiag] = useState<DiagInfo>({});
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [court, setCourt] = useState("");
  const [decisionType, setDecisionType] = useState("");
  const [tsjComunidad, setTsjComunidad] = useState("");
  const [apProvincia, setApProvincia] = useState("");
  const [seccion, setSeccion] = useState("");

  // Sort state (client-side only)
  const [sort, setSort] = useState<"relevance" | "date_desc" | "date_asc">("relevance");

  // Initialize state from URL params on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const q = searchParams.get("q");
    const c = searchParams.get("court");
    const t = searchParams.get("type");
    const s = searchParams.get("tsj_ccaa");
    const p = searchParams.get("ap_prov");
    const j = searchParams.get("jurisdiccion");
    const fd = searchParams.get("fecha_desde");
    const fh = searchParams.get("fecha_hasta");
    const r = searchParams.get("roj");
    const e = searchParams.get("ecli");
    const po = searchParams.get("ponente");
    const sc = searchParams.get("seccion");
    if (q) setQuery(q);
    if (c && COURT_OPTIONS.some(o => o.value === c)) setCourt(c);
    if (t && TYPE_OPTIONS.some(o => o.value === t)) setDecisionType(t);
    if (s) setTsjComunidad(s);
    if (p) setApProvincia(p);
    if (j) setJurisdiccion(j);
    if (fd) setFechaDesde(fd);
    if (fh) setFechaHasta(fh);
    if (r) setRoj(r);
    if (e) setEcli(e);
    if (po) setPonente(po);
    if (sc) setSeccion(sc);
    const so = searchParams.get("sort");
    if (so === "date_desc" || so === "date_asc") setSort(so);
    // Auto-search if q or identifiers present from URL
    if (q || r || e) {
      setTimeout(() => {
        // Trigger search with URL params
        const params = new URLSearchParams();
        if (q) params.set("query", q);
        if (r) params.set("roj", r);
        if (e) params.set("ecli", e);
        if (po) params.set("ponente", po);
        if (j) params.set("jurisdiccion", j);
        if (fd) params.set("fecha_desde", fd);
        if (fh) params.set("fecha_hasta", fh);
        if (c) {
          const mapped = COURT_VALUE_TO_PARAMS[c];
          if (mapped) mapped.tipo_organopub.forEach(v => params.append("tipo_organopub", v));
          if (c === "tribunal_superior" && s) params.set("localizacion", s);
          if (c === "audiencia_provincial" && p) params.set("localizacion", p);
          if (c === "tribunal_supremo.civil" && sc) params.set("seccion", sc);
        }
        if (t) params.set("subtipo_resolucion", t);
        // Fire and forget – the normal handleSearch would double-set state
        setSearchData(null);
        setSearching(true);
        setError(null);
        fetch(`/api/cendoj/search?${params.toString()}`, { signal: AbortSignal.timeout(130_000) })
          .then(r => r.json())
          .then(data => {
            if (data.error) setError(data.error);
            else setSearchData(data);
            setDiag({ endpoint: data._endpoint, httpStatus: 200, elapsed_ms: data._elapsed_ms, totalResults: data.total });
          })
          .catch(err => setError(`Error: ${err instanceof Error ? err.message : String(err)}`))
          .finally(() => setSearching(false));
      }, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Update URL search params to reflect current filter state */
  const syncURL = useCallback((overrides?: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (court) p.set("court", court);
    if (decisionType) p.set("type", decisionType);
    if (tsjComunidad) p.set("tsj_ccaa", tsjComunidad);
    if (apProvincia) p.set("ap_prov", apProvincia);
    if (jurisdiccion) p.set("jurisdiccion", jurisdiccion);
    if (fechaDesde) p.set("fecha_desde", fechaDesde);
    if (fechaHasta) p.set("fecha_hasta", fechaHasta);
    if (roj.trim()) p.set("roj", roj.trim());
    if (ecli.trim()) p.set("ecli", ecli.trim());
    if (ponente.trim()) p.set("ponente", ponente.trim());
    if (seccion) p.set("seccion", seccion);
    if (sort !== "relevance") p.set("sort", sort);
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
    }
    const qs = p.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [query, court, decisionType, tsjComunidad, apProvincia, jurisdiccion, fechaDesde, fechaHasta, roj, ecli, ponente, seccion, sort, router]);

  // News analysis state
  const [newsUrl, setNewsUrl] = useState("");
  const [newsAnalyzing, setNewsAnalyzing] = useState(false);
  const [newsResult, setNewsResult] = useState<NewsAnalysisResult | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsPhase, setNewsPhase] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Compare selection state
  const [compareCount, setCompareCount] = useState(() => compareStore.count());

  const handleToggleCompare = (r: CendojResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = compareStore.toggle({
      roj: r.roj ?? r.id,
      ecli: r.ecli,
      organo: r.organo ?? "",
      fecha: r.fecha ?? "",
      titulo: r.titulo,
      ponente: r.ponente,
      url_pdf: r.url_pdf,
      resumen: r.resumen,
      n_recurso: r.n_recurso,
      n_resolucion: r.n_resolucion,
      sede: r.sede,
    });
    setCompareCount(compareStore.count());
    if (result === "added_a" || result === "added_b") {
      showToast("Seleccionada para comparar");
    } else if (result === "removed") {
      showToast("Quitada de la comparación", "info");
    } else if (result === "full") {
      showToast("Ya hay 2 resoluciones seleccionadas. Quite una primero.", "info");
    }
  };

  /* ── Status check ── */
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cendoj/status", { cache: "no-store" });
      const data = await res.json();
      setStatus(data.status === "healthy" ? "online" : "offline");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const iv = setInterval(checkStatus, 30_000);
    return () => clearInterval(iv);
  }, [checkStatus]);

  /* ── Manual search ── */
  const handleSearch = async () => {
    if (!query.trim() && !roj.trim() && !ecli.trim()) return;
    if (searching) return;
    setSearching(true);
    setError(null);
    setSearchData(null);
    setSelectedResult(null);
    setDecisionData(null);
    setDiag({});

    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (jurisdiccion) params.set("jurisdiccion", jurisdiccion);
    if (fechaDesde) params.set("fecha_desde", fechaDesde);
    if (fechaHasta) params.set("fecha_hasta", fechaHasta);
    if (roj.trim()) params.set("roj", roj.trim());
    if (ecli.trim()) params.set("ecli", ecli.trim());
    if (ponente.trim()) params.set("ponente", ponente.trim());

    // Court type filter → backend tipo_organopub
    if (court) {
      const mapped = COURT_VALUE_TO_PARAMS[court];
      if (mapped && mapped.tipo_organopub.length > 0) {
        mapped.tipo_organopub.forEach(v => params.append("tipo_organopub", v));
      }
      // Dependent sub-filters → localizacion
      if (court === "tribunal_superior" && tsjComunidad) {
        params.set("localizacion", tsjComunidad);
      }
      if (court === "audiencia_provincial" && apProvincia) {
        params.set("localizacion", apProvincia);
      }
      if (court === "tribunal_supremo.civil" && seccion) {
        params.set("seccion", seccion);
      }
    }

    // Decision type filter → backend subtipo_resolucion
    if (decisionType) {
      params.set("subtipo_resolucion", decisionType);
    }

    syncURL();

    const endpoint = `/api/cendoj/search?${params.toString()}`;
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(130_000) });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `HTTP ${res.status}`);
        setDiag({ endpoint, httpStatus: res.status, error: data.error, rawJson: data });
        return;
      }
      setSearchData(data);
      setDiag({ endpoint: data._endpoint || endpoint, httpStatus: res.status, elapsed_ms: data._elapsed_ms, totalResults: data.total, rawJson: data });
    } catch (err: unknown) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSearching(false);
    }
  };

  /* ── View decision ── */
  const handleViewDecision = async (result: CendojResult) => {
    setSelectedResult(result);
    setDecisionData(null);
    setLoadingDecision(true);
    setError(null);
    try {
      const res = await fetch(`/api/cendoj/decision?pdf_url=${encodeURIComponent(result.url_pdf)}`, { signal: AbortSignal.timeout(130_000) });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || `HTTP ${res.status}`); return; }
      setDecisionData(data);
    } catch (err: unknown) { setError(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setLoadingDecision(false); }
  };

  const handleCopy = (text: string) => navigator.clipboard.writeText(text);
  const handleBack = () => { setSelectedResult(null); setDecisionData(null); setAiSummary(null); setSummaryError(null); setError(null); };

  /* ── AI Summary ── */
  const handleAISummarize = async () => {
    if (!selectedResult || loadingSummary) return;
    setLoadingSummary(true);
    setSummaryError(null);
    setAiSummary(null);

    try {
      const res = await fetch("/api/cendoj/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_url: selectedResult.url_pdf,
          resumen: selectedResult.resumen,
          roj: selectedResult.roj,
          ecli: selectedResult.ecli,
          organo: selectedResult.organo,
          titulo: selectedResult.titulo,
          fecha: selectedResult.fecha,
          ponente: selectedResult.ponente,
          n_recurso: selectedResult.n_recurso,
          query: query.trim() || undefined,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSummaryError(data.error || `HTTP ${res.status}`);
        return;
      }
      setAiSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSummaryError(msg.includes("Timeout") ? "Timeout: el análisis tardó más de 2 minutos." : `Error: ${msg}`);
    } finally {
      setLoadingSummary(false);
    }
  };

  /* ── News analysis ── */
  const handleNewsAnalyze = async (url?: string) => {
    const targetUrl = url || newsUrl.trim();
    if (!targetUrl) return;
    if (newsAnalyzing) return;

    setNewsAnalyzing(true);
    setNewsError(null);
    setNewsResult(null);
    setNewsPhase("Validando URL...");

    try {
      setNewsPhase("Extrayendo artículo y buscando en CENDOJ...");
      const res = await fetch("/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
        signal: AbortSignal.timeout(180_000),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNewsError(data.error || `HTTP ${res.status}`);
        return;
      }
      setNewsResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNewsError(msg.includes("Timeout") ? "Timeout: el análisis tardó más de 3 minutos." : `Error: ${msg}`);
    } finally {
      setNewsAnalyzing(false);
      setNewsPhase("");
    }
  };

  /* ── Drag & Drop ── */
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    let url: string | null = null;
    const uriList = e.dataTransfer.getData("text/uri-list");
    if (uriList) {
      const lines = uriList.split("\n").filter((l) => !l.startsWith("#") && l.trim());
      if (lines.length > 0) url = lines[0].trim();
    }
    if (!url) {
      const text = e.dataTransfer.getData("text/plain")?.trim();
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) url = text;
    }
    if (url) { setNewsUrl(url); handleNewsAnalyze(url); }
  };

  const pipelineSteps = [
    { label: "Extrayendo artículo", phase: "Extrayendo" },
    { label: "Buscando en CENDOJ", phase: "Buscando" },
    { label: "Verificando candidatos", phase: "Verificando" },
    { label: "Generando reporte", phase: "Generando" },
  ];

  const getPipelineStepIndex = () => {
    if (!newsPhase) return 0;
    return pipelineSteps.findIndex((s) => newsPhase.includes(s.phase));
  };

  const quickTags = ["Tarjetas revolving", "Pensión alimentos", "Despido disciplinario", "Plusvalía municipal"];

  /* ─── Offline View ─── */
  if (status === "offline") {
    return (
      <OfflineView
        onRetry={checkStatus}
        newsResult={newsResult}
        newsUrl={newsUrl}
        newsAnalyzing={newsAnalyzing}
        newsPhase={newsPhase}
        pipelineSteps={pipelineSteps}
        getPipelineStepIndex={getPipelineStepIndex}
      />
    );
  }

  /* ─── Render ─────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background text-on-surface">

      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Observatorio de Jurisprudencia · Fuente CENDOJ</span>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center flex-1 max-w-md mx-auto">
            <div className="flex items-center p-1 bg-surface-container rounded-lg w-full">
              <button
                onClick={() => { setTab("manual"); setSelectedResult(null); setDecisionData(null); }}
                className={`flex-1 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  tab === "manual" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <M name="search" className="!text-sm" />
                Buscar jurisprudencia
              </button>
              <button
                onClick={() => { setTab("noticia"); setSelectedResult(null); setDecisionData(null); }}
                className={`flex-1 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  tab === "noticia" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <M name="newspaper" className="!text-sm" />
                Encontrar sentencia
              </button>
            </div>
          </nav>

          {/* Status + Diag */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/compare"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs relative"
            >
              <M name="compare" className="!text-base" />
              <span className="hidden sm:inline">Comparar</span>
              {compareCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] font-bold flex items-center justify-center">{compareCount}</span>
              )}
            </Link>
            <Link
              href="/news-compare"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs"
            >
              <M name="fact_check" className="!text-base" />
              <span className="hidden sm:inline">Contrastar</span>
            </Link>
            <Link
              href="/proposition"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs"
            >
              <M name="policy" className="!text-base" />
              <span className="hidden sm:inline">Proposición</span>
            </Link>
            <Link
              href="/workspace"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs relative"
            >
              <M name="workspaces" className="!text-base" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-[11px]">
              <span className={`w-2 h-2 rounded-full animate-pulse ${status === "online" ? "bg-emerald-500" : "bg-yellow-500"}`} />
              <span className="text-secondary font-medium">API:</span>
              <span className="text-on-surface font-semibold">{status === "loading" ? "..." : status.toUpperCase()}</span>
            </div>
            <button
              onClick={() => setShowDiag(!showDiag)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs"
            >
              <M name="tune" className="!text-base" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </button>
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

      {/* Mobile Tab Bar */}
      <nav className="md:hidden sticky top-14 z-40 bg-surface-container-lowest border-b border-surface-container">
        <div className="flex">
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              tab === "manual" ? "border-primary text-primary" : "border-transparent text-secondary"
            }`}
          >
            <M name="search" className="!text-sm" />
            Buscar
          </button>
          <button
            onClick={() => setTab("noticia")}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              tab === "noticia" ? "border-primary text-primary" : "border-transparent text-secondary"
            }`}
          >
            <M name="newspaper" className="!text-sm" />
            Noticia
          </button>
        </div>
      </nav>

      {/* ═══ Main ═══ */}
      <main className="max-w-[1360px] mx-auto px-4 lg:px-8 py-5 lg:py-6">
        {/* Global error */}
        {error && (
          <div className="mb-4 p-3 bg-error-container rounded-xl text-sm flex items-start gap-2">
            <M name="error" className="!text-base text-error shrink-0 mt-0.5" />
            <span className="text-on-surface">{error}</span>
          </div>
        )}

        {/* ── DETAIL VIEW (selected result) ── */}
        {selectedResult ? (
          <div>
            <button onClick={handleBack} className="mb-4 text-xs text-primary hover:underline flex items-center gap-1">
              <M name="arrow_back" className="!text-sm" />
              Volver al buscador de resoluciones
            </button>
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 mb-4">
              <div className="flex items-center gap-2 mb-1">
                {selectedResult.organo && <span className="text-[10px] font-semibold text-primary uppercase tracking-wider px-2 py-0.5 rounded bg-secondary-container">{selectedResult.organo}</span>}
                {selectedResult.sede && <span className="text-[10px] text-on-surface-variant">{selectedResult.sede}</span>}
              </div>
              <h2 className="text-sm font-semibold text-on-surface mb-3">{selectedResult.titulo}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {selectedResult.fecha && <MetaChip label="Fecha" value={selectedResult.fecha} />}
                {selectedResult.ponente && <MetaChip label="Ponente" value={selectedResult.ponente} />}
                {selectedResult.roj && <MetaChip label="ROJ" value={selectedResult.roj} mono copyable onCopy={() => handleCopy(selectedResult.roj!)} />}
                {selectedResult.ecli && <MetaChip label="ECLI" value={selectedResult.ecli} mono copyable onCopy={() => handleCopy(selectedResult.ecli!)} />}
                {selectedResult.n_recurso && <MetaChip label="Nº Recurso" value={selectedResult.n_recurso} />}
                {selectedResult.n_resolucion && <MetaChip label="Nº Resolución" value={selectedResult.n_resolucion} />}
              </div>
              {selectedResult.resumen && (
                <div className="bg-surface-container-low rounded-lg p-3 border-l-2 border-primary mb-3">
                  <p className="text-xs text-on-surface-variant italic leading-relaxed">{selectedResult.resumen}</p>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <a href={selectedResult.url_pdf} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs bg-primary text-on-primary rounded-lg transition-colors flex items-center gap-1.5 hover:bg-primary-container">
                  <M name="open_in_new" className="!text-sm" />
                  Abrir PDF
                </a>
                {decisionData && (
                  <button onClick={() => handleCopy(decisionData.text)} className="px-3 py-1.5 text-xs bg-surface-container-low hover:bg-surface-container rounded-lg text-on-surface transition-colors flex items-center gap-1.5">
                    <M name="content_copy" className="!text-sm" />
                    Copiar texto
                  </button>
                )}
                <button onClick={() => setShowEmail(true)} className="px-3 py-1.5 text-xs bg-surface-container-low hover:bg-surface-container rounded-lg text-on-surface transition-colors flex items-center gap-1.5">
                  <M name="mail" className="!text-sm" />
                  Enviar por email
                </button>
                <button
                  onClick={handleAISummarize}
                  disabled={loadingSummary}
                  className="px-3 py-1.5 text-xs bg-secondary-container hover:bg-secondary text-on-secondary-container rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loadingSummary ? (
                    <>
                      <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <M name="auto_awesome" className="!text-sm" />
                      Analizar con IA
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => handleToggleCompare(selectedResult!, e)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
                    compareStore.isSelected(selectedResult!.roj ?? selectedResult!.id)
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-low hover:bg-surface-container text-on-surface"
                  }`}
                >
                  <M name="compare" className="!text-sm" />
                  {compareStore.isSelected(selectedResult!.roj ?? selectedResult!.id) ? "Quitar de comparación" : "Seleccionar para comparar"}
                </button>
              </div>

              {/* AI Summary Error */}
              {summaryError && (
                <div className="mt-3 p-3 bg-error-container rounded-lg text-xs flex items-start gap-2">
                  <M name="error" className="!text-base text-error shrink-0 mt-0.5" />
                  <span className="text-on-surface">{summaryError}</span>
                </div>
              )}

              {/* AI Summary Display */}
              {aiSummary && (
                <div className="mt-4 border-t border-outline-variant pt-4">
                  {/* Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                      <M name="auto_awesome" className="!text-sm" />
                      Análisis generado por IA
                    </span>
                    {aiSummary.source_identifiers.roj && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {aiSummary.source_identifiers.roj}</span>
                    )}
                    {aiSummary.source_identifiers.ecli && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {aiSummary.source_identifiers.ecli}</span>
                    )}
                  </div>

                  {/* Collapsible Sections */}
                  <div className="space-y-2">
                    {[
                      { key: "facts_summary", label: "Hechos", icon: "description" },
                      { key: "legal_question", label: "Cuestión jurídica", icon: "help_outline" },
                      { key: "court_reasoning", label: "Razonamiento", icon: "psychology" },
                      { key: "holding", label: "Decisión", icon: "gavel" },
                      { key: "result", label: "Resultado procesal", icon: "fact_check" },
                    ].map(({ key, label, icon }) => {
                      const value = aiSummary[key as keyof AISummary];
                      if (!value || typeof value !== "string") return null;
                      return (
                        <details key={key} open className="group bg-surface-container-low rounded-lg overflow-hidden">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-on-surface flex items-center gap-1.5 hover:bg-surface-container transition-colors select-none">
                            <M name={icon} className="!text-sm text-primary" />
                            {label}
                            <M name="expand_more" className="!text-sm text-secondary ml-auto group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="px-3 pb-3 pt-1">
                            <p className="text-xs text-on-surface-variant leading-relaxed">{value}</p>
                          </div>
                        </details>
                      );
                    })}

                    {/* Relevant Excerpt */}
                    {aiSummary.relevant_excerpt && (
                      <details open className="group bg-surface-container-low rounded-lg overflow-hidden">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-on-surface flex items-center gap-1.5 hover:bg-surface-container transition-colors select-none">
                          <M name="format_quote" className="!text-sm text-primary" />
                          Fragmento relevante
                          {aiSummary.excerpt_location && (
                            <span className="text-[10px] font-normal text-secondary ml-1">({aiSummary.excerpt_location})</span>
                          )}
                          <M name="expand_more" className="!text-sm text-secondary ml-auto group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="px-3 pb-3 pt-1">
                          <blockquote className="border-l-2 border-primary pl-3 py-1">
                            <p className="text-xs text-on-surface-variant leading-relaxed italic">{aiSummary.relevant_excerpt}</p>
                          </blockquote>
                        </div>
                      </details>
                    )}
                  </div>

                  {/* Uncertainty */}
                  {aiSummary.uncertainty && (
                    <div className="mt-2 p-2.5 rounded-lg bg-surface-container-low border-l-2 border-yellow-500 flex items-start gap-2">
                      <M name="info" className="!text-sm text-yellow-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{aiSummary.uncertainty}</p>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <p className="mt-2 text-[10px] text-outline leading-relaxed">
                    Este análisis es orientativo y generado automáticamente. No constituye asesoramiento jurídico ni sustituye la lectura íntegra de la resolución. Los identificadores mostrados proceden de CENDOJ.
                  </p>
                </div>
              )}
            </div>
            {loadingDecision ? (
              <div className="text-center py-10 text-secondary text-sm">
                <span className="inline-block w-5 h-5 border-2 border-surface-container-highest border-t-primary rounded-full animate-spin mb-2" />
                <p>Extrayendo texto...</p>
              </div>
            ) : decisionData ? (
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5">
                <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3">TEXTO DE LA RESOLUCIÓN</h3>
                <pre className="whitespace-pre-wrap text-xs text-on-surface leading-relaxed max-h-[500px] overflow-y-auto font-sans">{decisionData.text}</pre>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {/* ═══ TWO-COLUMN LAYOUT ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">

              {/* ── LEFT: Buscar Jurisprudencia ── */}
              <div className={`flex flex-col gap-4 lg:order-2 ${tab === "noticia" ? "hidden lg:flex" : ""}`}>
                <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4 lg:p-5">
                  <h2 className="text-lg font-bold text-on-surface mb-0.5 flex items-center gap-2">
                    <M name="search" className="!text-xl text-primary" />
                    Buscar jurisprudencia
                  </h2>
                  <p className="text-xs text-secondary mb-4">Consulta resoluciones judiciales españolas por conceptos, tribunal, ROJ o ECLI.</p>

                  {/* Search Input */}
                  <div className="relative mb-3">
                    <M name="search" className="absolute left-3 top-1/2 -translate-y-1/2 !text-lg text-secondary pointer-events-none" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Describe la jurisprudencia que quieres encontrar..."
                      className="w-full h-11 pl-10 pr-24 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                      disabled={searching}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {searching ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Buscando...</> : <>BUSCAR<M name="arrow_forward" className="!text-sm" /></>}
                    </button>
                  </div>

                  {/* Primary Filters: Court Type + Decision Type */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                        <M name="account_balance" className="!text-xs mr-0.5" />
                        Órgano judicial
                      </label>
                      <select
                        value={court}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCourt(v);
                          // Reset dependent sub-filters when court changes
                          if (v !== "tribunal_superior") setTsjComunidad("");
                          if (v !== "audiencia_provincial") setApProvincia("");
                          if (v !== "tribunal_supremo.civil") setSeccion("");
                        }}
                        className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {COURT_OPTIONS.map(o => (
                          <option key={o.value || "__all__"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                        <M name="gavel" className="!text-xs mr-0.5" />
                        Tipo de resolución
                      </label>
                      <select
                        value={decisionType}
                        onChange={(e) => setDecisionType(e.target.value)}
                        className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {TYPE_OPTIONS.map(o => (
                          <option key={o.value || "__all__"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dependent sub-filters */}
                  {court === "tribunal_superior" && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                        <M name="map" className="!text-xs mr-0.5" />
                        Comunidad Autónoma
                      </label>
                      <select
                        value={tsjComunidad}
                        onChange={(e) => setTsjComunidad(e.target.value)}
                        className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Todas</option>
                        {CCAA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {court === "audiencia_provincial" && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                        <M name="map" className="!text-xs mr-0.5" />
                        Provincia
                      </label>
                      <input
                        type="text"
                        value={apProvincia}
                        onChange={(e) => setApProvincia(e.target.value)}
                        placeholder="Ej: Madrid, Barcelona..."
                        className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  {court === "tribunal_supremo.civil" && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                        <M name="meeting_room" className="!text-xs mr-0.5" />
                        Sección
                      </label>
                      <select
                        value={seccion}
                        onChange={(e) => setSeccion(e.target.value)}
                        className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {SECTION_OPTIONS.map(o => (
                          <option key={o.value || "__all__"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Quick Tags */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1 text-[11px] text-secondary shrink-0">
                      <M name="bolt" className="!text-sm text-primary" />
                      Tendencias judiciales
                    </div>
                    {quickTags.map((t) => (
                      <button key={t} onClick={() => setQuery(t)} className="px-2 py-0.5 rounded bg-surface-container-low hover:bg-secondary-container text-on-surface-variant text-[11px] font-medium transition-colors cursor-pointer">
                        #{t}
                      </button>
                    ))}
                  </div>

                  {/* Filters Toggle */}
                  <button onClick={() => setShowFilters(!showFilters)} className="text-[11px] text-secondary hover:text-on-surface flex items-center gap-1.5 transition-colors w-full py-2 border-t border-surface-container">
                    <M name="tune" className="!text-sm" />
                    <span className="font-medium">Filtros avanzados</span>
                    <span className="text-[9px] text-outline ml-1">Jurisdicción, fechas, identificadores</span>
                    <M name={showFilters ? "expand_less" : "expand_more"} className="!text-sm ml-auto" />
                  </button>

                  {showFilters && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Jurisdicción</label>
                        <select value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value)} className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary">
                          <option value="">Todas</option>
                          <option>Civil</option><option>Penal</option><option>Contencioso-Administrativo</option><option>Social</option><option>Militar</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Fecha desde</label>
                        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Fecha hasta</label>
                        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">ROJ</label>
                        <input type="text" value={roj} onChange={(e) => setRoj(e.target.value)} placeholder="STS 2849/2026" className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">ECLI</label>
                        <input type="text" value={ecli} onChange={(e) => setEcli(e.target.value)} placeholder="ES:TS:2026:2849" className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Ponente</label>
                        <input type="text" value={ponente} onChange={(e) => setPonente(e.target.value)} placeholder="Nombre magistrado" className="w-full px-2.5 py-2 bg-surface-container rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Filter Chips */}
                {(court || decisionType) && (
                  <div className="flex flex-wrap gap-1.5">
                    {court && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                        {COURT_LABEL_MAP[court] || court}
                        <button onClick={() => { setCourt(""); setTsjComunidad(""); setApProvincia(""); setSeccion(""); }} className="hover:text-error transition-colors">
                          <M name="close" className="!text-xs" />
                        </button>
                      </span>
                    )}
                    {tsjComunidad && court === "tribunal_superior" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                        {tsjComunidad}
                        <button onClick={() => setTsjComunidad("")} className="hover:text-error transition-colors">
                          <M name="close" className="!text-xs" />
                        </button>
                      </span>
                    )}
                    {apProvincia && court === "audiencia_provincial" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                        {apProvincia}
                        <button onClick={() => setApProvincia("")} className="hover:text-error transition-colors">
                          <M name="close" className="!text-xs" />
                        </button>
                      </span>
                    )}
                    {seccion && court === "tribunal_supremo.civil" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                        Sección {SECTION_LABEL_MAP[seccion] || seccion}
                        <button onClick={() => setSeccion("")} className="hover:text-error transition-colors">
                          <M name="close" className="!text-xs" />
                        </button>
                      </span>
                    )}
                    {decisionType && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                        {TYPE_LABEL_MAP[decisionType] || decisionType}
                        <button onClick={() => setDecisionType("")} className="hover:text-error transition-colors">
                          <M name="close" className="!text-xs" />
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {/* Search Results */}
                {searchData && searchData.total > 0 && (() => {
                  // Client-side sort (no re-fetch)
                  const sortedResults = [...searchData.results].sort((a, b) => {
                    if (sort === "date_desc") {
                      return (b.fecha || "").localeCompare(a.fecha || "");
                    }
                    if (sort === "date_asc") {
                      return (a.fecha || "").localeCompare(b.fecha || "");
                    }
                    return 0; // relevance = original order
                  });
                  return (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-secondary">
                        <strong className="text-on-surface">{searchData.total.toLocaleString()}</strong> resoluciones
                        {searchData._elapsed_ms && <span className="text-outline ml-1">({(searchData._elapsed_ms / 1000).toFixed(1)}s)</span>}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <FeedbackButton
                          context={{ page: "search", query: query.trim() }}
                        />
                        <M name="sort" className="!text-sm text-secondary" />
                        <select
                          value={sort}
                          onChange={(e) => {
                            const v = e.target.value as typeof sort;
                            setSort(v);
                            syncURL({ sort: v === "relevance" ? null : v });
                          }}
                          className="px-2 py-1 bg-surface-container rounded-lg text-[11px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                          <option value="relevance">Relevancia</option>
                          <option value="date_desc">Más recientes</option>
                          <option value="date_asc">Más antiguas</option>
                        </select>
                      </div>
                    </div>
                    {sortedResults.map((r) => {
                      const compareSlot = compareStore.isSelected(r.roj ?? r.id);
                      return (
                      <div key={r.id} onClick={() => handleViewDecision(r)} className={`bg-surface-container-lowest rounded-xl shadow-sm border p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group ${compareSlot ? "border-primary/50 shadow-md" : "border-outline-variant"}`}>
                        <div className="flex items-start gap-2">
                          {/* Compare checkbox */}
                          <button
                            onClick={(e) => handleToggleCompare(r, e)}
                            className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all mt-0.5 ${
                              compareSlot
                                ? "bg-primary border-primary text-on-primary"
                                : "border-outline-variant hover:border-primary text-transparent hover:text-primary/30"
                            }`}
                            title={compareSlot ? `Seleccionada (${compareSlot.toUpperCase()})` : "Seleccionar para comparar"}
                          >
                            {compareSlot ? (
                              <M name="check" className="!text-sm" />
                            ) : (
                              <M name="compare" className="!text-xs opacity-0 group-hover:opacity-40" />
                            )}
                          </button>
                          <h3 className="text-sm font-semibold text-on-surface mb-1.5 group-hover:text-primary transition-colors flex-1">{r.titulo}</h3>
                          <SaveButton
                            roj={r.roj ?? r.id}
                            ecli={r.ecli}
                            organo={r.organo ?? ""}
                            fecha={r.fecha ?? ""}
                            titulo={r.titulo}
                            ponente={r.ponente}
                            url_pdf={r.url_pdf}
                            resumen={r.resumen}
                          />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary mb-1.5">
                          {r.organo && <span className="flex items-center gap-1"><M name="account_balance" className="!text-xs" />{r.organo}</span>}
                          {r.fecha && <span className="flex items-center gap-1"><M name="calendar_today" className="!text-xs" />{r.fecha}</span>}
                          {r.ponente && <span className="flex items-center gap-1"><M name="person" className="!text-xs" />{r.ponente}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {r.roj && <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {r.roj}</span>}
                          {r.ecli && <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {r.ecli}</span>}
                        </div>
                        {r.resumen && <p className="text-[11px] text-on-surface-variant line-clamp-2">{r.resumen}</p>}
                      </div>
                    );
                    })}
                  </div>
                  );
                })()}

                {/* Zero results with filters */}
                {searchData && searchData.total === 0 && (court || decisionType) && (
                  <div className="bg-surface-container-low rounded-xl p-5 text-center">
                    <M name="search_off" className="!text-3xl text-outline mb-2" />
                    <p className="text-sm font-semibold text-on-surface mb-1">No se han encontrado resoluciones con estos filtros.</p>
                    <p className="text-xs text-secondary mb-4">Prueba a ampliar la búsqueda eliminando alguno de los filtros activos.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {court && (
                        <button onClick={() => { setCourt(""); setTsjComunidad(""); setApProvincia(""); setSeccion(""); }} className="px-3 py-1.5 text-xs bg-surface-container-lowest hover:bg-surface-container rounded-lg text-on-surface transition-colors flex items-center gap-1 border border-outline-variant">
                          <M name="close" className="!text-sm" />
                          Quitar tribunal
                        </button>
                      )}
                      {decisionType && (
                        <button onClick={() => setDecisionType("")} className="px-3 py-1.5 text-xs bg-surface-container-lowest hover:bg-surface-container rounded-lg text-on-surface transition-colors flex items-center gap-1 border border-outline-variant">
                          <M name="close" className="!text-sm" />
                          Quitar tipo
                        </button>
                      )}
                      <button onClick={() => { setCourt(""); setDecisionType(""); setTsjComunidad(""); setApProvincia(""); setSeccion(""); }} className="px-3 py-1.5 text-xs bg-primary text-on-primary rounded-lg hover:bg-primary-container transition-colors flex items-center gap-1">
                        <M name="filter_alt_off" className="!text-sm" />
                        Ver todos
                      </button>
                    </div>
                  </div>
                )}

                {/* Zero results without filters */}
                {searchData && searchData.total === 0 && !court && !decisionType && (
                  <div className="bg-surface-container-low rounded-xl p-5 text-center">
                    <M name="search_off" className="!text-3xl text-outline mb-2" />
                    <p className="text-sm font-semibold text-on-surface mb-1">No se han encontrado resoluciones.</p>
                    <p className="text-xs text-secondary">Prueba con otros términos de búsqueda.</p>
                  </div>
                )}
              </div>

              {/* ── PRIMARY: Encuentra la sentencia de una noticia ── */}
              <div className={`flex flex-col gap-4 lg:order-1 ${tab === "manual" ? "hidden lg:flex" : ""}`}>
                <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4 lg:p-5 lg:border-primary/30 lg:shadow-md">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                      <M name="newspaper" className="!text-xl text-primary" />
                      Encuentra la sentencia de una noticia
                    </h2>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold uppercase">Diferenciador</span>
                  </div>
                  <p className="text-xs text-secondary mb-4">Arrastra una noticia jurídica o pega su enlace para localizar la resolución original en CENDOJ.</p>

                  {/* Drop Zone */}
                  <div
                    ref={dropRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all mb-4 ${
                      dragOver ? "border-primary bg-secondary-container/20 scale-[1.01]" : "border-outline-variant bg-surface-container-low hover:border-outline"
                    }`}
                  >
                    <M name="newspaper" className={`!text-4xl mb-2 ${dragOver ? "text-primary" : "text-outline"}`} />
                    <p className="text-sm font-semibold text-on-surface mb-0.5">
                      {dragOver ? "¡Suelta aquí!" : "Arrastra aquí una noticia"}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Enlace desde navegador, captura de prensa o texto
                    </p>
                    <div className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${
                      dragOver ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dragOver ? "bg-on-primary" : "bg-primary"}`} />
                      {dragOver ? "¡SUELTA!" : "DROP READY"}
                    </div>
                  </div>

                  {/* URL Input */}
                  <div className="flex flex-col gap-2 mb-3">
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <M name="link" className="!text-xs" />
                        URL DE NOTICIA JUDICIAL
                      </span>
                      <button onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setNewsUrl(t); } catch {} }} className="text-primary text-[10px] hover:underline flex items-center gap-0.5">
                        <M name="content_paste" className="!text-xs" />
                        pegar portapapeles
                      </button>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <M name="link" className="absolute left-3 top-1/2 -translate-y-1/2 !text-base text-secondary pointer-events-none" />
                        <input
                          type="url"
                          value={newsUrl}
                          onChange={(e) => setNewsUrl(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleNewsAnalyze()}
                          placeholder="elpais.com/espana/tribunales/..."
                          className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={newsAnalyzing}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto">
                      <span className="text-[10px] text-outline shrink-0 self-center">Ejemplos:</span>
                      {[{ l: "TS · Cláusulas suelo", u: "https://cincodias.elpais.com/legal/2024/02/tribunal-supremo-clausulas-suelo-retroactividad.html" }, { l: "AN · Cartel camiones", u: "https://www.expansion.com/juridico/actualidad-tendencias/2024/audiencia-nacional-cartel-camiones.html" }].map((s) => (
                        <button key={s.l} onClick={() => { setNewsUrl(s.u); handleNewsAnalyze(s.u); }} className="shrink-0 px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-[10px] font-medium text-on-surface-variant transition-colors">
                          {s.l}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { if (!newsUrl.trim()) setNewsUrl("https://cincodias.elpais.com/legal/2024/02/tribunal-supremo-clausulas-suelo-retroactividad.html"); handleNewsAnalyze(); }}
                      disabled={newsAnalyzing}
                      className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-60"
                    >
                      {newsAnalyzing ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analizando...</> : <><M name="science" className="!text-lg" />Analizar noticia</>}
                    </button>
                  </div>

                  {/* Pipeline Progress */}
                  {newsAnalyzing && (
                    <div className="bg-surface-container-low rounded-lg p-3 mb-3">
                      <div className="space-y-2">
                        {pipelineSteps.map((step, i) => {
                          const currentIdx = getPipelineStepIndex();
                          const isCompleted = i < currentIdx;
                          const isActive = i === currentIdx;
                          const isPending = i > currentIdx;
                          return (
                            <div key={i} className={`pipeline-step ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""} flex items-center gap-3 relative pl-8`}>
                              {/* Circle indicator */}
                              <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                                isCompleted ? "bg-[#16a34a]" : isActive ? "bg-primary" : "bg-outline-variant"
                              }`}>
                                {isCompleted ? <M name="check" className="!text-xs text-white" /> : isActive ? <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-surface-container-lowest" />}
                              </div>
                              {/* Connecting line */}
                              {i < pipelineSteps.length - 1 && (
                                <div className={`absolute left-[9px] top-6 w-0.5 h-5 ${isCompleted ? "bg-[#16a34a]" : "bg-outline-variant"}`} />
                              )}
                              <span className={`text-xs font-medium ${isCompleted ? "text-[#16a34a]" : isActive ? "text-primary font-semibold" : "text-outline"}`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {newsError && (
                    <div className="p-3 bg-error-container rounded-lg text-xs mb-3 flex items-start gap-2">
                      <M name="error" className="!text-base text-error shrink-0 mt-0.5" />
                      <span className="text-on-surface">{newsError}</span>
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-surface-container-low flex gap-2 items-start text-[10px]">
                    <M name="lock" className="!text-sm text-secondary shrink-0 mt-0.5" />
                    <span className="text-on-surface-variant leading-relaxed">
                      <strong className="text-on-surface">Privacidad:</strong> Solo se extraen metadatos procesales para contrastar con CENDOJ. Sin retención de datos personales.
                    </span>
                  </div>
                </div>

                {/* ── News Results ── */}
                {newsResult && <NewsResultPanel result={newsResult} onBack={() => { setNewsResult(null); setNewsUrl(""); }} />}
              </div>
            </div>

            {/* ═══ BOTTOM STATS ROW ═══ */}
            {!searchData && !newsResult && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {/* Recent Cotejos */}
                <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-1.5 mb-3">
                    <M name="history" className="!text-base text-primary" />
                    Cotejos recientes
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold ml-auto">Ejemplo</span>
                  </h3>
                  <ul className="space-y-1.5">
                    {[
                      { roj: "STS 452/2024", match: "—", title: "Ejemplo: resolución ilustrativa", source: "—", time: "—" },
                      { roj: "SAN 189/2023", match: "—", title: "Ejemplo: resolución ilustrativa", source: "—", time: "—" },
                      { roj: "STSJ MAD 234/2024", match: "—", title: "Ejemplo: resolución ilustrativa", source: "—", time: "—" },
                    ].map((item, i) => (
                      <li key={i} className="p-2 rounded bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer">
                        <div className="flex items-center justify-between text-[10px] font-medium mb-0.5">
                          <span className="font-bold text-on-surface font-mono">{item.roj}</span>
                          <span className="px-1 py-0.5 rounded bg-secondary-container text-primary font-bold">{item.match}</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant truncate">{item.title}</p>
                        <span className="text-[9px] text-outline">{item.source} · Hace {item.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Performance */}
                <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-1.5 mb-3">
                    <M name="analytics" className="!text-base text-primary" />
                    Métricas del sistema
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold ml-auto">Ejemplo</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Resoluciones", value: "—", sub: "Consultar CENDOJ" },
                      { label: "Precisión", value: "—", sub: "Pendiente de datos" },
                      { label: "Latencia", value: diag.elapsed_ms ? `${(diag.elapsed_ms / 1000).toFixed(1)}s` : "—", sub: diag.elapsed_ms ? "Última consulta" : "Sin datos" },
                      { label: "Fuentes", value: "—", sub: "Pendiente de datos" },
                    ].map((m, i) => (
                      <div key={i} className="p-2 rounded bg-surface-container-low">
                        <span className="text-[9px] text-secondary uppercase tracking-wider font-semibold">{m.label}</span>
                        <div className="text-sm font-bold text-on-surface">{m.value}</div>
                        <span className="text-[9px] text-outline">{m.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diagnostics */}
                <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-1.5 mb-3">
                    <M name="terminal" className="!text-base text-primary" />
                    Diagnóstico rápido
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold ml-auto">Ejemplo</span>
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: "CENDOJ API", value: status === "online" ? "ONLINE" : "Comprobando...", icon: status === "online" ? "check_circle" : "hourglass_empty" },
                      { label: "Motor NLP", value: "—", icon: "psychology" },
                      { label: "Pipeline", value: "—", icon: "settings" },
                      { label: "Endpoint", value: diag.endpoint ? "Configurado" : "Sin datos", icon: "dns" },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-on-surface-variant flex items-center gap-1">
                          <M name={d.icon} className="!text-xs text-secondary" />
                          {d.label}
                        </span>
                        <span className={`font-medium ${d.value === "ONLINE" ? "text-[#16a34a]" : d.value === "OFFLINE" ? "text-error" : "text-on-surface"}`}>{d.value}</span>
                      </div>
                    ))}
                    {diag.elapsed_ms !== undefined && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-on-surface-variant flex items-center gap-1">
                          <M name="timer" className="!text-xs text-secondary" />
                          Última latencia
                        </span>
                        <span className="font-medium text-on-surface">{(diag.elapsed_ms / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ═══ Diagnostics Overlay ═══ */}
      {showDiag && (
        <DiagnosticModal
          status={status}
          diag={diag}
          onClose={() => setShowDiag(false)}
          onCopy={handleCopy}
        />
      )}

      {/* ═══ Email Modal ═══ */}
      {showEmail && selectedResult && (
        <EmailModal
          result={selectedResult}
          onClose={() => setShowEmail(false)}
        />
      )}

      {/* ═══ Floating Comparison Bar ═══ */}
      {compareCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] bg-surface-container-lowest rounded-2xl shadow-2xl border border-primary/30 px-5 py-3 flex items-center gap-4 animate-[slideUp_.25s_ease-out]">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">{compareCount}</span>
            <span className="text-sm font-semibold text-on-surface">
              resolución{compareCount !== 1 ? "es" : ""} seleccionada{compareCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="h-5 w-px bg-outline-variant" />
          <Link
            href="/compare"
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all ${
              compareCount >= 2
                ? "bg-primary text-on-primary hover:bg-primary-container shadow-md"
                : "bg-surface-container text-on-surface-variant cursor-not-allowed"
            }`}
            onClick={(e) => {
              if (compareCount < 2) e.preventDefault();
            }}
          >
            <M name="compare" className="!text-base" />
            Comparar
          </Link>
          <button
            onClick={() => { compareStore.clear(); setCompareCount(0); showToast("Selección limpiada", "info"); }}
            className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-lg hover:bg-surface-container"
            title="Limpiar selección"
          >
            <M name="close" className="!text-base" />
          </button>
          <style>{`@keyframes slideUp{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}`}</style>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function MetaChip({ label, value, mono, copyable, onCopy }: { label: string; value: string; mono?: boolean; copyable?: boolean; onCopy?: () => void }) {
  return (
    <div className="p-2 rounded-lg bg-surface-container-low relative group">
      <span className="text-[9px] text-secondary uppercase tracking-wider font-semibold block">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-xs font-medium text-on-surface ${mono ? "font-mono" : ""}`}>{value}</span>
        {copyable && onCopy && (
          <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-primary">
            <M name="content_copy" className="!text-xs" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Diagnostic Modal ─────────────────────────────────── */

function DiagnosticModal({ status, diag, onClose, onCopy }: { status: string; diag: DiagInfo; onClose: () => void; onCopy: (t: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-t-xl lg:rounded-xl shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <M name="terminal" className="!text-lg text-primary" />
            <div>
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">AUDITORÍA TELEMÉTRICA</span>
              <h3 className="text-sm font-semibold text-on-surface">Diagnóstico de Extracción & CENDOJ</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors">
            <M name="close" className="!text-lg" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
              status === "online" ? "bg-[#dcfce7] text-[#15803d]" : "bg-error-container text-error"
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${status === "online" ? "bg-emerald-500" : "bg-error"}`} />
              CENDOJ API: {status.toUpperCase()}
              {diag.elapsed_ms && <span className="text-secondary font-normal ml-1">({(diag.elapsed_ms / 1000).toFixed(1)}s)</span>}
            </div>
          </div>

          {/* URL Strip */}
          {diag.endpoint && (
            <div className="p-2 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant break-all flex items-center gap-2">
              <M name="link" className="!text-sm text-secondary shrink-0" />
              <span className="flex-1 truncate">{diag.endpoint}</span>
              <button onClick={() => onCopy(diag.endpoint!)} className="text-primary shrink-0"><M name="content_copy" className="!text-sm" /></button>
            </div>
          )}

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Motor NLP", value: "—" },
              { label: "Latencia Total", value: diag.elapsed_ms ? `${(diag.elapsed_ms / 1000).toFixed(1)}s` : "—" },
              { label: "Cotejo Unívoco", value: diag.totalResults?.toLocaleString() || "—" },
              { label: "HTTP Status", value: diag.httpStatus?.toString() || "—" },
              { label: "Resultados", value: diag.totalResults?.toLocaleString() || "—" },
              { label: "Endpoint", value: diag.endpoint ? "Configurado" : "—" },
            ].map((m, i) => (
              <div key={i} className="p-2.5 bg-surface-container-low rounded-lg">
                <span className="text-[9px] text-secondary uppercase tracking-wider font-semibold">{m.label}</span>
                <div className="text-sm font-bold text-on-surface mt-0.5">{m.value}</div>
              </div>
            ))}
          </div>

          {diag.error && <div className="p-2 bg-error-container text-on-error-container rounded-lg text-xs flex items-center gap-2"><M name="error" className="!text-sm" />{diag.error}</div>}

          {/* JSON viewer */}
          {diag.rawJson !== undefined && diag.rawJson !== null && (
            <div className="bg-inverse-surface text-inverse-on-surface rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[10px] font-mono text-surface-container-high">response.json</span>
                <button onClick={() => onCopy(JSON.stringify(diag.rawJson, null, 2))} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                  <M name="content_copy" className="!text-xs" />
                  Copiar
                </button>
              </div>
              <pre className="px-3 pb-3 max-h-48 overflow-auto text-[10px] leading-relaxed">{JSON.stringify(diag.rawJson, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Email Modal ──────────────────────────────────────── */

function EmailModal({ result, onClose }: { result: CendojResult; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Resolución judicial: ${result.roj || result.titulo}`);
  const [body, setBody] = useState(`Adjunto la resolución judicial identificada con ROJ ${result.roj || "N/A"}.\n\n${result.titulo}\n${result.organo ? `Órgano: ${result.organo}` : ""}${result.fecha ? `\nFecha: ${result.fecha}` : ""}`);
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-xl max-h-[85vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-2">
            <M name="mail" className="!text-lg text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-on-surface">Enviar resolución por email</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono text-on-surface-variant">{result.roj || "—"}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-[#dcfce7] text-[#15803d] font-bold">VERIFIED MATCH</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors">
            <M name="close" className="!text-lg" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Recipient */}
          <div>
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1 block">Destinatario</label>
            <div className="relative">
              <M name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 !text-base text-secondary pointer-events-none" />
              <input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="correo@ejemplo.com" className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          {/* CC */}
          <div>
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1 block">CC (opcional)</label>
            <input type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="otro@correo.com" className="w-full h-10 px-3 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {/* Subject */}
          <div>
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1 block">Asunto</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {/* Body */}
          <div>
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1 block">Mensaje</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          {/* Attach PDF */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} className="rounded border-outline-variant" />
            <M name="attach_file" className="!text-sm text-secondary" />
            <span className="text-xs text-on-surface-variant">Adjuntar PDF de la sentencia</span>
          </label>
          {/* Send */}
          <button
            disabled={!recipient.trim() || sending}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <M name="send" className="!text-lg" />
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Offline View ─────────────────────────────────────── */

function OfflineView({ onRetry, newsResult, newsUrl, newsAnalyzing, newsPhase, pipelineSteps, getPipelineStepIndex }: {
  onRetry: () => void;
  newsResult: NewsAnalysisResult | null;
  newsUrl: string;
  newsAnalyzing: boolean;
  newsPhase: string;
  pipelineSteps: { label: string; phase: string }[];
  getPipelineStepIndex: () => number;
}) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Observatorio de Jurisprudencia · Fuente CENDOJ</span>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-[640px] mx-auto px-4 py-10">
        {/* Offline banner */}
        <div className="bg-error-container rounded-xl p-5 mb-6 flex items-start gap-3">
          <div className="relative shrink-0">
            <M name="cloud_off" className="!text-2xl text-error" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-error animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-error uppercase tracking-wider">OFFLINE</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-error font-bold">API NO DISPONIBLE</span>
            </div>
            <h2 className="text-lg font-bold text-on-surface mb-1">SERVICIO CENDOJ NO DISPONIBLE</h2>
            <p className="text-xs text-on-surface-variant">El Centro de Documentación Judicial del CGPJ no está respondiendo. Las consultas de jurisprudencia no están disponibles temporalmente.</p>
          </div>
        </div>

        {/* Retained news card */}
        {newsResult && (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <M name="verified_user" className="!text-base text-[#16a34a]" />
              <span className="text-xs font-semibold text-on-surface">Análisis de noticia retenido</span>
              <M name="lock_clock" className="!text-sm text-secondary ml-auto" />
            </div>
            <p className="text-[11px] text-on-surface-variant truncate">{newsUrl}</p>
          </div>
        )}

        {/* Pipeline state */}
        {newsAnalyzing && (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4 mb-6">
            <h3 className="text-xs font-semibold text-on-surface mb-3">Pipeline en progreso</h3>
            <div className="space-y-2">
              {pipelineSteps.map((step, i) => {
                const currentIdx = getPipelineStepIndex();
                const isCompleted = i < currentIdx;
                const isActive = i === currentIdx;
                return (
                  <div key={i} className="flex items-center gap-3 pl-8 relative pipeline-step">
                    <div className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                      isCompleted ? "bg-[#16a34a]" : isActive ? "bg-primary" : "bg-outline-variant"
                    }`}>
                      {isCompleted ? <M name="check" className="!text-xs text-white" /> : isActive ? <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-surface-container-lowest" />}
                    </div>
                    <span className={`text-xs ${isCompleted ? "text-[#16a34a]" : isActive ? "text-primary font-semibold" : "text-outline"}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Retry */}
        <button onClick={onRetry} className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all">
          <M name="refresh" className="!text-lg" />
          Reintentar conexión
        </button>
      </main>
    </div>
  );
}

/* ─── News Result Panel ────────────────────────────────── */

function NewsResultPanel({ result, onBack }: { result: NewsAnalysisResult; onBack: () => void }) {
  const { article, legal_metadata: meta, match, diagnostics } = result;
  const sc = STATUS_BADGE[match.status];

  return (
    <div className="space-y-3">
      {/* Status Banner */}
      <div className={`w-full ${sc.bg} rounded-xl p-4 shadow-sm border-l-4 ${sc.border}`}>
        <div className="flex items-center gap-2 mb-1">
          <M name={sc.icon} className={`!text-lg ${sc.text}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${sc.text}`}>{sc.label}</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-[10px] font-bold text-on-surface">Confianza {match.confidence}%</span>
          <FeedbackButton
            context={{ page: "news-analysis", articleUrl: article.url, articleTitle: article.title ?? undefined, matchStatus: match.status }}
            className="ml-auto"
          />
        </div>
        <p className="text-xs text-on-surface-variant">{match.explanation}</p>
      </div>

      {/* Article Info */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
        <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
          <M name="newspaper" className="!text-sm" />
          Noticia Analizada
        </h3>
        {article.title && <h4 className="text-sm font-semibold text-on-surface mb-1">{article.title}</h4>}
        <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
          {article.publication && <span className="font-medium text-on-surface">{article.publication}</span>}
          {article.publication_date && <span>· {article.publication_date}</span>}
          {article.author && <span>· {article.author}</span>}
        </div>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
          <M name="open_in_new" className="!text-xs" />
          Abrir noticia original
        </a>
      </div>

      {/* Legal Metadata */}
      {(meta.court || meta.ecli || meta.roj) && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
          <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <M name="gavel" className="!text-sm" />
            Datos jurídicos detectados
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {meta.court && <MetaChip label="Tribunal" value={meta.court.value} />}
            {meta.ecli && <MetaChip label="ECLI" value={meta.ecli.value} mono copyable onCopy={() => navigator.clipboard.writeText(meta.ecli!.value)} />}
            {meta.roj && <MetaChip label="ROJ" value={meta.roj.value} mono copyable onCopy={() => navigator.clipboard.writeText(meta.roj!.value)} />}
            {meta.decision_date && <MetaChip label="Fecha" value={meta.decision_date.value} />}
            {meta.judge && <MetaChip label="Ponente" value={meta.judge.value} />}
            {meta.appeal_number && <MetaChip label="Nº Recurso" value={meta.appeal_number.value} />}
          </div>
          {meta.legal_topics.value.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {meta.legal_topics.value.map((t, i) => <span key={i} className="px-1.5 py-0.5 bg-surface-container-low text-[10px] rounded text-on-surface-variant">{t}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Source Level Indicator */}
      <div className="flex items-center gap-2">
        {(() => {
          const sl = match.source_level;
          const slConfig = {
            FULL_TEXT: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", icon: "description", label: "Análisis basado en texto completo" },
            OFFICIAL_SUMMARY: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", icon: "summarize", label: "Análisis basado en resumen oficial" },
            METADATA_ONLY: { bg: "bg-surface-container", text: "text-on-surface-variant", icon: "data_object", label: "Análisis basado solo en metadatos" },
          };
          const c = slConfig[sl] || slConfig.METADATA_ONLY;
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
              <M name={c.icon} className="!text-xs" />
              {c.label}
            </span>
          );
        })()}
      </div>

      {/* Structured Evidence Explanation */}
      {match.evidence_items && match.evidence_items.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
          <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <M name="quiz" className="!text-sm text-primary" />
            ¿Por qué creemos que esta es la resolución?
          </h3>
          <ul className="space-y-1.5">
            {match.evidence_items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                {item.status === "match" ? (
                  <M name="check_circle" className="!text-sm text-[#16a34a] shrink-0 mt-0.5" />
                ) : item.status === "mismatch" ? (
                  <M name="cancel" className="!text-sm text-[#dc2626] shrink-0 mt-0.5" />
                ) : (
                  <M name="remove_circle_outline" className="!text-sm text-outline shrink-0 mt-0.5" />
                )}
                <span className="flex-1">
                  {item.status === "match" && <span className="text-[#15803d]">✓</span>}
                  {item.status === "mismatch" && <span className="text-[#dc2626]">✗</span>}
                  {item.status === "missing" && <span className="text-outline">—</span>}
                  {" "}
                  <span className="font-medium text-on-surface">{item.field}</span>
                  {item.status === "match" && item.candidate_value && (
                    <span className="text-on-surface-variant"> coincide ({item.candidate_value})</span>
                  )}
                  {item.status === "mismatch" && (
                    <span className="text-on-surface-variant">
                      {" "}no coincide (artículo: {item.article_value || "—"}, candidato: {item.candidate_value || "—"})
                    </span>
                  )}
                  {item.status === "missing" && (
                    <span className="text-on-surface-variant"> no disponible</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-2 border-t border-surface-container">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              match.status === "VERIFIED" ? "text-[#15803d]" :
              match.status === "PROBABLE" ? "text-[#a16207]" :
              match.status === "AMBIGUOUS" ? "text-primary" :
              "text-secondary"
            }`}>
              Estado: {match.status}
            </span>
          </div>
        </div>
      )}

      {/* Evidence (legacy string list — fallback) */}
      {(!match.evidence_items || match.evidence_items.length === 0) && match.evidence.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
          <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <M name="check_circle" className="!text-sm text-[#16a34a]" />
            Evidencia
          </h3>
          <ul className="space-y-1">
            {match.evidence.map((e, i) => (
              <li key={i} className="text-[11px] text-on-surface flex gap-1.5">
                <M name="check" className="!text-xs text-[#16a34a] shrink-0 mt-0.5" />
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Candidates — Top 3 ranked */}
      {match.candidates.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
          <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <M name="leaderboard" className="!text-sm" />
            Top candidatos ({Math.min(match.candidates.length, 3)} de {match.candidates.length})
          </h3>
          <div className="space-y-2">
            {match.candidates.slice(0, 3).map((c, idx) => {
              const isSelected = c === match.candidate;
              const isFirst = idx === 0;
              return (
                <div key={c.id} className={`p-3 rounded-lg border ${
                  isSelected ? "bg-[#f0fdf4] border-[#16a34a] shadow-sm" :
                  isFirst ? "bg-surface-container-low border-outline-variant" :
                  "bg-surface-container-lowest border-outline-variant/50"
                }`}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 pr-2">
                      <span className="text-[9px] font-bold text-on-surface-variant w-4">#{idx + 1}</span>
                      <h4 className="text-xs font-semibold text-on-surface flex-1">{c.titulo}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded bg-[#16a34a] text-white text-[9px] font-bold">SELECCIONADO</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        c.match_score >= 80 ? "bg-[#dcfce7] text-[#15803d]" : c.match_score >= 50 ? "bg-[#fef9c3] text-[#a16207]" : "bg-surface-container text-on-surface-variant"
                      }`}>{c.match_score}%</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] text-secondary mb-1.5 ml-6">
                    {c.organo && <span className="flex items-center gap-0.5"><M name="account_balance" className="!text-xs" />{c.organo}</span>}
                    {c.fecha && <span>· {c.fecha}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5 ml-6">
                    {c.roj && <span className="px-1 py-0.5 rounded bg-surface-container text-primary text-[9px] font-mono font-semibold">ROJ: {c.roj}</span>}
                    {c.ecli && <span className="px-1 py-0.5 rounded bg-surface-container text-on-surface-variant text-[9px] font-mono font-semibold">ECLI: {c.ecli}</span>}
                  </div>
                  {c.match_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5 ml-6">{c.match_reasons.map((r, j) => <span key={j} className="px-1.5 py-0.5 bg-secondary-container text-[9px] text-on-secondary-container rounded">{r}</span>)}</div>
                  )}
                  {/* Rejection reason for non-selected candidates */}
                  {!isSelected && c.rejected_reason && (
                    <div className="ml-6 mt-1 flex items-start gap-1.5 text-[10px] text-on-surface-variant">
                      <M name="info" className="!text-xs text-outline shrink-0 mt-0.5" />
                      <span>{c.rejected_reason}</span>
                    </div>
                  )}
                  <div className="flex gap-1.5 ml-6">
                    <a href={c.url_pdf} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-[10px] bg-primary text-on-primary rounded hover:bg-primary-container transition-colors flex items-center gap-1">
                      <M name="visibility" className="!text-xs" />
                      Revisar
                    </a>
                    <a href={`https://www.poderjudicial.es/search/AN/openDocument/${c.ecli || ""}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-[10px] bg-surface-container hover:bg-surface-container-high rounded transition-colors flex items-center gap-1">
                      <M name="open_in_new" className="!text-xs" />
                      Abrir en CENDOJ
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contrast Button */}
      {match.candidate && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <M name="fact_check" className="!text-base text-primary" />
                Contrastar noticia con la resolución
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Extrae las afirmaciones del artículo y las compara con los datos oficiales de CENDOJ.
              </p>
            </div>
            <Link
              href={`/news-compare?url=${encodeURIComponent(result.article.url)}`}
              className="shrink-0 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all"
            >
              <M name="fact_check" className="!text-sm" />
              Contrastar
            </Link>
          </div>
        </div>
      )}

      {/* Search Attempts */}
      {match.search_attempts.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant">
          <h3 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <M name="manage_search" className="!text-sm" />
            Búsquedas realizadas
          </h3>
          <div className="space-y-1">
            {match.search_attempts.map((a) => (
              <div key={a.attempt} className="text-[10px] font-mono flex gap-2 text-on-surface-variant">
                <span className="text-outline w-5">#{a.attempt}</span>
                <span className="text-primary font-medium">{a.type}</span>
                <span>{a.result_count} res.</span>
                <span className="text-outline">{a.duration_ms}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      <details className="bg-inverse-surface text-inverse-on-surface rounded-xl overflow-hidden">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-surface-container-high flex items-center gap-1.5">
          <M name="terminal" className="!text-sm" />
          Diagnóstico técnico de extracción NLP
        </summary>
        <div className="px-4 pb-3 grid grid-cols-2 gap-1.5 text-[11px]">
          <div>Extractor: <span className="font-medium">{diagnostics.extractor}</span></div>
          <div>Extracción: <span className="font-medium">{(diagnostics.extraction_ms / 1000).toFixed(1)}s</span></div>
          <div>Búsqueda: <span className="font-medium">{(diagnostics.search_ms / 1000).toFixed(1)}s</span></div>
          <div>Verificación: <span className="font-medium">{(diagnostics.verification_ms / 1000).toFixed(1)}s</span></div>
          <div>Total: <span className="font-medium">{(diagnostics.total_ms / 1000).toFixed(1)}s</span></div>
          <div>ID: <span className="font-mono">{result.request_id}</span></div>
          {diagnostics.errors.length > 0 && <div className="col-span-2 text-error">{diagnostics.errors.join(", ")}</div>}
        </div>
      </details>
    </div>
  );
}
