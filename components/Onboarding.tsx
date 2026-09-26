"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "jurelia-onboarding-dismissed";

interface OnboardingTip {
  icon: string;
  title: string;
  description: string;
}

const TIPS: OnboardingTip[] = [
  {
    icon: "search",
    title: "Buscar jurisprudencia",
    description:
      "Busca una cuestión jurídica o utiliza filtros avanzados por tribunal, fecha e identificadores.",
  },
  {
    icon: "newspaper",
    title: "Encontrar sentencia desde noticia",
    description:
      "Arrastra aquí una noticia y JURELIA localizará la resolución correspondiente en CENDOJ.",
  },
  {
    icon: "upload_file",
    title: "Analizar documentos",
    description:
      "Sube un documento para analizar cuestiones y buscar jurisprudencia relacionada.",
  },
  {
    icon: "compare",
    title: "Comparar resoluciones",
    description:
      "Selecciona dos resoluciones para un análisis comparativo con similitudes y diferencias.",
  },
];

function M({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — show anyway
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  const tip = TIPS[current];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-inverse-surface/30 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="flex gap-1 px-5 pt-4">
          {TIPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === current ? "bg-primary" : "bg-surface-container"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center mx-auto mb-4">
            <M name={tip.icon} className="!text-2xl text-on-secondary-container" />
          </div>
          <h3 className="text-base font-bold text-on-surface mb-1">{tip.title}</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {tip.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          {current > 0 ? (
            <button
              onClick={() => setCurrent(current - 1)}
              className="flex-1 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-xs font-semibold transition-colors"
            >
              Anterior
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="flex-1 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-xs font-semibold transition-colors"
            >
              Saltar
            </button>
          )}
          {current < TIPS.length - 1 ? (
            <button
              onClick={() => setCurrent(current + 1)}
              className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}