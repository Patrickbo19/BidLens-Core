#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { blockerSchema, makePlan, planToMarkdown } from "./core.js";
import { listAvailable, postEscalation } from "./gibwork.js";

const server=new Server({name:"earn-relay",version:"0.1.0"},{capabilities:{tools:{}}});

server.setRequestHandler(ListToolsRequestSchema,async()=>({
  tools:[
    {
      name:"relay_plan_escalation",
      description:"Turn an AI-agent blocker into a sanitized, bounded Gibwork escalation plan. No spending or posting.",
      inputSchema:{type:"object",required:["objective","blocker","requiredOutput","acceptance","maxBudgetUsdc"],properties:{
        objective:{type:"string"},blocker:{type:"string"},context:{type:"string"},requiredOutput:{type:"string"},
        acceptance:{type:"array",items:{type:"string"}},deadlineHours:{type:"number"},maxBudgetUsdc:{type:"number"},
        sensitivity:{type:"string",enum:["public","sanitized-public"]},tags:{type:"array",items:{type:"string"}}
      }}
    },
    {
      name:"relay_scan_market",
      description:"Read current Gibwork work inventory through the official SDK when configured, otherwise the public Gibwork API.",
      inputSchema:{type:"object",properties:{limit:{type:"number",minimum:1,maximum:50}}}
    },
    {
      name:"relay_post_escalation",
      description:"Post a prepared escalation through the official Gibwork SDK. Requires confirm=true and a locally configured wallet key.",
      inputSchema:{type:"object",required:["blocker","confirm"],properties:{
        blocker:{type:"object"},confirm:{type:"boolean"}
      }}
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema,async(req)=>{
  const name=req.params.name;
  const args=(req.params.arguments??{}) as Record<string,unknown>;
  if(name==="relay_plan_escalation"){
    const plan=makePlan(args);
    return {content:[{type:"text",text:JSON.stringify({plan,markdown:planToMarkdown(plan)},null,2)}]};
  }
  if(name==="relay_scan_market"){
    const data=await listAvailable(Number(args.limit??10));
    return {content:[{type:"text",text:JSON.stringify(data,null,2)}]};
  }
  if(name==="relay_post_escalation"){
    if(args.confirm!==true) throw new Error("confirm=true is required for live posting");
    const blocker=blockerSchema.parse(args.blocker);
    const data=await postEscalation(blocker,true);
    return {content:[{type:"text",text:JSON.stringify(data,null,2)}]};
  }
  throw new Error("Unknown tool");
});

await server.connect(new StdioServerTransport());
