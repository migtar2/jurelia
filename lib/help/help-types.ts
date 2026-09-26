/* ─── JURELIA Help System Types ─── */

export type HelpSectionId =
  | "QUE_ES"
  | "PARA_QUE"
  | "COMO_USAR"
  | "RESULTADOS"
  | "ESTADOS"
  | "LIMITACIONES"
  | "CONSEJOS"
  | "ERRORES";

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  content: string;
}

export interface HelpEntry {
  id: string;
  route: string;
  title: string;
  icon: string;
  summary: string;
  sections: HelpSection[];
  keywords: string[];
  related: string[];
}

export interface HelpCategory {
  id: string;
  label: string;
  icon: string;
  entries: string[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  related?: string[];
}

export interface TooltipTerm {
  term: string;
  definition: string;
}