-- 20260910002100_add_on_family_copy
--
-- Backfills `family_summary` for the families created in 20260910002000.
--
-- Why this is a migration and not just a seed: seeds do not ship through CI (docs/deployment.md),
-- they are replayed by hand against the pooler on a catalogue refresh. The previous migration
-- backfilled `family` on production, so production would have had families with no family copy —
-- and the fallback is the *cheapest variant's* description, which on the yacht card reads
-- "A day on the water for qualifying". That is a sentence about one of the three days, printed
-- under a card that stands for all of them, which is the precise failure the column exists to stop.
--
-- Idempotent and narrow: it writes only where the family matches and the copy is still missing, so
-- replaying it cannot overwrite anything an editor has since changed in the admin.

update public.departure_add_ons
set family_summary =
  'A day on a boat in Port Hercule, inside the circuit. Qualifying, race day, or both — '
  'you pick which when you build the trip.'
where family = 'Yacht'
  and family_summary is null;

update public.departure_add_ons
set family_summary =
  'A numbered seat above Tabac, where the cars come out of the chicane. Choose the full three '
  'days or just the weekend when you build the trip.'
where family = 'Grandstand K'
  and family_summary is null;
