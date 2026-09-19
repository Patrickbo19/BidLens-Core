import test from "node:test";
import assert from "node:assert/strict";
import { makePlan, sanitize } from "../core.js";

test("redacts credential-shaped content",()=>{
  const s=sanitize("api_key=abcdef123456789 token=ghp_abcdefghijklmnopqrstuvwxyz");
  assert.match(s,/\[REDACTED\]/);
  assert.doesNotMatch(s,/ghp_abcdefghijklmnopqrstuvwxyz/);
});

test("builds a bounded escalation plan",()=>{
  const p=makePlan({
    objective:"Recover a blocked production engineering workflow.",
    blocker:"The agent lacks the required physical device.",
    context:"Public repository only.",
    requiredOutput:"Reproduce the bug and return evidence.",
    acceptance:["Provide exact reproduction steps"],
    deadlineHours:4,
    maxBudgetUsdc:50,
    sensitivity:"sanitized-public",
    tags:["qa"]
  });
  assert.ok(p.rewardUsdc>0 && p.rewardUsdc<=50);
  assert.equal(p.safety.humanApprovalRequiredForSpend,true);
  assert.equal(p.fingerprint.length,64);
});
