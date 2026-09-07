-- Seed: destinations for the first route (Southern France). Catalog seed: safe to apply once to any environment.
insert into public.destinations
  (id, slug, name, country_code, country_name, region, timezone, latitude, longitude, summary, emergency_numbers, is_published)
values
  ('10000000-0000-4000-8000-000000000001', 'nice', 'Nice', 'FR', 'France', 'Côte d''Azur', 'Europe/Paris',
   43.7102, 7.2620,
   'Belle Époque promenades, a pastel old town and the bluest water on the Riviera. Trains along the coast every half hour.',
   '{"general":"112","police":"17","ambulance":"15","fire":"18"}', true),
  ('10000000-0000-4000-8000-000000000002', 'avignon', 'Avignon', 'FR', 'France', 'Provence', 'Europe/Paris',
   43.9493, 4.8055,
   'A walled city of papal palaces and plane-tree squares, with Châteauneuf-du-Pape fifteen minutes away.',
   '{"general":"112","police":"17","ambulance":"15","fire":"18"}', true),
  ('10000000-0000-4000-8000-000000000003', 'paris', 'Paris', 'FR', 'France', 'Île-de-France', 'Europe/Paris',
   48.8566, 2.3522,
   'The city that needs no guide — which is rather the point.',
   '{"general":"112","police":"17","ambulance":"15","fire":"18"}', true)
on conflict (id) do nothing;
