# CENDOJ Intelligence Platform — Stitch Mega-Prompt

Copia todo el bloque de abajo y pégalo en https://stitch.withgoogle.com

---

## Design System (compartido por todas las pantallas)

**Palette:**
- Primary: #1E3A5F (azul jurídico profundo)
- Secondary: #2563EB (azul brillante para acciones)
- Accent: #F59E0B (ámbar para alertas/verificación)
- Surface: #F8FAFC (fondo claro)
- Surface Elevated: #FFFFFF (tarjetas)
- Text Primary: #0F172A
- Text Secondary: #64748B
- Success: #10B981 (VERIFIED)
- Warning: #F59E0B (PROBABLE)
- Error: #EF4444 (NOT_FOUND)
- Border: #E2E8F0

**Typography:**
- Font: Inter (headings 600-700 weight, body 400)
- H1: 28px bold
- H2: 20px semibold
- Body: 14px regular
- Caption: 12px regular

**Shapes:**
- Border radius: 12px (cards), 8px (buttons/inputs)
- Shadows: subtle (0 1px 3px rgba(0,0,0,0.08))
- Spacing: 16px base grid

**Style:** Professional legal tech. Clean, sober, high readability. Desktop-first. No excessive animations. White/light backgrounds with blue accent hierarchy.

---

--- SCREEN 1: Home / Landing ---

A full-page legal search platform home screen. Top header bar with logo "⚖️ CENDOJ Intelligence Platform" on the left and a status badge "CENDOJ API ONLINE" (green dot) on the right.

Below the header, a centered tab switcher with two tabs: "🔍 Búsqueda Manual" (active, white bg) and "📰 Buscar desde Noticia" (inactive, gray bg).

Under the active tab, a large white search card with:
- A prominent search input with placeholder "Describe la jurisprudencia que quieres encontrar..."
- A blue "🔍 Buscar Jurisprudencia" button next to it
- Below the input, a "▼ Filtros avanzados" collapsible link
- Below that, example query pills: "tarjetas revolving usura", "pensión alimentos", "despido disciplinario", "responsabilidad patrimonial"

The overall layout is centered, max-width 900px, with generous padding. Background is very light gray (#F8FAFC). Professional and minimal.

---

--- SCREEN 2: Search Results ---

Same header and tab bar as Screen 1. Below, a results summary line: "47,973 resoluciones encontradas (7.0s)".

Below that, a vertical list of result cards. Each card is white with subtle border and contains:
- Title line: "SAP Tarragona, a 16 de septiembre de 2026"
- Metadata row: "SAP Tarragona · Tarragona · 2026-09-16 · Ponente: INMACULADA PERDIGONES SANCHEZ"
- Identifier row: "ROJ: SAP T 1391/2026" (blue monospace) and "ECLI: ES:APT:2026:1391" (purple monospace)
- A 3-line snippet of the resolution summary in gray text
- Two action buttons: "📖 Ver Sentencia" (blue, primary) and "🏛️ Fuente Oficial" (gray outline)

Show 3 result cards. Cards have hover effect with blue border.

---

--- SCREEN 3: News Analysis Mode ---

Same header. The "📰 Buscar desde Noticia" tab is now active.

A large dashed-border drop zone with:
- 📰 emoji icon centered
- "Arrastra aquí una noticia jurídica" as main text
- "Soporta enlaces arrastrados desde el navegador" as subtitle

Below the drop zone, an URL input field with placeholder "O pega el enlace aquí: https://..." and a blue "🔍 Analizar Noticia" button.

Below that, a pipeline progress indicator showing 5 steps with connecting lines:
1. URL Validation ✓ (green check)
2. Article Extraction ✓ (green check)
3. Legal Metadata Extraction ✓ (green check)
4. CENDOJ Search (spinner, in progress)
5. Verification (gray, pending)

---

--- SCREEN 4: News Analysis Result (VERIFIED) ---

Header with "← Volver a resultados" link at top.

Three stacked sections:

**Section 1: "📰 NOTICIA ORIGINAL"**
White card showing:
- Título: "El Supremo estima la primera demanda colectiva contra las tarjetas revolving"
- Medio: EL PAÍS
- Fecha: 2026-02-25
- 🔗 Abrir noticia original (blue link)

**Section 2: "🔍 DATOS JURÍDICOS DETECTADOS"**
White card with a 2-column grid:
- ECLI: ES:TS:2026:2849 (purple monospace, "explicit" badge)
- ROJ: STS 2849/2026 (blue monospace, "explicit" badge)
- Tribunal: Tribunal Supremo
- Jurisdicción: Civil
- Fecha: 2026-02-25
- Topics: tags "revolving", "usura", "consumidor"

**Section 3: "✅ SENTENCIA LOCALIZADA"**
A green-bordered card (#10B981 border) with:
- Large "✅ SENTENCIA LOCALIZADA" heading
- "Identificador oficial coincide exactamente con la resolución encontrada."
- Confidence: 95%

Below, an evidence section "📋 POR QUÉ CREEMOS QUE ES ESTA SENTENCIA" with checkmarks:
- ✓ ECLI coincide exactamente
- ✓ ROJ coincide exactamente
- ✓ Tribunal coincide
- ✓ Fecha coincide

---

--- SCREEN 5: News Analysis Result (NOT_FOUND) ---

Same layout as Screen 4 but with different result:

**Section 1: Noticia** — same structure

**Section 2: Datos jurídicos** — shows extracted data but with fewer identifiers (only court and topics, no ECLI/ROJ)

**Section 3: "❌ NO SE HA PODIDO VERIFICAR"**
A red-bordered card (#EF4444 border) with:
- "No hemos podido identificar con suficiente seguridad la sentencia mencionada en esta noticia."
- "Esto NO es un error del sistema."
- Confidence: 0%

Below, a "🔎 BÚSQUEDAS REALIZADAS" section showing search attempts:
- #1 (topics): 351 results — 10.2s
- No candidates found

---

--- SCREEN 6: Candidate Comparison (AMBIGUOUS) ---

Header shows "🔀 MÚLTIPLES CANDIDATOS" with orange border.

Below, 3 candidate cards stacked vertically. Each card shows:
- Title, court, date, ROJ, ECLI
- A horizontal score bar (like a progress bar) showing match percentage
- Match reason tags: "Tribunal coincide", "Fecha aproximada", "Tema coincide"
- Action buttons: "📖 Leer Sentencia", "Copiar ECLI", "Copiar ROJ"

First card has 72% score (yellow bar), second has 58%, third has 45%.

---

--- SCREEN 7: Resolution Detail ---

A detail view showing:
- Title: "STS, a 15 de enero de 2025 - ROJ: STS 154/2025"
- Metadata grid: Tribunal, Sede, Fecha, Ponente, ROJ, ECLI, Nº Resolución, Nº Recurso
- Action buttons row: "📋 Copiar texto", "📄 Abrir PDF", "🏛️ Abrir en CENDOJ"
- Below, a text panel "TEXTO DE LA RESOLUCIÓN" showing the first lines of the actual resolution text in a scrollable area (max-height 600px)

---

--- SCREEN 8: Diagnostic Panel ---

A collapsible dark panel (#1E293B background) at the bottom of any screen, labeled "▼ Diagnóstico".

When expanded, it shows a monospace grid:
- CENDOJ API: ONLINE (green)
- Base URL: http://127.0.0.1:8000
- Endpoint: /api/search?query=tarjeta+revolving
- HTTP Status: 200
- Tiempo: 7.0s
- Resultados: 47,973

Below the grid, a "JSON RAW" collapsible section that shows raw JSON response when expanded.

---
