#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { blockerSchema, makePlan, planToMarkdown } from "./core.js";
import { listAvailable, postEscalation } from "./gibwork.js";

const program=new Command();
program
  .name("earn-relay")
  .description("AI agents should not dead-end. Escalate missing work into a bounded Gibwork task, then return the result to the parent workflow.")
  .version("0.1.0");

program.command("plan")
  .argument("<file>","JSON blocker file")
  .option("--json","machine-readable JSON")
  .action(async(file,opts)=>{
    const raw=JSON.parse(await readFile(file,"utf8"));
    const plan=makePlan(raw);
    console.log(opts.json?JSON.stringify(plan,null,2):planToMarkdown(plan));
  });

program.command("escalate")
  .argument("<file>","JSON blocker file")
  .option("--confirm","actually post through the official Gibwork SDK")
  .action(async(file,opts)=>{
    const raw=blockerSchema.parse(JSON.parse(await readFile(file,"utf8")));
    const out=await postEscalation(raw,Boolean(opts.confirm));
    console.log(JSON.stringify(out,null,2));
  });

program.command("market")
  .option("--limit <n>","number of open Gibwork tasks","10")
  .action(async(opts)=>{
    console.log(JSON.stringify(await listAvailable(Number(opts.limit)),null,2));
  });

program.command("demo").action(async()=>{
  const demo={
    objective:"Ship a production patch before the deployment window closes.",
    blocker:"The parent coding agent cannot reproduce a device-specific Android failure.",
    context:"Public repo: https://github.com/example/project. Reproduction only requires a physical Android device; no private credentials are needed.",
    requiredOutput:"A reproducible bug report with device model, Android version, exact steps, logs, and a minimal failing test or patch suggestion.",
    acceptance:[
      "Includes device model and Android version",
      "Contains exact reproduction steps",
      "Includes sanitized logs",
      "Provides either a failing test or a concrete patch recommendation"
    ],
    deadlineHours:6,
    maxBudgetUsdc:75,
    sensitivity:"sanitized-public",
    tags:["android","qa","reproduction"]
  };
  const plan=makePlan(demo);
  console.log(planToMarkdown(plan));
  console.log("\n---\nDRY RUN: no wallet, payment, or task creation occurred.");
});

await program.parseAsync(process.argv);
