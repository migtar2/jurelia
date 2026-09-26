"use client";

import { useState, useEffect, useRef } from "react";
import * as store from "@/lib/workspace/store";
import { showToast } from "@/components/Toast";

interface SaveButtonProps {
  roj: string;
  ecli?: string;
  organo: string;
  fecha: string;
  titulo: string;
  ponente?: string;
  url_pdf: string;
  resumen?: string;
  className?: string;
}

export default function SaveButton({ roj, ecli, organo, fecha, titulo, ponente, url_pdf, resumen, className = "" }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Form state
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [folders, setFolders] = useState<string[]>([]);

  useEffect(() => {
    store.isSaved(roj).then(setSaved);
    store.listFolders().then(setFolders);
  }, [roj]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSave = async () => {
    const result = await store.add(
      { type: "decision", roj, ecli, organo, fecha, titulo, ponente, url_pdf, resumen },
      { folders: selectedFolders, tags, notes }
    );
    if (result.ok) {
      setSaved(true);
      setOpen(false);
      showToast("Guardado en workspace");
    } else if (result.reason === "duplicate") {
      showToast("Ya está en el workspace", "info");
      setSaved(true);
      setOpen(false);
    } else {
      showToast("Límite de 500 resoluciones alcanzado", "error");
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const toggleFolder = (f: string) => {
    setSelectedFolders((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  if (saved && !open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`text-primary hover:text-primary-container transition-colors ${className}`}
        title="Guardado en workspace"
      >
        <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`text-on-surface-variant hover:text-primary transition-colors ${className}`}
        title="Guardar en workspace"
      >
        <span className="material-symbols-outlined !text-lg">{saved ? "bookmark" : "bookmark_border"}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-50 w-80 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant p-4 flex flex-col gap-3"
        >
          <h4 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined !text-sm text-primary">bookmark_add</span>
            Guardar resolución
          </h4>

          {/* Folders */}
          {folders.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1 block">Carpetas</label>
              <div className="flex flex-wrap gap-1">
                {folders.map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleFolder(f)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      selectedFolders.includes(f) ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1 block">Etiquetas</label>
            <div className="flex gap-1 mb-1 flex-wrap">
              {tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-medium flex items-center gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-error">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Añadir etiqueta..."
                className="flex-1 px-2 py-1 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button onClick={addTag} className="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">+</button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1 block">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas privadas..."
              rows={2}
              className="w-full px-2 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined !text-sm">save</span>
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}