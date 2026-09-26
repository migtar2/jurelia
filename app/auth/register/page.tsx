"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    const result = await register(email, password, name || undefined);
    setLoading(false);

    if (result.ok) {
      router.push("/workspace");
    } else {
      setError(result.error || "Error al registrarse");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/jurelia-logo.png" alt="JURELIA" className="w-10 h-10 rounded-lg" />
            <span className="text-lg font-bold tracking-tight text-on-surface">JURELIA</span>
          </Link>
          <h1 className="text-xl font-bold text-on-surface">Crear cuenta</h1>
          <p className="text-sm text-secondary mt-1">Guarda y organiza resoluciones judiciales</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 space-y-4">
          {error && (
            <div className="bg-error/10 text-error text-xs rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label htmlFor="name" className="block text-xs font-medium text-on-surface mb-1.5">
              Nombre <span className="text-secondary">(opcional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-on-surface mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-on-surface mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-on-surface mb-1.5">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant"
              placeholder="Repite la contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <p className="text-xs text-center text-secondary">
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}