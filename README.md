# hybrid-audit-ts

**Live demo:** https://markusisaksson1982.github.io/showcases/hybrid-audit-ts/

Strict TypeScript, dependency-light demo of a hybrid audit pipeline: **deterministic rules first, LLM findings second**.
Output from several LLM providers is treated as untrusted input, validated with type guards, and merged with the rule
findings into one prioritized, deduplicated action list (highest severity wins, every source is kept).

The pipeline is domain-agnostic. Two example domains share the same contracts, adapters and dedupe:

- **Ad campaigns** (`src/rules.ts`): low ROAS, budget-limited campaigns, disapproved products.
- **Software licenses** (`src/licenses.ts`): over-deployment, unused/inactive seats by wasted cost, renewals with seats to cut.

## Files

- `src/types.ts` – shared contracts (`Finding`, `Action`, `Rule`, `ProviderAdapter`, ...)
- `src/rules.ts`, `src/licenses.ts` – deterministic rules per domain
- `src/actions.ts` – provider adapters, validation, dedupe and prioritization
- `test/*.test.ts` – `node:test` suites (rules, licenses, parsing, dedupe)
- `data/sample.json`, `data/licenses.json` – sample data incl. messy LLM outputs
- `index.html` – static page rendering both domains

## Run

```bash
npm install
npm test            # tsc --strict + node --test
npm run build && python3 -m http.server   # then open http://localhost:8000/
```

Only dev dependencies: `typescript` and `@types/node`.

## Design notes

- Strict types end to end; no `any` in the validation path.
- Use deterministic rules where the logic is known; use LLMs for the fuzzy part, and never trust their output unvalidated.
- Pluggable rules and provider adapters (a new provider or domain is one small module).

## How it was built

Built by Markus Isaksson's *night queue*: tasks are queued during the day, free/local models draft code overnight, a fixed
TypeScript contract plus hidden tests and `tsc --strict` act as the acceptance gate, and Markus reviews in the morning.
Send a task or feedback to **markusisaksson@mail.grokbot.com** (handled by his assistant Grok Bot) and watch it get built on.
Formerly published as `ad-audit-mini`.

## License

MIT
