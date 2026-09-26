import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import * as path from "path";

/* ── Constants ── */
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const EXTRACTION_TIMEOUT_MS = 60_000; // 60 s

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// Magic bytes
const PDF_MAGIC = Buffer.from("%PDF");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 (DOCX is ZIP)
const MZ_MAGIC = Buffer.from([0x4d, 0x5a]); // MZ – Windows PE / DOS executable
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF – Linux executable

/* ── Helpers ── */

/** Strip path separators and keep only the basename. */
function sanitizeFilename(name: string): string {
  // Remove any path components (backslash, forward-slash, colon)
  const base = name.replace(/^.*[/\\:]/, "");
  // Strip null bytes and control characters
  return base.replace(/[\x00-\x1f]/g, "");
}

/** Validate extension and return its canonical form. */
function getExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

/** Map extension to extraction method label. */
function extractionMethod(ext: string): string {
  switch (ext) {
    case ".pdf":
      return "pdf-parse";
    case ".docx":
      return "mammoth";
    case ".txt":
      return "direct";
    default:
      return "unknown";
  }
}

/** Reject executables and HTML-disguised-as-documents via magic bytes / content scan. */
function rejectMalicious(buf: Buffer, ext: string): string | null {
  // Reject executable formats regardless of claimed extension
  if (buf.length >= 2 && buf.subarray(0, 2).equals(MZ_MAGIC)) {
    return "Archivo ejecutable rechazado (cabecera MZ)";
  }
  if (buf.length >= 4 && buf.subarray(0, 4).equals(ELF_MAGIC)) {
    return "Archivo ejecutable rechazado (cabecera ELF)";
  }

  // Extension-specific magic-byte validation
  if (ext === ".pdf") {
    if (buf.length < 4 || !buf.subarray(0, 4).equals(PDF_MAGIC)) {
      return "El archivo no parece ser un PDF válido (firma mágica incorrecta)";
    }
  }
  if (ext === ".docx") {
    if (buf.length < 4 || !buf.subarray(0, 4).equals(ZIP_MAGIC)) {
      return "El archivo no parece ser un DOCX válido (firma mágica incorrecta)";
    }
  }

  // For .txt files: reject if the first 1024 bytes contain HTML markers
  if (ext === ".txt") {
    const head = buf.subarray(0, Math.min(1024, buf.length)).toString("utf-8").toLowerCase();
    if (
      head.includes("<html") ||
      head.includes("<body") ||
      head.includes("<!doctype")
    ) {
      return "El archivo de texto contiene marcadores HTML y fue rechazado";
    }
  }

  return null; // OK
}

/* ── Text extraction with timeout ── */

async function extractText(
  buf: Buffer,
  ext: string,
): Promise<{ text: string; pages?: number }> {
  // Wrap extraction in a timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

  try {
    if (ext === ".pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      await parser.destroy();
      return { text: result.text, pages: result.total };
    }

    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await (mammoth.default ?? mammoth).extractRawText({ buffer: buf });
      return { text: result.value };
    }

    // .txt
    return { text: buf.toString("utf-8") };
  } finally {
    clearTimeout(timer);
  }
}

/** Trim and collapse multiple blank lines. */
function normalizeText(raw: string): string {
  return raw
    .trim()
    .replace(/\n{3,}/g, "\n\n"); // collapse 3+ newlines to 2
}

/* ── Route handler ── */

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // 2. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar el formulario (multipart/form-data requerido)" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Campo 'file' requerido" },
      { status: 400 },
    );
  }

  // 3. Filename sanitization
  const rawName = file.name ?? "unnamed";
  const safeName = sanitizeFilename(rawName);
  if (!safeName) {
    return NextResponse.json(
      { error: "Nombre de archivo inválido" },
      { status: 400 },
    );
  }

  // 4. Extension validation
  const ext = getExtension(safeName);
  if (!ext) {
    return NextResponse.json(
      { error: `Extensión no permitida. Solo se aceptan: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}` },
      { status: 400 },
    );
  }

  // 5. MIME validation
  const mime = file.type || "";
  if (mime && !ALLOWED_MIMES.has(mime)) {
    return NextResponse.json(
      { error: `Tipo MIME no permitido: ${mime}` },
      { status: 400 },
    );
  }

  // 6. Size validation
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / (1024 * 1024)} MB` },
      { status: 400 },
    );
  }

  // 7. Read buffer + magic-byte / content validation
  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  const malicious = rejectMalicious(buf, ext);
  if (malicious) {
    return NextResponse.json({ error: malicious }, { status: 400 });
  }

  // 8. Extract text
  const warnings: string[] = [];
  let extraction: { text: string; pages?: number };

  try {
    extraction = await extractText(buf, ext);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error desconocido durante la extracción";
    return NextResponse.json(
      { error: `Fallo al extraer texto: ${msg}` },
      { status: 422 },
    );
  }

  const normalized = normalizeText(extraction.text);

  if (normalized.length === 0) {
    warnings.push("El documento no contiene texto extraíble");
  }

  // 9. Persist metadata (NOT raw text)
  const [doc] = await db
    .insert(documents)
    .values({
      userId: auth.user.userId,
      filename: safeName,
      originalType: ext.replace(".", ""), // pdf | docx | txt
      sizeBytes: file.size,
      textLength: normalized.length,
      extractionMethod: extractionMethod(ext),
      pages: extraction.pages ?? null,
    })
    .returning({ id: documents.id });

  // 10. Return result
  return NextResponse.json({
    document_id: doc.id,
    filename: safeName,
    type: ext.replace(".", ""),
    size: file.size,
    text_length: normalized.length,
    extraction_method: extractionMethod(ext),
    ...(extraction.pages !== undefined ? { pages: extraction.pages } : {}),
    warnings,
  });
}