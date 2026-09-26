import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { documents, documentAnalyses, documentResearchResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { cendojSearch, type CendojSearchResult } from "@/lib/cendoj/client";

/* ── Constants ── */
const MIMO_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const MIMO_MODEL = "mimo-v2.5-pro";
const MAX_ISSUES_PER_SEARCH = 5;
const MAX_CANDIDATES_PER_ISSUE = 5;

/* ── Types ── */
type Relationship = "SUPPORTS" | "CONTRADICTS" | "DISTINGUISHES" | "NEUTRAL" | "INSUFFICIENT_EVIDENCE";
type EvidenceBasis = "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";

interface ClassificationResult {
  relationship: Relationship;
  reason: string;
  evidence_basis: EvidenceBasis;
}

interface IssueResult {
  issue_text: string;
  candidates: Array<{
    decision_roj: string | null;
    decision_ecli: string | null;
    organo: string | null;
    fecha: string | null;
    titulo: string | null;
    resumen: string | null;
    relationship: Relationship;
    reason: string;
    evidence_basis: EvidenceBasis;
    source_url: string;
  }>;
}

interface GapAnalysis {
  issues_without_jurisprudence: string[];
  cited_cases_unresolved: string[];
  only_lower_court: string[];
  missing_contrary: string[];
}

interface SearchRequestBody {
  document_id?: string;
  analysis_id?: string;
  selected_issues?: string[];
}

/* ── Balanced search query generation ── */
interface SearchQueries {
  supporting: Record<string, string>[];
  contrary: Record<string, string>[];
}

function generateBalancedQueries(
  issueText: string,
  relatedArguments: Array<{ argument: string; related_issue: string }>,
  citedLaws: string[],
): SearchQueries {
  const supporting: Record<string, string>[] = [];
  const contrary: Record<string, string>[] = [];

  // Supporting: issue text directly
  supporting.push({ query: issueText });
  // Supporting: issue + key argument
  if (relatedArguments.length > 0) {
    supporting.push({ query: `${issueText} ${relatedArguments[0].argument}`.slice(0, 200) });
  }
  // Supporting: issue + first cited law
  if (citedLaws.length > 0) {
    supporting.push({ query: `${issueText} ${citedLaws[0]}` });
  }

  // Contrary: invert the argument direction
  // Use the issue text + "mantener" / "denegar" / "improcedente" keywords
  contrary.push({ query: `${issueText} denegar improcedente desestimar` });
  if (relatedArguments.length > 0) {
    contrary.push({ query: `${relatedArguments[0].argument} desestimado rechazado` });
  }
  if (citedLaws.length > 0) {
    contrary.push({ query: `${citedLaws[0]} improcedente desestimar` });
  }

  return { supporting, contrary };
}

/* ── Classify relationship via MiMo ── */
async function classifyRelationship(
  apiKey: string,
  issueText: string,
  relatedArguments: string[],
  candidate: CendojSearchResult,
): Promise<ClassificationResult> {
  const systemPrompt = `Eres un asistente jurídico experto. Clasifica la relación entre una cuestión jurídica/argumento y una resolución judicial encontrada.

IMPORTANTE:
- Solo puedes afirmar lo que está en los datos proporcionados de la resolución.
- Si no tienes información suficiente, usa INSUFFICIENT_EVIDENCE.
- NUNCA inventes contenido que no esté en los datos.

Clasificaciones válidas:
- SUPPORTS: la jurisprudencia apoya el argumento del documento
- CONTRADICTS: la jurisprudencia contradice o limita el argumento
- DISTINGUISHES: la jurisprudencia se diferencia por hechos o circunstancias distintas
- NEUTRAL: relacionada pero sin apoyo ni contradicción directa
- INSUFFICIENT_EVIDENCE: no hay datos suficientes para determinar la relación

Nivel de evidencia:
- FULL_TEXT: tienes acceso al texto completo de la resolución
- OFFICIAL_SUMMARY: solo tienes el resumen oficial (menos fiable)
- METADATA_ONLY: solo tienes metadatos (mínima fiabilidad)

Responde SOLO con JSON válido:
{
  "relationship": "SUPPORTS|CONTRADICTS|DISTINGUISHES|NEUTRAL|INSUFFICIENT_EVIDENCE",
  "reason": "Breve explicación (máx 2 frases)",
  "evidence_basis": "FULL_TEXT|OFFICIAL_SUMMARY|METADATA_ONLY"
}`;

  // Determine what data we have
  const hasSummary = !!(candidate.resumen && candidate.resumen.length > 20);
  const evidenceLevel = hasSummary ? "OFFICIAL_SUMMARY" : "METADATA_ONLY";

  const candidateData = [
    `ROJ: ${candidate.roj || "N/A"}`,
    `ECLI: ${candidate.ecli || "N/A"}`,
    `Órgano: ${candidate.organo || "N/A"}`,
    `Fecha: ${candidate.fecha || "N/A"}`,
    `Título: ${candidate.titulo || "N/A"}`,
    hasSummary ? `Resumen oficial: ${candidate.resumen}` : "(Sin resumen disponible)",
  ].join("\n");

  const userPrompt = `CUESTIÓN JURÍDICA:
${issueText}

ARGUMENTOS RELACIONADOS:
${relatedArguments.length > 0 ? relatedArguments.join("\n- ") : "(ninguno)"}

RESOLUCIÓN JUDICIAL ENCONTRADA EN CENDOJ:
${candidateData}

Nivel de datos disponible: ${evidenceLevel}

Clasifica la relación. Responde SOLO con JSON válido.`;

  try {
    const response = await fetch(MIMO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MIMO_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return { relationship: "INSUFFICIENT_EVIDENCE", reason: "Error al clasificar", evidence_basis: evidenceLevel };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { relationship: "INSUFFICIENT_EVIDENCE", reason: "Respuesta vacía", evidence_basis: evidenceLevel };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { relationship: "INSUFFICIENT_EVIDENCE", reason: "Sin JSON válido", evidence_basis: evidenceLevel };
    }

    const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult;

    // Validate relationship
    const validRelationships: Relationship[] = ["SUPPORTS", "CONTRADICTS", "DISTINGUISHES", "NEUTRAL", "INSUFFICIENT_EVIDENCE"];
    if (!validRelationships.includes(parsed.relationship)) {
      parsed.relationship = "INSUFFICIENT_EVIDENCE";
    }

    // Override evidence basis based on available data
    parsed.evidence_basis = evidenceLevel;

    // Clamp reason
    if (parsed.reason && parsed.reason.length > 500) {
      parsed.reason = parsed.reason.slice(0, 500);
    }

    return parsed;
  } catch {
    return { relationship: "INSUFFICIENT_EVIDENCE", reason: "Error de clasificación", evidence_basis: evidenceLevel };
  }
}

/* ── Gap analysis ── */
function generateGapAnalysis(
  allIssues: Array<{ issue: string }>,
  allCitations: Array<{ text: string; type: string; normalized: string }>,
  resultsByIssue: Map<string, IssueResult["candidates"]>,
): GapAnalysis {
  const issuesWithoutJurisprudence: string[] = [];
  const onlyLowerCourt: string[] = [];

  for (const iss of allIssues) {
    const candidates = resultsByIssue.get(iss.issue) || [];
    if (candidates.length === 0) {
      issuesWithoutJurisprudence.push(iss.issue);
    } else {
      // Check if only lower-court authority
      const hasHigherCourt = candidates.some((c) => {
        const roj = (c.decision_roj || "").toUpperCase();
        return roj.startsWith("STS") || roj.startsWith("STC") || roj.startsWith("SAN");
      });
      if (!hasHigherCourt) {
        onlyLowerCourt.push(iss.issue);
      }
    }
  }

  // Check cited cases that couldn't be resolved (ROJ/ECLI citations without matching CENDOJ results)
  const citedCasesUnresolved: string[] = [];
  for (const cit of allCitations) {
    if (cit.type === "roj" || cit.type === "ecli") {
      // Check if any candidate matches this citation
      let found = false;
      for (const [, candidates] of resultsByIssue) {
        for (const c of candidates) {
          if (cit.type === "roj" && c.decision_roj && c.decision_roj.toLowerCase() === cit.normalized.toLowerCase()) {
            found = true;
          }
          if (cit.type === "ecli" && c.decision_ecli && c.decision_ecli.toLowerCase() === cit.normalized.toLowerCase()) {
            found = true;
          }
        }
      }
      if (!found) {
        citedCasesUnresolved.push(cit.text);
      }
    }
  }

  // Check for issues missing contrary jurisprudence
  const missingContrary: string[] = [];
  for (const iss of allIssues) {
    const candidates = resultsByIssue.get(iss.issue) || [];
    const hasContrary = candidates.some((c) => c.relationship === "CONTRADICTS");
    if (candidates.length > 0 && !hasContrary) {
      missingContrary.push(iss.issue);
    }
  }

  return {
    issues_without_jurisprudence: issuesWithoutJurisprudence,
    cited_cases_unresolved: citedCasesUnresolved,
    only_lower_court: onlyLowerCourt,
    missing_contrary: missingContrary,
  };
}

/* ── Route handler ── */
export async function POST(request: NextRequest) {
  const totalStart = Date.now();

  // 1. Auth
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // 2. Parse body
  let body: SearchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { document_id, analysis_id, selected_issues } = body;

  if (!document_id) {
    return NextResponse.json({ error: "Campo 'document_id' requerido" }, { status: 400 });
  }
  if (!analysis_id) {
    return NextResponse.json({ error: "Campo 'analysis_id' requerido" }, { status: 400 });
  }

  // 3. Ownership check: document belongs to user
  const [doc] = await db
    .select({ id: documents.id, userId: documents.userId })
    .from(documents)
    .where(and(eq(documents.id, document_id), eq(documents.userId, auth.user.userId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado o sin permisos" }, { status: 404 });
  }

  // 4. Load analysis
  const [analysis] = await db
    .select()
    .from(documentAnalyses)
    .where(and(eq(documentAnalyses.id, analysis_id), eq(documentAnalyses.documentId, document_id)))
    .limit(1);

  if (!analysis) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  const issues = (analysis.issues ?? []) as Array<{
    issue: string;
    evidence: string;
    confidence: number;
    provenance: string;
  }>;
  const argumentsList = (analysis.arguments ?? []) as Array<{
    argument: string;
    document_location: string;
    related_issue: string;
    confidence: number;
    provenance: string;
  }>;
  const citationsList = (analysis.citations ?? []) as Array<{
    text: string;
    type: string;
    normalized: string;
    status: string;
  }>;

  // 5. Filter to selected issues or all (max MAX_ISSUES_PER_SEARCH)
  let targetIssues = issues;
  if (selected_issues && selected_issues.length > 0) {
    targetIssues = issues.filter((iss) => selected_issues.includes(iss.issue));
  }
  targetIssues = targetIssues.slice(0, MAX_ISSUES_PER_SEARCH);

  if (targetIssues.length === 0) {
    return NextResponse.json({ error: "No hay cuestiones seleccionadas para buscar" }, { status: 400 });
  }

  // 6. Get cited laws for query enhancement
  const citedLaws = citationsList
    .filter((c) => c.type === "law" || c.type === "regulation")
    .map((c) => c.normalized)
    .slice(0, 3);

  // 7. API key check
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "MIMO_API_KEY no configurada" }, { status: 500 });
  }

  // 8. For each issue: generate balanced queries, search CENDOJ, classify
  const allResults: IssueResult[] = [];
  const resultsByIssue = new Map<string, IssueResult["candidates"]>();
  let totalRetrievalMs = 0;
  let totalAiMs = 0;

  for (const iss of targetIssues) {
    const relatedArgs = argumentsList.filter((a) => a.related_issue === iss.issue);
    const relatedArgTexts = relatedArgs.map((a) => a.argument);

    // Generate balanced queries
    const queries = generateBalancedQueries(iss.issue, relatedArgs, citedLaws);

    // Collect unique candidates from all query types
    const candidateMap = new Map<string, CendojSearchResult>();
    const queryTypes: Array<"supporting" | "contrary"> = ["supporting", "contrary"];

    for (const qtype of queryTypes) {
      const queryList = queries[qtype];
      for (const params of queryList) {
        try {
          const retrievalStart = Date.now();
          const response = await cendojSearch(params);
          totalRetrievalMs += Date.now() - retrievalStart;

          for (const result of response.results.slice(0, MAX_CANDIDATES_PER_ISSUE)) {
            const key = result.roj || result.id || `${result.titulo}_${result.fecha}`;
            if (!candidateMap.has(key)) {
              candidateMap.set(key, result);
            }
          }
        } catch {
          // Continue on individual search failure
        }
      }
    }

    // Classify each candidate
    const issueCandidates: IssueResult["candidates"] = [];

    for (const [, candidate] of candidateMap) {
      const aiStart = Date.now();
      const classification = await classifyRelationship(apiKey, iss.issue, relatedArgTexts, candidate);
      totalAiMs += Date.now() - aiStart;

      issueCandidates.push({
        decision_roj: candidate.roj || null,
        decision_ecli: candidate.ecli || null,
        organo: candidate.organo || null,
        fecha: candidate.fecha || null,
        titulo: candidate.titulo || null,
        resumen: candidate.resumen || null,
        relationship: classification.relationship,
        reason: classification.reason,
        evidence_basis: classification.evidence_basis,
        source_url: candidate.url_pdf || "",
      });
    }

    allResults.push({
      issue_text: iss.issue,
      candidates: issueCandidates,
    });

    resultsByIssue.set(iss.issue, issueCandidates);
  }

  // 9. Gap analysis
  const gapAnalysis = generateGapAnalysis(issues, citationsList, resultsByIssue);

  // 10. Persist results
  const insertValues = allResults.flatMap((ir) =>
    ir.candidates.map((c) => ({
      documentId: document_id,
      analysisId: analysis_id,
      userId: auth.user.userId,
      issueText: ir.issue_text,
      decisionRoj: c.decision_roj,
      decisionEcli: c.decision_ecli,
      organo: c.organo,
      fecha: c.fecha,
      relationship: c.relationship,
      reason: c.reason,
      evidenceBasis: c.evidence_basis,
      sourceUrl: c.source_url,
    })),
  );

  if (insertValues.length > 0) {
    await db.insert(documentResearchResults).values(insertValues);
  }

  const totalMs = Date.now() - totalStart;

  // 11. Return
  return NextResponse.json({
    document_id,
    analysis_id,
    results: allResults,
    gap_analysis: gapAnalysis,
    performance: {
      total_ms: totalMs,
      retrieval_ms: totalRetrievalMs,
      ai_ms: totalAiMs,
      issues_searched: targetIssues.length,
      candidates_found: allResults.reduce((sum, r) => sum + r.candidates.length, 0),
    },
  });
}
