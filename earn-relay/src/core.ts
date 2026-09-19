import { createHash } from "node:crypto";
import { z } from "zod";

export const blockerSchema = z.object({
  objective: z.string().min(10),
  blocker: z.string().min(5),
  context: z.string().default(""),
  requiredOutput: z.string().min(5),
  acceptance: z.array(z.string().min(3)).min(1),
  deadlineHours: z.number().positive().max(168).default(24),
  maxBudgetUsdc: z.number().positive().max(10000),
  sensitivity: z.enum(["public","sanitized-public"]).default("sanitized-public"),
  tags: z.array(z.string()).default([])
});

export type Blocker = z.infer<typeof blockerSchema>;

const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
  /0x[a-fA-F0-9]{64}/g,
  /(?:sk|pk)_[A-Za-z0-9_-]{16,}/g,
  /gh[opsu]_[A-Za-z0-9]{20,}/g
];

export function sanitize(input:string){
  let out=input;
  for(const pattern of SECRET_PATTERNS) out=out.replace(pattern,"[REDACTED]");
  return out;
}

export function deriveReward(b:Blocker){
  const urgency=Math.max(0,Math.min(1,(24-b.deadlineHours)/24));
  const complexity=Math.min(1,(b.context.length+b.acceptance.join(" ").length)/4000);
  const floor=5;
  const target=Math.max(floor,Math.round((15+45*complexity+40*urgency)*100)/100);
  return Math.min(b.maxBudgetUsdc,target);
}

export function makePlan(raw:unknown){
  const b=blockerSchema.parse(raw);
  const publicContext=sanitize(b.context);
  const rewardUsdc=deriveReward(b);
  const fingerprint=createHash("sha256")
    .update(JSON.stringify({objective:b.objective,blocker:b.blocker,requiredOutput:b.requiredOutput,acceptance:b.acceptance}))
    .digest("hex");

  return {
    version:"earn-relay/0.1",
    fingerprint,
    title:`Escalation: ${sanitize(b.requiredOutput).slice(0,80)}`,
    rewardUsdc,
    deadlineHours:b.deadlineHours,
    tags:["agent-escalation",...b.tags].slice(0,8),
    objective:sanitize(b.objective),
    blocker:sanitize(b.blocker),
    context:publicContext,
    requiredOutput:sanitize(b.requiredOutput),
    acceptance:b.acceptance.map(sanitize),
    safety:{
      publicOnly:true,
      secretsRedacted:true,
      noCredentialSharing:true,
      humanApprovalRequiredForSpend:true
    }
  };
}

export function planToMarkdown(plan:ReturnType<typeof makePlan>){
  return [
    `# ${plan.title}`,
    "",
    "## Parent objective",
    plan.objective,
    "",
    "## Why the agent escalated",
    plan.blocker,
    "",
    "## Sanitized context",
    plan.context || "(none)",
    "",
    "## Required output",
    plan.requiredOutput,
    "",
    "## Acceptance criteria",
    ...plan.acceptance.map((x,i)=>`${i+1}. ${x}`),
    "",
    `Budget ceiling: ${plan.rewardUsdc.toFixed(2)} USDC`,
    `Deadline: ${plan.deadlineHours} hours`,
    `Fingerprint: ${plan.fingerprint}`
  ].join("\n");
}
