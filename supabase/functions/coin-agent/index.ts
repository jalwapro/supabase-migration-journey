import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
const URL=Deno.env.get("SUPABASE_URL")??"";const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";const PUBLIC=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"";
const origins=new Set(["https://www.jalwa.pro","https://jalwa.pro","http://localhost:5173"]);
const headers=(origin:string|null)=>({"Access-Control-Allow-Origin":origin&&origins.has(origin)?origin:"https://www.jalwa.pro","Vary":"Origin","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"});
const reply=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:headers(origin)});
Deno.serve(async(req)=>{const origin=req.headers.get("Origin");if(req.method==="OPTIONS")return new Response("ok",{headers:headers(origin)});if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405,origin);if(!URL||!SERVICE||!PUBLIC)return reply({error:"SERVER_CONFIGURATION_ERROR"},500,origin);
 const token=(req.headers.get("Authorization")??"").match(/^Bearer\s+(.+)$/i)?.[1];if(!token)return reply({error:"AUTH_REQUIRED"},401,origin);
 try{const auth=createClient(URL,PUBLIC,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user},error:authError}=await auth.auth.getUser(token);if(authError||!user)return reply({error:"INVALID_SESSION"},401,origin);
 const body=await req.json().catch(()=>null) as {action?:unknown;payload?:unknown}|null;if(typeof body?.action!=="string")return reply({error:"INVALID_ACTION"},400,origin);
 const payload=body.payload&&typeof body.payload==="object"&&!Array.isArray(body.payload)?body.payload as Record<string,unknown>:{};
 const coinActions=new Set(["COIN_ORDER_LIST","CREATE_COIN_ORDER","ADMIN_APPROVE_COIN_ORDER","ADMIN_REJECT_COIN_ORDER"]);
 const roleActions=new Set(["ADMIN_LIST_ROLES","ADMIN_SET_ROLE","ROLE_CONTEXT","SUPER_LIST_CHILDREN","SUPER_CREATE_CHILD_AGENT"]);\n const allowed=new Set(["CONFIG","MARKETPLACE","SAVE_AGENT_RATE","CREATE_TRADE","AGENT_MARK_PAID","USER_CONFIRM_TRADE","DISPUTE_TRADE","ADMIN_RESOLVE_TRADE_COMPLETE","ADMIN_RESOLVE_TRADE_REFUND","CANCEL_TRADE","SETTLEMENT_REQUEST","ADMIN_APPROVE_SETTLEMENT","ADMIN_REJECT_SETTLEMENT","ADMIN_SET_CONFIG","ADMIN_SAVE_TIER","ADMIN_TOGGLE_AGENT","ADMIN_ASSIGN_AGENT",...coinActions,...roleActions]);
 if(!allowed.has(body.action))return reply({error:"INVALID_ACTION"},400,origin);
 const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});const isCoin=coinActions.has(body.action);const isRole=roleActions.has(body.action);
 const action=body.action==="COIN_ORDER_LIST"?"LIST":body.action==="CREATE_COIN_ORDER"?"CREATE":body.action==="ADMIN_APPROVE_COIN_ORDER"?"APPROVE":body.action==="ADMIN_REJECT_COIN_ORDER"?"REJECT":body.action;
 let rpcName=isCoin?"coin_agent_coin_order_action":isRole?"coin_agent_role_action":"coin_agent_action";let rpcArgs:Record<string,unknown>={actor_id:user.id,action,payload};
 if(body.action==="ADMIN_ASSIGN_AGENT"){rpcName="admin_assign_coin_agent";rpcArgs={actor_id:user.id,target_id:payload.agent_id,assigned_country:payload.country,assigned_currency:payload.currency_code??"PKR",enable_agent:payload.enabled??true};}
 else if(body.action==="ADMIN_TOGGLE_AGENT"){rpcName="admin_set_coin_agent_enabled";rpcArgs={actor_id:user.id,target_id:payload.agent_id,enabled:payload.enabled??false};}
 else if(body.action==="MARKETPLACE"){rpcName="coin_agent_marketplace_for_user";rpcArgs={actor_id:user.id};}
 const {data,error}=await db.rpc(rpcName,rpcArgs);
 if(error){const msg=error.message||"COIN_AGENT_ACTION_FAILED";const status=/AUTH_REQUIRED|ADMIN_REQUIRED/i.test(msg)?403:/NOT_FOUND|NOT_AVAILABLE|INSUFFICIENT|OUT_OF_RANGE|INVALID|REQUIRED|BANNED|PENDING|MUST_BE|NO_EXCHANGE|TOO_SMALL|MINIMUM|PACKAGE|DISPUT|COUNTRY_MISMATCH/i.test(msg)?400:500;return reply({error:msg},status,origin);}
 return reply({data},200,origin);
 }catch(error){console.error("[coin-agent] request failed",error);return reply({error:"INTERNAL_ERROR"},500,origin);}
});