/**
 * Domain enums shared across web, mobile, edge functions and (via migrations) Postgres.
 *
 * Every enum here must have a matching Postgres enum type in supabase/migrations.
 * Keep the string values identical in both places — they cross the wire unchanged.
 */

export const ROLES = [
  "customer",
  "trip_staff",
  "support",
  "content_editor",
  "finance",
  "admin",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that grant access to /admin. */
export const STAFF_ROLES: readonly Role[] = [
  "trip_staff",
  "support",
  "content_editor",
  "finance",
  "admin",
  "super_admin",
];

// Booking state and payment state are deliberately separate. Do not mix them.
export const BOOKING_STATUSES = [
  "draft",
  "pending_payment",
  "confirmed",
  "cancelled",
  "refunded",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "deposit_paid",
  "partially_paid",
  "paid",
  "refunded",
  "partially_refunded",
  "failed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DEPARTURE_STATUSES = [
  "draft",
  "open",
  "guaranteed",
  "full",
  "closed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const TRIP_STATUSES = ["upcoming", "active", "completed", "cancelled"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TOUR_VERSION_STATUSES = ["draft", "published", "archived"] as const;
export type TourVersionStatus = (typeof TOUR_VERSION_STATUSES)[number];

/** `free_time` is a first-class concept. Do not fill every hour. */
export const ITINERARY_ITEM_TYPES = [
  "hotel",
  "transfer",
  "train",
  "flight",
  "activity",
  "meal",
  "free_time",
  "recommendation",
  "meeting_point",
  "check_in",
  "check_out",
  "live_moment",
  "custom",
] as const;
export type ItineraryItemType = (typeof ITINERARY_ITEM_TYPES)[number];

export const ITINERARY_ITEM_STATUSES = [
  "planned",
  "confirmed",
  "pending_supplier",
  "changed",
  "cancelled",
] as const;
export type ItineraryItemStatus = (typeof ITINERARY_ITEM_STATUSES)[number];

export const VISIBILITIES = [
  "public_preview",
  "booked_customer",
  "trip_member",
  "staff_only",
] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Who is responsible for arranging an item. Must be extremely clear to the traveler. */
export const RESPONSIBILITIES = ["guideless", "traveler"] as const;
export type Responsibility = (typeof RESPONSIBILITIES)[number];

export const LIVE_MOMENT_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "completed",
  "cancelled",
] as const;
export type LiveMomentStatus = (typeof LIVE_MOMENT_STATUSES)[number];

export const CHAT_ROOM_TYPES = ["trip_group", "announcements", "optional_activities"] as const;
export type ChatRoomType = (typeof CHAT_ROOM_TYPES)[number];

export const SUPPORT_CATEGORIES = [
  "hotel",
  "transportation",
  "activity",
  "booking",
  "payment",
  "lost_item",
  "itinerary",
  "emergency",
  "other",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_THREAD_STATUSES = [
  "open",
  "waiting_on_customer",
  "waiting_on_staff",
  "resolved",
  "closed",
] as const;
export type SupportThreadStatus = (typeof SUPPORT_THREAD_STATUSES)[number];

export const TRANSPORT_TYPES = ["train", "flight", "transfer", "ferry", "bus"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const ROOM_PREFERENCES = [
  "single",
  "shared_twin",
  "shared_double",
  "no_preference",
] as const;
export type RoomPreference = (typeof ROOM_PREFERENCES)[number];

export const TRANSFER_PREFERENCES = ["group_welcome_transfer", "own_arrangement"] as const;
export type TransferPreference = (typeof TRANSFER_PREFERENCES)[number];

export const SUPPLIER_SERVICE_STATUSES = [
  "requested",
  "pending",
  "confirmed",
  "cancelled",
  "failed",
] as const;
export type SupplierServiceStatus = (typeof SUPPLIER_SERVICE_STATUSES)[number];

export const NOTIFICATION_CATEGORIES = ["operational", "social", "marketing"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ["push", "email", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const RECOMMENDATION_CATEGORIES = [
  "food",
  "coffee",
  "bars",
  "culture",
  "shopping",
  "nature",
  "nightlife",
  "local",
  "hidden_gem",
  "rainy_day",
  "romantic",
  "solo",
  "group",
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export const ACTIVITY_LEVELS = ["relaxed", "moderate", "active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const AUDIT_ACTIONS = [
  "booking_created",
  "booking_cancelled",
  "refund_created",
  "payment_updated",
  "traveler_added",
  "traveler_removed",
  "itinerary_changed",
  "supplier_changed",
  "admin_login",
  "role_changed",
  "support_assignment",
  "message_deleted",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const WEBHOOK_EVENT_STATUSES = ["received", "processed", "failed", "skipped"] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

// ── Marketing / social publishing (migration 025) ────────────────────────────
export const SOCIAL_PLATFORMS = ["instagram", "pinterest"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_MEDIA_KINDS = ["image", "carousel"] as const;
export type SocialMediaKind = (typeof SOCIAL_MEDIA_KINDS)[number];

export const SOCIAL_POST_STATUSES = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

// ── Catalog: add-ons and stay tiers (migrations 029, 039) ────────────────────
/** What an add-on is; `extension` covers pre/post-trip nights and destinations. */
export const ADD_ON_KINDS = [
  "activity",
  "ticket",
  "transfer",
  "dinner",
  "extra_night",
  "room_upgrade",
  "group_moment",
  "insurance",
  "extension",
  "other",
] as const;
export type AddOnKind = (typeof ADD_ON_KINDS)[number];

/** Admin-chosen badge on a stay tier or add-on. Manual on purpose: no inferred "popular". */
export const OPTION_LABELS = ["best_value", "most_popular", "social", "luxury"] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

/** ISO 4217 codes we sell in. Extend deliberately; each needs Stripe + pricing support. */
export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
