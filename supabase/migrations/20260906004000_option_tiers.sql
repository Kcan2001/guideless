-- 040_option_tiers
-- Kyle's decision (2026-09-07): every tour starts at the bare minimum and travelers pick between
-- public tiers for accommodation and for add-ons. The tier is a customer-facing level, separate
-- from the marketing `label` badge (migration 039), and it is not read by pricing.
--
--   explorer  Best price. More basic accommodation. Maximum value.
--   classic   The standard Guideless experience.
--   premium   Better hotels and upgraded experiences.
--   elite     Luxury. The best available.
--
-- Nullable: an airport transfer or a farewell dinner has no tier. Never invent one to fill the set.

create type public.option_tier as enum ('explorer', 'classic', 'premium', 'elite');

alter table public.departure_stay_options add column tier public.option_tier;
alter table public.departure_add_ons      add column tier public.option_tier;

comment on column public.departure_stay_options.tier is
  'Public tier (explorer / classic / premium / elite); null = untiered. Presentation only, pricing ignores it.';
comment on column public.departure_add_ons.tier is
  'Public tier (explorer / classic / premium / elite); null = untiered. Presentation only, pricing ignores it.';

-- RLS: unchanged. The "anyone reads active" policies from migration 029 expose whole rows.
