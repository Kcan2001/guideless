-- Seed: open departures for Southern France v1. Prices in USD minor units ($3,495 / $750 deposit).
-- The default group is created automatically by trigger.
insert into public.departures
  (id, tour_id, tour_version_id, status, start_date, end_date, timezone, capacity, minimum_travelers,
   price_amount, deposit_amount, currency, booking_deadline, balance_due_date)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   'open', '2027-05-14', '2027-05-22', 'Europe/Paris', 14, 6, 349500, 75000, 'USD', '2027-04-14', '2027-03-15'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   'open', '2027-06-11', '2027-06-19', 'Europe/Paris', 14, 6, 369500, 75000, 'USD', '2027-05-11', '2027-04-12'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
   'open', '2027-09-17', '2027-09-25', 'Europe/Paris', 12, 6, 349500, 75000, 'USD', '2027-08-17', '2027-07-19')
on conflict (id) do nothing;
