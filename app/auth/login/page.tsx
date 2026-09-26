"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.ok) {
      router.push("/workspace");
    } else {
      setError(result.error || "Error al iniciar sesión");
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
          <h1 className="text-xl font-bold text-on-surface">Iniciar sesión</h1>
          <p className="text-sm text-secondary mt-1">Accede a tu workspace personal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 space-y-4">
          {error && (
            <div className="bg-error/10 text-error text-xs rounded-lg px-3 py-2">{error}</div>
          )}

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
              className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-xs text-center text-secondary">
            ¿No tienes cuenta?{" "}
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Regístrate
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}