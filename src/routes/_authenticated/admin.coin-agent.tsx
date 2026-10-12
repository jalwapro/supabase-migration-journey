import {createFileRoute} from "@tanstack/react-router";
import {CoinAgentAdmin} from "@/pages/admin/CoinAgentAdmin";
export const Route=createFileRoute("/_authenticated/admin/coin-agent")({component:CoinAgentAdmin});
