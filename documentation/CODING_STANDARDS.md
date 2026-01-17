# Coding Standards

This document establishes the coding standards for Lambic. New code should follow these conventions to improve reliability and maintainability while legacy systems are incrementally migrated.

## Core Principles
- Prefer dependency injection or `SystemRegistry` over new globals.
- Keep modules focused; avoid adding to monolithic files.
- Fail safely in game loop hot paths with clear, throttled logging.
- Favor incremental refactors with compatibility adapters.

## Module Structure
- Place new bootstrap logic in `server/js/bootstrap/`.
- Place new entity modules in `server/js/entities/` and export compatibility adapters from `server/js/Entity.js`.
- Avoid introducing new cross‑module coupling in `lambic.js`.

## Globals Policy
- Do not add new `global.*` values without a migration plan.
- If you must add a global for compatibility, also register it in `SystemRegistry` and expose it via `DependencyInjector` with a clear alias.

## Error Handling
- Wrap critical per‑frame logic with guarded calls and throttled logging.
- Avoid swallowing errors silently; log with context and keep the loop running.

## Testing
- Add tests under `tests/` with deterministic fixtures.
- Avoid mutating `global` state in new tests; if unavoidable, reset after each test.

## Linting
- Lint new bootstrap, entities, and tests with ESLint (`npm run lint`).
- Only apply lint rules to new code until legacy systems are fully migrated.
