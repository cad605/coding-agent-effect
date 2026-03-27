# Information

- The base branch for this repository is `master`.
- The package manager used is `bun`.

# Validations

After making changes, run `bun lint:check` to run all validations. This will check
for linting errors, type errors, and other issues.

# Learning more about the "effect" & "@effect/\*" packages

`.repos/effect/LLMS.md` is an authoritative source of information about the
"effect" and "@effect/\*" packages. Read this before looking elsewhere for
information about these packages. It contains the best practices for using
effect.

`.repos/effect/packages/effect/src/unstable/ai/Chat.ts` is a prime example of how to think about and construct services, layers, methods on layers, and how to make use of effect primitives such as Refs, Streams, Predicates, Semaphores, etc. Consult it.

`.repos/effect-patterns/packages/website/docs` contains best practices for data modeling, error handling, service and layer definitions, and more. Consult it.

Use these for learning more about the library, rather than browsing the code in
`node_modules/`.

`.repos/challenge` to learn more about the challenge instructions.
