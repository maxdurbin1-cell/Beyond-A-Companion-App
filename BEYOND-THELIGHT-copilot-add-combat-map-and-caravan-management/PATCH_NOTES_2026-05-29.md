# BEYOND: The Light - Website + VTT Patch Notes

Date: 2026-05-29
Build Focus: Integration, localization reliability, startup stability, and VTT navigation resilience.

## Highlights For Players and GMs

- Language switching now updates visible website/VTT content more reliably and much faster.
- Added live translation status notifications so you know if translation is online, cached, or partially unavailable.
- Improved startup/event wiring for tab navigation and combat UI interactions to reduce cross-system regressions.
- Fixed a DOM ordering issue that could cause rare client-side runtime errors during tab initialization.
- Completed a V.D. consistency pass so item flows using +V.D. now resolve as additive bonuses where intended.

## Localization and Accessibility Improvements

- Language changes now prioritize currently visible UI regions (active tab, header, quick access, settings, modal) for immediate feedback.
- Added translation status messaging:
  - Live translation online
  - Cached translations used
  - Partial fallback (some text may remain in English)
- Language updates still preserve accessibility-first behavior and document language metadata.

## VTT and Navigation Refinements

- Modularized high-churn startup wiring for tab bootstrap + event delegation into centralized helper logic.
- Unified tab/context bootstrap flow to make click handling and change handling more deterministic.
- Improved startup sequencing so cross-feature initialization (including World That Was tab behavior) is cleaner and less fragile.

## Stability and Cleanup

- Corrected invalid HTML document structure by removing stray pre-doctype content and relocating modal stack wiring to a valid script location.
- Hardened nav tab insertion logic to prevent parent/child ordering mismatches during dynamic tab ordering.
- Verified with smoke coverage:
  - Context tab visibility smoke test
  - Click-paths smoke test (including multiplayer sync assertions)

## V.D. Rules Consistency Pass

- Lockpicks now resolve as Control + V.D. (additive), rather than highest-of-two.
- E-Picks were aligned to the same additive lockpick behavior for consistency.
- Toolkit rolls now use additive V.D. math and updated in-UI wording.
- Compass and Spyglass item-use config was aligned from V.D. advantage semantics to additive +V.D. semantics.

## Why This Matters

This patch is focused on making BEYOND: The Light feel more consistent as a single integrated web + VTT experience:

- Faster feedback when changing language
- Better resilience in complex tab/navigation states
- Fewer startup-time UI surprises
- Clearer player-facing behavior when external translation services are degraded
