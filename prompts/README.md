# Prompts

Paste one of these at the start of an agent session. They assume the repo root and `csmon.md`.

| Prompt | Use when |
| --- | --- |
| [develop.md](develop.md) | Adding or changing a desk, feed, filter, or reader behavior |
| [keep.md](keep.md) | Reviewing a change, or starting work that must not undo what already works |
| [harden.md](harden.md) | Checking or tightening the local-operator threat model |
| [taxonomy-ux/](taxonomy-ux/README.md) | Eleven ordered tasks: correct topics and places, source categories, people and orgs, one facet model, connections, topic families, palette and trail |
| [sprint.md](sprint.md) | UX sprint from the 17 Nov 2026 interactive pass: readability, filters, configuration, situation map |

Security checks the harden prompt runs:

```bash
pnpm security:audit
pnpm security:outbound
pnpm security:live
```

`security:live` talks only to loopback. It exits quietly if nothing is listening.
