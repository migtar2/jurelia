# FALSE NEGATIVE ANALYSIS — CENDOJ Pipeline

> **Fecha**: 2026-09-24
> **Baseline**: 20 E2E cases, 7 false negatives (NOT_FOUND with expected ROJ)

---

## ROOT CAUSE CLASSIFICATION

| # | Case | Expected ROJ | Failure Stage | Root Cause |
|---|------|-------------|---------------|------------|
| 8 | TSJ Cataluña despido nulo | STSJ CAT 236/2025 | METADATA_EXTRACTION | Article references STC 114/1989 (different case); court extracted as "Tribunal Constitucional" instead of TSJ Cataluña |
| 9 | TSJ Asturias Telefónica | STSJ AS 1491/2025 | METADATA_EXTRACTION | No ROJ/ECLI/resolution extracted from article; only topic keywords |
| 13 | García Ortiz revelación | STS 1000/2025 | METADATA_EXTRACTION | No ROJ/ECLI/resolution extracted; article doesn't mention identifiers |
| 20 | TC abogado sancionado | STC 27/2025 | CENDOJ_RETRIEVAL | TC search causes 500 error in CENDOJ API; ROJ extracted correctly but search fails |
| R2 | Cártel camiones | STS 951/2025 | METADATA_EXTRACTION | ECLI from different case (2013:5819) captured; resolution 373/2025 extracted but court wrong ("Audiencia Provincial") |
| R18 | Intereses demora | STS 1724/2025 | SEARCH_STRATEGY | No metadata extracted; brute-force ROJ search now finds it |
| E2 | Crédito usurario | STS 350/2025 | METADATA_EXTRACTION | No ROJ/ECLI/resolution extracted; article doesn't mention identifiers |

## FAILURE STAGE DISTRIBUTION

| Stage | Count | Cases |
|-------|-------|-------|
| METADATA_EXTRACTION | 5 | 8, 9, 13, R2, E2 |
| CENDOJ_RETRIEVAL | 1 | 20 |
| SEARCH_STRATEGY | 1 | R18 |

## IMPROVEMENTS IMPLEMENTED

### 1. Brute-force ROJ construction (Priority 2.6)
When resolution_number is extracted, try ALL common court prefixes:
- STS, STC, SAN (3 prefixes)
- STSJ with 17 community codes (CAT, M, AND, CV, GAL, PV, etc.)
- Total: 20 ROJ variants per resolution_number

**Impact**: R2 and R18 now found (NOT_FOUND → AMBIGUOUS)

### 2. ECLI cross-validation (Priority 1)
When ECLI search returns a result, verify resolution_number matches before accepting. If mismatch, continue searching.

**Impact**: Prevents false matches from wrong ECLI references in articles

### 3. TSJ community ROJ construction (Priority 2.5)
Construct STSJ ROJ with community code from court name:
"Tribunal Superior de Justicia de Cataluña" + "236/2025" → "STSJ CAT 236/2025"

**Impact**: Enables finding TSJ resolutions when court is correctly extracted

### 4. Resolution-only search (Priority 3.5)
Search by n_resolucion alone as fallback.

**Impact**: Backup when court extraction is wrong

### 5. Brute-force ROJ scoring bonus
Candidates found via brute-ROJ search get +45 score bonus.

**Impact**: R2 and R18 now score 45+ → AMBIGUOUS instead of NOT_FOUND

## REMAINING LIMITATIONS

### Articles without identifiers (cases 9, 13, E2)
Some articles summarize court decisions without mentioning ROJ, ECLI, or resolution number. The pipeline cannot find these because:
- CENDOJ doesn't support semantic search
- Topic-based search returns too many results
- No hard identifier to match against

**Proposed fix**: Extract identifiers from article URLs (e.g., iberley.es URLs contain case metadata)

### Wrong ECLI extraction (case R2)
Articles may reference multiple ECLIs from related cases. The first ECLI found may not be the main case.

**Proposed fix**: Score all ECLI matches and prefer the one that matches other metadata

### TC search 500 error (case 20)
CENDOJ API returns 500 when searching for TC (Tribunal Constitucional) ROJs.

**Proposed fix**: Handle TC search errors gracefully; try alternative search methods

### Court extraction wrong (cases 8, R2)
The first court mentioned in the article may be from a reference, not the main case.

**Proposed fix**: Use URL-based court inference; score multiple court extractions

## BEFORE vs AFTER

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| VERIFIED | 0 | 0 | — |
| PROBABLE | 6 | 6 | — |
| AMBIGUOUS | 6 | 8 | +2 |
| NOT_FOUND | 8 | 6 | -2 |
| FALSE_NEGATIVES | 7 | 5 | -2 |
| FALSE_POSITIVES | 0 | 0 | — |
| FALSE_VERIFIED | 0 | 0 | — |

## NEXT STEPS

1. **URL-based metadata extraction**: Extract court/ROJ from article URLs (iberley.es, iustel.com patterns)
2. **Multi-ECLI scoring**: Score all ECLI matches, prefer consistent ones
3. **TC search fix**: Handle Tribunal Constitucional 500 errors
4. **Decision text verification**: When candidate found, fetch full text and compare quoted phrases
