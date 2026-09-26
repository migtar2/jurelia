"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

export default function Tooltip({ term, children, className = "" }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + 6,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
        });
      }
      setVisible(true);
    }, 200);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        role="button"
        aria-label={`Definición de ${term}`}
        className={`underline decoration-dotted decoration-outline-variant underline-offset-2 cursor-help focus:outline-none focus:ring-1 focus:ring-primary focus:rounded ${className}`}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[200] max-w-[260px] px-3 py-2 rounded-lg bg-inverse-surface text-inverse-on-surface text-xs leading-relaxed shadow-lg pointer-events-none animate-[tooltipIn_.15s_ease-out]"
            style={{ top: pos.top, left: pos.left }}
          >
            {term}
            <style>{`@keyframes tooltipIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
          </div>,
          document.body
        )}
    </>
  );
}

/* ── Pre-defined term tooltips for JURELIA ── */

export const TOOLTIP_TERMS: Record<string, string> = {
  ROJ: "Identificador nacional de una resolución judicial",
  ECLI: "Identificador europeo de jurisprudencia",
  VERIFIED: "Coincidencia verificada mediante identificadores y evidencia disponible",
  PROBABLE: "Coincidencia probable pero sin verificación completa",
  AI_GENERATED: "Contenido generado por IA, verificar con fuente oficial",
  SOURCE_FACT: "Información directa de la fuente oficial",
  INFERRED: "Dato inferido a partir de la información disponible",
  AMBIGUOUS: "Resultado ambiguo, se requiere revisión manual",
  NOT_FOUND: "No se encontró coincidencia",
};

interface TermTooltipProps {
  term: keyof typeof TOOLTIP_TERMS;
  children?: React.ReactNode;
  className?: string;
}

export function TermTooltip({ term, children, className }: TermTooltipProps) {
  return (
    <Tooltip term={TOOLTIP_TERMS[term] || term} className={className}>
      {children || term}
    </Tooltip>
  );
}