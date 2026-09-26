"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { openHelpDrawer } from "@/components/HelpDrawer";
import ToastContainer, { showToast } from "@/components/Toast";
import { copyToClipboard, downloadJSON, formatDocumentAnalysisAsMarkdown, type DocumentExportInput } from "@/lib/export-utils";
import { saveDocument } from "@/lib/workspace/store";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

type UploadState = "IDLE" | "UPLOADING" | "EXTRACTING" | "COMPLETE" | "ERROR";
type AnalysisPhase = "IDLE" | "CLASIFICANDO" | "EXTRAYENDO_CUESTIONES" | "EXTRAYENDO_ARGUMENTOS" | "COMPLETO" | "ERROR";
type SearchPhase = "IDLE" | "SEARCHING" | "CLASSIFYING" | "COMPLETE" | "ERROR";

interface UploadResult {
  document_id: string;
  filename: string;
  type: string;
  size: number;
  text_length: number;
  extraction_method: string;
  pages?: number;
  warnings: string[];
}

interface ExtractedIssue {
  issue: string;
  evidence: string;
  confidence: number;
  provenance: "SOURCE_FACT" | "INFERRED";
}

interface ExtractedArgument {
  argument: string;
  document_location: string;
  related_issue: string;
  confidence: number;
  provenance: "SOURCE_FACT" | "INFERRED";
}

interface ExtractedCitation {
  text: string;
  type: "law" | "regulation" | "roj" | "ecli" | "case_number";
  normalized: string;
  status: "CITED_IN_DOCUMENT";
}

interface AnalysisResult {
  analysis_id: string;
  document_id: string;
  doc_type: string;
  issues: ExtractedIssue[];
  arguments: ExtractedArgument[];
  citations: ExtractedCitation[];
  issue_count: number;
  argument_count: number;
  citation_count: number;
}

interface ResearchCandidate {
  decision_roj: string | null;
  decision_ecli: string | null;
  organo: string | null;
  fecha: string | null;
  titulo: string | null;
  resumen: string | null;
  relationship: "SUPPORTS" | "CONTRADICTS" | "DISTINGUISHES" | "NEUTRAL" | "INSUFFICIENT_EVIDENCE";
  reason: string;
  evidence_basis: "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";
  source_url: string;
}

interface ResearchIssueResult {
  issue_text: string;
  candidates: ResearchCandidate[];
}

interface GapAnalysis {
  issues_without_jurisprudence: string[];
  cited_cases_unresolved: string[];
  only_lower_court: string[];
  missing_contrary: string[];
}

interface SearchPerformance {
  total_ms: number;
  retrieval_ms: number;
  ai_ms: number;
  issues_searched: number;
  candidates_found: number;
}

interface ResearchResults {
  document_id: string;
  analysis_id: string;
  results: ResearchIssueResult[];
  gap_analysis: GapAnalysis;
  performance: SearchPerformance;
}

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_TYPES = [".pdf", ".docx", ".txt"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const DOC_TYPE_LABELS: Record<string, string> = {
  DEMANDA: "Demanda",
  CONTESTACION: "Contestación",
  RECURSO: "Recurso",
  ESCRITO_ALEGACIONES: "Escrito de alegaciones",
  SENTENCIA: "Sentencia",
  AUTO: "Auto",
  INFORME: "Informe",
  CONTRATO: "Contrato",
  OTRO: "Otro",
};

const CITATION_TYPE_LABELS: Record<string, string> = {
  law: "Ley",
  regulation: "Reglamento",
  roj: "ROJ",
  ecli: "ECLI",
  case_number: "Nº de caso",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

/* ── Issue Card (expandable) ── */
function IssueCard({
  issue,
  index,
  relatedArguments,
}: {
  issue: ExtractedIssue;
  index: number;
  relatedArguments: ExtractedArgument[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-start gap-3 hover:bg-surface-container-low/50 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface leading-snug">{issue.issue}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                issue.provenance === "SOURCE_FACT"
                  ? "bg-[#dcfce7] text-[#15803d]"
                  : "bg-[#fef9c3] text-[#a16207]"
              }`}
            >
              {issue.provenance === "SOURCE_FACT" ? "Hecho verificado" : "Inferido"}
            </span>
            <span className="text-[10px] text-secondary">
              Confianza: {Math.round(issue.confidence * 100)}%
            </span>
          </div>
        </div>
        <M
          name={expanded ? "expand_less" : "expand_more"}
          className="!text-xl text-secondary shrink-0"
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-outline-variant/50">
          {/* Evidence */}
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">
              Evidencia
            </p>
            <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg p-3 italic leading-relaxed">
              &ldquo;{issue.evidence}&rdquo;
            </p>
          </div>

          {/* Related arguments */}
          {relatedArguments.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Argumentos vinculados
              </p>
              <div className="space-y-2">
                {relatedArguments.map((arg, i) => (
                  <div key={i} className="bg-surface-container rounded-lg p-3">
                    <p className="text-xs text-on-surface leading-relaxed">{arg.argument}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          arg.provenance === "SOURCE_FACT"
                            ? "bg-[#dcfce7] text-[#15803d]"
                            : "bg-[#fef9c3] text-[#a16207]"
                        }`}
                      >
                        {arg.provenance === "SOURCE_FACT" ? "Hecho" : "Inferido"}
                      </span>
                      {arg.document_location && (
                        <span className="text-[10px] text-secondary">
                          {arg.document_location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
function DocumentsContent() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("IDLE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Analysis state
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>("IDLE");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  // Search state
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("IDLE");
  const [searchResults, setSearchResults] = useState<ResearchResults | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

  // Save/Export state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copying, setCopying] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const validateFile = useCallback((file: File): string | null => {
    const ext = getFileExtension(file.name);
    if (!ACCEPTED_TYPES.includes(ext) && !ACCEPTED_MIME.includes(file.type)) {
      return `Tipo de archivo no soportado. Acepta: ${ACCEPTED_TYPES.join(", ")}`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `El archivo excede el tamaño máximo de 25 MB (${formatBytes(file.size)}).`;
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      showToast(error, "error");
      return;
    }
    setSelectedFile(file);
    setUploadResult(null);
    setErrorMessage(null);
    setState("IDLE");
    setAnalysisPhase("IDLE");
    setAnalysisResult(null);
    setAnalysisError(null);
    setExtractedText(null);
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setState("UPLOADING");
    setErrorMessage(null);
    setUploadResult(null);
    setAnalysisPhase("IDLE");
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      setState("EXTRACTING");
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${res.status})`);
      }

      const data = await res.json();

      // The upload API returns flat object with document_id
      if (data.document_id) {
        // Read the file text for later analysis
        const text = await selectedFile.text();
        setExtractedText(text);

        setState("COMPLETE");
        setUploadResult(data as UploadResult);
        showToast("Documento subido correctamente");
      } else {
        throw new Error(data.error || "Error desconocido al procesar el documento");
      }
    } catch (err) {
      setState("ERROR");
      const msg = err instanceof Error ? err.message : "Error al subir el documento";
      setErrorMessage(msg);
      showToast(msg, "error");
    }
  }, [selectedFile]);

  /* ── Analysis handler ── */
  const handleAnalyze = useCallback(async () => {
    if (!uploadResult?.document_id || !extractedText) return;

    setAnalysisPhase("CLASIFICANDO");
    setAnalysisError(null);
    setAnalysisResult(null);

    // Simulate phase progression (the actual API call is a single request)
    const phaseTimer1 = setTimeout(() => setAnalysisPhase("EXTRAYENDO_CUESTIONES"), 2000);
    const phaseTimer2 = setTimeout(() => setAnalysisPhase("EXTRAYENDO_ARGUMENTOS"), 5000);

    try {
      const res = await fetch("/api/documents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: uploadResult.document_id,
          extracted_text: extractedText,
        }),
      });

      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${res.status})`);
      }

      const data: AnalysisResult = await res.json();
      setAnalysisResult(data);
      setAnalysisPhase("COMPLETO");
      showToast("Análisis completado");
    } catch (err) {
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
      setAnalysisPhase("ERROR");
      const msg = err instanceof Error ? err.message : "Error al analizar el documento";
      setAnalysisError(msg);
      showToast(msg, "error");
    }
  }, [uploadResult, extractedText]);

  /* ── Search jurisprudence handler ── */
  const handleSearchJurisprudence = useCallback(async () => {
    if (!uploadResult?.document_id || !analysisResult?.analysis_id) return;

    setSearchPhase("SEARCHING");
    setSearchError(null);
    setSearchResults(null);

    const phaseTimer = setTimeout(() => setSearchPhase("CLASSIFYING"), 3000);

    try {
      const body: Record<string, unknown> = {
        document_id: uploadResult.document_id,
        analysis_id: analysisResult.analysis_id,
      };
      if (selectedIssues.length > 0) {
        body.selected_issues = selectedIssues;
      }

      const res = await fetch("/api/documents/search-jurisprudence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      clearTimeout(phaseTimer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${res.status})`);
      }

      const data: ResearchResults = await res.json();
      setSearchResults(data);
      setSearchPhase("COMPLETE");
      showToast(`Búsqueda completada: ${data.performance.candidates_found} resultados`);
    } catch (err) {
      clearTimeout(phaseTimer);
      setSearchPhase("ERROR");
      const msg = err instanceof Error ? err.message : "Error al buscar jurisprudencia";
      setSearchError(msg);
      showToast(msg, "error");
    }
  }, [uploadResult, analysisResult, selectedIssues]);

  const toggleIssueSelection = useCallback((issueText: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issueText)
        ? prev.filter((i) => i !== issueText)
        : [...prev, issueText],
    );
  }, []);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage(null);
    setState("IDLE");
    setAnalysisPhase("IDLE");
    setAnalysisResult(null);
    setAnalysisError(null);
    setExtractedText(null);
    setSearchPhase("IDLE");
    setSearchResults(null);
    setSearchError(null);
    setSelectedIssues([]);
  }, []);

  if (authLoading || (!user && typeof window !== "undefined")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-secondary text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Documentos</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-secondary hidden sm:inline">{user?.email}</span>
            <Link href="/workspace" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="workspaces" className="!text-sm" />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <Link href="/documents" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-xs text-on-surface font-semibold border border-primary/30 transition-colors">
              <M name="description" className="!text-sm" />
              <span className="hidden sm:inline">Documentos</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">
              <M name="search" className="!text-sm" />
              <span className="hidden sm:inline">Buscar</span>
            </Link>
            <Link href="/alerts" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="notifications" className="!text-sm" />
              <span className="hidden sm:inline">Alertas</span>
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-error-container hover:text-error text-xs text-on-surface-variant transition-colors">
              <M name="logout" className="!text-sm" />
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

      <div className="max-w-[720px] mx-auto px-4 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-on-surface mb-2">Analiza un documento jurídico</h1>
          <p className="text-sm text-secondary">
            Sube un documento legal para extraer cuestiones, argumentos y buscar jurisprudencia relevante.
          </p>
        </div>

        {/* Drop Zone */}
        {state === "IDLE" && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center py-14 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
              isDragOver
                ? "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(var(--primary-rgb,59,130,246),0.08)]"
                : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-low/50"
            }`}
          >
            <M name="cloud_upload" className={`!text-5xl mb-3 transition-colors ${isDragOver ? "text-primary" : "text-outline-variant"}`} />
            <p className="text-sm font-semibold text-on-surface mb-1">
              {isDragOver ? "Suelta el archivo aquí" : "Arrastra un documento aquí"}
            </p>
            <p className="text-xs text-secondary mb-4">o haz clic para seleccionar un archivo</p>
            <div className="flex items-center gap-3 text-[11px] text-outline">
              <span className="flex items-center gap-1"><M name="picture_as_pdf" className="!text-sm" /> PDF</span>
              <span className="text-outline-variant">·</span>
              <span className="flex items-center gap-1"><M name="article" className="!text-sm" /> DOCX</span>
              <span className="text-outline-variant">·</span>
              <span className="flex items-center gap-1"><M name="text_snippet" className="!text-sm" /> TXT</span>
              <span className="text-outline-variant">·</span>
              <span className="flex items-center gap-1"><M name="straighten" className="!text-sm" /> Máx. 25 MB</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* Selected File Info */}
        {selectedFile && state === "IDLE" && (
          <div className="mt-4 bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <M name="description" className="!text-xl text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{selectedFile.name}</p>
                <p className="text-xs text-secondary">
                  {formatBytes(selectedFile.size)} · {selectedFile.type || getFileExtension(selectedFile.name).toUpperCase()}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="p-1.5 rounded-lg hover:bg-error-container hover:text-error text-on-surface-variant transition-colors"
                title="Quitar archivo"
              >
                <M name="close" className="!text-base" />
              </button>
            </div>
            <button
              onClick={handleUpload}
              className="w-full mt-4 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
            >
              <M name="upload_file" className="!text-base" />
              Subir y analizar
            </button>
          </div>
        )}

        {/* Processing States */}
        {(state === "UPLOADING" || state === "EXTRACTING") && (
          <div className="mt-4 bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <M
                  name={state === "UPLOADING" ? "upload_file" : "text_snippet"}
                  className="!text-2xl text-primary animate-pulse"
                />
              </div>
              <p className="text-sm font-semibold text-on-surface mb-1">
                {state === "UPLOADING" && "Subiendo documento..."}
                {state === "EXTRACTING" && "Extrayendo texto..."}
              </p>
              {selectedFile && (
                <p className="text-xs text-secondary">{selectedFile.name} · {formatBytes(selectedFile.size)}</p>
              )}
              <div className="w-full max-w-xs mt-4 h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                  style={{ width: state === "UPLOADING" ? "50%" : "90%" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {state === "ERROR" && (
          <div className="mt-4 bg-surface-container-lowest rounded-xl border border-error/30 p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                <M name="error" className="!text-xl text-error" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-on-surface mb-1">Error al procesar el documento</p>
                <p className="text-xs text-error mb-3">{errorMessage}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant font-semibold transition-colors"
                  >
                    Elegir otro archivo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Complete → Show metadata + Analyze button */}
        {state === "COMPLETE" && uploadResult && (
          <div className="mt-4 space-y-4">
            {/* Upload success card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center shrink-0">
                  <M name="check_circle" className="!text-xl text-[#15803d]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Documento subido correctamente</p>
                  {selectedFile && (
                    <p className="text-xs text-secondary">{selectedFile.name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-0.5">Caracteres</p>
                  <p className="text-sm font-bold text-on-surface">{uploadResult.text_length?.toLocaleString("es-ES")}</p>
                </div>
                {uploadResult.pages != null && (
                  <div className="bg-surface-container rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-0.5">Páginas</p>
                    <p className="text-sm font-bold text-on-surface">{uploadResult.pages}</p>
                  </div>
                )}
                <div className="bg-surface-container rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-0.5">Método</p>
                  <p className="text-sm font-bold text-on-surface capitalize">{uploadResult.extraction_method}</p>
                </div>
                <div className="bg-surface-container rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-0.5">ID Documento</p>
                  <p className="text-xs font-mono font-bold text-on-surface truncate">{uploadResult.document_id}</p>
                </div>
              </div>

              {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                <div className="mt-4 rounded-lg bg-[#fff7ed] border border-[#fed7aa] p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <M name="warning" className="!text-sm text-[#c2410c]" />
                    <p className="text-xs font-semibold text-[#9a3412]">Advertencias</p>
                  </div>
                  <ul className="space-y-1">
                    {uploadResult.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-[#9a3412] pl-5 list-disc">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Analyze button (before analysis starts) */}
            {analysisPhase === "IDLE" && (
              <button
                onClick={handleAnalyze}
                className="w-full py-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
              >
                <M name="psychology" className="!text-base" />
                Analizar documento
              </button>
            )}

            {/* Analysis progress */}
            {analysisPhase !== "IDLE" && analysisPhase !== "COMPLETO" && analysisPhase !== "ERROR" && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <M name="psychology" className="!text-2xl text-primary animate-pulse" />
                  </div>
                  <p className="text-sm font-semibold text-on-surface mb-1">
                    {analysisPhase === "CLASIFICANDO" && "Clasificando documento..."}
                    {analysisPhase === "EXTRAYENDO_CUESTIONES" && "Extrayendo cuestiones jurídicas..."}
                    {analysisPhase === "EXTRAYENDO_ARGUMENTOS" && "Extrayendo argumentos..."}
                  </p>
                  <p className="text-xs text-secondary mt-1">Analizando con IA — esto puede tardar unos segundos</p>
                  <div className="w-full max-w-xs mt-4 h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width:
                          analysisPhase === "CLASIFICANDO" ? "25%" :
                          analysisPhase === "EXTRAYENDO_CUESTIONES" ? "60%" : "85%",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Analysis error */}
            {analysisPhase === "ERROR" && (
              <div className="bg-surface-container-lowest rounded-xl border border-error/30 p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                    <M name="error" className="!text-xl text-error" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface mb-1">Error en el análisis</p>
                    <p className="text-xs text-error mb-3">{analysisError}</p>
                    <button
                      onClick={handleAnalyze}
                      className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
                    >
                      Reintentar análisis
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis results */}
            {analysisPhase === "COMPLETO" && analysisResult && (
              <div className="space-y-4">
                {/* Document type badge */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <M name="gavel" className="!text-xl text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Tipo de documento</p>
                      <p className="text-sm font-bold text-on-surface">
                        {DOC_TYPE_LABELS[analysisResult.doc_type] || analysisResult.doc_type}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-secondary mt-2">
                    Contenido generado por IA — procedencia: AI_GENERATED
                  </p>
                </div>

                {/* Issues section */}
                {analysisResult.issues.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                      <M name="policy" className="!text-base text-primary" />
                      Cuestiones jurídicas ({analysisResult.issue_count})
                    </h2>
                    <div className="space-y-2">
                      {analysisResult.issues.map((issue, i) => (
                        <IssueCard
                          key={i}
                          issue={issue}
                          index={i}
                          relatedArguments={analysisResult.arguments.filter(
                            (a) => a.related_issue === issue.issue,
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Citations section */}
                {analysisResult.citations.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                      <M name="format_quote" className="!text-base text-primary" />
                      Citas detectadas ({analysisResult.citation_count})
                    </h2>
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant divide-y divide-outline-variant/50">
                      {analysisResult.citations.map((cit, i) => (
                        <div key={i} className="p-3 flex items-start gap-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-secondary shrink-0 mt-0.5">
                            {CITATION_TYPE_LABELS[cit.type] || cit.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-on-surface font-medium">{cit.text}</p>
                            {cit.normalized !== cit.text && (
                              <p className="text-[10px] text-secondary mt-0.5">Normalizado: {cit.normalized}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issue selection for search */}
                {searchPhase === "IDLE" && analysisResult.issues.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                      <M name="tune" className="!text-base text-primary" />
                      Seleccionar cuestiones para buscar (opcional)
                    </h2>
                    <p className="text-xs text-secondary mb-3">
                      Deja todas sin seleccionar para buscar por todas las cuestiones. Máximo 5 por búsqueda.
                    </p>
                    <div className="space-y-2">
                      {analysisResult.issues.map((iss, i) => {
                        const isSelected = selectedIssues.includes(iss.issue);
                        return (
                          <button
                            key={i}
                            onClick={() => toggleIssueSelection(iss.issue)}
                            className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 text-on-surface"
                                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center ${
                                isSelected ? "bg-primary text-on-primary" : "border border-outline-variant"
                              }`}>
                                {isSelected && <M name="check" className="!text-xs" />}
                              </span>
                              <span className="flex-1">{iss.issue}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Search button */}
                {searchPhase === "IDLE" && (
                  <button
                    onClick={handleSearchJurisprudence}
                    className="w-full py-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
                  >
                    <M name="search" className="!text-base" />
                    Buscar jurisprudencia relevante
                    {selectedIssues.length > 0 && (
                      <span className="text-[10px] ml-1 opacity-80">({selectedIssues.length} cuestiones)</span>
                    )}
                  </button>
                )}

                {/* Search progress */}
                {(searchPhase === "SEARCHING" || searchPhase === "CLASSIFYING") && (
                  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <M name="search" className="!text-2xl text-primary animate-pulse" />
                      </div>
                      <p className="text-sm font-semibold text-on-surface mb-1">
                        {searchPhase === "SEARCHING" && "Buscando en CENDOJ..."}
                        {searchPhase === "CLASSIFYING" && "Clasificando resultados con IA..."}
                      </p>
                      <p className="text-xs text-secondary mt-1">
                        {searchPhase === "SEARCHING"
                          ? "Consultando jurisprudencia de soporte y contraria"
                          : "Analizando relación entre cada resolución y las cuestiones del documento"}
                      </p>
                      <div className="w-full max-w-xs mt-4 h-1.5 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                          style={{ width: searchPhase === "SEARCHING" ? "40%" : "80%" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Search error */}
                {searchPhase === "ERROR" && (
                  <div className="bg-surface-container-lowest rounded-xl border border-error/30 p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                        <M name="error" className="!text-xl text-error" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-on-surface mb-1">Error en la búsqueda</p>
                        <p className="text-xs text-error mb-3">{searchError}</p>
                        <button
                          onClick={handleSearchJurisprudence}
                          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
                        >
                          Reintentar búsqueda
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search results */}
                {searchPhase === "COMPLETE" && searchResults && (
                  <div className="space-y-4">
                    {/* Performance stats */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center shrink-0">
                          <M name="check_circle" className="!text-xl text-[#15803d]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">Búsqueda completada</p>
                          <p className="text-xs text-secondary">
                            {searchResults.performance.issues_searched} cuestiones · {searchResults.performance.candidates_found} resoluciones encontradas
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-container rounded-lg p-2 text-center">
                          <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Total</p>
                          <p className="text-xs font-bold text-on-surface">{(searchResults.performance.total_ms / 1000).toFixed(1)}s</p>
                        </div>
                        <div className="bg-surface-container rounded-lg p-2 text-center">
                          <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">CENDOJ</p>
                          <p className="text-xs font-bold text-on-surface">{(searchResults.performance.retrieval_ms / 1000).toFixed(1)}s</p>
                        </div>
                        <div className="bg-surface-container rounded-lg p-2 text-center">
                          <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">IA</p>
                          <p className="text-xs font-bold text-on-surface">{(searchResults.performance.ai_ms / 1000).toFixed(1)}s</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-secondary mt-2">
                        Contenido generado por IA — procedencia: AI_GENERATED
                      </p>
                    </div>

                    {/* Results grouped by issue */}
                    {searchResults.results.map((issueResult, irIdx) => (
                      <div key={irIdx}>
                        <h2 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                          <M name="policy" className="!text-base text-primary" />
                          {issueResult.issue_text}
                          <span className="text-xs font-normal text-secondary">({issueResult.candidates.length})</span>
                        </h2>

                        {issueResult.candidates.length === 0 ? (
                          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 text-center">
                            <M name="search_off" className="!text-2xl text-secondary mb-2" />
                            <p className="text-xs text-secondary">Sin resultados de jurisprudencia para esta cuestión</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {issueResult.candidates.map((cand, cIdx) => {
                              const relColors: Record<string, { bg: string; text: string; label: string }> = {
                                SUPPORTS: { bg: "bg-[#dcfce7]", text: "text-[#15803d]", label: "Apoya" },
                                CONTRADICTS: { bg: "bg-[#fee2e2]", text: "text-[#dc2626]", label: "Contradice" },
                                DISTINGUISHES: { bg: "bg-[#fef9c3]", text: "text-[#a16207]", label: "Distingue" },
                                NEUTRAL: { bg: "bg-gray-100", text: "text-gray-600", label: "Neutral" },
                                INSUFFICIENT_EVIDENCE: { bg: "bg-gray-100", text: "text-gray-500", label: "Sin evidencia" },
                              };
                              const rel = relColors[cand.relationship] || relColors.NEUTRAL;
                              const evLabels: Record<string, string> = {
                                FULL_TEXT: "Texto completo",
                                OFFICIAL_SUMMARY: "Resumen oficial",
                                METADATA_ONLY: "Solo metadatos",
                              };

                              return (
                                <div key={cIdx} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-on-surface leading-snug">
                                        {cand.titulo || cand.decision_roj || "Resolución sin título"}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                        {cand.decision_roj && (
                                          <span className="text-[10px] font-mono font-bold text-primary">{cand.decision_roj}</span>
                                        )}
                                        {cand.organo && (
                                          <span className="text-[10px] text-secondary">{cand.organo}</span>
                                        )}
                                        {cand.fecha && (
                                          <span className="text-[10px] text-secondary">{cand.fecha}</span>
                                        )}
                                      </div>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${rel.bg} ${rel.text}`}>
                                      {rel.label}
                                    </span>
                                  </div>

                                  <p className="text-xs text-on-surface-variant leading-relaxed mb-2">{cand.reason}</p>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-secondary">
                                      {evLabels[cand.evidence_basis] || cand.evidence_basis}
                                    </span>
                                    {cand.source_url && (
                                      <a
                                        href={cand.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                                      >
                                        <M name="open_in_new" className="!text-xs" />
                                        Ver PDF
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Gap analysis */}
                    {(searchResults.gap_analysis.issues_without_jurisprudence.length > 0 ||
                      searchResults.gap_analysis.cited_cases_unresolved.length > 0 ||
                      searchResults.gap_analysis.only_lower_court.length > 0 ||
                      searchResults.gap_analysis.missing_contrary.length > 0) && (
                      <div className="bg-surface-container-lowest rounded-xl border border-[#fed7aa] p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <M name="analytics" className="!text-base text-[#c2410c]" />
                          <h2 className="text-sm font-bold text-on-surface">Análisis de brechas</h2>
                        </div>
                        <p className="text-xs text-secondary mb-3">
                          Potenciales áreas de investigación adicional. Esto no constituye asesoramiento jurídico.
                        </p>

                        {searchResults.gap_analysis.issues_without_jurisprudence.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-[#c2410c] uppercase tracking-wider mb-1.5">
                              Cuestiones sin jurisprudencia encontrada
                            </p>
                            <ul className="space-y-1">
                              {searchResults.gap_analysis.issues_without_jurisprudence.map((g, i) => (
                                <li key={i} className="text-xs text-[#9a3412] pl-4 list-disc">{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {searchResults.gap_analysis.cited_cases_unresolved.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-[#c2410c] uppercase tracking-wider mb-1.5">
                              Citas del documento no resueltas en CENDOJ
                            </p>
                            <ul className="space-y-1">
                              {searchResults.gap_analysis.cited_cases_unresolved.map((g, i) => (
                                <li key={i} className="text-xs text-[#9a3412] pl-4 list-disc">{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {searchResults.gap_analysis.only_lower_court.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-[#c2410c] uppercase tracking-wider mb-1.5">
                              Solo autoridad de instancia inferior
                            </p>
                            <ul className="space-y-1">
                              {searchResults.gap_analysis.only_lower_court.map((g, i) => (
                                <li key={i} className="text-xs text-[#9a3412] pl-4 list-disc">{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {searchResults.gap_analysis.missing_contrary.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-[#c2410c] uppercase tracking-wider mb-1.5">
                              Potencial brecha de investigación: sin jurisprudencia contraria identificada
                            </p>
                            <ul className="space-y-1">
                              {searchResults.gap_analysis.missing_contrary.map((g, i) => (
                                <li key={i} className="text-xs text-[#9a3412] pl-4 list-disc">{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons: Save, Copy, Export, Print */}
                    <div className="flex flex-col gap-2">
                      {/* Save to Workspace */}
                      {!saved ? (
                        <button
                          onClick={async () => {
                            if (!uploadResult?.document_id || !analysisResult?.analysis_id) return;
                            setSaving(true);
                            const result = await saveDocument(uploadResult.document_id, analysisResult.analysis_id);
                            setSaving(false);
                            if (result.ok) {
                              setSaved(true);
                              showToast("Guardado en Workspace");
                            } else {
                              showToast(result.error || "Error al guardar", "error");
                            }
                          }}
                          disabled={saving}
                          className="w-full py-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <M name={saving ? "hourglass_empty" : "save"} className="!text-base" />
                          {saving ? "Guardando..." : "Guardar en Workspace"}
                        </button>
                      ) : (
                        <div className="w-full py-3 rounded-lg bg-[#dcfce7] text-[#15803d] text-sm font-semibold flex items-center justify-center gap-2">
                          <M name="check_circle" className="!text-base" />
                          Guardado en Workspace
                        </div>
                      )}

                      {/* Copy + Export row */}
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!analysisResult) return;
                            setCopying(true);
                            const exportData: DocumentExportInput = {
                              filename: uploadResult?.filename || selectedFile?.name || "documento",
                              doc_type: analysisResult.doc_type,
                              issues: analysisResult.issues,
                              arguments: analysisResult.arguments,
                              citations: analysisResult.citations,
                              research_results: searchResults?.results,
                              gap_analysis: searchResults?.gap_analysis,
                            };
                            const md = formatDocumentAnalysisAsMarkdown(exportData);
                            const ok = await copyToClipboard(md);
                            setCopying(false);
                            showToast(ok ? "Copiado al portapapeles" : "Error al copiar", ok ? "success" : "error");
                          }}
                          disabled={copying}
                          className="flex-1 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant font-semibold transition-colors flex items-center justify-center gap-2 border border-outline-variant"
                        >
                          <M name="content_copy" className="!text-base" />
                          Copiar investigación
                        </button>
                        <button
                          onClick={() => {
                            if (!analysisResult) return;
                            const exportData: DocumentExportInput = {
                              filename: uploadResult?.filename || selectedFile?.name || "documento",
                              doc_type: analysisResult.doc_type,
                              issues: analysisResult.issues,
                              arguments: analysisResult.arguments,
                              citations: analysisResult.citations,
                              research_results: searchResults?.results,
                              gap_analysis: searchResults?.gap_analysis,
                            };
                            downloadJSON(exportData, `jurelia-document-${(uploadResult?.filename || "doc").replace(/[^a-zA-Z0-9._-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`);
                            showToast("JSON exportado");
                          }}
                          className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant font-semibold transition-colors flex items-center justify-center gap-2 border border-outline-variant"
                          title="Exportar JSON"
                        >
                          <M name="download" className="!text-base" />
                          JSON
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant font-semibold transition-colors flex items-center justify-center gap-2 border border-outline-variant"
                          title="Imprimir"
                        >
                          <M name="print" className="!text-base" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reset button */}
            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <M name="upload_file" className="!text-base" />
              Analizar otro documento
            </button>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          header, button, .no-print { display: none !important; }
          .bg-surface-container-lowest { background: white !important; border-color: #e5e7eb !important; }
          .text-on-surface { color: #111 !important; }
          .text-secondary { color: #555 !important; }
          .text-primary { color: #1a56db !important; }
          .bg-primary\/10 { background: #eff6ff !important; }
          .border-outline-variant { border-color: #d1d5db !important; }
          .shadow-sm, .shadow-md { box-shadow: none !important; }
          @page { margin: 1.5cm; }
          @page :first {
            margin-top: 0;
          }
          .print-header { display: block !important; text-align: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #111; }
        }
        .print-header { display: none; }
      `}</style>
      <div className="print-header">
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>JURELIA — Análisis de Documento Jurídico</h1>
        <p style={{ fontSize: '0.75rem', color: '#666' }}>{new Date().toLocaleDateString('es-ES')} · Generado con IA — AI_GENERATED</p>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function DocumentsPage() {
  return <DocumentsContent />;
}