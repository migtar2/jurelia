import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { betaFeedback } from "@/lib/db/schema";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { feedback_type, description, context } = body as {
    feedback_type?: string;
    description?: string;
    context?: Record<string, unknown>;
  };

  const VALID_TYPES = [
    "wrong_decision",
    "wrong_classification",
    "bad_summary",
    "bad_match",
    "missing_jurisprudence",
    "other",
  ];

  if (!feedback_type || !VALID_TYPES.includes(feedback_type)) {
    return NextResponse.json(
      { error: "Tipo de feedback inválido" },
      { status: 400 }
    );
  }

  try {
    const [row] = await db
      .insert(betaFeedback)
      .values({
        userId: session.userId,
        feedbackType: feedback_type,
        description: description?.trim() || null,
        context: context ?? null,
      })
      .returning({ id: betaFeedback.id });

    return NextResponse.json({ id: row.id, ok: true });
  } catch (err) {
    console.error("[FEEDBACK]", err);
    return NextResponse.json(
      { error: "Error al guardar el feedback" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 });
  }

  // Only allow admin-ish access — for now any authenticated user can view
  const rows = await db
    .select()
    .from(betaFeedback)
    .orderBy(betaFeedback.createdAt);

  return NextResponse.json({ feedback: rows });
}