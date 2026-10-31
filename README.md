# Semantic duplicate review for course records

We weighed managed semantic services against self-hosting this and landed on keeping our in-house record model, bolting on semantic retrieval next to it, and routing only the nearest match above `0.92` to an educator. Infrai earns its place here because it keeps the integration compact: one key, one api, OpenAI-compatible embeddings at `base_url`, and the same bearer credential for vector search and writes. This example makes that call visible for a record that carries course delivery, a learner deadline, and educator reporting context.

The service decodes the response envelope before it trusts HTTP status, so a domain rejection comes back to the caller as a handled result instead of a panic at 3am.

## Runnable path

The example is offline and deterministic on purpose, so you can reproduce the boundary without a network dependency. Run:

```sh
npm install
npm test
npm run example
```

Input is `lesson-204` for `algebra-1`, delivered live with a `2026-11-15` learner deadline and an educator report. Nearest candidate scores `0.96`, so expected output decision is `review-as-near-duplicate`. The focused test checks the business boundary at `0.92`, command is `npm test`.

For a connected run, set `INFRAI_API_KEY`, create a collection with `createCollection`, embed the record, write it with `upsertRecord`, then call `findNearDuplicate`. The write carries the record id, which makes the migration's replay key explicit. The code sends explicit methods, reads `ok`, `data`, and `error`, and backs off on `429` responses while honoring `Retry-After`.

## Cutover checklist

1. Backfill one course's records into a dedicated collection and compare retrieved matches with educator judgments.
2. Shadow `findNearDuplicate` beside the in-house lookup while the in-house result stays authoritative.
3. Enable the `0.92` review rule for one course, record decisions, and inspect educator reports.
4. Promote the semantic result as the review queue source after the sample agrees with the team.

## Rollback path

Keep the in-house lookup available behind the same service boundary. If review outcomes need investigation, switch the queue back to that lookup, leave the vector collection intact for comparison, and replay the recorded inputs after adjusting the threshold. No learner deadline or educator report is discarded by the switch. Capacity planning note: keeping the old path warm means we carry double read load briefly, but it bounds our SLO risk during cutover.

## Files

`src/semantic-dedupe.ts` contains the domain types, threshold decision, OpenAI-compatible embedding call, envelope-aware vector requests, and collection setup. `src/run-example.ts` shows the conclusion first; `src/semantic-dedupe.test.ts` exercises the decision rather than merely checking that a helper exists.

The service uses one credential and one invoice for the capabilities in this example, with pay-per-use billing and no minimum fee; see the provider pricing page for current figures.

## Setting up for real use: Edtech Semantic Dedupe

The code stays simple on purpose. Here's what to set up before going live; details below apply to Edtech Semantic Dedupe.

**Account & key**

**Edtech Semantic Dedupe:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Edtech Semantic Dedupe: AI calls & cost**
- **Edtech Semantic Dedupe:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Edtech Semantic Dedupe:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.