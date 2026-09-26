"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  helpEntries,
  globalEntries,
  privacyEntry,
  getHelpByRoute,
  searchHelp,
  getRelatedEntries,
  getEntryById,
} from "@/lib/help/help-content";
import type { HelpEntry } from "@/lib/help/help-types";

/* ── Singleton opener ── */
let _openHelp: ((route?: string) => void) | null = null;

export function openHelpDrawer(route?: string) {
  if (_openHelp) _openHelp(route);
}

/* ── Section renderer ── */
function HelpSection({ entry }: { entry: HelpEntry }) {
  const [expanded, setExpanded] = useState<string | null>(entry.sections[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-1">
      {entry.sections.map((sec) => (
        <div key={sec.id} className="border-b border-outline-variant/30 last:border-b-0">
          <button
            onClick={() => setExpanded(expanded === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between py-2.5 text-xs font-semibold text-on-surface hover:text-primary transition-colors"
          >
            <span>{sec.title}</span>
            <span
              className="material-symbols-outlined !text-sm text-on-surface-variant transition-transform"
              style={{ transform: expanded === sec.id ? "rotate(180deg)" : "rotate(0)" }}
            >
              expand_more
            </span>
          </button>
          {expanded === sec.id && (
            <div className="pb-3 text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">
              {sec.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Main drawer ── */

export default function HelpDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<HelpEntry | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HelpEntry[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  /* Register opener */
  useEffect(() => {
    _openHelp = (route?: string) => {
      const entry = route ? getHelpByRoute(route) : getHelpByRoute(pathname);
      setActiveEntry(entry || getHelpByRoute("/") || null);
      setQuery("");
      setSearchResults([]);
      setOpen(true);
    };
    return () => {
      _openHelp = null;
    };
  }, [pathname]);

  /* Search */
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchResults(searchHelp(query));
  }, [query]);

  /* Focus trap + ESC */
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    setTimeout(() => inputRef.current?.focus(), 50);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      previousFocus.current?.focus();
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const navigateToEntry = useCallback((entryId: string) => {
    const entry = getEntryById(entryId);
    if (entry) {
      setActiveEntry(entry);
      setQuery("");
      setSearchResults([]);
    }
  }, []);

  if (!open) return null;

  const related = activeEntry ? getRelatedEntries(activeEntry.id) : [];
  const showingSearch = query.trim().length > 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[90] animate-[fadeIn_.2s_ease-out] lg:bg-black/20"
        onClick={close}
        aria-hidden="true"
      />
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-label="Ayuda contextual"
        aria-modal="true"
        className="fixed right-0 top-0 z-[95] h-full w-full sm:w-[380px] bg-surface-container-lowest shadow-2xl flex flex-col animate-[slideRight_.25s_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/40 shrink-0">
          <span className="material-symbols-outlined text-primary !text-xl">help</span>
          <h2 className="text-sm font-semibold text-on-surface flex-1">Ayuda</h2>
          <button
            onClick={close}
            aria-label="Cerrar ayuda"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined !text-lg text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-outline-variant/30 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined !text-base absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en la ayuda..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {showingSearch ? (
            /* Search results */
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">
                {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
              </p>
              {searchResults.length === 0 && (
                <p className="text-xs text-on-surface-variant">
                  No se encontraron resultados. Pruebe con otros términos.
                </p>
              )}
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigateToEntry(r.id)}
                  className="text-left px-3 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined !text-sm text-primary">{r.icon}</span>
                    <span className="text-xs font-semibold text-on-surface">{r.title}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2">{r.summary}</p>
                </button>
              ))}
            </div>
          ) : activeEntry ? (
            /* Entry detail */
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined !text-base text-primary">{activeEntry.icon}</span>
                  <h3 className="text-sm font-bold text-on-surface">{activeEntry.title}</h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">{activeEntry.summary}</p>
              </div>

              <HelpSection entry={activeEntry} />

              {/* Related */}
              {related.length > 0 && (
                <div className="pt-2 border-t border-outline-variant/30">
                  <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1.5">
                    Temas relacionados
                  </p>
                  <div className="flex flex-col gap-1">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => navigateToEntry(r.id)}
                        className="flex items-center gap-2 text-xs text-primary hover:text-primary-container transition-colors py-1"
                      >
                        <span className="material-symbols-outlined !text-sm">{r.icon}</span>
                        {r.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">Seleccione un tema para ver la ayuda.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-outline-variant/40 shrink-0">
          <button
            onClick={() => {
              setActiveEntry(null);
              setQuery("");
              setSearchResults([]);
              // Navigate to help page
              window.location.href = "/help";
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-semibold text-on-surface-variant"
          >
            <span className="material-symbols-outlined !text-sm">menu_book</span>
            Centro de ayuda completo
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}