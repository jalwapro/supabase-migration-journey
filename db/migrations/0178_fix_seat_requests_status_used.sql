-- Add 'used' to seat_requests.status check constraint.
-- respond_seat_request() marks a granted request as 'used' after seating
-- the user, but the old CHECK only allowed pending/accepted/rejected/cancelled,
-- so host approve failed with:
--   new row for relation "seat_requests" violates check constraint
--     "seat_requests_status_check"

alter table public.seat_requests
  drop constraint if exists seat_requests_status_check;

alter table public.seat_requests
  add constraint seat_requests_status_check
  check (status = any (array['pending','accepted','rejected','cancelled','used']));
