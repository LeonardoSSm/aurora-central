# Aurora Central — Agent Guidelines

## Source of truth
- Product vision and scope: issue #1.
- Cycle sequence: #2 → #3 → #4 → #5 → #6 → #7 → #8.
- The approved visual reference must be supplied by the owner; do not claim visual approval without comparing it.

## Working rules
- Implement only the current cycle; use a dedicated branch and a reviewable PR. Do not push implementation directly to main or modify other Aurora repositories without authorization.
- Read the current issue and existing documentation first. Record decisions, trade-offs, tests, evidence, limitations and blockers.
- Prioritize a clean dark screen and organic volumetric 3D particle core, without a face or decorative dashboard. Use GPU rendering, not prerecorded imagery.
- Keep Board, Control, Lens and Nexus independent; integrations must be explicit and typed. No arbitrary shell execution, unrestricted IPC or undocumented AI endpoints.
- Never present mock integrations, untested platform compatibility or invented benchmarks as real.
- Run available lint, type checks, tests, builds and visual inspection; report commands and outcomes. Stop at the cycle boundary for review.
- Establish product, architecture, visual and roadmap documentation in Cycle 01; add graphics, integration, security and implementation reports in subsequent cycles.
