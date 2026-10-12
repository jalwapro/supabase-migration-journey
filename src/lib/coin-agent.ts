import { supabase } from "@/integrations/supabase/client";
export type CoinAgentAction = "CONFIG"|"MARKETPLACE"|"SAVE_AGENT_RATE"|"CREATE_TRADE"|"AGENT_MARK_PAID"|"USER_CONFIRM_TRADE"|"DISPUTE_TRADE"|"ADMIN_RESOLVE_TRADE_COMPLETE"|"ADMIN_RESOLVE_TRADE_REFUND"|"CANCEL_TRADE"|"SETTLEMENT_REQUEST"|"ADMIN_APPROVE_SETTLEMENT"|"ADMIN_REJECT_SETTLEMENT"|"ADMIN_SET_CONFIG"|"ADMIN_SAVE_TIER"|"ADMIN_TOGGLE_AGENT"|"ADMIN_ASSIGN_AGENT"|"COIN_ORDER_LIST"|"CREATE_COIN_ORDER"|"ADMIN_APPROVE_COIN_ORDER"|"ADMIN_REJECT_COIN_ORDER"|"ADMIN_LIST_ROLES"|"ADMIN_SET_ROLE"|"ROLE_CONTEXT"|"SUPER_LIST_CHILDREN"|"SUPER_CREATE_CHILD_AGENT";
export async function coinAgentAction<T=any>(action:CoinAgentAction,payload:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.functions.invoke("coin-agent",{body:{action,payload}});
 if(error){let message=error.message||"Coin Agent request failed";try{const c=(error as {context?:Response}).context;const b=c?await c.clone().json() as {error?:string}:null;if(b?.error)message=b.error;}catch{}throw new Error(message);}
 if(data?.error)throw new Error(String(data.error));return data?.data as T;
}
export const DIAMOND_SOURCES=[{value:"profile_diamonds",label:"Wallet Diamonds"},{value:"red_diamonds",label:"Red Diamonds"}] as const;
