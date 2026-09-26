"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  helpEntries,
  helpCategories,
  globalEntries,
  privacyEntry,
  faqItems,
  searchHelp,
  getEntryById,
} from "@/lib/help/help-content";
import type { HelpEntry } from "@/lib/help/help-types";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

/* ── FAQ accordion ── */
function FAQAccordion({ items }: { items: typeof faqItems }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div key={item.id} className="border border-outline-variant/40 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors text-left"
          >
            <span className="pr-4">{item.question}</span>
            <M
              name="expand_more"
              className={`!text-sm text-on-surface-variant shrink-0 transition-transform ${
                openId === item.id ? "rotate-180" : ""
              }`}
            />
          </button>
          {openId === item.id && (
            <div className="px-4 pb-3 text-xs text-on-surface-variant leading-relaxed">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Entry detail view ── */
function EntryDetail({ entry, onBack }: { entry: HelpEntry; onBack: () => void }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(entry.sections[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary-container transition-colors self-start"
      >
        <M name="arrow_back" className="!text-sm" />
        Volver al índice
      </button>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <M name={entry.icon} className="!text-lg text-primary" />
          <h2 className="text-base font-bold text-on-surface">{entry.title}</h2>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">{entry.summary}</p>
      </div>
      <div className="flex flex-col gap-1">
        {entry.sections.map((sec) => (
          <div key={sec.id} className="border border-outline-variant/40 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === sec.id ? null : sec.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <span>{sec.title}</span>
              <M
                name="expand_more"
                className={`!text-sm text-on-surface-variant shrink-0 transition-transform ${
                  expandedSection === sec.id ? "rotate-180" : ""
                }`}
              />
            </button>
            {expandedSection === sec.id && (
              <div className="px-4 pb-3 text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">
                {sec.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  const searchResults = useMemo(() => searchHelp(query), [query]);
  const activeEntry = activeEntryId ? getEntryById(activeEntryId) : null;
  const showingSearch = query.trim().length > 0;

  const lastUpdate = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 max-w-[900px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <img src="/jurelia-logo.png" alt="JURELIA" className="w-8 h-8 rounded-lg object-contain" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-on-surface leading-none">JURELIA</span>
                <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">
                  Centro de ayuda
                </span>
              </div>
            </Link>
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

      {/* Content */}
      <main className="max-w-[900px] mx-auto px-4 lg:px-8 py-8">
        {activeEntry ? (
          <EntryDetail entry={activeEntry} onBack={() => setActiveEntryId(null)} />
        ) : (
          <div className="flex flex-col gap-8">
            {/* Search */}
            <div>
              <h1 className="text-lg font-bold text-on-surface mb-1">Centro de ayuda</h1>
              <p className="text-xs text-on-surface-variant mb-4">
                Encuentre ayuda sobre todas las funciones de JURELIA.
              </p>
              <div className="relative max-w-md">
                <M name="search" className="!text-base absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar en la ayuda..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {showingSearch ? (
              /* Search results */
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
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
                    onClick={() => setActiveEntryId(r.id)}
                    className="text-left px-4 py-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <M name={r.icon} className="!text-sm text-primary" />
                      <span className="text-xs font-semibold text-on-surface">{r.title}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2">{r.summary}</p>
                  </button>
                ))}
              </div>
            ) : (
              /* Categories + FAQ */
              <>
                {/* Categories */}
                <div className="flex flex-col gap-6">
                  {helpCategories.map((cat) => {
                    const entries = cat.entries
                      .map((eId) => getEntryById(eId))
                      .filter(Boolean) as HelpEntry[];
                    return (
                      <section key={cat.id}>
                        <div className="flex items-center gap-2 mb-3">
                          <M name={cat.icon} className="!text-base text-primary" />
                          <h2 className="text-sm font-bold text-on-surface">{cat.label}</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {entries.map((entry) => (
                            <button
                              key={entry.id}
                              onClick={() => setActiveEntryId(entry.id)}
                              className="text-left px-4 py-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container-low hover:border-primary/30 transition-all group"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <M name={entry.icon} className="!text-sm text-primary" />
                                <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                                  {entry.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2">
                                {entry.summary}
                              </p>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}

                  {/* Global entries */}
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <M name="info" className="!text-base text-primary" />
                      <h2 className="text-sm font-bold text-on-surface">Información general</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...globalEntries, privacyEntry].map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => setActiveEntryId(entry.id)}
                          className="text-left px-4 py-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container-low hover:border-primary/30 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <M name={entry.icon} className="!text-sm text-primary" />
                            <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                              {entry.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2">
                            {entry.summary}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                {/* FAQ */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <M name="quiz" className="!text-base text-primary" />
                    <h2 className="text-sm font-bold text-on-surface">Preguntas frecuentes</h2>
                  </div>
                  <FAQAccordion items={faqItems} />
                </section>

                {/* Disclaimer */}
                <div className="px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/40">
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    <strong className="text-on-surface">Aviso legal:</strong> JURELIA facilita investigación
                    jurídica y análisis documental. No sustituye revisión profesional ni interpretación jurídica.
                    Todo contenido generado por IA debe verificarse con la fuente oficial.
                  </p>
                </div>

                {/* Last update */}
                <p className="text-[10px] text-on-surface-variant text-center">
                  Versión JURELIA v1.7.0 · Última actualización: {lastUpdate}
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}