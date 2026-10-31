import test from "node:test";
import assert from "node:assert/strict";
import { decideNearDuplicate } from "./decision.ts";

test("flags a matching course delivery at the review threshold", () => {
  assert.equal(decideNearDuplicate({ score: 0.92 }), true);
  assert.equal(decideNearDuplicate({ score: 0.91 }), false);
});
