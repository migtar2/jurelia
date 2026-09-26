import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const results = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.userId, auth.user.userId))
    .orderBy(tags.name);

  return NextResponse.json({ tags: results.map((r) => r.name) });
}