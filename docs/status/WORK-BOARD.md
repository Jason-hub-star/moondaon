# Work Board

Optional board for route, feature, worker, API, or automation work units.
Keep detailed notes in `docs/daily/` and keep this file compact.

| Work Unit | Type | Owner | Status | Source Path | Required Docs | Last Evidence | Next Action |
|---|---|---|---|---|---|---|---|
| `initial-architecture` | docs | parent agent | InProgress | `docs/ref/ARCHITECTURE.md` | `PROJECT-STATUS.md`, `PROJECT-PLAN.md` | `bash scripts/check-project.sh` | fill project-specific boundaries |

## Status Rules

- `Ready`: scope exists, implementation not started.
- `InProgress`: files changed or active work is underway.
- `QA`: implementation is mostly complete but verification or review remains.
- `Done`: implementation, verification, and doc sync are complete.
- `Hold`: blocked by missing decision, access, dependency, or failing runtime.
