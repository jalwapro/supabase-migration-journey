import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const apiKey=Deno.env.get("OPENAI_API_KEY")?.trim();
const model=Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-5.6-luna";
const admin=createClient(supabaseUrl,serviceKey);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};

const fallback=(s:string)=>{
 const b=s.toLowerCase();
 if(/recharge|coins|top.?up|package|balance/.test(b)) return "Recharge Coins page par package select karein, WhatsApp Manual Recharge ya Manual Payment use karein, phir transaction/TID aur proof submit karein. PIN kabhi share na karein.";
 if(/withdraw|cashout|payout/.test(b)) return "Withdrawal Request section mein request submit karein. Admin verification ke baad process hoti hai.";
 if(/easypaisa|jazzcash|payment|qr|till|tid|transaction/.test(b)) return "Official payment app se payment karein aur transaction/TID + required proof submit karein. PIN/password/OTP share na karein.";
 if(/gift|animation|video/.test(b)) return "Voice Room gift issue mein gift name, room aur screenshot/video bhejein.";
 if(/room|seat|mic|microphone|speaker|audio|cohost|moderator/.test(b)) return "Voice Room issue mein room name/ID aur exact problem bhejein.";
 if(/emoji/.test(b)) return "Room emoji recipient ki seat/DP par momentarily show hona chahiye. Sender, receiver aur room detail bhejein.";
 if(/login|google|signin|account/.test(b)) return "Login issue ka exact error aur screenshot bhejein. Secret credentials share na karein.";
 if(/profile|dp|frame|theme|vip|level|xp/.test(b)) return "Profile, DP, frames aur themes ke issue mein screenshot aur user ID bhejein.";
 if(/ludo|game|mini game|room game/.test(b)) return "Game ka naam, room/game ID aur exact error bhejein.";
 if(/admin|agent|human|person|ticket|complaint|report/.test(b)) return "Theek hai — admin support ko escalate kar raha hoon. Admin isi chat mein reply karega.";
 return "Main JALWA ke documented features ke mutaliq help karta hoon. Reliable jawab na ho to main admin support ko escalate karta hoon.";
};

Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  const {data:{user}}=await admin.auth.getUser(token);
  if(!user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  const x=await req.json(), conversation_id=String(x.conversation_id||""), message=String(x.body||"").trim();
  const {data:conv}=await admin.from("support_conversations").select("id").eq("id",conversation_id).eq("user_id",user.id).maybeSingle();
  if(!conv||!message) return new Response(JSON.stringify({error:"Invalid conversation"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  const {data:history}=await admin.from("support_messages").select("sender_kind,body").eq("conversation_id",conversation_id).order("created_at",{ascending:false}).limit(12);
  let reply=fallback(message);
  if(apiKey){
   const instructions="You are JALWA Global Live's in-app AI support assistant. Answer only about JALWA: recharge/coins, Easypaisa/JazzCash/WhatsApp manual payment, withdrawal, gifts, audio-only Voice Rooms, seats/requests/host/cohost/moderator, emojis, Google login, profile/DP/frame/theme, VIP/levels, games/Ludo, reports and support. Never invent prices, IDs, database fields, policies, fixes or claim to change code. Never request passwords, OTPs, payment PINs, API keys or service-role keys. If evidence is insufficient or outside JALWA scope, explicitly escalate to admin. Reply in the user's language and stay concise.";
   const input=[...(history||[]).reverse().map((m:any)=>({role:m.sender_kind==="user"?"user":"assistant",content:m.body})),{role:"user",content:message}];
   const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model,instructions,input,max_output_tokens:450})});
   if(r.ok){const j=await r.json(); const out=(j.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("\n").trim(); if(out) reply=out;}
  }
  const {error}=await admin.from("support_messages").insert({conversation_id,sender_id:user.id,sender_kind:"bot",body:reply});
  if(error) throw error;
  return new Response(JSON.stringify({ok:true,reply}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"AI support failed"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});}
});