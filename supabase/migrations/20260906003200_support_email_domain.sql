-- 033_support_email_domain
-- The company domain is guidelesstravel.com (Squarespace-managed DNS). Forward-only fix of the
-- reply-to address seeded in migration 021; the app reads it from system_settings.
update public.system_settings
set value = '"hello@guidelesstravel.com"'::jsonb, updated_at = now()
where key = 'support_email' and value = '"hello@guidelesstours.com"'::jsonb;
