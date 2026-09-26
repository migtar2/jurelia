// Email delivery (scaffolded interface)

import type { MatchResult } from "../news/types";

export interface EmailPayload {
  news_title: string;
  news_publication: string | null;
  news_url: string;
  court: string | null;
  date: string | null;
  roj: string | null;
  ecli: string | null;
  resolution_number: string | null;
  match_status: MatchResult["status"];
  cendoj_url: string | null;
}

export async function sendDecisionEmail(payload: EmailPayload): Promise<{ sent: boolean; message: string }> {
  // Scaffold — no email provider configured yet
  // In production, integrate with SendGrid/Resend/SMTP

  const verified = payload.match_status === "VERIFIED";

  const subject = verified
    ? `Sentencia localizada: ${payload.roj || payload.ecli || payload.resolution_number || "CENDOJ"}`
    : `Resolución no verificada — ${payload.news_title}`;

  const body = buildEmailBody(payload, verified);

  // Log for POC observability
  console.log("[EMAIL] Would send:", { subject, to: "(not configured)", body_length: body.length });

  return {
    sent: false,
    message: "Envío de email no configurado. En producción se integraría con un proveedor de email.",
  };
}

function buildEmailBody(payload: EmailPayload, verified: boolean): string {
  const lines: string[] = [];

  lines.push("=== RESOLUCIÓN JUDICIAL ===");
  lines.push("");
  if (!verified) {
    lines.push("⚠️ RESOLUCIÓN NO VERIFICADA");
    lines.push("");
  }
  lines.push(`Noticia: ${payload.news_title}`);
  if (payload.news_publication) lines.push(`Medio: ${payload.news_publication}`);
  lines.push(`URL: ${payload.news_url}`);
  lines.push("");
  lines.push("--- Datos de la resolución ---");
  if (payload.court) lines.push(`Tribunal: ${payload.court}`);
  if (payload.date) lines.push(`Fecha: ${payload.date}`);
  if (payload.roj) lines.push(`ROJ: ${payload.roj}`);
  if (payload.ecli) lines.push(`ECLI: ${payload.ecli}`);
  if (payload.resolution_number) lines.push(`Nº Resolución: ${payload.resolution_number}`);
  lines.push(`Match: ${payload.match_status}`);
  lines.push("");
  if (payload.cendoj_url) {
    lines.push(`CENDOJ: ${payload.cendoj_url}`);
  }

  return lines.join("\n");
}
