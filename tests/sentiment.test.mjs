import assert from "node:assert/strict";
import { test } from "node:test";

import { detectNegativeSentiment } from "../lib/feedback/sentiment.ts";

test("flags clearly negative feedback", () => {
  const result = detectNegativeSentiment("Honestly I feel burned out and I am thinking of leaving.");
  assert.equal(result.negative, true);
  assert.deepEqual(result.matches, ["burned out", "thinking of leaving"]);
});

test("ignores positive feedback", () => {
  assert.equal(detectNegativeSentiment("Great onboarding, the team has been really helpful.").negative, false);
});

test("respects simple negation", () => {
  assert.equal(detectNegativeSentiment("I am not stressed and there is no conflict.").negative, false);
});

test("phrases that include a negation still count", () => {
  assert.equal(detectNegativeSentiment("I have felt not supported on the new project.").negative, true);
});

test("matches word stems", () => {
  assert.deepEqual(detectNegativeSentiment("My manager micromanages every task.").matches, ["micromanag"]);
});

test("does not match inside unrelated words", () => {
  assert.equal(detectNegativeSentiment("Quite a strong quarter overall.").negative, false);
});
