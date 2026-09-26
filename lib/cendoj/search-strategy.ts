// Progressive search strategy for CENDOJ

import type { LegalMetadata, SearchAttempt } from "../news/types";
import { cendojSearch, type CendojSearchResult } from "./client";

interface StrategyResult {
  attempts: SearchAttempt[];
  candidates: CendojSearchResult[];
}

export async function executeSearchStrategy(meta: LegalMetadata): Promise<StrategyResult> {
  const attempts: SearchAttempt[] = [];
  let attemptNum = 0;

  // Priority 1: ECLI exacto
  if (meta.ecli?.value) {
    attemptNum++;
    const result = await trySearch(attemptNum, "ECLI", { ecli: meta.ecli.value });
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      // Cross-validate: if we have resolution_number, check it matches
      if (meta.resolution_number?.value) {
        const matches = result.results.filter(r => 
          r.n_resolucion && normalize(r.n_resolucion) === normalize(meta.resolution_number!.value)
        );
        if (matches.length > 0) return { attempts, candidates: matches };
        // ECLI result doesn't match resolution_number → continue searching
      } else {
        return { attempts, candidates: result.results };
      }
    }
  }

  // Priority 2: ROJ exacto (normalize TS → STS for CENDOJ)
  if (meta.roj?.value) {
    attemptNum++;
    const normalizedRoj = normalizeRoj(meta.roj.value);
    const result = await trySearch(attemptNum, "ROJ", { roj: normalizedRoj });
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
    // Try original value too
    if (normalizedRoj !== meta.roj.value) {
      attemptNum++;
      const result2 = await trySearch(attemptNum, "ROJ-raw", { roj: meta.roj.value });
      attempts.push(result2.attempt);
      if (result2.results.length > 0) {
        return { attempts, candidates: result2.results };
      }
    }
  }

  // Priority 2.5: Construct ROJ from court + resolution number
  if (meta.resolution_number?.value && meta.court?.value) {
    const constructedRoj = constructRoj(meta.court.value, meta.resolution_number.value);
    if (constructedRoj) {
      attemptNum++;
      const result = await trySearch(attemptNum, "constructed-ROJ", { roj: constructedRoj });
      attempts.push(result.attempt);
      if (result.results.length > 0) {
        return { attempts, candidates: result.results };
      }
    }
    // Try TSJ community-specific ROJ construction
    const tsjRojs = constructTsjRoj(meta.court.value, meta.resolution_number.value);
    for (const tsjRoj of tsjRojs) {
      attemptNum++;
      const result = await trySearch(attemptNum, "constructed-TSJ-ROJ", { roj: tsjRoj });
      attempts.push(result.attempt);
      if (result.results.length > 0) {
        return { attempts, candidates: result.results };
      }
    }
  }

  // Priority 2.6: Brute-force ROJ construction from resolution number alone
  // Try all common court prefixes when we have resolution_number but court may be wrong
  if (meta.resolution_number?.value) {
    const prefixes = ["STS", "STC", "SAN"];
    for (const prefix of prefixes) {
      const roj = `${prefix} ${meta.resolution_number.value}`;
      attemptNum++;
      const result = await trySearch(attemptNum, "brute-ROJ", { roj });
      attempts.push(result.attempt);
      if (result.results.length > 0) {
        return { attempts, candidates: result.results };
      }
    }
    // Also try common TSJ communities
    const tsjCodes = ["CAT", "M", "AND", "CV", "GAL", "PV", "CYL", "CLM", "AR", "MU", "EX", "AS", "CAN", "CB", "NA", "RI", "IB"];
    for (const code of tsjCodes) {
      const roj = `STSJ ${code} ${meta.resolution_number.value}`;
      attemptNum++;
      const result = await trySearch(attemptNum, "brute-TSJ-ROJ", { roj });
      attempts.push(result.attempt);
      if (result.results.length > 0) {
        return { attempts, candidates: result.results };
      }
    }
  }

  // Priority 3: Número resolución + tribunal
  if (meta.resolution_number?.value && meta.court?.value) {
    attemptNum++;
    const result = await trySearch(attemptNum, "resolution+court", {
      n_resolucion: meta.resolution_number.value,
      query: meta.court.value,
    });
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 3.5: Número resolución solo
  if (meta.resolution_number?.value) {
    attemptNum++;
    const result = await trySearch(attemptNum, "resolution-only", {
      n_resolucion: meta.resolution_number.value,
    });
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 4: Número recurso + tribunal
  if (meta.appeal_number?.value && meta.court?.value) {
    attemptNum++;
    const result = await trySearch(attemptNum, "appeal+court", {
      n_recurso: meta.appeal_number.value,
      query: meta.court.value,
    });
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 5: Fecha + tribunal + jurisdicción
  if (meta.decision_date?.value && meta.court?.value) {
    attemptNum++;
    const params: Record<string, string> = {
      query: meta.court.value,
      fecha_desde: meta.decision_date.value,
      fecha_hasta: meta.decision_date.value,
    };
    if (meta.jurisdiction?.value) {
      params.jurisdiccion = meta.jurisdiction.value;
    }
    const result = await trySearch(attemptNum, "date+court", params);
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 6: Ponente
  if (meta.judge?.value) {
    attemptNum++;
    const params: Record<string, string> = { ponente: meta.judge.value };
    if (meta.jurisdiction?.value) {
      params.jurisdiccion = meta.jurisdiction.value;
    }
    const result = await trySearch(attemptNum, "ponente", params);
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 7: Norma + tema
  if (meta.laws?.value && meta.laws.value.length > 0) {
    attemptNum++;
    const result = await trySearch(attemptNum, "law+topic", {
      query: meta.laws.value[0],
    });
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 8: Búsqueda textual semántica (use article summary/topics)
  if (meta.summary?.value) {
    attemptNum++;
    const params: Record<string, string> = { query: meta.summary.value };
    if (meta.jurisdiction?.value) {
      params.jurisdiccion = meta.jurisdiction.value;
    }
    const result = await trySearch(attemptNum, "semantic", params);
    attempts.push(result.attempt);
    if (result.results.length > 0) {
      return { attempts, candidates: result.results };
    }
  }

  // Priority 9: Topic keywords
  if (meta.legal_topics?.value && meta.legal_topics.value.length > 0) {
    attemptNum++;
    const query = meta.legal_topics.value.slice(0, 3).join(" ");
    const params: Record<string, string> = { query };
    if (meta.jurisdiction?.value) {
      params.jurisdiccion = meta.jurisdiction.value;
    }
    const result = await trySearch(attemptNum, "topics", params);
    attempts.push(result.attempt);
    return { attempts, candidates: result.results };
  }

  return { attempts, candidates: [] };
}

interface TrySearchResult {
  attempt: SearchAttempt;
  results: CendojSearchResult[];
}

async function trySearch(
  num: number,
  type: string,
  params: Record<string, string>
): Promise<TrySearchResult> {
  const start = Date.now();
  try {
    const response = await cendojSearch(params);
    return {
      attempt: {
        attempt: num,
        type,
        params,
        result_count: response.total,
        duration_ms: Date.now() - start,
      },
      results: response.results.slice(0, 10), // Cap candidates
    };
  } catch (err) {
    return {
      attempt: {
        attempt: num,
        type,
        params,
        result_count: 0,
        duration_ms: Date.now() - start,
      },
      results: [],
    };
  }
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Normalize ROJ for CENDOJ: "TS 154/2025" → "STS 154/2025"
function normalizeRoj(roj: string): string {
  const trimmed = roj.trim();
  // If starts with "TS " (not "STS " or "STSJ "), prefix with "S"
  if (/^TS\s/i.test(trimmed) && !/^STS/i.test(trimmed)) {
    return "S" + trimmed;
  }
  return trimmed;
}

// Construct ROJ from court name + resolution number
// "Tribunal Supremo" + "155/2025" → "STS 155/2025"
// "Audiencia Provincial" + "581/2026" → "SAP 581/2026" (incomplete without location)
function constructRoj(court: string, resolution: string): string | null {
  const c = court.toLowerCase();
  if (c.includes("tribunal supremo")) return `STS ${resolution}`;
  if (c.includes("tribunal constitucional")) return `STC ${resolution}`;
  if (c.includes("audiencia nacional")) return `SAN ${resolution}`;
  if (c.includes("tribunal superior de justicia")) return `STSJ ${resolution}`;
  return null;
}

// Construct ROJ for TSJ with community
// "Tribunal Superior de Justicia de Cataluña" + "236/2025" → "STSJ CAT 236/2025"
function constructTsjRoj(court: string, resolution: string): string[] {
  const c = court.toLowerCase();
  const rojs: string[] = [];
  if (!c.includes("tribunal superior de justicia")) return rojs;
  
  const communityMap: [RegExp, string][] = [
    [/catalu[nñ]a/, "CAT"],
    [/madrid/, "M"],
    [/andaluc[ií]a/, "AND"],
    [/valenc/, "CV"],
    [/galicia/, "GAL"],
    [/pa[ií]s\s*vasco|euskadi/, "PV"],
    [/castilla.*le[oó]n/, "CYL"],
    [/castilla.*la\s*mancha/, "CLM"],
    [/arag[oó]n/, "AR"],
    [/murcia/, "MU"],
    [/extremadura/, "EX"],
    [/asturias/, "AS"],
    [/canarias/, "CAN"],
    [/cant[aá]bria/, "CB"],
    [/navarra/, "NA"],
    [/la\s*rioja/, "RI"],
    [/baleares|illes/, "IB"],
  ];
  
  for (const [regex, code] of communityMap) {
    if (regex.test(c)) {
      rojs.push(`STSJ ${code} ${resolution}`);
    }
  }
  return rojs;
}
