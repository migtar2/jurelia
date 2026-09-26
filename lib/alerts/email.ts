/**
 * Email Delivery Abstraction
 *
 * Provider-agnostic email sending for alert notifications.
 * - Resend API when RESEND_API_KEY is set
 * - Console simulation otherwise (still recorded in DB)
 *
 * Never fails alert execution — errors are caught and recorded.
 */

import { Resend } from "resend";
import { db } from "@/lib/db";
import { emailDeliveries, savedSearches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { CendojSearchResult } from "@/lib/cendoj/client";

/* ── Types ── */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  alertId: string;
  executionId: string;
}

export interface SendEmailResult {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
}

/* ── Resend client (lazy) ── */

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_ADDRESS = "JURELIA <alertas@jurelia.es>";

/* ── Send email ── */

export async function sendAlertEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, alertId, executionId } = params;
  const resend = getResendClient();

  let status: string;
  let providerMessageId: string | null = null;
  let errorCode: string | null = null;
  let sentAt: Date | null = null;

  if (resend) {
    // ── Real delivery via Resend ──
    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });

      if (result.error) {
        status = "FAILED";
        errorCode = result.error.message || "RESEND_ERROR";
      } else {
        status = "SENT";
        providerMessageId = result.data?.id || null;
        sentAt = new Date();
      }
    } catch (err: unknown) {
      status = "FAILED";
      errorCode = err instanceof Error ? err.message : String(err);
    }
  } else {
    // ── Simulated delivery ──
    status = "SIMULATED";
    providerMessageId = `sim_${crypto.randomUUID().slice(0, 8)}`;
    sentAt = new Date();

    console.log("─".repeat(60));
    console.log("[EMAIL SIMULATED]");
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Alert:   ${alertId}`);
    console.log(`  Exec:    ${executionId}`);
    console.log("─".repeat(60));
  }

  // Record in email_deliveries
  try {
    await db.insert(emailDeliveries).values({
      alertId,
      executionId,
      recipient: to,
      status,
      providerMessageId,
      sentAt,
      errorCode,
    });
  } catch (dbErr) {
    console.error("[email] Failed to record delivery:", dbErr);
  }

  return {
    ok: status === "SENT" || status === "SIMULATED",
    providerMessageId,
    error: errorCode,
  };
}

/** Check if a delivery already exists for this execution (prevents duplicate emails on retry). */
export async function hasExistingDelivery(alertId: string, executionId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: emailDeliveries.id })
    .from(emailDeliveries)
    .where(eq(emailDeliveries.executionId, executionId))
    .limit(1);
  return !!existing;
}

/* ── Email Template ── */

interface BuildEmailHtmlParams {
  alertName: string;
  alertId: string;
  searchParams: Record<string, string>;
  newDecisions: CendojSearchResult[];
  aiSummary?: string;
}

const SITE_URL = "https://cendoj.vercel.app";

export function buildAlertEmailHtml(params: BuildEmailHtmlParams): string {
  const { alertName, alertId, searchParams, newDecisions, aiSummary } = params;
  const count = newDecisions.length;

  // Build search criteria display
  const criteriaEntries = Object.entries(searchParams)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;font-size:13px;text-transform:capitalize;">${escapeHtml(formatParamKey(k))}</td><td style="padding:2px 0;font-size:13px;">${escapeHtml(String(v))}</td></tr>`)
    .join("");

  // Build decision rows
  const decisionRows = newDecisions
    .map(
      (d, i) => `
    <tr>
      <td style="padding:12px 0;${i < newDecisions.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}">
        <div style="font-weight:600;font-size:14px;color:#111827;margin-bottom:4px;">
          ${escapeHtml(d.titulo || "Sin título")}
        </div>
        <div style="font-size:12px;color:#6b7280;line-height:1.6;">
          ${d.organo ? `<span>⚖ ${escapeHtml(d.organo)}</span><br/>` : ""}
          ${d.fecha ? `<span>📅 ${escapeHtml(d.fecha)}</span><br/>` : ""}
          ${d.roj ? `<span>ROJ: <strong>${escapeHtml(d.roj)}</strong></span><br/>` : ""}
          ${d.ecli ? `<span>ECLI: ${escapeHtml(d.ecli)}</span><br/>` : ""}
          ${d.url_pdf ? `<a href="${escapeHtml(d.url_pdf)}" style="color:#2563eb;text-decoration:none;">📄 Ver resolución</a>` : ""}
        </div>
      </td>
    </tr>`,
    )
    .join("");

  // AI summary section
  const aiSection = aiSummary
    ? `
    <tr>
      <td style="padding:16px 0 8px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;">
          <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            ⚡ Resumen generado por IA
          </div>
          <div style="font-size:13px;color:#166534;line-height:1.6;">
            ${escapeHtml(aiSummary)}
          </div>
        </div>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px 32px;">
            <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">JURELIA</div>
            <div style="font-size:12px;color:#93c5fd;margin-top:4px;">Jurisprudencia al día</div>
          </td>
        </tr>

        <!-- Alert name -->
        <tr>
          <td style="padding:24px 32px 0;">
            <div style="font-size:18px;font-weight:700;color:#111827;">Nueva jurisprudencia detectada</div>
            <div style="font-size:14px;color:#6b7280;margin-top:4px;">Alerta: <strong>${escapeHtml(alertName)}</strong></div>
          </td>
        </tr>

        <!-- Count badge -->
        <tr>
          <td style="padding:16px 32px;">
            <div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:6px 16px;">
              <span style="font-size:14px;font-weight:700;color:#1d4ed8;">${count} nueva${count !== 1 ? "s" : ""} resolución${count !== 1 ? "es" : ""}</span>
            </div>
          </td>
        </tr>

        <!-- Search criteria -->
        ${criteriaEntries ? `
        <tr>
          <td style="padding:0 32px 16px;">
            <div style="font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Criterios de búsqueda</div>
            <table cellpadding="0" cellspacing="0">${criteriaEntries}</table>
          </td>
        </tr>` : ""}

        <!-- AI summary -->
        ${aiSection}

        <!-- Decisions -->
        <tr>
          <td style="padding:8px 32px 24px;">
            <div style="font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Resoluciones</div>
            <table width="100%" cellpadding="0" cellspacing="0">${decisionRows}</table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
              <a href="${SITE_URL}/alerts?id=${encodeURIComponent(alertId)}" style="color:#2563eb;text-decoration:none;">⚙ Gestionar alerta</a>
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/alerts?id=${encodeURIComponent(alertId)}&action=unsubscribe" style="color:#9ca3af;text-decoration:none;">Dejar de recibir</a>
            </div>
            <div style="font-size:11px;color:#d1d5db;margin-top:12px;">
              Este email fue enviado por JURELIA. Si no solicitaste esta alerta, puedes desactivarla desde el enlace anterior.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ── Helpers ── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatParamKey(key: string): string {
  const map: Record<string, string> = {
    tipo: "Tipo",
    organo: "Órgano",
    fechaDesde: "Desde",
    fechaHasta: "Hasta",
    texto: "Texto libre",
    sede: "Sede",
    ponente: "Ponente",
    nRecurso: "Nº recurso",
    nResolucion: "Nº resolución",
    roj: "ROJ",
    ecli: "ECLI",
  };
  return map[key] || key;
}