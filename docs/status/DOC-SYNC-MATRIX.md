# Doc Sync Matrix

Maps work units to source truth, companion docs, and verification.

| Work Unit | Source Truth | Skills or Commands | Required Docs | Verify | Notes |
|---|---|---|---|---|---|
| `initial-architecture` | `docs/ref/ARCHITECTURE.md` | `project-planning`, `doc-sync` | `PROJECT-STATUS.md`, `DECISION-LOG.md` | `bash scripts/check-project.sh` | scaffold baseline |

## Rules

- Source truth points to code, runtime facts, or the nearest ref doc.
- Required docs are the files that must stay aligned with that work unit.
- Keep skill references as pointers only.
