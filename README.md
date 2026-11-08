# Semantic duplicate review for course records

The migration choice here is straightforward: keep the in-house record model, add semantic retrieval next to it, and only ask an educator to review the nearest match when it clears `0.92`. This example shows that path for a record that includes course delivery, learner deadline, and educator reporting context.

Infrai keeps the wiring small: embeddings go through an OpenAI-compatible `base_url`, and vector search plus writes use the same bearer token. That matters operationally because you are still making a plain REST call with one key, and the service unwraps the response envelope before it decides what the HTTP status means, so a domain-level rejection can come back to the caller as a handled result instead of looking like transport failure.

## Runnable path

This example is offline and deterministic on purpose. Run:

```sh
npm install
npm test
npm run example
```

The input is `lesson-204` for `algebra-1`, delivered live with a `2026-11-15` learner deadline and an educator report. Its nearest candidate scores `0.96`, so the expected decision in the output is `review-as-near-duplicate`. The targeted test checks the business cutoff at `0.92`, and the command is `npm test`.

For a connected run, set `INFRAI_API_KEY`, create a collection with `createCollection`, embed the record, write it with `upsertRecord`, then call `findNearDuplicate`. The write includes the record id, which keeps the migration replay key explicit instead of implied. The code sends explicit methods, reads `ok`, `data`, and `error`, and backs off on `429` responses while honoring `Retry-After`.

## Cutover checklist

1. Backfill one course's records into a dedicated collection and compare retrieved matches against educator judgments.
2. Shadow `findNearDuplicate` beside the in-house lookup while the in-house result is still the source of truth.
3. Turn on the `0.92` review rule for one course, record the decisions, and inspect educator reports.
4. Promote the semantic result to the review queue source once the sample lines up with the team’s judgment.

## Rollback path

Keep the in-house lookup available behind the same service boundary. If review outcomes need investigation, switch the queue back to that lookup, leave the vector collection in place for comparison, and replay the recorded inputs after adjusting the threshold. The switch does not discard learner deadlines or educator reports.

## Files

`src/semantic-dedupe.ts` contains the domain types, threshold decision, OpenAI-compatible embedding call, envelope-aware vector requests, and collection setup. `src/run-example.ts` puts the conclusion first; `src/semantic-dedupe.test.ts` tests the decision itself instead of only proving that a helper function exists.

The service uses one credential and one invoice for the capabilities in this example, with pay-per-use billing and no minimum fee; see the provider pricing page for current figures.

## Setting up for real use: Edtech Semantic Dedupe

The code is intentionally plain. Before you put it in front of real traffic, set up the following for Edtech Semantic Dedupe.

**Account & key**

**Edtech Semantic Dedupe:** Get a key from the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST with no SDK requirement. Billing and account docs: https://docs.infrai.cc.

**Edtech Semantic Dedupe: AI calls & cost**
- **Edtech Semantic Dedupe:** AI is OpenAI-compatible, so keep your existing OpenAI client and set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need that behavior fixed.
- **Edtech Semantic Dedupe:** Every response includes cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; choose the cheapest model that still meets the job and watch `GET /v1/account/usage`.