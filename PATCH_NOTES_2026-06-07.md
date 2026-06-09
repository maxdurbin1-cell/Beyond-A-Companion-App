# BEYOND: The Light - Website + VTT Patch Notes

Date: 2026-06-07
Build Focus: Province rules consistency, manual-roll reliability, and dungeon/puzzle flow alignment.

## Highlights For Players and GMs

- Thievery now consistently supports manual roll mode and clearly shows Control vs DD12 where relevant.
- Province Ruins, Infinite Dungeon floors, and Infinite Library failures now use margin-based outcomes instead of flat penalties.
- Ruin and dungeon result language was standardized so VD/DD wording and outcome text match actual behavior.
- Puzzle flows were tightened so placeholder word-only fallbacks were replaced with real puzzle specs in active ruin paths.
- Solo-GM tracking now correctly records Infinite Library delves from direct hex entry flows.
- Valor is now the single canonical stat key across Character Sheet, Soul Array/Dice readouts, combat prompts, and rules-driven roll systems.
- Space context sub-tabs now keep a stable grouped order after World That Was, preventing drifted or awkward tab positions in the nav row.

## Cross-System Refinements (Single-Site Consistency)

- Canonical text contract now appears consistently in active combat resolution copy:
  - "VDx vs DDy" format for check summaries
  - "HP each" and "Death Number z" in enemy summaries
  - "Choose outcome to resolve encounter" for post-combat closure
- Canonical combat seed contract is now reinforced in Sea, Galaxy/Planet, World That Was, and Yessod flows:
  - Seed enemies
  - Auto-open Combat + Quick Access
  - Show outcome modal/panel
  - Require explicit resolve (Victory/Defeat)
- Canonical manual-roll contract remains aligned on shared manual prompts:
  - Compare, Success, Failure, Push Luck + Success, Push Luck + Failure
  - Shared push-luck cost wording (2 Teamwork, higher Dread)
  - Shared summary style for manual outcomes
- Canonical fail-recovery messaging now favors explicit context over generic fallback copy in updated combat-outcome paths.
- Canonical reward/failure structure remains region-flavored while preserving the same deterministic math pattern per encounter type.

## Upcoming June 7 Additions

- Fixed a Soul Array mismatch where Valor could display as d4 in Dice/Soul Array views even when Character Sheet showed a higher die (for example d8).
- Added one-way save migration for legacy Adventure data so older saves are upgraded to Valor automatically on load.
- Standardized Space Location sub-tab placement so Planet Exploration, Yessod, and Exocrafts stay aligned as a single cluster.
- Completed a Valor naming and stat-key consistency pass across UI labels, roller paths, campaign parsing, and smoke tests to reduce UI-to-rules drift.

## Thievery and Manual Roll Reliability

- Manual thievery checks now properly route through the manual check flow when manual mode is enabled.
- Thievery actions now display the intended check context: Control vs DD12.
- This was applied across thievery entry points so behavior and button text stay consistent.

## Ruins and Infinite Dungeon Rules Pass

- Failure consequences in Province Ruins and Infinite Dungeon segments were aligned to action-vs-dread margin handling.
- Flat failure penalties in key ruin/depth branches were replaced with margin-driven outcomes.
- Result text now reflects damage language where damage is actually applied.
- Ruin/depth roll readouts were cleaned up for VD/DD consistency.

## Infinite Library Consistency

- Infinite Library failure handling now uses margin-aware consequences across read/explore/fallback branches.
- Library failure copy now reflects the applied effects (mental stress, damage, radiation exposure) instead of older flat text patterns.
- Direct library entry now safely initializes and increments Solo-GM website counters so delve tracking is reliable.

## Puzzle Flow and Placeholder Cleanup

- Active sea-ruin puzzle fallback was upgraded from a hardcoded placeholder prompt to authored puzzle specs.
- Puzzle resolve text was aligned with current damage terminology and consistency updates.
- Existing puzzle banks continue to drive ruin/depth puzzle doors, with fallback behavior now matching that standard.

## Validation and Regression Checks

- Focused smoke validation executed after these updates:
  - Solo Library smoke test
  - Minigames Expedition smoke test
- Solo Library smoke initially exposed a counter-tracking issue; the follow-up fix was applied and revalidated.

## Why This Matters

This update improves mechanical trust and cross-system consistency in exploration-heavy content:

- Clearer check prompts for manual players
- More predictable failure outcomes tied to roll margin
- Better alignment between what UI text says and what the system actually applies
- Fewer immersion-breaking placeholder puzzle moments
- More reliable Solo-GM objective progression signals
