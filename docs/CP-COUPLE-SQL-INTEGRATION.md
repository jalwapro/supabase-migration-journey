# Supplied CP Couple SQL — integration notes

The SQL supplied for `0280_cp_couple_system.sql` has been reviewed against the active JALWA CP implementation on this branch.

## Important: do not apply the supplied SQL as a new migration verbatim

This repository already has an active CP schema and server-side RPCs in:

- `supabase/migrations/20261013190000_cp_couple_system_v1.sql`
- `supabase/migrations/20261013210000_cp_couple_system_completion.sql`
- `supabase/migrations/20261013220000_cp_prelink_gift_qualification.sql`
- `supabase/migrations/20261013230000_cp_harden_trigger_acl.sql`

The supplied SQL uses a different schema/API generation:

| Supplied SQL | Current JALWA CP implementation |
|---|---|
| `cp_relationships` | `cp_relations` |
| `intimacy_points` | `intimacy_score` |
| `level` | `ring_level` backed by `cp_levels_config` |
| `propose_cp` | `cp_send_proposal` |
| `respond_cp_proposal` | `cp_respond_proposal` |
| `dissolve_cp` | `cp_divorce` |
| `cp_intimacy_logs` | `cp_intimacy_events` and `cp_prelink_intimacy_events` |

Running the supplied SQL unchanged would create a second relationship table beside the live one. Its broad table grants and public read policies also differ from the current participant-restricted RLS model. Its gift trigger expects `gift_sends.coins`, while the active implementation uses the existing `gift_sends` schema and tracks qualifying gift sends through the established CP event tables.

## What is integrated already

The active migrations already provide the core requested behavior: proposals, acceptance/rejection, one active relationship per user, server-side coin charging, intimacy events from gifts, romantic-gift pre-qualification, and CP ranking/level support. The existing implementation remains the source of truth so the app does not end up with two competing CP systems.

The supplied SQL's legacy-only fields (`message`, `ring_type`, `ring_icon`, and `space_bio`) are documented here as compatibility items, not silently added to the active schema. They should be added only with a deliberate schema/API migration that updates the app consumers as well.

No LiveKit token, transport, room, or API code is changed by this integration note.
