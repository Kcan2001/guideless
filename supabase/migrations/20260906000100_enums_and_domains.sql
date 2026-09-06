-- 002_enums_and_domains
-- Every enum here has a 1:1 mirror in packages/types/src/enums.ts. Keep the string values identical.
-- Adding a value: `alter type public.x add value 'y';` in a new migration AND update enums.ts.

create type public.app_role as enum (
  'customer', 'trip_staff', 'support', 'content_editor', 'finance', 'admin', 'super_admin'
);

-- Booking state and payment state are deliberately separate. Never merge them.
create type public.booking_status as enum (
  'draft', 'pending_payment', 'confirmed', 'cancelled', 'refunded', 'completed'
);
create type public.payment_status as enum (
  'unpaid', 'deposit_paid', 'partially_paid', 'paid', 'refunded', 'partially_refunded', 'failed'
);

create type public.departure_status as enum (
  'draft', 'open', 'guaranteed', 'full', 'closed', 'in_progress', 'completed', 'cancelled'
);
create type public.trip_status as enum ('upcoming', 'active', 'completed', 'cancelled');
create type public.tour_version_status as enum ('draft', 'published', 'archived');

-- free_time is a first-class concept. Do not fill every hour.
create type public.itinerary_item_type as enum (
  'hotel', 'transfer', 'train', 'flight', 'activity', 'meal', 'free_time', 'recommendation',
  'meeting_point', 'check_in', 'check_out', 'live_moment', 'custom'
);
create type public.itinerary_item_status as enum (
  'planned', 'confirmed', 'pending_supplier', 'changed', 'cancelled'
);
create type public.content_visibility as enum (
  'public_preview', 'booked_customer', 'trip_member', 'staff_only'
);
-- Who arranges an item. Must be extremely clear to the traveler.
create type public.responsibility as enum ('guideless', 'traveler');

create type public.live_moment_status as enum ('draft', 'scheduled', 'live', 'completed', 'cancelled');
create type public.chat_room_type as enum ('trip_group', 'announcements', 'optional_activities');

create type public.support_category as enum (
  'hotel', 'transportation', 'activity', 'booking', 'payment', 'lost_item', 'itinerary', 'emergency', 'other'
);
create type public.support_thread_status as enum (
  'open', 'waiting_on_customer', 'waiting_on_staff', 'resolved', 'closed'
);

create type public.supplier_service_status as enum ('requested', 'pending', 'confirmed', 'cancelled', 'failed');
create type public.transport_type as enum ('train', 'flight', 'transfer', 'ferry', 'bus');

create type public.notification_category as enum ('operational', 'social', 'marketing');
create type public.notification_channel as enum ('push', 'email', 'in_app');

create type public.recommendation_category as enum (
  'food', 'coffee', 'bars', 'culture', 'shopping', 'nature', 'nightlife', 'local',
  'hidden_gem', 'rainy_day', 'romantic', 'solo', 'group'
);
create type public.activity_level as enum ('relaxed', 'moderate', 'active');

create type public.audit_action as enum (
  'booking_created', 'booking_cancelled', 'refund_created', 'payment_updated', 'traveler_added',
  'traveler_removed', 'itinerary_changed', 'supplier_changed', 'admin_login', 'role_changed',
  'support_assignment', 'message_deleted'
);
create type public.webhook_event_status as enum ('received', 'processed', 'failed', 'skipped');

create type public.room_preference as enum ('single', 'shared_twin', 'shared_double', 'no_preference');
create type public.transfer_preference as enum ('group_welcome_transfer', 'own_arrangement');

-- Money: integer minor units + ISO 4217. Extend deliberately; each currency needs Stripe + pricing support.
create domain public.currency_code as char(3)
  check (value in ('USD', 'EUR', 'GBP'));

comment on domain public.currency_code is 'ISO 4217 codes Guideless sells in. Mirror of CURRENCIES in @guideless/types.';
