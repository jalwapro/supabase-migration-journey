# JALWA P2P Master-Agency v1 rollout

The nine `20261013000100`–`20261013000900` migrations create an isolated P2P economy, coin marketplace and P2P spending cutover. It does not read or write the previous wallet, coin seller, or diamond trade tables. The legacy economy is intentionally not dropped by this change: perform the app cutover and legacy deprecation in a separate reviewed release after the new flows pass staging tests.

## Included

- Independent profiles/roles, coin inventory, available/locked diamond balances, exchange-rate snapshots, ledger, withdrawals, and notifications.
- Admin-only role assignment, fiat conversion-rate configuration, and audited coin/diamond grants.
- Super Agent team dashboard for searching JALWA users and creating/managing up to five Sub-Agents; the same five-agent cap is enforced in database RPCs, including Admin assignments.
- Required payout destination (JazzCash, Easypaisa, bank transfer, Raast, or other), account-holder name, and account/wallet number; visible only to withdrawal parties under RLS.
- Top-down coin transfers: Admin -> Super Agent -> assigned Sub-Agent -> standard User; each Super Agent is limited to five Sub-Agents.
- P2P coin marketplace with agent country/payment details, Admin-controlled pricing and currency conversion, agent coin escrow, payment screenshots, order chat, and Admin appeal resolution.
- Gift send RPC debits P2P coins and credits P2P diamonds; VIP, shop and custom-theme spending also use P2P balances. Paid-coin cost basis is maintained for gift payout calculations.
- Diamond withdrawal escrow, private payout screenshot storage, Super Agent approval, and rejection/refund.
- RLS for table reads and screenshot access; browser clients have no direct balance/table write grants.
- Super Agent review route: `/_authenticated/agency-approvals`.
- Sub-Agent storefront with country/currency, WhatsApp, price per 1,000 coins, and a user-facing country filter.
- Gift sending debits P2P coins and credits P2P diamonds atomically; VIP subscription, theme shop, and custom-theme submission fees use P2P balances.
- Legacy coin-agent, coin-seller, wallet, recharge, recharge-history, and withdrawal screens redirect into `/p2p-agency`; the old agent components are no longer the active frontend.
- Legacy user wallet/recharge/withdraw/coin-seller routes redirect to `/p2p-agency`; old finance items are filtered from published bottom navigation.

## One-time bootstrap

1. Apply the migration only in a development Supabase branch first.
2. In the Supabase SQL editor, after identifying the intended Auth user, create the first Admin profile once (replace the UUID with the real `auth.users.id`):
   ```sql
   insert into public.p2p_profiles(user_id, role, display_name)
   values ('REPLACE-WITH-ADMIN-AUTH-UUID'::uuid, 'admin', 'Platform Admin');
   ```
   The trigger creates the Admin's new P2P wallet.
3. Add a PKR conversion rate using the Admin session:
   ```sql
   select public.p2p_admin_set_exchange_rate('PKR', 10, true);
   ```
   This example means 10 diamonds per PKR 1 and is only a placeholder. Set the business-approved rate before enabling withdrawals.
4. Assign Super Agents and Sub-Agents through `p2p_admin_assign_role`. A Sub-Agent must be assigned to an active Super Agent.
5. Configure the Admin gift-economy settings in `/p2p-agency`: approved PKR value per 1,000 coins, receiver share, and enable toggle. Configure an active PKR diamond conversion rate before enabling gift settlement. The backend rejects gift sends until both settings are valid.
6. Run RLS tests for every role before enabling navigation or real-money activity.

## P2P coin order lifecycle

- Admin configures the PKR bundle price, allowed agent bundle range (default 500–600 coins per PKR 50), and currency conversion rates.
- Admin assigns each Sub-Agent's country and currency. Agents can configure payment methods/details, price within the Admin range, and order limits but cannot change their assigned country/currency.
- Order creation atomically locks agent coins. Buyer uploads payment proof and reference; the agent confirms payment to release coins to the buyer. Buyer can open an appeal; Admin resolves to buyer or agent. Unpaid cancellations refund agent escrow.
- Order messages are restricted to the buyer, assigned Sub-Agent, their Super Agent, and Admin.

## Withdrawal lifecycle

- User calls `p2p_request_diamond_withdrawal` with payout method, account-holder name, and account/wallet number. The DB calculates the fiat quote from the active exchange rate and atomically moves available diamonds to locked escrow.
- Sub-Agent pays fiat outside the app, uploads a new image to the private `payout_screenshots` bucket at `<withdrawal-uuid>/<random-file>.png`, then calls `p2p_submit_diamond_payout`.
- Only the assigned Super Agent may call `p2p_approve_diamond_withdrawal` or `p2p_reject_diamond_withdrawal`.
- Approval atomically debits the user's locked diamonds and credits the Sub-Agent's diamond inventory. Rejection returns locked diamonds to the user.
- Screenshots are private; UI uses short-lived signed URLs. Do not enable Storage upsert or client update/delete policies.

## Staging acceptance tests

- Two simultaneous withdrawal requests cannot overdraw available diamonds.
- Duplicate request keys return the same request or safely fail without a second debit.
- Sub-Agent cannot approve a withdrawal or submit proof for another Sub-Agent.
- A Super Agent cannot approve a request assigned to another agency.
- Approval twice cannot release diamonds twice; rejection twice cannot refund twice.
- Missing/invalid screenshot path prevents submission; unrelated users cannot read proof.
- Insufficient coin stock blocks every hierarchy transfer; all invalid hierarchy transfers fail.
- Browser roles cannot directly insert/update/delete wallets, ledger, roles, or withdrawal states.
- Gift credit idempotency prevents duplicate diamond credit.
- Verify dashboard and Super Agent team routes build after route generation, old finance routes redirect as intended, and no LiveKit files or APIs changed.

## Not yet a production cutover

Legacy user-facing finance pages are redirected/hidden, and gift send accounting is switched to P2P balances. This does not migrate existing legacy balances or apply migrations to production. Several mini-game/casino RPCs still use legacy profile coin balances and require a separate audited port to P2P balances before claiming the entire app economy has completed its cutover. Those steps require staging verification and an explicit cutover plan to avoid losing balances or breaking existing JALWA features.
