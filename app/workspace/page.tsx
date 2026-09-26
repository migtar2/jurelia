"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as store from "@/lib/workspace/store";
import type { WorkspaceItem, SavedDocument } from "@/lib/workspace/types";
import ToastContainer, { showToast } from "@/components/Toast";
import * as compareStore from "@/lib/compare/store";
import { useAuth } from "@/lib/auth/context";
import { openHelpDrawer } from "@/components/HelpDrawer";
import { formatDocumentAnalysisAsMarkdown, copyToClipboard, downloadJSON, type DocumentExportInput } from "@/lib/export-utils";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function WorkspaceContent() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // News analyses state
  const [newsAnalyses, setNewsAnalyses] = useState<Array<{
    id: string;
    article_url: string;
    article_title: string | null;
    publication: string | null;
    published_at: string | null;
    decision_roj: string | null;
    decision_ecli: string | null;
    match_status: string;
    match_confidence: number | null;
    analysis_basis: string | null;
    created_at: string;
  }>>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsExpanded, setNewsExpanded] = useState(true);

  // Saved documents state
  const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsExpanded, setDocsExpanded] = useState(true);

  // Migration state
  const [showMigration, setShowMigration] = useState(false);
  const [legacyItems, setLegacyItems] = useState<WorkspaceItem[]>([]);
  const [migrating, setMigrating] = useState(false);

  // Filters
  const [filterText, setFilterText] = useState("");
  const [filterFolder, setFilterFolder] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterType, setFilterType] = useState<"" | "decision" | "comparison" | "proposition">("");
  const [sort, setSort] = useState<"saved_desc" | "saved_asc" | "court" | "fecha_desc" | "fecha_asc">("saved_desc");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Detail panel
  const [detail, setDetail] = useState<WorkspaceItem | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editFolders, setEditFolders] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newFolder, setNewFolder] = useState("");

  // Folder management
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [renameOld, setRenameOld] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; searchParams: unknown; createdAt: string }[]>([]);
  const [existingAlerts, setExistingAlerts] = useState<Set<string>>(new Set());
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [alertSearchId, setAlertSearchId] = useState<string | null>(null);
  const [alertSearchName, setAlertSearchName] = useState("");
  const [alertName, setAlertName] = useState("");
  const [alertFrequency, setAlertFrequency] = useState<"daily" | "weekly">("daily");

  // Import
  const fileRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Check for legacy localStorage data
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    try {
      const raw = localStorage.getItem("jurelia-workspace");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLegacyItems(parsed);
          setShowMigration(true);
        }
      }
    } catch {
      // ignore
    }
  }, [user]);

  // Migrate legacy data
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      let count = 0;
      for (const item of legacyItems) {
        const result = await store.add(item, {
          folders: item.folders,
          tags: item.tags,
          notes: item.notes,
        });
        if (result.ok) count++;
      }
      showToast(`${count} elemento${count !== 1 ? "s" : ""} migrado${count !== 1 ? "s" : ""}`);
      localStorage.removeItem("jurelia-workspace");
      localStorage.removeItem("jurelia-folders");
      setShowMigration(false);
      setLegacyItems([]);
      refresh();
    } catch {
      showToast("Error al migrar datos", "error");
    } finally {
      setMigrating(false);
    }
  };

  const dismissMigration = () => {
    setShowMigration(false);
  };

  /* ── Load data ── */
  const refresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const [results, folderList, tagList, count] = await Promise.all([
        store.search({ text: filterText, folder: filterFolder, tag: filterTag, sort }),
        store.listFolders(),
        store.listAllTags(),
        store.count(),
      ]);

      let filtered = results;
      if (filterType) {
        filtered = results.filter((i) => (i.type || "decision") === filterType);
      }

      setItems(filtered);
      setFolders(folderList);
      setAllTags(tagList);
      setTotalCount(count);
      setSelected(new Set());
      setSelectAll(false);
    } catch {
      // silently fail
    } finally {
      setDataLoading(false);
    }
  }, [filterText, filterFolder, filterTag, filterType, sort]);

  useEffect(() => {
    if (user) refresh();
  }, [refresh, user]);

  // Load saved searches and existing alerts
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/workspace/searches").then(r => r.ok ? r.json() : { searches: [] }),
      fetch("/api/alerts").then(r => r.ok ? r.json() : { alerts: [] }),
    ]).then(([searchData, alertData]) => {
      setSavedSearches(searchData.searches || []);
      const searchIds = new Set<string>((alertData.alerts || []).map((a: { savedSearchId: string }) => a.savedSearchId));
      setExistingAlerts(searchIds);
    }).catch(() => {});
  }, [user]);

  // Load news analyses
  useEffect(() => {
    if (!user) return;
    setNewsLoading(true);
    fetch("/api/workspace/news")
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(data => { setNewsAnalyses(data.analyses || []); })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [user]);

  // Load saved documents
  useEffect(() => {
    if (!user) return;
    setDocsLoading(true);
    store.listSavedDocuments()
      .then(data => { setSavedDocs(data); })
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [user]);

  /* ── Selection ── */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(items.map((i) => i.id)));
      setSelectAll(true);
    }
  };

  /* ── Detail panel ── */
  const openDetail = (item: WorkspaceItem) => {
    setDetail(item);
    setEditNotes(item.notes);
    setEditTags([...item.tags]);
    setEditFolders([...item.folders]);
  };

  const closeDetail = () => setDetail(null);

  const saveDetail = async () => {
    if (!detail) return;
    await store.update(detail.id, { notes: editNotes, tags: editTags, folders: editFolders });
    showToast("Cambios guardados");
    closeDetail();
    refresh();
  };

  /* ── Bulk actions ── */
  const bulkRemove = async () => {
    const count = await store.removeMany([...selected]);
    showToast(`${count} elemento${count !== 1 ? "s" : ""} eliminado${count !== 1 ? "s" : ""}`);
    refresh();
  };

  const bulkMoveToFolder = async (folder: string) => {
    for (const id of selected) {
      const item = items.find((i) => i.id === id);
      if (item && !item.folders.includes(folder)) {
        await store.update(id, { folders: [...item.folders, folder] });
      }
    }
    showToast(`Movido${selected.size > 1 ? "s" : ""} a "${folder}"`);
    refresh();
  };

  const bulkAddTag = async (tag: string) => {
    for (const id of selected) {
      const item = items.find((i) => i.id === id);
      if (item && !item.tags.includes(tag)) {
        await store.update(id, { tags: [...item.tags, tag] });
      }
    }
    showToast(`Etiqueta "${tag}" añadida`);
    refresh();
  };

  /* ── Export / Import ── */
  const handleExport = () => {
    store.downloadExport();
    showToast("Workspace exportado", "info");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = await store.importJSON(reader.result as string);
      if (result.ok) {
        showToast(`${result.count} elemento${result.count !== 1 ? "s" : ""} importado${result.count !== 1 ? "s" : ""}`);
      } else {
        showToast(result.error, "error");
      }
      refresh();
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ── Folder manager ── */
  const handleCreateFolder = async () => {
    if (await store.createFolder(newFolder)) {
      showToast(`Carpeta "${newFolder}" creada`);
      setNewFolder("");
      refresh();
    }
  };

  const handleRenameFolder = async () => {
    if (renameOld && await store.renameFolder(renameOld, renameVal)) {
      showToast(`Renombrada a "${renameVal}"`);
      setRenameOld(null);
      setRenameVal("");
      refresh();
    }
  };

  const handleDeleteFolder = async (name: string) => {
    await store.deleteFolder(name);
    showToast(`Carpeta "${name}" eliminada`, "info");
    refresh();
  };

  const removeItem = async (id: string) => {
    await store.remove(id);
    showToast("Elemento eliminado", "info");
    if (detail?.id === id) closeDetail();
    refresh();
  };

  const openCreateAlert = (searchId: string, searchName: string) => {
    setAlertSearchId(searchId);
    setAlertSearchName(searchName);
    setAlertName(`Alerta: ${searchName}`);
    setAlertFrequency("daily");
    setShowCreateAlert(true);
  };

  const handleCreateAlert = async () => {
    if (!alertSearchId) return;
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saved_search_id: alertSearchId,
          name: alertName,
          frequency: alertFrequency,
        }),
      });
      if (res.ok) {
        showToast("Alerta creada");
        setExistingAlerts(prev => new Set(prev).add(alertSearchId));
        setShowCreateAlert(false);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Error al crear alerta", "error");
      }
    } catch {
      showToast("Error al crear alerta", "error");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  if (authLoading || (!user && typeof window !== "undefined")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-secondary text-sm">Cargando...</div>
      </div>
    );
  }

  const getItemTypeBadge = (item: WorkspaceItem) => {
    const t = item.type || "decision";
    if (t === "comparison") return { icon: "compare", label: "Comparación", color: "bg-secondary-container text-on-secondary-container" };
    if (t === "proposition") return { icon: "policy", label: "Proposición", color: "bg-[#fef9c3] text-[#854d0e]" };
    return { icon: "gavel", label: "Resolución", color: "bg-primary/10 text-primary" };
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Migration Banner */}
      {showMigration && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
          <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-on-surface">
              <strong>Tienes {legacyItems.length} elemento{legacyItems.length !== 1 ? "s" : ""} guardado{legacyItems.length !== 1 ? "s" : ""} localmente.</strong>{" "}
              ¿Quieres migrarlos a tu cuenta?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                {migrating ? "Migrando..." : "Migrar"}
              </button>
              <button
                onClick={dismissMigration}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[1360px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-9 h-9 rounded-lg object-contain" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Workspace</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-secondary hidden sm:inline">{user?.email}</span>
            <button onClick={() => setShowFolderManager(!showFolderManager)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="folder_open" className="!text-sm" />
              <span className="hidden sm:inline">Carpetas</span>
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="download" className="!text-sm" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="upload" className="!text-sm" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Link href="/alerts" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="notifications" className="!text-sm" />
              <span className="hidden sm:inline">Alertas</span>
            </Link>
            <Link href="/documents" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="description" className="!text-sm" />
              <span className="hidden sm:inline">Documentos</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">
              <M name="search" className="!text-sm" />
              <span className="hidden sm:inline">Buscar</span>
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

      {/* Folder Manager */}
      {showFolderManager && (
        <div className="max-w-[1360px] mx-auto px-4 lg:px-8 py-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5"><M name="folder_open" className="!text-sm text-primary" />Gestión de carpetas</h3>
              <button onClick={() => setShowFolderManager(false)} className="text-on-surface-variant hover:text-on-surface"><M name="close" className="!text-base" /></button>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }} placeholder="Nueva carpeta..." className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={handleCreateFolder} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">Crear</button>
            </div>
            {folders.length === 0 ? (
              <p className="text-xs text-secondary">No hay carpetas creadas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {folders.map((f) => (
                  <div key={f} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs">
                    {renameOld === f ? (
                      <>
                        <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(); }} className="w-24 px-1.5 py-0.5 rounded bg-surface-container-lowest text-xs focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
                        <button onClick={handleRenameFolder} className="text-primary hover:text-primary-container"><M name="check" className="!text-sm" /></button>
                        <button onClick={() => setRenameOld(null)} className="text-on-surface-variant hover:text-on-surface"><M name="close" className="!text-sm" /></button>
                      </>
                    ) : (
                      <>
                        <span className="text-on-surface font-medium">{f}</span>
                        <button onClick={() => { setRenameOld(f); setRenameVal(f); }} className="text-on-surface-variant hover:text-primary"><M name="edit" className="!text-xs" /></button>
                        <button onClick={() => handleDeleteFolder(f)} className="text-on-surface-variant hover:text-error"><M name="delete" className="!text-xs" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Searches & Alerts */}
      {savedSearches.length > 0 && (
        <div className="max-w-[1360px] mx-auto px-4 lg:px-8 py-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <M name="saved_search" className="!text-sm text-primary" />
                Búsquedas guardadas
              </h3>
              <Link href="/alerts" className="text-[10px] text-primary hover:text-primary-container font-semibold flex items-center gap-1">
                <M name="notifications" className="!text-xs" />
                Ver alertas
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {savedSearches.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container">
                  <div className="flex items-center gap-2 min-w-0">
                    <M name="search" className="!text-sm text-secondary shrink-0" />
                    <span className="text-xs text-on-surface truncate">{s.name}</span>
                  </div>
                  {existingAlerts.has(s.id) ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#15803d] text-[10px] font-semibold shrink-0">
                      <M name="notifications_active" className="!text-[10px]" />
                      Alerta activa
                    </span>
                  ) : (
                    <button
                      onClick={() => openCreateAlert(s.id, s.name)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors shrink-0"
                    >
                      <M name="add_alert" className="!text-[10px]" />
                      Crear alerta
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Documents Section ── */}
      {user && (savedDocs.length > 0 || docsLoading) && (
        <div className="max-w-[1360px] mx-auto px-4 lg:px-8 pt-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
            <div
              className="flex items-center justify-between mb-3 cursor-pointer"
              onClick={() => setDocsExpanded(!docsExpanded)}
            >
              <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <M name="description" className="!text-sm text-primary" />
                Documentos analizados
                {savedDocs.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">{savedDocs.length}</span>
                )}
              </h3>
              <M name={docsExpanded ? "expand_less" : "expand_more"} className="!text-sm text-secondary" />
            </div>
            {docsExpanded && (
              <div className="flex flex-col gap-2">
                {docsLoading ? (
                  <div className="text-xs text-secondary text-center py-3">Cargando...</div>
                ) : savedDocs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container">
                    <div className="flex items-center gap-2 min-w-0">
                      <M name="description" className="!text-sm text-secondary shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs text-on-surface truncate block font-medium">{d.filename}</span>
                        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                          {d.doc_type && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{d.doc_type}</span>}
                          {d.original_type && <span>{d.original_type.toUpperCase()}</span>}
                          <span>{d.issue_count} cuestiones · {d.argument_count} args · {d.citation_count} citas</span>
                          <span>{new Date(d.saved_at).toLocaleDateString("es-ES")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Copy markdown */}
                      <button
                        onClick={async () => {
                          if (!d.analysis_snapshot) return;
                          const snap = d.analysis_snapshot as Record<string, unknown>;
                          const exportData: DocumentExportInput = {
                            filename: d.filename,
                            original_type: d.original_type ?? undefined,
                            doc_type: (snap.docType as string) || d.doc_type || "OTRO",
                            issues: (snap.issues as DocumentExportInput["issues"]) || [],
                            arguments: (snap.arguments as DocumentExportInput["arguments"]) || [],
                            citations: (snap.citations as DocumentExportInput["citations"]) || [],
                            research_results: d.research_snapshot ? (d.research_snapshot as unknown as DocumentExportInput["research_results"]) : undefined,
                          };
                          const md = formatDocumentAnalysisAsMarkdown(exportData);
                          const ok = await copyToClipboard(md);
                          showToast(ok ? "Copiado" : "Error", ok ? "success" : "error");
                        }}
                        className="text-on-surface-variant hover:text-primary p-1 rounded"
                        title="Copiar análisis"
                      >
                        <M name="content_copy" className="!text-sm" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={async () => {
                          await store.deleteSavedDocument(d.id);
                          setSavedDocs(prev => prev.filter(x => x.id !== d.id));
                          showToast("Documento eliminado", "info");
                        }}
                        className="text-error hover:text-error-container p-1 rounded"
                        title="Eliminar"
                      >
                        <M name="delete" className="!text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── News Analyses Section ── */}
      {user && (newsAnalyses.length > 0 || newsLoading) && (
        <div className="max-w-[1360px] mx-auto px-4 lg:px-8 pt-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
            <div
              className="flex items-center justify-between mb-3 cursor-pointer"
              onClick={() => setNewsExpanded(!newsExpanded)}
            >
              <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <M name="newspaper" className="!text-sm text-primary" />
                Análisis de noticias
                {newsAnalyses.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">{newsAnalyses.length}</span>
                )}
              </h3>
              <M name={newsExpanded ? "expand_less" : "expand_more"} className="!text-sm text-secondary" />
            </div>
            {newsExpanded && (
              <div className="flex flex-col gap-2">
                {newsLoading ? (
                  <div className="text-xs text-secondary text-center py-3">Cargando...</div>
                ) : newsAnalyses.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-container">
                    <div className="flex items-center gap-2 min-w-0">
                      <M name="article" className="!text-sm text-secondary shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs text-on-surface truncate block">{a.article_title || a.article_url}</span>
                        <span className="text-[10px] text-on-surface-variant">{a.publication || "Desconocido"} · {new Date(a.created_at).toLocaleDateString("es-ES")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.match_status && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.match_status === "VERIFIED" ? "bg-[#dcfce7] text-[#15803d]" :
                          a.match_status === "PROBABLE" ? "bg-[#fef9c3] text-[#a16207]" :
                          a.match_status === "AMBIGUOUS" ? "bg-[#fef3c7] text-[#b45309]" :
                          "bg-gray-100 text-gray-600"
                        }`}>{a.match_status}</span>
                      )}
                      <a
                        href={`/news-compare?url=${encodeURIComponent(a.article_url)}`}
                        className="text-primary hover:text-primary-container"
                        title="Abrir análisis"
                      >
                        <M name="open_in_new" className="!text-sm" />
                      </a>
                      <button
                        onClick={async () => {
                          await fetch(`/api/workspace/news/${a.id}`, { method: "DELETE" });
                          setNewsAnalyses(prev => prev.filter(x => x.id !== a.id));
                        }}
                        className="text-error hover:text-error-container"
                        title="Eliminar"
                      >
                        <M name="delete" className="!text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1360px] mx-auto px-4 lg:px-8 py-6">
        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-secondary text-sm">Cargando workspace...</div>
          </div>
        ) : totalCount === 0 ? (
          /* ── Empty State ── */
          <div className="flex flex-col items-center justify-center py-20">
            <M name="workspaces" className="!text-6xl text-outline-variant mb-4" />
            <p className="text-base font-semibold text-on-surface mb-1">No hay elementos guardados</p>
            <p className="text-sm text-secondary mb-6 text-center max-w-md">Busca y guarda resoluciones, comparaciones y proposiciones desde las distintas secciones.</p>
            <Link href="/" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center gap-2">
              <M name="search" className="!text-base" />
              Ir a buscar
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── List Panel ── */}
            <div className={`flex-1 flex flex-col gap-4 ${detail ? "lg:max-w-[60%]" : ""}`}>
              {/* Filters */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <M name="search" className="!text-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Buscar en workspace..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)} className="px-2 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                      <option value="">Todos los tipos</option>
                      <option value="decision">Resoluciones</option>
                      <option value="comparison">Comparaciones</option>
                      <option value="proposition">Proposiciones</option>
                    </select>
                    <select value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} className="px-2 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                      <option value="">Todas las carpetas</option>
                      {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="px-2 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                      <option value="">Todas las etiquetas</option>
                      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="px-2 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                      <option value="saved_desc">Más recientes</option>
                      <option value="saved_asc">Más antiguos</option>
                      <option value="court">Tribunal</option>
                      <option value="fecha_desc">Fecha ↓</option>
                      <option value="fecha_asc">Fecha ↑</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bulk actions bar */}
              {selected.size > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold text-primary">{selected.size} seleccionada{selected.size > 1 ? "s" : ""}</span>
                  <div className="h-4 w-px bg-primary/20" />
                  {folders.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-secondary">Mover a:</span>
                      {folders.map((f) => (
                        <button key={f} onClick={() => bulkMoveToFolder(f)} className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-[10px] font-medium text-on-surface-variant hover:bg-primary hover:text-on-primary transition-colors border border-outline-variant">{f}</button>
                      ))}
                    </div>
                  )}
                  <button onClick={bulkRemove} className="ml-auto px-3 py-1 rounded-lg bg-error-container text-error text-[10px] font-semibold hover:bg-error hover:text-on-error transition-colors flex items-center gap-1">
                    <M name="delete" className="!text-xs" />
                    Eliminar
                  </button>
                  <button
                    onClick={() => {
                      const sel = [...selected];
                      const decisionItems = sel
                        .map((id) => items.find((i) => i.id === id))
                        .filter((item): item is WorkspaceItem => !!item && (item.type || "decision") === "decision");
                      if (decisionItems.length < 2) { showToast("Selecciona al menos 2 resoluciones para comparar", "info"); return; }
                      compareStore.clear();
                      for (const item of decisionItems.slice(0, 2)) {
                        compareStore.toggle({
                          roj: item.roj, ecli: item.ecli, organo: item.organo, fecha: item.fecha,
                          titulo: item.titulo, ponente: item.ponente, url_pdf: item.url_pdf, resumen: item.resumen,
                        });
                      }
                      window.location.href = "/compare";
                    }}
                    className="px-3 py-1 rounded-lg bg-secondary-container text-on-secondary-container text-[10px] font-semibold hover:bg-secondary transition-colors flex items-center gap-1"
                  >
                    <M name="compare" className="!text-xs" />
                    Comparar
                  </button>
                </div>
              )}

              {/* Results header */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-secondary">
                  <strong className="text-on-surface">{items.length}</strong> elemento{items.length !== 1 ? "s" : ""} guardado{items.length !== 1 ? "s" : ""}
                  {filterText || filterFolder || filterTag || filterType ? ` (de ${totalCount} total)` : ""}
                </p>
                <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer select-none">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="accent-primary w-3.5 h-3.5" />
                  Todas
                </label>
              </div>

              {/* List */}
              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const badge = getItemTypeBadge(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => openDetail(item)}
                      className={`bg-surface-container-lowest rounded-xl shadow-sm border p-4 hover:shadow-md transition-all cursor-pointer group ${
                        detail?.id === item.id ? "border-primary/40 shadow-md" : "border-outline-variant hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-primary w-3.5 h-3.5 mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badge.color}`}>
                              <M name={badge.icon} className="!text-[10px]" />
                              {badge.label}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-on-surface mb-1.5 group-hover:text-primary transition-colors line-clamp-2">{item.titulo}</h3>
                          {(item.type || "decision") === "decision" && (
                            <>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-secondary mb-1.5">
                                {item.organo && <span className="flex items-center gap-1"><M name="account_balance" className="!text-xs" />{item.organo}</span>}
                                {item.fecha && <span className="flex items-center gap-1"><M name="calendar_today" className="!text-xs" />{item.fecha}</span>}
                                {item.ponente && <span className="flex items-center gap-1"><M name="person" className="!text-xs" />{item.ponente}</span>}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {item.roj && <span className="px-1.5 py-0.5 rounded bg-surface-container text-primary text-[10px] font-mono font-semibold">ROJ: {item.roj}</span>}
                                {item.ecli && <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold">ECLI: {item.ecli}</span>}
                              </div>
                            </>
                          )}
                          {item.type === "comparison" && item.comparisonData && (
                            <p className="text-[11px] text-secondary mb-1.5">
                              {item.comparisonData.decisionA.roj} vs {item.comparisonData.decisionB.roj} · {item.comparisonData.sections.length} secciones
                            </p>
                          )}
                          {item.type === "proposition" && item.propositionData && (
                            <p className="text-[11px] text-secondary mb-1.5">
                              {item.propositionData.total_analyzed} resoluciones · {item.propositionData.counts.supporting} favorables · {item.propositionData.counts.contradicting} contrarias
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {item.folders.map((f) => (
                              <span key={f} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-0.5">
                                <M name="folder" className="!text-[10px]" />{f}
                              </span>
                            ))}
                            {item.tags.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[10px] font-medium">{t}</span>
                            ))}
                          </div>
                          {item.notes && <p className="text-[11px] text-on-surface-variant mt-1.5 line-clamp-1 italic">📝 {item.notes}</p>}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title="Eliminar"
                        >
                          <M name="delete_outline" className="!text-base" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Detail Panel ── */}
            {detail && (
              <div className="lg:w-[40%] lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-5 flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {(() => { const badge = getItemTypeBadge(detail); return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badge.color} mb-2`}>
                          <M name={badge.icon} className="!text-[10px]" />
                          {badge.label}
                        </span>
                      ); })()}
                      <h2 className="text-base font-bold text-on-surface leading-snug">{detail.titulo}</h2>
                    </div>
                    <button onClick={closeDetail} className="text-on-surface-variant hover:text-on-surface shrink-0"><M name="close" /></button>
                  </div>

                  {/* Meta */}
                  {(detail.type || "decision") === "decision" && (
                    <>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary">
                        {detail.organo && <span className="flex items-center gap-1"><M name="account_balance" className="!text-sm" />{detail.organo}</span>}
                        {detail.fecha && <span className="flex items-center gap-1"><M name="calendar_today" className="!text-sm" />{detail.fecha}</span>}
                        {detail.ponente && <span className="flex items-center gap-1"><M name="person" className="!text-sm" />{detail.ponente}</span>}
                      </div>

                      {/* Identifiers */}
                      <div className="flex flex-wrap gap-2">
                        {detail.roj && <span className="px-2 py-1 rounded-lg bg-surface-container text-primary text-[11px] font-mono font-semibold">ROJ: {detail.roj}</span>}
                        {detail.ecli && <span className="px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant text-[11px] font-mono font-semibold">ECLI: {detail.ecli}</span>}
                      </div>

                      {/* Summary */}
                      {detail.resumen && (
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Resumen CENDOJ</h4>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{detail.resumen}</p>
                        </div>
                      )}

                      {/* AI Summary */}
                      {detail.aiSummary && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                          <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                            <M name="auto_awesome" className="!text-sm" />Resumen IA
                          </h4>
                          <div className="space-y-2 text-xs text-on-surface-variant">
                            {Object.entries(detail.aiSummary).map(([key, val]) => {
                              if (typeof val !== "string" || key === "provenance") return null;
                              const labels: Record<string, string> = {
                                facts_summary: "Hechos",
                                legal_question: "Cuestión jurídica",
                                court_reasoning: "Razonamiento",
                                holding: "Doctrina",
                                result: "Resultado",
                                relevant_excerpt: "Extracto",
                              };
                              return (
                                <div key={key}>
                                  <span className="text-[10px] font-semibold text-secondary">{labels[key] ?? key}: </span>
                                  <span>{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Comparison detail */}
                  {detail.type === "comparison" && detail.comparisonData && (
                    <div className="space-y-3">
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Resolución A</h4>
                        <p className="text-xs text-on-surface font-medium">{detail.comparisonData.decisionA.titulo}</p>
                        <p className="text-[11px] text-secondary">ROJ: {detail.comparisonData.decisionA.roj}</p>
                      </div>
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Resolución B</h4>
                        <p className="text-xs text-on-surface font-medium">{detail.comparisonData.decisionB.titulo}</p>
                        <p className="text-[11px] text-secondary">ROJ: {detail.comparisonData.decisionB.roj}</p>
                      </div>
                      {detail.comparisonData.sections.length > 0 && (
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Secciones comparadas</h4>
                          <div className="space-y-1">
                            {detail.comparisonData.sections.map((s) => (
                              <p key={s.key} className="text-xs text-on-surface-variant">• {s.label}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {detail.comparisonData.evidence_summary && (
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Confianza</h4>
                          <p className="text-xs text-on-surface-variant">{detail.comparisonData.evidence_summary.confidence}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proposition detail */}
                  {detail.type === "proposition" && detail.propositionData && (
                    <div className="space-y-3">
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Proposición</h4>
                        <p className="text-xs text-on-surface italic">&ldquo;{detail.propositionData.proposition}&rdquo;</p>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { count: detail.propositionData.counts.supporting, label: "Apoyan", color: "bg-[#dcfce7] text-[#15803d]" },
                          { count: detail.propositionData.counts.contradicting, label: "Contradicen", color: "bg-[#fecaca] text-[#991b1b]" },
                          { count: detail.propositionData.counts.distinguishing, label: "Distinguen", color: "bg-[#fef9c3] text-[#854d0e]" },
                          { count: detail.propositionData.counts.neutral, label: "Neutrales", color: "bg-surface-container text-secondary" },
                          { count: detail.propositionData.counts.insufficient_evidence, label: "Insuf.", color: "bg-secondary-container text-on-secondary-container" },
                        ].map((s) => (
                          <div key={s.label} className={`${s.color} rounded-lg p-2 text-center`}>
                            <p className="text-sm font-bold">{s.count}</p>
                            <p className="text-[8px] font-semibold uppercase">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Resoluciones analizadas</h4>
                        <p className="text-xs text-on-surface-variant">{detail.propositionData.total_analyzed} de {detail.propositionData.total_decisions_found} encontradas</p>
                      </div>
                    </div>
                  )}

                  <hr className="border-outline-variant" />

                  {/* Folders */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1.5">Carpetas</h4>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {editFolders.map((f) => (
                        <span key={f} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-1">
                          <M name="folder" className="!text-[10px]" />{f}
                          <button onClick={() => setEditFolders(editFolders.filter((x) => x !== f))} className="hover:text-error">×</button>
                        </span>
                      ))}
                    </div>
                    {folders.filter((f) => !editFolders.includes(f)).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {folders.filter((f) => !editFolders.includes(f)).map((f) => (
                          <button key={f} onClick={() => setEditFolders([...editFolders, f])} className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] text-on-surface-variant hover:bg-surface-container-high transition-colors">+ {f}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1.5">Etiquetas</h4>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {editTags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-medium flex items-center gap-1">
                          {t}
                          <button onClick={() => setEditTags(editTags.filter((x) => x !== t))} className="hover:text-error">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const t = newTag.trim(); if (t && !editTags.includes(t)) { setEditTags([...editTags, t]); setNewTag(""); } } }} placeholder="Añadir etiqueta..." className="flex-1 px-2 py-1 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
                      <button onClick={() => { const t = newTag.trim(); if (t && !editTags.includes(t)) { setEditTags([...editTags, t]); setNewTag(""); } }} className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">+</button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1.5">Notas privadas</h4>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Escribe tus notas..."
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button onClick={saveDetail} className="w-full py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5">
                      <M name="save" className="!text-sm" />
                      Guardar cambios
                    </button>
                    <div className="flex gap-2">
                      {(detail.type || "decision") === "decision" && detail.url_pdf && (
                        <a href={detail.url_pdf} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface-variant text-center transition-colors flex items-center justify-center gap-1.5">
                          <M name="open_in_new" className="!text-sm" />
                          Abrir PDF
                        </a>
                      )}
                      <button onClick={() => { removeItem(detail.id); }} className="px-4 py-2 rounded-lg bg-error-container text-error text-xs font-semibold hover:bg-error hover:text-on-error transition-colors flex items-center justify-center gap-1.5">
                        <M name="delete" className="!text-sm" />
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-outline text-center">Guardado: {new Date(detail.savedAt).toLocaleString("es-ES")}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateAlert(false)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-on-surface mb-1">Crear alerta</h3>
            <p className="text-xs text-secondary mb-4">Búsqueda: {alertSearchName}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Nombre de la alerta</label>
                <input
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Frecuencia</label>
                <select
                  value={alertFrequency}
                  onChange={(e) => setAlertFrequency(e.target.value as "daily" | "weekly")}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateAlert(false)}
                className="flex-1 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAlert}
                className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5"
              >
                <M name="add_alert" className="!text-sm" />
                Crear alerta
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

export default function WorkspacePage() {
  return <WorkspaceContent />;
}