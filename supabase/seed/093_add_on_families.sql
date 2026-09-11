-- 093_add_on_families
--
-- Groups the Monaco race-viewing variants into families so the tour page can show one card per
-- thing instead of one card per day. The builder is untouched and still offers every row.
--
-- Families only where there are genuinely variants. Secteur Rocher, the harbour terrace and the
-- Wednesday casino night each exist once, so they stay null and stand as themselves.

-- ── Yacht: three days, one product ──────────────────────────────────────────
update public.departure_add_ons
set family = 'Yacht',
    family_summary =
      'A day on a boat in Port Hercule, inside the circuit. Qualifying, race day, or both — '
      'you pick which when you build the trip.'
where title ilike 'Amber Lounge yacht%';

-- ── Grandstand K: the three-day pass and the weekend pass ───────────────────
update public.departure_add_ons
set family = 'Grandstand K',
    family_summary =
      'A numbered seat above Tabac, where the cars come out of the chicane. Choose the full three '
      'days or just the weekend when you build the trip.'
where title ilike 'Grandstand K%';

-- Nothing else has variants yet. Leaving family null is the correct state, not an omission: an
-- add-on with no family is its own family, and the tour page renders it unchanged.
