"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { openHelpDrawer } from "@/components/HelpDrawer";
import ToastContainer, { showToast } from "@/components/Toast";

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface Alert {
  id: string;
  name: string;
  frequency: string;
  enabled: boolean;
  notifyOnlyNew: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  savedSearchId: string;
  searchName: string | null;
  searchParams: unknown;
}

function AlertsContent() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [alertsList, setAlertsList] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Alert | null>(null);
  const [editName, setEditName] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "weekly">("daily");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlertsList(data.alerts || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [fetchAlerts, user]);

  const handlePause = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/pause`, { method: "POST" });
      if (res.ok) {
        showToast("Alerta pausada");
        fetchAlerts();
      }
    } catch {
      showToast("Error al pausar", "error");
    }
  };

  const handleResume = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resume`, { method: "POST" });
      if (res.ok) {
        showToast("Alerta reanudada");
        fetchAlerts();
      }
    } catch {
      showToast("Error al reanudar", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Alerta eliminada");
        fetchAlerts();
      }
    } catch {
      showToast("Error al eliminar", "error");
    }
  };

  const openEdit = (alert: Alert) => {
    setEditModal(alert);
    setEditName(alert.name);
    setEditFrequency(alert.frequency as "daily" | "weekly");
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    try {
      const res = await fetch(`/api/alerts/${editModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, frequency: editFrequency }),
      });
      if (res.ok) {
        showToast("Alerta actualizada");
        setEditModal(null);
        fetchAlerts();
      }
    } catch {
      showToast("Error al actualizar", "error");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFrequencyLabel = (freq: string) => {
    return freq === "daily" ? "Diaria" : "Semanal";
  };

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
              <span className="text-[10px] font-semibold tracking-wider text-secondary uppercase leading-none mt-0.5">Alertas</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-secondary hidden sm:inline">{user?.email}</span>
            <Link href="/workspace" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant transition-colors">
              <M name="workspaces" className="!text-sm" />
              <span className="hidden sm:inline">Workspace</span>
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

      <div className="max-w-[1360px] mx-auto px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-secondary text-sm">Cargando alertas...</div>
          </div>
        ) : alertsList.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <M name="notifications_none" className="!text-6xl text-outline-variant mb-4" />
            <p className="text-base font-semibold text-on-surface mb-1">No hay alertas configuradas</p>
            <p className="text-sm text-secondary mb-6 text-center max-w-md">
              Crea una alerta desde una búsqueda guardada en tu workspace.
            </p>
            <Link href="/workspace" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors flex items-center gap-2">
              <M name="workspaces" className="!text-base" />
              Ir al Workspace
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-secondary">
                <strong className="text-on-surface">{alertsList.length}</strong> alerta{alertsList.length !== 1 ? "s" : ""}
              </p>
            </div>

            {alertsList.map((alert) => (
              <div
                key={alert.id}
                className={`bg-surface-container-lowest rounded-xl shadow-sm border p-4 hover:shadow-md transition-all ${
                  alert.enabled ? "border-outline-variant" : "border-outline-variant/50 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        alert.enabled ? "bg-[#dcfce7] text-[#15803d]" : "bg-surface-container text-secondary"
                      }`}>
                        <M name={alert.enabled ? "notifications_active" : "notifications_off"} className="!text-[10px]" />
                        {alert.enabled ? "Activa" : "Pausada"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                        <M name="schedule" className="!text-[10px]" />
                        {getFrequencyLabel(alert.frequency)}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-on-surface mb-1">{alert.name}</h3>

                    {alert.searchName && (
                      <p className="text-[11px] text-secondary mb-1.5 flex items-center gap-1">
                        <M name="saved_search" className="!text-xs" />
                        Búsqueda: {alert.searchName}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-secondary">
                      <span className="flex items-center gap-1">
                        <M name="event_upcoming" className="!text-xs" />
                        Próxima ejecución: {formatDate(alert.nextRunAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <M name="history" className="!text-xs" />
                        Última ejecución: {formatDate(alert.lastRunAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {alert.enabled ? (
                      <button
                        onClick={() => handlePause(alert.id)}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                        title="Pausar"
                      >
                        <M name="pause" className="!text-base" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResume(alert.id)}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                        title="Reanudar"
                      >
                        <M name="play_arrow" className="!text-base" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(alert)}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                      title="Editar"
                    >
                      <M name="edit" className="!text-base" />
                    </button>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="p-1.5 rounded-lg hover:bg-error-container hover:text-error text-on-surface-variant transition-colors"
                      title="Eliminar"
                    >
                      <M name="delete_outline" className="!text-base" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditModal(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-on-surface mb-4">Editar alerta</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Nombre</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Frecuencia</label>
                <select
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value as "daily" | "weekly")}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-sm text-on-surface-variant font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

export default function AlertsPage() {
  return <AlertsContent />;
}