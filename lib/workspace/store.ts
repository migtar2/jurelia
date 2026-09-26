"use client";

import type { WorkspaceItem, SavedDocument } from "./types";

/* ── Authenticated API-backed workspace store ── */

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

/* ── Decisions ── */

export async function getAll(): Promise<WorkspaceItem[]> {
  const res = await apiFetch("/api/workspace/decisions");
  if (!res.ok) return [];
  const data = await res.json();
  return data.decisions ?? [];
}

export async function isSaved(roj: string): Promise<boolean> {
  const items = await getAll();
  return items.some((i) => i.roj === roj);
}

export async function getSavedByRoj(roj: string): Promise<WorkspaceItem | undefined> {
  const items = await getAll();
  return items.find((i) => i.roj === roj);
}

export type AddResult = { ok: true; id?: string; updated?: boolean } | { ok: false; reason: string };

export async function add(
  data: Omit<WorkspaceItem, "id" | "savedAt" | "folders" | "tags" | "notes">,
  opts?: { folders?: string[]; tags?: string[]; notes?: string }
): Promise<AddResult> {
  const res = await apiFetch("/api/workspace/decisions/save", {
    method: "POST",
    body: JSON.stringify({
      roj: data.roj,
      ecli: data.ecli,
      organo: data.organo,
      fecha: data.fecha,
      titulo: data.titulo,
      ponente: data.ponente,
      url_pdf: data.url_pdf,
      resumen: data.resumen,
      aiSummary: data.aiSummary,
      type: data.type || "decision",
      comparisonData: data.comparisonData,
      propositionData: data.propositionData,
      folders: opts?.folders,
      tagNames: opts?.tags,
      noteContent: opts?.notes,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, reason: err.error || "Error al guardar" };
  }

  const result = await res.json();
  return { ok: true, id: result.id, updated: result.updated };
}

export async function addComparison(
  decisionA: { roj: string; titulo: string; organo?: string; fecha?: string },
  decisionB: { roj: string; titulo: string; organo?: string; fecha?: string },
  data: import("./types").ComparisonWorkspaceData,
  opts?: { folders?: string[]; tags?: string[]; notes?: string }
): Promise<AddResult> {
  const compId = `comp-${decisionA.roj}-${decisionB.roj}`;
  return add(
    {
      type: "comparison",
      roj: compId,
      organo: "",
      fecha: "",
      titulo: `Comparación: ${decisionA.titulo.slice(0, 40)} vs ${decisionB.titulo.slice(0, 40)}`,
      url_pdf: "",
      comparisonData: data,
    },
    opts
  );
}

export async function addProposition(
  proposition: string,
  data: import("./types").PropositionWorkspaceData,
  opts?: { folders?: string[]; tags?: string[]; notes?: string }
): Promise<AddResult> {
  const propId = `prop-${proposition.slice(0, 50).replace(/\s+/g, "-")}`;
  return add(
    {
      type: "proposition",
      roj: propId,
      organo: "",
      fecha: "",
      titulo: `Proposición: ${proposition.slice(0, 80)}`,
      url_pdf: "",
      propositionData: data,
    },
    opts
  );
}

export async function update(
  id: string,
  patch: Partial<Pick<WorkspaceItem, "folders" | "tags" | "notes" | "aiSummary">>
): Promise<boolean> {
  // For tags/folders/notes updates, we need to use the specific endpoints
  // For now, this is a simplified version - the main save endpoint handles full updates
  if (patch.notes !== undefined) {
    await apiFetch(`/api/workspace/decisions/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content: patch.notes }),
    });
  }
  if (patch.tags) {
    // Get current tags, diff, add/remove
    const currentRes = await apiFetch("/api/workspace/decisions");
    if (currentRes.ok) {
      const data = await currentRes.json();
      const item = data.decisions?.find((d: WorkspaceItem) => d.id === id);
      if (item) {
        const currentTags = new Set<string>(item.tags || []);
        const newTags = new Set<string>(patch.tags || []);
        for (const t of newTags) {
          if (!currentTags.has(t)) {
            await apiFetch(`/api/workspace/decisions/${id}/tags`, {
              method: "POST",
              body: JSON.stringify({ tagName: t }),
            });
          }
        }
        for (const t of currentTags) {
          if (!newTags.has(t)) {
            await apiFetch(`/api/workspace/decisions/${id}/tags/${encodeURIComponent(t)}`, {
              method: "DELETE",
            });
          }
        }
      }
    }
  }
  return true;
}

export async function remove(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/workspace/decisions/${id}`, { method: "DELETE" });
  return res.ok;
}

export async function removeMany(ids: string[]): Promise<number> {
  let count = 0;
  for (const id of ids) {
    if (await remove(id)) count++;
  }
  return count;
}

export async function count(): Promise<number> {
  const items = await getAll();
  return items.length;
}

/* ── Folders ── */

export async function listFolders(): Promise<string[]> {
  const res = await apiFetch("/api/workspace/folders");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.folders ?? []).map((f: { name: string }) => f.name);
}

export async function createFolder(name: string): Promise<boolean> {
  const res = await apiFetch("/api/workspace/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.ok;
}

export async function renameFolder(id: string, newName: string): Promise<boolean> {
  const res = await apiFetch(`/api/workspace/folders/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name: newName }),
  });
  return res.ok;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/workspace/folders/${id}`, { method: "DELETE" });
  return res.ok;
}

/* ── Tags ── */

export async function listAllTags(): Promise<string[]> {
  const res = await apiFetch("/api/workspace/tags");
  if (!res.ok) return [];
  const data = await res.json();
  return data.tags ?? [];
}

/* ── Search (client-side filter over API data) ── */

export async function search(opts: {
  text?: string;
  folder?: string;
  tag?: string;
  sort?: "saved_desc" | "saved_asc" | "court" | "fecha_desc" | "fecha_asc";
}): Promise<WorkspaceItem[]> {
  const params = new URLSearchParams();
  if (opts.text) params.set("text", opts.text);
  if (opts.folder) params.set("folder", opts.folder);
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.sort) params.set("sort", opts.sort);

  const res = await apiFetch(`/api/workspace/decisions?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.decisions ?? [];
}

/* ── Export / Import (still client-side) ── */

export function downloadExport(): void {
  getAll().then((items) => {
    listFolders().then((folders) => {
      const data = { version: 1 as const, exportedAt: new Date().toISOString(), items, folders };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `jurelia-workspace-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
}

export async function importJSON(json: string): Promise<{ ok: true; count: number; foldersAdded: number } | { ok: false; error: string }> {
  try {
    const data = JSON.parse(json);
    if (!data.version || !Array.isArray(data.items)) {
      return { ok: false, error: "Formato de archivo no válido." };
    }

    let count = 0;
    for (const item of data.items) {
      if (!item.roj || !item.titulo) continue;
      const result = await add(item, {
        folders: item.folders,
        tags: item.tags,
        notes: item.notes,
      });
      if (result.ok) count++;
    }

    let foldersAdded = 0;
    if (Array.isArray(data.folders)) {
      for (const f of data.folders) {
        const ok = await createFolder(f);
        if (ok) foldersAdded++;
      }
    }

    return { ok: true, count, foldersAdded };
  } catch {
    return { ok: false, error: "No se pudo leer el archivo JSON." };
  }
}

/* ── Workspace Documents ── */

export async function listSavedDocuments(): Promise<SavedDocument[]> {
  const res = await apiFetch("/api/workspace/documents");
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents ?? [];
}

export async function saveDocument(documentId: string, analysisId?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await apiFetch("/api/workspace/documents", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, analysis_id: analysisId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || "Error al guardar" };
  }
  const result = await res.json();
  return { ok: true, id: result.id };
}

export async function deleteSavedDocument(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/workspace/documents/${id}`, { method: "DELETE" });
  return res.ok;
}