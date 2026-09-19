import { makePlan, planToMarkdown, type Blocker } from "./core.js";

export async function createGibworkPlan(blocker:Blocker){
  const plan=makePlan(blocker);
  return {
    plan,
    gibworkInput:{
      title:plan.title,
      content:planToMarkdown(plan),
      tags:plan.tags,
      reward:plan.rewardUsdc.toFixed(2)
    }
  };
}

async function sdkClient(){
  const privateKey=process.env.GIBWORK_PRIVATE_KEY?.trim();
  if(!privateKey) throw new Error("GIBWORK_PRIVATE_KEY is required for live posting. Dry-run does not need a wallet.");
  const { createGibworkClient } = await import("@gibwork/sdk/node");
  return createGibworkClient({
    privateKey,
    production:(process.env.GIBWORK_PRODUCTION ?? "true") !== "false"
  });
}

export async function postEscalation(blocker:Blocker, confirm:boolean){
  const {plan,gibworkInput}=await createGibworkPlan(blocker);
  if(!confirm) return {mode:"dry-run",plan,gibworkInput};

  const client:any=await sdkClient();
  if(!client?.tasks?.create) {
    throw new Error("Installed @gibwork/sdk does not expose tasks.create; run against the current official SDK and inspect its client surface.");
  }

  const result=await client.tasks.create(gibworkInput);
  return {mode:"live",plan,result};
}

export async function listAvailable(limit=10){
  const privateKey=process.env.GIBWORK_PRIVATE_KEY?.trim();
  if(privateKey){
    const client:any=await sdkClient();
    if(client?.tasks?.listAvailable){
      return client.tasks.listAvailable({page:1,limit});
    }
  }
  const r=await fetch(`https://api.gib.work/explore?page=1&limit=${Math.max(1,Math.min(50,limit))}`,{
    headers:{accept:"application/json","user-agent":"earn-relay/0.1"}
  });
  if(!r.ok) throw new Error(`Gibwork public API HTTP ${r.status}`);
  return r.json();
}
