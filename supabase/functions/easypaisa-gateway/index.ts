import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_APP_URL = "https://www.jalwa.pro";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function getAppUrl(){
  const {data}=await admin.from("app_kv").select("value").eq("key","runtime_config").maybeSingle();
  return String((data?.value as Record<string, unknown> | null)?.primary_domain ?? Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/$/,"");
}

async function userFromRequest(req:Request){
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return null;
  const {data}=await admin.auth.getUser(token);
  return data.user??null;
}
async function isAdmin(id:string){
  try{const {data,error}=await admin.rpc("is_admin",{_user_id:id});if(!error&&data===true)return true;}catch{}
  const {data}=await admin.from("user_roles").select("role").eq("user_id",id).in("role",["admin","super_admin"]);
  return !!data?.length;
}
function base(environment:string){return environment==="production"?"https://easypay.easypaisa.com.pk":"https://easypaystg.easypaisa.com.pk";}

async function save(req:Request,body:any){
  const u=await userFromRequest(req); if(!u)return json({error:"Authentication required"},401);
  if(!(await isAdmin(u.id)))return json({error:"Admin access required"},403);
  const c=body.config??{},s=body.secret??{};
  const appUrl=await getAppUrl();
  const {data:existingSecret}=await admin.from("payment_gateway_secrets").select("merchant_id,store_id,hash_key,partner_username,partner_password,rsa_private_key").eq("provider","easypaisa").maybeSingle();
  const value={
    enabled:!!c.enabled,
    environment:c.environment==="production"?"production":"sandbox",
    merchantId:c.merchantId||s.merchantId||null,
    storeId:c.storeId||s.storeId||null,
    accountNum:c.accountNum||s.accountNum||null,
    tid:c.tid||s.tid||null,
    msisdn:c.msisdn||s.msisdn||null,
    accountTitle:c.accountTitle||null,
    returnUrl:c.returnUrl||`${appUrl}/recharge`,
    updatedAt:new Date().toISOString(),updatedBy:u.id
  };
  const {error}=await admin.from("app_kv").upsert({key:"easypaisa_gateway",value});
  if(error)return json({error:"Unable to save Easypaisa configuration"},400);
  const {error:secretError}=await admin.from("payment_gateway_secrets").upsert({
    provider:"easypaisa",merchant_id:s.merchantId||c.merchantId||existingSecret?.merchant_id||null,store_id:s.storeId||c.storeId||existingSecret?.store_id||null,
    hash_key:s.hashKey||existingSecret?.hash_key||null,partner_username:s.partnerUsername||existingSecret?.partner_username||null,partner_password:s.partnerPassword||existingSecret?.partner_password||null,
    rsa_private_key:s.rsaPrivateKey||existingSecret?.rsa_private_key||null,updated_at:new Date().toISOString(),updated_by:u.id
  });
  if(secretError)return json({error:"Unable to save private gateway credentials"},400);
  return json({ok:true,message:"Easypaisa gateway configuration saved"});
}

async function createCheckout(req:Request,body:any){
  const u=await userFromRequest(req);if(!u)return json({error:"Authentication required"},401);
  if(!body.packageId||!/^03\d{9}$/.test(String(body.mobile||"")))return json({error:"Valid Easypaisa mobile number is required"},400);
  const {data:row}=await admin.from("app_kv").select("value").eq("key","easypaisa_gateway").maybeSingle();
  const cfg:any=row?.value;
  const {data:sec}=await admin.from("payment_gateway_secrets").select("store_id,partner_username,partner_password").eq("provider","easypaisa").maybeSingle();
  if(!cfg?.enabled)return json({error:"Easypaisa gateway is not enabled"},400);
  const storeId=String(sec?.store_id||cfg.storeId||"").trim();
  if(!storeId||!sec?.partner_username||!sec?.partner_password)return json({error:"Easypaisa Partner credentials and Store ID are not configured"},400);

  const {data,error}=await admin.rpc("recharge_initiate",{_package_id:body.packageId,_method:"easypaisa",_account_ref:String(body.mobile)});
  if(error)return json({error:error.message},400);
  const order=Array.isArray(data)?data[0]:data;
  if(!order?.order_id)return json({error:"Unable to create recharge order"},500);
  const orderRef=`JALWA-${String(order.order_id).replaceAll("-","").slice(0,24)}`;
  const {error:updateError}=await admin.from("recharge_orders").update({gateway_provider:"easypaisa",gateway_order_ref:orderRef,gateway_status:"initiated"}).eq("id",order.order_id);
  if(updateError)return json({error:"Unable to initialize payment order"},500);

  const endpoint=`${base(cfg.environment)}/easypay-service/rest/v4/initiate-ma-transaction`;
  const credentials=btoa(`${sec.partner_username}:${sec.partner_password}`);
  const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Credentials":credentials},body:JSON.stringify({
    orderId:orderRef,storeId:Number(storeId),transactionAmount:String(order.amount_pkr),transactionType:"MA",
    mobileAccountNo:String(body.mobile),emailAddress:body.email||"payments@jalwa.pro"
  })});
  const payload=await r.json().catch(()=>({}));
  if(!r.ok||String(payload.responseCode||"")!=="0000"){
    await admin.from("recharge_orders").update({gateway_status:"failed",gateway_payload:payload}).eq("id",order.order_id);
    return json({error:payload.responseDesc||"Easypaisa rejected the transaction"},400);
  }
  await admin.from("recharge_orders").update({
    gateway_status:"pending",gateway_transaction_ref:payload.transactionId||null,gateway_payload:payload
  }).eq("id",order.order_id);
  return json({ok:true,orderId:order.order_id,orderRefNum:orderRef,transactionId:payload.transactionId||null,message:"Easypaisa payment request sent. Complete the payment in Easypaisa."});
}

async function verifyOrder(req:Request,body:any){
  const u=await userFromRequest(req);if(!u)return json({error:"Authentication required"},401);
  const orderId=String(body.orderId||"").trim();if(!orderId)return json({error:"Order ID required"},400);
  const {data:order}=await admin.from("recharge_orders").select("id,user_id,amount_pkr,gateway_order_ref,gateway_provider,status").eq("id",orderId).maybeSingle();
  if(!order||order.user_id!==u.id||order.gateway_provider!=="easypaisa")return json({error:"Recharge order not found"},404);
  if(order.status==="completed")return json({ok:true,status:"PAID",alreadyCredited:true});
  const {data:row}=await admin.from("app_kv").select("value").eq("key","easypaisa_gateway").maybeSingle();
  const cfg:any=row?.value;
  const {data:sec}=await admin.from("payment_gateway_secrets").select("store_id,partner_username,partner_password").eq("provider","easypaisa").maybeSingle();
  const storeId=String(sec?.store_id||cfg?.storeId||"").trim();
  const accountNum=String(cfg?.accountNum||"").trim();
  if(!storeId||!accountNum||!sec?.partner_username||!sec?.partner_password)return json({error:"Easypaisa verification credentials are not configured"},400);
  const endpoint=`${base(cfg.environment)}/easypay-service/rest/v4/inquire-transaction`;
  const credentials=btoa(`${sec.partner_username}:${sec.partner_password}`);
  const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Credentials":credentials},body:JSON.stringify({
    orderId:String(order.gateway_order_ref),storeId:Number(storeId),accountNum
  })});
  const payload=await r.json().catch(()=>({}));
  if(!r.ok||String(payload.responseCode||"")!=="0000")return json({ok:true,status:"PENDING",message:payload.responseDesc||"Payment status is not available yet"});
  const status=String(payload.transactionStatus||"").toUpperCase();
  const amount=Number(payload.transactionAmount);
  const txn=String(payload.transactionId||"").trim();
  if(status==="PAID"){
    if(!Number.isFinite(amount)||amount!==Number(order.amount_pkr)||!txn)return json({error:"Easypaisa verification mismatch"},409);
    const {data:credited,error}=await admin.rpc("gateway_credit_recharge_by_ref",{
      _provider:"easypaisa",_order_ref:String(order.gateway_order_ref),_provider_txn:txn,_status:"PAID",_amount_pkr:amount,_raw:payload
    });
    if(error)return json({error:"Payment verified but wallet credit failed"},500);
    return json({ok:true,status:"PAID",result:credited});
  }
  if(["FAILED","REVERSED","BLOCKED","EXPIRED"].includes(status)){
    await admin.from("recharge_orders").update({gateway_status:status.toLowerCase(),gateway_payload:payload,status:"failed"}).eq("id",order.id);
  }else{
    await admin.from("recharge_orders").update({gateway_status:status.toLowerCase()||"pending",gateway_payload:payload}).eq("id",order.id);
  }
  return json({ok:true,status:status||"PENDING"});
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const url=new URL(req.url);
    if(req.method!=="POST")return json({ok:true,service:"easypaisa-gateway"});
    const body=await req.json();
    if(body.action==="save")return save(req,body);
    if(body.action==="create_checkout")return createCheckout(req,body);
    if(body.action==="verify")return verifyOrder(req,body);
    return json({error:"Unknown action"},400);
  }catch(e){console.error("easypaisa-gateway",e);return json({error:e instanceof Error?e.message:"Unexpected error"},500);}
});