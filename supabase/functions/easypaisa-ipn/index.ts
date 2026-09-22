import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const allowedHosts=new Set(["easypay.easypaisa.com.pk","easypaystg.easypaisa.com.pk"]);

async function verifyProviderUrl(rawUrl:string){
  let u:URL;try{u=new URL(rawUrl)}catch{return null}
  if(u.protocol!=="https:"||!allowedHosts.has(u.hostname))return null;
  const r=await fetch(u.toString(),{method:"GET",headers:{"Accept":"application/json"}});
  const payload=await r.json().catch(()=>null);
  return r.ok&&payload&&typeof payload==="object"?payload:null;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="GET"&&req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=new URL(req.url);
    let body:any={};
    if(req.method==="POST"){
      const ct=req.headers.get("content-type")||"";
      const raw=await req.text();
      body=ct.includes("application/json")?(JSON.parse(raw||"{}")):Object.fromEntries(new URLSearchParams(raw));
    }
    const providerUrl=String(url.searchParams.get("URL")||url.searchParams.get("url")||body.URL||body.url||"").trim();
    if(!providerUrl)return json({ok:true,received:true,status:"pending"});
    const payload:any=await verifyProviderUrl(providerUrl);
    if(!payload)return json({ok:false,error:"Invalid Easypaisa status URL"},400);
    const orderRef=String(payload.orderId||payload.orderID||"").trim();
    const status=String(payload.transactionStatus||payload.status||"").toUpperCase();
    const txn=String(payload.transactionId||"").trim();
    const amount=Number(payload.transactionAmount);
    if(!orderRef)return json({ok:false,error:"Missing order reference"},400);
    const {data:order}=await admin.from("recharge_orders").select("id,amount_pkr,status,gateway_provider").eq("gateway_provider","easypaisa").eq("gateway_order_ref",orderRef).maybeSingle();
    if(!order)return json({ok:true,received:true,status:"unknown_order"});
    if(status==="PAID"){
      if(!Number.isFinite(amount)||amount!==Number(order.amount_pkr)||!txn)return json({ok:false,error:"Verification mismatch"},409);
      const {data:result,error}=await admin.rpc("gateway_credit_recharge_by_ref",{_provider:"easypaisa",_order_ref:orderRef,_provider_txn:txn,_status:"PAID",_amount_pkr:amount,_raw:payload});
      if(error)return json({ok:false,error:"Verified payment could not be credited"},500);
      return json({ok:true,received:true,status:"PAID",result});
    }
    await admin.from("recharge_orders").update({gateway_status:status.toLowerCase()||"pending",gateway_transaction_ref:txn||null,gateway_payload:payload,status:["FAILED","REVERSED","BLOCKED","EXPIRED"].includes(status)?"failed":undefined}).eq("id",order.id);
    return json({ok:true,received:true,status:status||"PENDING"});
  }catch(e){console.error("easypaisa-ipn",e);return json({ok:false,error:"Invalid Easypaisa notification"},400)}
});