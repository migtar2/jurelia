"use client";

import { openHelpDrawer } from "./HelpDrawer";

export default function HelpButton() {
  return (
    <button
      onClick={() => openHelpDrawer()}
      aria-label="Abrir ayuda"
      className="fixed bottom-6 right-6 z-[80] w-12 h-12 rounded-full bg-primary text-on-primary shadow-lg hover:shadow-xl hover:bg-primary-container transition-all flex items-center justify-center group"
    >
      <span className="material-symbols-outlined !text-xl group-hover:scale-110 transition-transform">
        help
      </span>
    </button>
  );
}