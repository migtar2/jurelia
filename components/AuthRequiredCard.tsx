"use client";

import { useRouter } from "next/navigation";

/**
 * Friendly prompt shown when an API returns 401 (no session or expired).
 * Replaces the raw «No autenticado» error with login/register actions that
 * return to the current page after authenticating. Standalone: does not
 * require AuthProvider.
 */
export default function AuthRequiredCard({ onDismiss }: { onDismiss?: () => void }) {
  const router = useRouter();

  const gotoAuth = (path: string) => {
    const current = window.location.pathname + window.location.search;
    router.push(`${path}?next=${encodeURIComponent(current)}`);
  };

  return (
    <div className="mb-4 p-4 bg-secondary-container rounded-xl border border-primary flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="material-symbols-outlined !text-2xl text-primary shrink-0">lock_person</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-on-surface">Inicia sesión para continuar</p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Esta función requiere una cuenta gratuita. Si ya habías iniciado sesión, tu sesión ha caducado.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => gotoAuth("/auth/login")}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => gotoAuth("/auth/register")}
          className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors"
        >
          Crear cuenta
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Cerrar aviso"
            className="px-2 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-xs"
          >
            <span className="material-symbols-outlined !text-base">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
