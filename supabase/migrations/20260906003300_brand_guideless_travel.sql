-- 034_brand_guideless_travel
-- The brand is "Guideless Travel" (legal entity Guideless LLC), not "Guideless Tours". Seeds were
-- corrected in place; this fixes rows that already exist in staging/production. Forward-only.
update public.tour_versions
set seo_title = replace(seo_title, 'Guideless Tours', 'Guideless Travel'),
    seo_description = replace(seo_description, 'Guideless Tours', 'Guideless Travel')
where seo_title like '%Guideless Tours%' or seo_description like '%Guideless Tours%';

update public.system_settings
set value = to_jsonb(replace(value #>> '{}', 'Guideless Tours', 'Guideless Travel')), updated_at = now()
where jsonb_typeof(value) = 'string' and (value #>> '{}') like '%Guideless Tours%';
