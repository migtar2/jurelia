import { NextResponse } from "next/server";
import type { SessionPayload } from "./session";
import { getSession } from "./session";

/**
 * Returns the authenticated user or a 401 response.
 * Use in every protected API route.
 */
export async function requireAuth(): Promise<
  { user: SessionPayload; error?: never } | { user?: never; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }
  return { user: session };
}