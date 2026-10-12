# JALWA P2P Master-Agency v1 rollout

The three `20261013000100`–`20261013000300` migrations create a new, isolated P2P economy. It does not read or write the previous wallet, coin seller, or diamond trade tables. The legacy economy is intentionally not dropped by this change: perform the app cutover and legacy deprecation in a separate reviewed release after the new flows pass staging tests.

## Included

- Independent profiles/roles, coin inventory, available/locked diamond balances, exchange-rate snapshots, ledger, withdrawals, and notifications.
- Admin-only role assignment, fiat conversion-rate configuration, and audited coin/diamond grants.
- Required payout destination (JazzCash, Easypaisa, bank transfer, Raast, or other), account-holder name, and account/wallet number; visible only to withdrawal parties under RLS.
- Top-down coin transfers: Admin -> Super Agent -> assigned Sub-Agent -> standard User.
- Diamond withdrawal escrow, private payout screenshot storage, Super Agent approval, and rejection/refund.
- RLS for table reads and screenshot access; browser clients have no direct balance/table write grants.
- Super Agent review route: `/_authenticated/agency-approvals`.

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
5. Seed or credit diamond balances only through trusted server-side gift settlement. The private `p2p_private.credit_diamonds` function is granted to `service_role` only; never put the service-role key in the browser.
6. Run RLS tests for every role before enabling navigation or real-money activity.

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
- Verify dashboard route builds after route generation and that no LiveKit files or APIs changed.

## Not yet a production cutover

This commit does not migrate legacy balances, switch gift settlement to the new economy, remove old coin-agent pages, or apply the migration to production. Those steps require staging verification and an explicit cutover plan to avoid losing balances or breaking existing JALWA features.
