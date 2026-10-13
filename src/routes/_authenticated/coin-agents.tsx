import {createFileRoute} from "@tanstack/react-router";
import {AppShell} from "@/components/layout/AppShell";
import {BottomNav} from "@/components/layout/BottomNav";
import {CoinAgentHub} from "@/components/coin-agent/CoinAgentHub";
import {DiamondPayoutFlow} from "@/components/coin-agent/DiamondPayoutFlow";
export const Route=createFileRoute("/_authenticated/coin-agents")({component:Page});
function Page(){return <><AppShell title="Coin Agent Market" subtitle="Sell diamonds, receive agent payout"><div className="space-y-4"><DiamondPayoutFlow/><CoinAgentHub/></div></AppShell><BottomNav/></>;}
