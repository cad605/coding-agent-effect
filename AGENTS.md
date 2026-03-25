## Learned User Preferences

- Treat Effect as a core architectural substrate in this codebase; do not try to make ports Effect-free just for abstraction purity.
- Follow local Effect guidance first: consult `.repos/effect/LLMS.md` and `.repos/effect-patterns/packages/website/docs` before relying on external docs or `node_modules`.
- Prefer schema-backed Effect models such as `Schema.Class`, `Schema.TaggedClass`, and `Schema.TaggedErrorClass` for public contracts and errors instead of ad-hoc interfaces.
- Prefer imports from `"effect"` directly when the local Effect docs support that style.
- For the coding agent architecture, treat filesystem and shell tool wiring as executor-side infrastructure; only promote it to a first-class port when multiple use cases need that abstraction.

## Learned Workspace Facts

- The base branch for this repository is `master`.
- The package manager used is `bun`.
- Run `bun lint:check` after making changes.
- `.repos/effect/LLMS.md` is the authoritative local Effect reference for this workspace.
- `.repos/effect-patterns/packages/website/docs` is the intended local source for Effect data modeling, error handling, service, and layer patterns.
- `.repos/effect-coding-agent` is a useful local reference for agent-runtime and `effect/unstable/ai` patterns.
