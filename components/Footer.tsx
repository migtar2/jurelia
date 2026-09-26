import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-outline-variant/40 bg-surface-container-lowest">
      <div className="max-w-[1360px] mx-auto px-4 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[11px] text-on-surface-variant leading-relaxed text-center sm:text-left">
          JURELIA facilita investigación jurídica y análisis documental.{" "}
          No sustituye revisión profesional ni interpretación jurídica.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/help"
            className="text-[10px] text-secondary hover:text-primary transition-colors"
          >
            Centro de ayuda
          </Link>
          <span className="text-[10px] text-outline">v1.7.0</span>
        </div>
      </div>
    </footer>
  );
}