# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Formula 1 is a QbD (Quality-by-Design) engine for pharmaceutical **formulation** design. Given a SMILES and a dose, it proposes candidate formulations (API + excipients + process steps), checks them against sourced rulebooks, and — where a verdict hinges on a value that can only be measured — asks the user for a **specific test** (XRPD, DSC, equilibrium solubility, …). The design principle: **AI proposes recipes, deterministic rules verify them, and experiments fill what neither can know** — creative generation is LLM work, but strategy selection, safety/regulatory checks and confidence tagging must be a calculator (same input → same plan → same verdict).

**The output boundary is a ranked list of candidate formulations** — ingredients, process steps, rule verdicts, a confidence tag (`grounded` | `provisional`), and the unresolved data requests. QbD/DoE, dissolution method/PBPK, stability/packaging, executable protocols, researcher approval and post-batch feedback are **out of scope** (their inputs don't exist when nothing is manufactured).

**Three authorities, never conflated.** The rulebook `gate` is the only thing that can **reject**. The data-request layer (`DRQ_NARROW` / `DRQ_REFINE`) is the only thing that sets a candidate's **confidence**. Judges only **rank**. A rulebook pass means "no explicit violation found", not "safe" — a novel API often has no data, so nothing fires; that is exactly why candidates carry `provisional` plus the tests that would settle it. Data requests **never block**: the graph always runs to the candidate list.

The README.md (Korean) is the authoritative design doc — update it (and `web/static/explainer.js`, which mirrors it) in the same commit when the design story changes.

## v3 migration status — read this first

README.md and `explainer.js` describe **v3**. The code in this repo (and the live pod at zihwan.com/f) is still **v1**: rulebook gate → Evidence Readiness Gate (`blocked → ready_for_review → approved`) → judges → consensus, plus the post-batch lab loop. v3 removes the evidence gate, approval and the wet-lab loop, and replaces them with non-blocking data requests.

The v3 spec lives **outside the repo** at `~/Desktop/Formula1_v3/formula1-v3/`:
- `IMPLEMENTATION_GUIDE.md` — data model, graph, invariants I-9–I-13, tests T-9–T-14, pitfalls, 4-week order
- `SCENARIO_TRACES.md` — X1 (two rounds) / X2 / X3 with exact numbers; `prototype/phase_gate_prototype.py` + `prototype_output.txt` reproduce them (stdlib only)
- `seeds/database/…` — CSVs to copy into `database/` (all rows `pending_team_review`)

Migration checklist (guide §6), in order:
1. Copy seeds: `00_master/derived_quantities.csv`, `04_biopharmaceutics/gate_3a_biopharm_class.csv` · `gate_3b_solid_form.csv` · `gate_4_enabling_strategy.csv` · `gate_4b_asd_process.csv`, `06_config/phase_registry.csv` · `strategy_families.csv` · `backtrack_transitions.csv` · `reviewer_registry.csv` (7 reviewers, adds REV007), `reference/measurement_catalog.csv` (20) · `data_request_triggers.csv` (16) · `counterion_pka_reference.csv` (9). **Don't delete** `evidence_requirements.csv` / `confirmation_test_master.csv` — unwire them from the manifest only.
2. `evaluate_triggers(ctx, urgency, strategy=None)` — a lookup over `data_request_triggers.csv` reusing the `checkers/applies_when.py` sandbox (fail-closed). Not a new strategy function.
3. `contracts.py`: add `Candidate.confidence` / `pending_refinements`; **delete** `ProtocolReadiness`. `formula/planner/strategy_planner.py`: `required_evidence` → `required_measurements`.
4. `graph.py`: `route` → `phase_gates`; add `drq_narrow` (before `plan`) and `drq_refine` (after `gate`, per candidate); remove `evidence`; add `backtrack` driven by `backtrack_transitions.csv` and `qtpp_review` terminal. `state.py`: drop protocol status.
5. `web/server.py`: add `POST /api/runs/{id}/measurements` (`reassess_with_measurements`); remove `/evidence`, `/confirmation`, `/approve`, `/wetlab`. UI: data-request card (Tier-sorted, input + "건너뛰기"), confidence badge + pending tags on candidate cards, `narrateEvent()` beats for `drq_narrow` / `drq_refine`, `SCENARIOS` → X1/X2/X3.
6. Verify: X1 two-round and X2 numbers match `SCENARIO_TRACES.md`; `plan.signature` 100% stable over 10 runs.

Until a step lands, the v1 descriptions below marked **(v1, to be removed)** are what actually runs.

## Commands

**Python 3.10+ required** (langgraph/fastapi/sse-starlette all need ≥3.10). The venv is 3.12.

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/pytest                                  # run this first when changing the core
.venv/bin/python scripts/demo.py                  # golden scenario (v1: reject → reflect → pass)
.venv/bin/python scripts/verify_smarts.py         # SMARTS truth-table report (exit 1 on mismatch)
.venv/bin/python scripts/feedback_demo.py         # v1 post-batch lab loop (to be removed)
.venv/bin/uvicorn web.server:app --port 8000      # dashboard at http://localhost:8000
.venv/bin/python scripts/import_rulebook.py       # re-import rulebook zips from 추가자료/
python3 ~/Desktop/Formula1_v3/formula1-v3/prototype/phase_gate_prototype.py   # v3 X1/X2 reference numbers
```

Everything runs **without an API key** — LLM nodes fall back to deterministic stand-ins so
demos never break. Set `GROQ_API_KEY` (free tier) or `ANTHROPIC_API_KEY` to enable a real LLM path.

## Deployment — this repo is served live at zihwan.com/f

This clone lives inside the home-server repo at `~/zihwan/formula1` but keeps **its own git
history** (origin is `github.com/zihwaan/formula1-qbd`); the hub repo does not track it.
It runs as an OrbStack k8s deployment. Editing a file changes nothing live until you rebuild:

```bash
cd ~/zihwan/formula1 && docker build -t formula1:latest . && kubectl rollout restart deployment/formula1
kubectl rollout status deployment/formula1 --timeout=180s
curl -s -o /dev/null -w '%{http_code}\n' https://zihwan.com/f/
```

FastAPI serves both the API and the no-build SPA, so one image covers front and back.
Full home-server context (proxy layout, secrets, traps) is in `~/zihwan/CLAUDE.md`.
**Don't redeploy the v3 explainer/README story on top of v1 code without saying so** — the live
guide would describe a data-request card that the dashboard doesn't have yet.

Three hosting concerns are baked into `web/server.py` — don't undo them:

- **`BASE_PATH` env** (`/f` in k8s — must match the hub proxy prefix in `hub/server.js`;
  empty locally). The hub proxy strips the prefix, so
  FastAPI routes stay rooted at `/`; the `/` handler injects `<base href>` + `window.__BASE__`
  and `app.js` builds every fetch/EventSource URL through `api()`. Local `uvicorn` on :8000 with
  no `BASE_PATH` behaves exactly as before.
- **Content-hashed asset URLs** (`_asset_version`). Filenames aren't hashed (no build step) and
  Cloudflare caches `.js`/`.css` for 4h when the origin sends no `Cache-Control` — without this,
  a redeploy keeps serving the old script.
- **Public-endpoint limits.** `MAX_ACTIVE_RUNS=3` (429 past that) and `MAX_STORED_RUNS=40`
  (oldest evicted). `RUNS` is an in-process dict, so this is what keeps a 24/7 public pod bounded;
  it's also why the image runs `--workers 1` (a second worker can't see another's run).
  The v3 measurement re-entry (`/measurements`) relies on the same in-process `Run` object.

## LLM providers — `formula/agents/client.py` wraps both

`parse_structured` / `stream_text` are the only touchpoints; agents never know the provider.
`FORMULA1_LLM_PROVIDER` = `auto` (default) | `anthropic` | `groq` | `none`. The pod pins `groq`.

The Groq path differs from Anthropic in ways that caused real failures:

- **`max_tokens` counts against the per-minute token limit (TPM).** A 2-token prompt with
  `max_tokens: 8192` returns **413** on the 8,000-TPM tier. `_groq_payload` therefore shrinks
  `max_tokens` to fit `GROQ_TPM[model]` and trims the prompt's middle if even that won't fit.
- **`_TokenBudget` meters TPM client-side — this is what keeps stand-in scores off the screen.**
  LangGraph fans generators and judges out in parallel, so without metering they hit Groq at once,
  collect 429s, and every judge falls back to a fabricated score that still renders as an opinion.
  The budget makes callers *queue* for a model with headroom (buckets are per-model, ~26k TPM
  combined) instead of failing. Measured: 4/4 judges fake before, 0 after — including two
  concurrent runs. Cost is latency: a full run is ~60s, not 11s. **Don't "speed it up" by removing
  the wait** — that trades real judgements for fake ones.
- Reserved tokens are reconciled with `usage.total_tokens` (`settle`) so over-reservation doesn't
  starve the next call. `GROQ_WAIT_BUDGET` caps how long a caller waits before giving up.
- The judge's score-extraction call must not resend the whole evaluation prompt — that doubled
  token spend was the main reason the budget ran out mid-run.
- **Structured output is `json_object` + schema in the system prompt**, not strict `json_schema`
  (which rejects the `$ref`/`anyOf` shapes Pydantic emits), with a validation-error retry hint.
- **gpt-oss reasoning tokens come out of the completion budget** → `reasoning_effort` is pinned
  `low`, otherwise reasoning eats the cap and `content` arrives empty.
- **Right-size `max_tokens` per call; do not raise the wait budget.** A reservation counts against
  the per-minute limit for a full 60s, so an oversized one starves later calls. Raising
  `GROQ_WAIT_BUDGET` to 110s made a 2-judge run *worse* (240s, 4 stand-ins); capping the judge's
  calls to their real need (narration 600, score 400) plus settling streaming reservations gave
  123s with 0 stand-ins. If stand-ins reappear, look for a call reserving more than it uses.
  v3 adds REV007 and widens REV002/REV005 summon conditions — more judges per run, so this matters more.

Deterministic stand-ins still exist for the no-key case, but they must never masquerade as real
judgements: the UI tags them (`.judge-note.stand-in` + "규칙 기반 대체 점수 · LLM 미사용") and the
run summary says how many nodes used them. Keep both signals if you touch that path.

## Architecture — the manifest is the linchpin

The whole system is **data-driven, not code-driven**. Rules, derived quantities, strategy selection, backtrack routes and data requests all live in CSVs; a YAML manifest wires rule CSVs into the right kind of check. Adding a rule = editing data (`database/*.csv` + one manifest entry), *never* editing backend code.

### v3 graph (target)

```
intake → phase_gates → drq_narrow → plan → generate ×≤3 → gate ─┬─ pass → drq_refine → summon → judge ×M → consensus → candidate list
                          ↑                                     ├─ reject → backtrack → reflect → phase_gates
                          │                                     └─ pinned ingredient is the reason → infeasible
plan (0 strategies) / backtrack (no strategy left) → qtpp_review
POST /measurements → recompute phase_gates + plan → same signature: refresh confidence only · different: regenerate from generate
```

Deterministic: `phase_gates`, `drq_narrow`, `plan`, `gate`, `drq_refine`, `summon`, `consensus`, `backtrack`. LLM: `intake`, `generate`, `judge`, `reflect`. Phase order is `phase_registry.csv` (P0 10 · P1 20 · DRQ_NARROW 25 · G3A 30 · G3B 35 · G4 40 · G4B 45 · G6R 48 · PLAN 50 · GEN 55 · GATE 60 · DRQ_REFINE 65 · SUMMON 70 · JURY 75 · CONS 80 · OUTPUT 90). The G9 layer (packaging, stability, dissolution, analytical) is **not wired** in v3; nor is coating.

- **`phase_gates`** reads `derived_quantities.csv` (23 rows: constants, D0, SLAD, Tg margin, ΔpKa, ESOL/GSE, `logs_pred_min`) then gates 3A (BCS/DCS), 3B (solid form, advisory only), 4 (enabling signals), 4B (HME vs SDD), 6R (flow → route). Uses a `derive_assign` strategy (condition true → assign values) — the **ninth** strategy, added in v2.
- **`plan`** scores the 8 families in `strategy_families.csv` (CONV_DC/DG/WG, MICRO, ASD_SDD, ASD_HME, LBF_SEDDS, CD) and keeps ≤3. Same input → same `plan.signature`; that signature decides recompute-vs-regenerate. Families without a process rulebook (ASD, HME, CD) are recorded as coverage gaps (COV001) and summon REV005.
- **`backtrack`** matches `backtrack_transitions.csv` (14 rows; `trigger_type` = `rule_verdict` | `measurement_result`) to a `return_phase` plus a constraint patch (`exclude_ingredient`, `exclude_strategy`, `penalize_family`, …). Per-phase 3 → escalate upward; 5 total → human. BT026 (GFA Class I) **penalizes** ASD, it doesn't exclude.
- **`drq_narrow` / `drq_refine`** call `evaluate_triggers` over `data_request_triggers.csv`: a row is pending when `condition_expression` is true and `satisfied_when` is false. `narrows_strategy` rows run before `plan`; `refines_confidence` rows run per candidate (`strategy` in scope, plus `has_flag()` / `has_step()`). `measurement_id` must exist in `measurement_catalog.csv` (Tier 1 ~10 mg → Tier 3 → strategy). Requests are sorted by tier and **merged by `measurement_id`**.

### v3 invariants (guide §7 — add tests T-9–T-14 with them)

- **I-1** `bcs_class` is set from measured values only. Predictions stop at `bcs_solubility_provisional`.
- **I-3** Don't compute SLAD when `permeability_factor` is unknown — filling PF=1 makes IIa mathematically impossible.
- **I-9** `drq_narrow` / `drq_refine` never end the graph. "Waiting for data" must not read as "not executable".
- **I-10** `confidence == "grounded"` ⟺ `pending_refinements == []`. Computed, never judged by an LLM.
- **I-11** No request may cite a `measurement_id` absent from the catalog (same "system can't invent a test" rule v1 had for `confirmation_test_master.csv`).
- **I-12** Once `satisfied_when` is true the request disappears next turn — never re-ask for data already given.
- **I-13** Triggers pointing at the same `measurement_id` (e.g. `DRQ_TM` and `DRQ_SOLIDFORM` both → `M_DSC`) merge into one request.

### v3 pitfalls already hit

- **`logs_pred_min` computed in Python is always `None`** — `logs_esol`/`logs_gse` are produced *inside* derive, so pre-computing it froze the prediction layer and X1 round 1 planned **zero** strategies (`PLAN []`). It's now DQ016–018 in the CSV. Derived values belong in data; the moment one moves to code you get ordering bugs.
- **DSC alone doesn't settle solid form** — that's why XRPD/DSC/TGA/KF are requested together (`DRQ_SOLIDFORM`).
- **"Prediction is low" ≠ "predictions disagree"** — `DRQ_SOL` fires for both, and the UI must show different reasons. X2: ESOL alone says adequate (211 mL), GSE with Tm=290 °C says low (2,868 mL); the conservative value is used.
- **ΔpKa thresholds are −1 / 4 (Cruz-Cabeza 2012), not ±3.** Tg margin is originally about Tg_mix (Hancock 1994); API-alone Tg is only a conservative proxy.
- ESOL/GSE are the whole B layer. SolTranNet / ADMET-AI / QupKake stay optional (not installed); when closed forms fail or disagree, **request a measurement instead of adding a model**.

### Rule gate — the three moving parts (unchanged from v1)

1. **`config/rulebook_manifest.yaml`** — the rule catalog. Each entry is a `RulebookEntry` that self-declares how its CSV gets checked:
   - `eval_type: quantitative` → routed to a deterministic strategy function.
   - `eval_type: qualitative` → routed to a Judge agent spec.
   - `applies_when` → a condition expression deciding whether this rule fires for a given input (e.g. `"is_pediatric"`, `"bcs_class in ['II','IV']"`).
   - `row_filter` → selects rows within a mixed CSV.
   - `schema` → maps this CSV's column names onto the generic strategy's expected keys.

2. **`formula/checkers/strategies.py`** — generic strategy functions reused across all rulebooks via `schema` column injection (eight in v1; v3 adds `derive_assign`). You almost never add a strategy; you add a CSV + manifest entry that reuses one. All share the signature `(entry, rows, recipe, spec, ctx) -> List[Verdict]` and return a passing verdict if nothing fires (never empty):
   - `pairwise_membership` — excipient × API functional-group incompatibility (Lactose + secondary_amine → Maillard). Ingredient names go through `checkers/excipients.py`, **never `==`** (see below).
   - `subset_forbidden` — a forbidden ingredient *set* being a subset of the recipe, optionally gated on `required_conditions`.
   - `threshold` — `param <op> threshold`; operators accept symbol/word forms plus `between` (`"lo;hi"`) and non-numeric `==`. Value source: `measured_param` | `ingredient_mg` | `role_percent` | `property` | `state`.
   - `range` — value outside `[min, max]` from a min/max column pair.
   - `categorical_requirement` — when `class == X`, a role/ingredient is mandatory (BCS II/IV → solubilizer required).
   - `conditional_prohibition` — a property flag forbids an option.
   - `band_lookup` — **produces** a derived value by band/predicate lookup (angle_of_repose 48° → `flow_character="Poor"`). Writes into `entry.provides`.
   - `decision_tree` — evaluates `condition_expression` rows to narrow process routes → `selected_route`.

   Four cross-cutting rules live here and are easy to get wrong:
   - **`polarity`** — `fail_when` (default) means the row describes a *failure* condition; `pass_when` means it describes a condition that must *hold*. The whole of `03_process/` is `pass_when`. Reading it the other way inverts every verdict.
   - **Per-row `action`** — severity comes from each CSV row's `action` column (7-value `RuleAction`), not from the manifest entry. The manifest `severity` is only a fallback.
   - **Evidence policy** — each row's `verification_status` decides whether it may produce a HARD_FAIL. `NO_SOURCE_FOUND`/`NOT_A_RULE`/`LEGACY` rows are dropped at load; `UNVERIFIED`/`SCHEMA_ONLY` get downgraded to REVIEWER_FLAG. See `VERIFICATION_POLICY` in `contracts.py`.
   - **Never compare ingredient names with `==`.** The rulebook writes `Lactose monohydrate`; a recipe writes `유당` / `Lactose` / `Lactose Monohydrate, NF`. String equality silently missed all three and INC002 read as 통과 (2026-08-06 사고). Names go through `formula/checkers/excipients.py`, whose match kinds are `exact` (same excipient, different spelling → fire as-is) and `generic` (recipe wrote a family name the rule specialises → **fire anyway**, with "등급 미지정" in the verdict). Family matching is head/tail only — plain subset would make `starch` hit `Sodium starch glycolate`, and a wrong rejection is the same accident in the other direction. The dictionary is data (both excipient masters' en/kr/synonyms columns); `config/excipient_aliases.yaml` holds only grade-token noise and gap-filling aliases, the same role `packaging_categories.yaml` plays for packaging.

3. **`formula/checkers/registry.py`** (`RulebookRegistry`) — loads the manifest and runs the firing checks **in `trigger_priority` order, as stages**. Values produced by one stage are injected into the next stage's `applies_when` scope. Never iterate rulebooks in folder order — pediatric safety lives in `05_regulatory/` but runs right after 1:1 incompatibility.
   - `run(spec, recipe, ...)` → `GateResult` (verdicts + derived state + skipped-row count). `passed` requires no HARD_FAIL **and** no ESCALATE.
   - **`spec.properties["structure_known"] is False` → a `STRUCT000` ESCALATE before any stage runs.** Tri-state on purpose (`ApiProfile.structure_resolved`): `None` = the chem layer never ran (hand-built specs, unit tests) and nothing is claimed; `False` = we tried and failed, so every structure-joined rule is *unevaluated*, not passed.
   - `ctx[CTX_IDENTITIES]` carries the pre-resolved ingredient→canonical-name map so strategies (which have no `base_dir`) do lookups without loading CSVs. It rides in `GateResult.derived`, so `_public_derived()` in `graph.py` strips `_`-prefixed keys before anything reaches an event.
   - `active_judges(spec, derived)` → `JudgeSpec`s whose `summon_condition` in `reviewer_registry.csv` is true (the dynamic "jury"). v3 summon signals to produce: `enabling_candidates_present`, `particle_size_candidates_present`, `asd_candidates_present`, `coverage_gap_present` (from `plan`), plus v1's `regulatory_narrative_needed` / `novel_combination_not_in_rulebook`.

### The other layers

- **구조 플래그 레지스트리 v1.1** (`database/00_master/structural_flags_registry.csv`, 82 flags) — the pharmacy team's reference guide turned into data. Each row carries SMARTS, `alert_level` (fact / conditional_alert / hard_alert), `required_cofactors`, `confirmation_test`, `specificity`, `false_positive_notes`. Adding a flag is a row, not code. Two post-processors are declared per row: `ring_size:N` (β vs γ lactam — only the *ring* atoms of a match may be tested) and `count_ge:N` (polyphenol = 2+ phenols).
  **`rulebook_group` is the compatibility bridge.** v1.1 splits amines into aliphatic/aromatic and 1°/2°/3°, but `incompatibility_1to1.csv` still joins on `primary_amine`/`secondary_amine`. `functional_groups()` emits both, and `test_rulebook_join_vocabulary_survives_rename` pins it. In v3 the same flags feed `has_flag()` in `DRQ_FORCED` (ester/lactam/phenol/secondary_amine → forced degradation request).
- **`formula/chem/descriptors_v2.py`** — structure quality, extended descriptors, derived screens (Lipinski/Veber with *reasons*). Never a hard gate.
- **`formula/chem/predictions.py`** — predictor registry. Adapters report `available()`; **nothing is fabricated when a model is absent**. In v3 the ESOL/GSE closed forms live in `derived_quantities.csv`, not here; external adapters stay optional.
- **`formula/experimental_inputs.py` + `config/experimental_inputs.yaml`** — the optional measured values the user supplies *before* a run. **(a) allowlist, not free-form** — these values are merged into the restricted-eval context, so an arbitrary key would let a user shadow `is_pediatric`/`flag` and bend the verdict; unknown or out-of-range keys are rejected and returned in `rejected_inputs` (never swallowed). **(b) every field must name a real consumer** — `test_catalog_keys_are_used_by_rulebook_or_evidence` scans CSV parameter columns, `condition_expression`, the manifest and the evidence table; in v3 extend it to `data_request_triggers.csv` (`result_keys`, `satisfied_when`) and `measurement_catalog.csv` (`output_fields`), and drop the evidence table. User values are seeded into the spec *before* `with_profile`, whose `setdefault` then can't overwrite them — 실측 > 추정 is enforced by assignment order.
- **`formula/evidence/gate.py`** — **(v1, to be removed)** the Evidence Readiness Gate over `evidence_requirements.csv` (16 rows, before_protocol / parallel / post_batch), `blocked → ready_for_review → approved`, `approve()` 409 while blocking, `Run.reassess()` with zero LLM calls. v3 replaces it with `evaluate_triggers` + `data_request_triggers.csv`; **keep its good habits**: requests may only cite catalog entries, numeric results are written into `spec.measured_params[result_key]` so `satisfied_when` becomes true on its own merit, a failed result is a negated premise (→ `backtrack` via `measurement_result`, never written as evidence), and the recompute path stays LLM-free.
- **`formula/feedback/`** — **(v1, to be removed)** the post-batch lab loop (`labloop.read_notes` LLM transcription → `interpreter.WetLabInterpreter` deterministic → `labloop.direct_next` LLM constrained to `confirmation_test_master.csv`). Out of scope in v3 because no batch is made. `test_planner.py` (structural alerts promote tests) is superseded by `refines_confidence` triggers using `has_flag()`.
- **`formula/rag/pdf_source.py`** — indexes reference books into the BM25 store. **Chunk per page, not per N pages** (merging pages fused two monographs). Books live in `database/reference/books/`, **gitignored and dockerignored** — indexed locally at runtime, never committed or shipped. Absent pypdf or books, the layer silently no-ops.
- **`formula/literature.py`** — PubChem + Europe PMC, no API key. Query uses `TITLE_ABS:` fields and relevance sort.
- **`formula/chem/smarts_probe.py`** — exposes the SMARTS layer to the UI (`GET/POST /api/chem/smarts`). Salts are stripped to the parent before matching. Pattern presets come from `structural_flags_smarts.csv` **together with each pattern's `triggers_rule`**.
- **`formula/chem/`** — RDKit input pipeline. `build_profile(api_name|smiles)` → `ApiProfile`. **Estimates must never set `bcs_class`** (I-1).
- **`formula/orchestrator/`** — LangGraph `StateGraph` (`graph.py`), shared state with a reset-aware `accumulate` reducer (`state.py`; return `None` to clear a fan-out list between rounds), and the `TraceEvent` bus (`events.py`). Every node emits events; the web UI consumes only that stream. v3 state keeps `pending_requests`, `constraints`, `backtrack_counts` and drops protocol status.
- **`formula/agents/`** — LLM nodes. All use structured output and **all have deterministic fallbacks**; `consensus.py` is pure Python driven by `severity_scoring_config.csv` (B model: judge scores rank, never block). In v3 `generator` gets its brief from `strategy_families.generator_brief` and must emit `process_steps`; ASD/HME briefs forbid inventing Tg or process temperatures.
- **`web/`** — FastAPI + SSE + a no-build SPA. v3 endpoints: `POST /api/runs` (SMILES + `dose_mg` required), `GET /api/runs/{id}/stream` (replays `bus.history`), `POST /api/runs/{id}/measurements` (the only result input — recompute or regenerate), `GET /api/rules/{rule_id}` (originating CSV row + SOURCES doc). v1's `/evidence`, `/confirmation`, `/approve`, `/wetlab` go away. `static/explainer.{js,css}` is the 10-step visual walkthrough of the README (auto-opens on first visit — `SEEN_KEY` is `f1_guide_seen_v3` so returning users see the v3 story once; deep-linkable via `?guide=N`); **update it when the design story changes**.

### Front-end rules (learned the hard way — don't regress these)

The dashboard follows the **zihwan.com design language**: grayscale chrome + Pretendard, tokens
mirroring `~/zihwan/wealthmate/frontend/src/tokens.css`, light/dark via `data-theme` with the
theme key **`mm:theme` shared across MoneyMate/브리핑** (switching in one service applies to all).

- **Colour is reserved for rule verdicts.** `--status-good/warn/serious/critical` mark
  통과/주의/이관/반려 only. The v3 confidence badge reuses that vocabulary rather than inventing
  colours: `grounded` = good + solid border, `provisional` = warn + **dashed** border — dashed/solid
  carries the state so it stays colour-blind safe. Data-request cards are plain chrome (a request is
  not a verdict). Agent kinds (결정론/LLM/심사관) are separated by grey level **plus line style**
  (solid/dashed/dotted), shared by the graph and the explainer.
- **`[hidden]` is force-declared `display:none !important` in `styles.css`.** Both overlays set
  `display:grid`, and an author `display` beats the UA `[hidden]` rule — never drop that rule, and
  never gate an overlay on a class alone.
- **`.guide-shell` pins `grid-template-rows: minmax(0, 100%)` and its children set `min-height: 0`.**
  Without it the rail gets clipped and `.guide-body`'s internal scrolling stops working.
- `.f1-lvl .n` is a 32px column — keep phase numbers to ≤3 characters.
- Korean copy sets `word-break: keep-all`; the default breaks mid-word and strands single syllables.
- **Everything rendered is untrusted** — ingredient names and rationales come from an LLM, table
  rows from CSVs, the request from the user. `app.js` has an `esc()` helper and every `${}` inside
  an `innerHTML` template must go through it. A browser test injects `<img onerror>` through the
  render paths and asserts zero executions — add the data-request card and confidence tags to it.
- **The run button is a lock, not decoration.** `setRunning()` owns button state, the elapsed
  counter, and replay availability. The measurement submit button needs the same treatment — a
  regenerate burns the token budget. Failures (429 from the hub limiter, 5xx) surface in `#notice`.
- **A dropped SSE stream must not lose the run.** `stream_run` replays `bus.history` to any new
  subscriber, so `connect()` retries up to 3 times, clearing the view first and letting the replay
  rebuild it.
- Verify with a real browser, not curl: `tests/browser/verify.mjs` (interaction checks) and
  `tests/browser/audit.mjs` (XSS injection, double-run, stand-in exposure, a11y, 9 viewport widths).
  `evidence.mjs` / `labloop.mjs` test v1 flows and go away with them.

### Supporting pieces

- **`formula/contracts.py`** — all shared Pydantic models (the stable interface between the pharmacy-student data team and the backend): `FormulationSpec`, `Recipe`, `Verdict` (`PASS`/`HARD_FAIL`/`SOFT_FLAG`/…), `RulebookEntry`, `JudgeSpec`. v3 adds `Candidate` (`strategy`, `ingredients`, `process_steps`, `rationale`, `rule_verdicts`, `confidence`, `pending_refinements`, `reviewer_scores`, `consensus_rank`) and `PendingRequest`; removes `ProtocolReadiness`. If CSV columns change, fix the manifest `schema` — these contracts stay stable.
- **`formula/checkers/applies_when.py`** — evaluates `applies_when` / `row_filter` / trigger expressions via a **restricted `eval`** (`__builtins__` stripped, whitelisted context only). These expressions are *trusted manifest-author input*, not user input. On expression error it fails closed (rule / trigger does not fire). Missing names should resolve to `None` (the v3 prototype's `Scope.__missing__`) so `x is None` conditions work on cold start.

## Demo scenarios and the narration panel

`app.js` holds two coupled pieces that exist so a viewer can *see the architecture* rather than
read about it. Keep them in sync with the graph — they are the demo.

- **`SCENARIOS`** — cards that **run on click**. v3 uses **hypothetical compounds only** (no
  fluoxetine or other real drugs as the headline example):
  `X1` (cold start: dose 150 mg, cLogP 3.6, MW 412, ester → 3 requests, MICRO + ASD_SDD provisional;
  round 2 auto-submits the Tier 1 set + solubility and **skips permeability** → 2 requests, ASD_SDD
  2.0 → 3.0), `X2` (Tm 290 °C, ESOL vs GSE disagree by 1.13 log → `DRQ_SOL` with the
  *disagreement* reason, ASD_SDD 4.0), `X3` (secondary aliphatic amine + pinned excipient →
  rule reject, **zero** requests). v1's `guardrail` / `team` / `labloop` cards are replaced.
  If you change an input, **re-run it** and confirm the numbers still match `SCENARIO_TRACES.md` —
  a scenario that doesn't demonstrate what its card promises is worse than no scenario. X1 round 2
  deliberately skips a request; that's the "declining doesn't stop the system" claim, so don't fill it in.
- **`narrateEvent()` → `narrate()`** — turns the event stream into ordered commentary. Every card
  carries the **owning layer** and a **`왜 중요한가`** line explaining why that layer exists.
  When you add a node to the graph (`phase_gates`, `drq_narrow`, `plan`, `drq_refine`, `backtrack`),
  add its narration beat too.

## Conventions specific to this repo

- **Never hardcode a rule in Python** — nor a derived quantity, strategy score, backtrack route or data request. First ask whether an existing strategy plus a new CSV row covers it.
- **Don't let the generator do the checker's job.** The design agent's fallback deliberately reaches for lactose and lets the rulebook reject it. Pre-avoiding known incompatibilities hides what the verification layer catches.
- **Never let the LLM decide confidence or invent a test.** Confidence is `pending_refinements == []`; tests come from `measurement_catalog.csv`.
- **Never assert chemistry the data doesn't support.** Acetaminophen is an amide, not an amine. `tests/test_smarts.py` pins the truth table — if it fails, the chemistry changed, not just the code.
- Comments and docstrings are in Korean; match that style when editing existing files.
- `database/` is the canonical rulebook (이도영's CSVs + SOURCES.md), `database/reference/` holds 조하준's lookup tables plus the v3 measurement catalog / trigger / counterion tables, `database/legacy/` holds the 1st-gen CSVs kept only for regression comparison (`config/legacy_manifest.yaml` still points at them). Stale top-level copies of `incompatibility_rules.csv`/`process_failure_rules.csv` remain in the repo root and are unused.
- **Known data issues to be resolved with the pharmacy team** (do not silently "fix" their CSVs):
  - All v3 seed rows are `pending_team_review`. `counterion_pka_reference.csv` values were not checked to the decimal against CRC Handbook; the M_COMPACT citation (Hiestand & Smith 1984) wasn't re-verified; `pf_max_plausible=10`, high-Tm 200 °C, ASD process 180 °C, CD 50 mg are `PROVISIONAL` rules of thumb.
  - `structural_flags_smarts.csv` is still `validation_status=UNTESTED` even though `scripts/verify_smarts.py` passes 9/9. FLG002 over-detects guanidine and non-aromatic ring NH as secondary amines.
  - `rulebook_config.csv` has 6 join_key/blocking discrepancies documented in the 개발자 가이드 §9.7. The engine uses `config/rulebook_manifest.yaml` instead, so they're documentation-only.
  - `packaging_compatibility_rules.csv` names prohibited packaging in Korean prose; `config/packaging_categories.yaml` bridges identifiers. (Packaging is unwired in v3.)
  - **`incompatibility_1to1.csv` covers 2° amines for lactose monohydrate only.** INC003/INC004 (anhydrous / spray-dried lactose) are `primary_amine` only, so a 2° amine + **무수유당** passes while + 유당수화물 is rejected, though the mechanism doesn't care about the grade. Ask the pharmacy team whether INC003/INC004 should gain `secondary_amine` rows. The X3 NDSRI rule (secondary amine + nitrite-bearing excipient) is also still a design example, not a row.

## History — audits that shaped the engine (v1, still binding)

### Design-intent audit (2026-07-28)

Claims were checked against what the code did. Three defects were fixed; keep them fixed:

- **Half the jury could never be summoned** — `target_population` was hardcoded pediatric/adult, and `regulatory_narrative_needed` / `novel_combination_not_in_rulebook` were never produced (NameError → fail closed). `population_of()` and `_summon_signals()` now compute them. Every summon condition must have a producer; v3's new signals need the same check.
- **The reject → reflect → pass story didn't reproduce on the live LLM path** because the generator avoided known incompatibilities. `FormulationSpec.required_excipients` pins field constraints the designer may not route around.
- **An unsatisfiable constraint burned all reflection loops** — the `infeasible` terminal now concludes on the first rejection that names a pinned ingredient, with the blocking rule and the rulebook's alternative.

### Silent-pass audit (2026-08-06) — "no rule fired" read as "no problem"

A 2° amine + 유당 run returned 통과. Three independent defects with one shape — **the engine's failure to find something was reported as a clean bill of health** — all pinned by `tests/test_excipient_matching.py`. Any new join between free text and rulebook data needs the same "미탐도 판정이다" review; in v3 that includes trigger scopes (a missing name must be `None`, not a silently false condition that drops a request).

- **Name matching was `==`** → fixed by `formula/checkers/excipients.py`; negative controls (Mannitol, MCC, `Sodium starch glycolate`) are pinned as hard as the positives.
- **An unparseable SMILES produced zero flags, and zero flags passed** → `POST /api/runs` 400s on unreadable SMILES, and unresolved structure raises `STRUCT000` ESCALATE. **Never fall back to the name dictionary when a user-supplied SMILES fails to parse.**
- **`known_excipients()` always returned an empty set** (wrong column names) → now delegates to the resolver, skipping `role == "api"` so the signal isn't always true.
