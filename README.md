# ad-audit-mini

**Live demo:** https://markusisaksson1982.github.io/showcases/ad-audit-mini/

Strict TypeScript, dependency-light demo for auditing e-commerce advertising.

## What it does

Typed contracts (`Campaign`, `Finding`, `Action`, `Rule`, `ProviderAdapter`) with a deterministic rule engine over sample ad-campaign data — low ROAS, budget-limited, disapproved products.

A parser turns messy LLM output from several providers into validated findings, and a dedupe step merges rule and LLM findings into one prioritized action list — max severity, all sources kept.

Pluggable typed rules and provider adapters. Compiled with `tsc --strict` and tested with `node --test`. A static HTML page renders the actions.

Only dev dependencies: `typescript` + `@types/node`.

## Why it relates to the Agentmama ad

Agentmama audits e-commerce ads from Google Ads, Meta, Merchant Center, and GA, running data through a rule engine and LLM audit agents into one-click actions.

This mini mirrors that core plumbing: rule evaluation + turning LLM output from multiple providers into reliable, deduplicated actions.

## Files

- `src/types.ts` — shared contracts for campaigns, findings, actions, rules, adapters
- `src/rules.ts` — deterministic audit rules
- `src/actions.ts` — parser, validation, dedupe and prioritization
- `test/*.test.ts` — tests for rules, parser, and dedupe
- `data/sample.json` — sample campaigns
- `index.html` — static renderer for the action list

## How to run

```bash
npm install
npm test
```

`npm test` = `tsc` + `node --test`.

```bash
npm run build
python3 -m http.server
```

Then open `index.html`.

## Design notes

- Strict types end-to-end, no `any` leaks.
- LLM output treated as untrusted input and validated with type guards.
- Pluggable rules and provider adapters.
- Dedupe keeps every source.

## Next steps

1. TypeScript: tRPC-style typed API + Zod-like runtime schemas for findings.
2. TypeScript: Pub/Sub-style integration worker with retries, idempotency keys and a dead-letter list.
3. TypeScript: provider cost/eval harness comparing LLM providers on the same audit.

Built by Markus Isaksson's night queue with Grok Bot.
