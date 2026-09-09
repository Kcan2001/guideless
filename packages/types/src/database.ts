// GENERATED FILE -- do not edit. Regenerate with `pnpm db:types` after every migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      accommodations: {
        Row: {
          address: string | null;
          check_in_date: string;
          check_in_time: string | null;
          check_out_date: string;
          check_out_time: string | null;
          created_at: string;
          departure_id: string;
          destination_id: string | null;
          guest_instructions: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          phone: string | null;
          supplier_service_id: string | null;
          timezone: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          check_in_date: string;
          check_in_time?: string | null;
          check_out_date: string;
          check_out_time?: string | null;
          created_at?: string;
          departure_id: string;
          destination_id?: string | null;
          guest_instructions?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          phone?: string | null;
          supplier_service_id?: string | null;
          timezone: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          check_in_date?: string;
          check_in_time?: string | null;
          check_out_date?: string;
          check_out_time?: string | null;
          created_at?: string;
          departure_id?: string;
          destination_id?: string | null;
          guest_instructions?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          phone?: string | null;
          supplier_service_id?: string | null;
          timezone?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accommodations_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "accommodations_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "accommodations_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "accommodations_supplier_service_id_fkey";
            columns: ["supplier_service_id"];
            isOneToOne: false;
            referencedRelation: "supplier_services";
            referencedColumns: ["id"];
          },
        ];
      };
      account_credits: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          note: string | null;
          source: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string;
          currency: string;
          id?: string;
          note?: string | null;
          source: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          note?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_credits_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_credits_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      activities: {
        Row: {
          address: string | null;
          capacity: number | null;
          created_at: string;
          currency: string | null;
          departure_id: string;
          description: string | null;
          destination_id: string | null;
          ends_at: string | null;
          id: string;
          is_optional: boolean;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          name: string;
          price_amount: number | null;
          starts_at: string;
          supplier_service_id: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          capacity?: number | null;
          created_at?: string;
          currency?: string | null;
          departure_id: string;
          description?: string | null;
          destination_id?: string | null;
          ends_at?: string | null;
          id?: string;
          is_optional?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          name: string;
          price_amount?: number | null;
          starts_at: string;
          supplier_service_id?: string | null;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          capacity?: number | null;
          created_at?: string;
          currency?: string | null;
          departure_id?: string;
          description?: string | null;
          destination_id?: string | null;
          ends_at?: string | null;
          id?: string;
          is_optional?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          name?: string;
          price_amount?: number | null;
          starts_at?: string;
          supplier_service_id?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_supplier_service_id_fkey";
            columns: ["supplier_service_id"];
            isOneToOne: false;
            referencedRelation: "supplier_services";
            referencedColumns: ["id"];
          },
        ];
      };
      add_on_fulfilments: {
        Row: {
          add_on_id: string;
          booked_at: string | null;
          booked_by: string | null;
          booking_add_on_id: string;
          booking_id: string;
          cancellation_terms: Json;
          created_at: string;
          failure_reason: string | null;
          id: string;
          instructions: string | null;
          status: Database["public"]["Enums"]["fulfilment_status"];
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_booking_id: string | null;
          supplier_option_id: string;
          supplier_reference: string | null;
          travel_date: string;
          travelers: number;
          updated_at: string;
          voucher_url: string | null;
        };
        Insert: {
          add_on_id: string;
          booked_at?: string | null;
          booked_by?: string | null;
          booking_add_on_id: string;
          booking_id: string;
          cancellation_terms?: Json;
          created_at?: string;
          failure_reason?: string | null;
          id?: string;
          instructions?: string | null;
          status?: Database["public"]["Enums"]["fulfilment_status"];
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_booking_id?: string | null;
          supplier_option_id: string;
          supplier_reference?: string | null;
          travel_date: string;
          travelers?: number;
          updated_at?: string;
          voucher_url?: string | null;
        };
        Update: {
          add_on_id?: string;
          booked_at?: string | null;
          booked_by?: string | null;
          booking_add_on_id?: string;
          booking_id?: string;
          cancellation_terms?: Json;
          created_at?: string;
          failure_reason?: string | null;
          id?: string;
          instructions?: string | null;
          status?: Database["public"]["Enums"]["fulfilment_status"];
          supplier?: Database["public"]["Enums"]["experience_supplier"];
          supplier_booking_id?: string | null;
          supplier_option_id?: string;
          supplier_reference?: string | null;
          travel_date?: string;
          travelers?: number;
          updated_at?: string;
          voucher_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "add_on_fulfilments_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_on_availability";
            referencedColumns: ["add_on_id"];
          },
          {
            foreignKeyName: "add_on_fulfilments_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "departure_add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "add_on_fulfilments_booking_add_on_id_fkey";
            columns: ["booking_add_on_id"];
            isOneToOne: true;
            referencedRelation: "booking_add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "add_on_fulfilments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "add_on_fulfilments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      add_on_sourcing: {
        Row: {
          add_on_id: string;
          created_at: string;
          currency: string;
          drift_amount: number | null;
          last_checked_at: string | null;
          net_amount: number;
          product_id: string;
          source_rate_id: string | null;
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_option_id: string;
          updated_at: string;
        };
        Insert: {
          add_on_id: string;
          created_at?: string;
          currency: string;
          drift_amount?: number | null;
          last_checked_at?: string | null;
          net_amount: number;
          product_id: string;
          source_rate_id?: string | null;
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_option_id: string;
          updated_at?: string;
        };
        Update: {
          add_on_id?: string;
          created_at?: string;
          currency?: string;
          drift_amount?: number | null;
          last_checked_at?: string | null;
          net_amount?: number;
          product_id?: string;
          source_rate_id?: string | null;
          supplier?: Database["public"]["Enums"]["experience_supplier"];
          supplier_option_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "add_on_sourcing_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: true;
            referencedRelation: "add_on_availability";
            referencedColumns: ["add_on_id"];
          },
          {
            foreignKeyName: "add_on_sourcing_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: true;
            referencedRelation: "departure_add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "add_on_sourcing_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "experience_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "add_on_sourcing_source_rate_id_fkey";
            columns: ["source_rate_id"];
            isOneToOne: false;
            referencedRelation: "experience_rates";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          booking_id: string;
          created_at: string;
          id: string;
          title: string | null;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          id?: string;
          title?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          id?: string;
          title?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          actions: Json;
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          actions?: Json;
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          actions?: Json;
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage: {
        Row: {
          booking_id: string | null;
          cost_micros: number;
          input_tokens: number;
          messages: number;
          output_tokens: number;
          updated_at: string;
          usage_date: string;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          cost_micros?: number;
          input_tokens?: number;
          messages?: number;
          output_tokens?: number;
          updated_at?: string;
          usage_date: string;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          cost_micros?: number;
          input_tokens?: number;
          messages?: number;
          output_tokens?: number;
          updated_at?: string;
          usage_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_group_posts: {
        Row: {
          created_at: string;
          item_count: number;
          message_id: string | null;
          post_date: string;
          trip_id: string;
        };
        Insert: {
          created_at?: string;
          item_count?: number;
          message_id?: string | null;
          post_date: string;
          trip_id: string;
        };
        Update: {
          created_at?: string;
          item_count?: number;
          message_id?: string | null;
          post_date?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_group_posts_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assistant_group_posts_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          ip_address: unknown;
          metadata: Json;
        };
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          ip_address?: unknown;
          metadata?: Json;
        };
        Update: {
          action?: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          ip_address?: unknown;
          metadata?: Json;
        };
        Relationships: [];
      };
      booking_add_ons: {
        Row: {
          add_on_id: string;
          booking_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          hold_expires_at: string | null;
          id: string;
          payment_id: string | null;
          purchase_id: string | null;
          quantity: number;
          status: string;
          stripe_checkout_session_id: string | null;
          title_snapshot: string | null;
          total_amount: number;
          traveler_id: string | null;
          unit_amount: number;
          updated_at: string;
        };
        Insert: {
          add_on_id: string;
          booking_id: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency: string;
          hold_expires_at?: string | null;
          id?: string;
          payment_id?: string | null;
          purchase_id?: string | null;
          quantity?: number;
          status?: string;
          stripe_checkout_session_id?: string | null;
          title_snapshot?: string | null;
          total_amount: number;
          traveler_id?: string | null;
          unit_amount: number;
          updated_at?: string;
        };
        Update: {
          add_on_id?: string;
          booking_id?: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency?: string;
          hold_expires_at?: string | null;
          id?: string;
          payment_id?: string | null;
          purchase_id?: string | null;
          quantity?: number;
          status?: string;
          stripe_checkout_session_id?: string | null;
          title_snapshot?: string | null;
          total_amount?: number;
          traveler_id?: string | null;
          unit_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_on_availability";
            referencedColumns: ["add_on_id"];
          },
          {
            foreignKeyName: "booking_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "departure_add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_add_ons_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_add_ons_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_add_ons_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_add_ons_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "traveler_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_documents: {
        Row: {
          booking_id: string;
          bucket: string;
          created_at: string;
          id: string;
          kind: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          title: string;
          uploaded_by: string | null;
        };
        Insert: {
          booking_id: string;
          bucket?: string;
          created_at?: string;
          id?: string;
          kind: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          title: string;
          uploaded_by?: string | null;
        };
        Update: {
          booking_id?: string;
          bucket?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          title?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_items: {
        Row: {
          booking_id: string;
          currency: string;
          id: string;
          kind: string;
          metadata: Json;
          quantity: number;
          title: string;
          total_amount: number;
          unit_amount: number;
        };
        Insert: {
          booking_id: string;
          currency: string;
          id?: string;
          kind: string;
          metadata?: Json;
          quantity?: number;
          title: string;
          total_amount: number;
          unit_amount: number;
        };
        Update: {
          booking_id?: string;
          currency?: string;
          id?: string;
          kind?: string;
          metadata?: Json;
          quantity?: number;
          title?: string;
          total_amount?: number;
          unit_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_items_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_notes: {
        Row: {
          body: string;
          booking_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
        };
        Insert: {
          body: string;
          booking_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
        };
        Update: {
          body?: string;
          booking_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_notes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_notes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_preferences: {
        Row: {
          accessibility_needs: string | null;
          airport_transfer: Database["public"]["Enums"]["transfer_preference"];
          booking_id: string;
          dietary_requirements: string | null;
          optional_experience_ids: string[];
          room_preference: Database["public"]["Enums"]["room_preference"];
          updated_at: string;
        };
        Insert: {
          accessibility_needs?: string | null;
          airport_transfer?: Database["public"]["Enums"]["transfer_preference"];
          booking_id: string;
          dietary_requirements?: string | null;
          optional_experience_ids?: string[];
          room_preference?: Database["public"]["Enums"]["room_preference"];
          updated_at?: string;
        };
        Update: {
          accessibility_needs?: string | null;
          airport_transfer?: Database["public"]["Enums"]["transfer_preference"];
          booking_id?: string;
          dietary_requirements?: string | null;
          optional_experience_ids?: string[];
          room_preference?: Database["public"]["Enums"]["room_preference"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_preferences_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_preferences_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_travelers: {
        Row: {
          booking_id: string;
          created_at: string;
          departure_group_id: string | null;
          is_lead: boolean;
          room_index: number;
          traveler_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          departure_group_id?: string | null;
          is_lead?: boolean;
          room_index?: number;
          traveler_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          departure_group_id?: string | null;
          is_lead?: boolean;
          room_index?: number;
          traveler_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_travelers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_travelers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_travelers_departure_group_id_fkey";
            columns: ["departure_group_id"];
            isOneToOne: false;
            referencedRelation: "departure_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_travelers_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "traveler_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          amount_paid: number;
          amount_refunded: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          confirmation_number: string;
          coupon_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          departure_id: string;
          deposit_amount: number;
          discount_amount: number;
          group_code_id: string | null;
          hold_expires_at: string | null;
          id: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          refund_percentage: number | null;
          status: Database["public"]["Enums"]["booking_status"];
          stay_option_id: string | null;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          subtotal_amount: number;
          terms_accepted_at: string | null;
          terms_version: string | null;
          total_amount: number;
          tour_version_id: string;
          updated_at: string;
        };
        Insert: {
          amount_paid?: number;
          amount_refunded?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          confirmation_number: string;
          coupon_id?: string | null;
          created_at?: string;
          currency: string;
          customer_id: string;
          departure_id: string;
          deposit_amount?: number;
          discount_amount?: number;
          group_code_id?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          refund_percentage?: number | null;
          status?: Database["public"]["Enums"]["booking_status"];
          stay_option_id?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          subtotal_amount?: number;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          total_amount?: number;
          tour_version_id: string;
          updated_at?: string;
        };
        Update: {
          amount_paid?: number;
          amount_refunded?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          confirmation_number?: string;
          coupon_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          departure_id?: string;
          deposit_amount?: number;
          discount_amount?: number;
          group_code_id?: string | null;
          hold_expires_at?: string | null;
          id?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          refund_percentage?: number | null;
          status?: Database["public"]["Enums"]["booking_status"];
          stay_option_id?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          subtotal_amount?: number;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          total_amount?: number;
          tour_version_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_group_code_id_fkey";
            columns: ["group_code_id"];
            isOneToOne: false;
            referencedRelation: "group_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_stay_option_id_fkey";
            columns: ["stay_option_id"];
            isOneToOne: false;
            referencedRelation: "departure_stay_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_stay_option_id_fkey";
            columns: ["stay_option_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_availability";
            referencedColumns: ["stay_option_id"];
          },
          {
            foreignKeyName: "bookings_stay_option_id_fkey";
            columns: ["stay_option_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["stay_option_id"];
          },
          {
            foreignKeyName: "bookings_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      builder_drafts: {
        Row: {
          departure_id: string;
          draft: Json;
          step: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          departure_id: string;
          draft: Json;
          step?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          departure_id?: string;
          draft?: Json;
          step?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "builder_drafts_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "builder_drafts_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      cancellation_requests: {
        Row: {
          booking_id: string;
          customer_id: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          reason: string;
          refund_percentage_quoted: number;
          requested_at: string;
          staff_notes: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          customer_id: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          reason: string;
          refund_percentage_quoted: number;
          requested_at?: string;
          staff_notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          customer_id?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          reason?: string;
          refund_percentage_quoted?: number;
          requested_at?: string;
          staff_notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellation_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_members: {
        Row: {
          is_muted: boolean;
          joined_at: string;
          last_read_at: string | null;
          member_role: string;
          removed_at: string | null;
          room_id: string;
          user_id: string;
        };
        Insert: {
          is_muted?: boolean;
          joined_at?: string;
          last_read_at?: string | null;
          member_role?: string;
          removed_at?: string | null;
          room_id: string;
          user_id: string;
        };
        Update: {
          is_muted?: boolean;
          joined_at?: string;
          last_read_at?: string | null;
          member_role?: string;
          removed_at?: string | null;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_members_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_rooms: {
        Row: {
          add_on_id: string | null;
          created_at: string;
          id: string;
          is_archived: boolean;
          name: string;
          trip_id: string;
          type: Database["public"]["Enums"]["chat_room_type"];
        };
        Insert: {
          add_on_id?: string | null;
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          name: string;
          trip_id: string;
          type: Database["public"]["Enums"]["chat_room_type"];
        };
        Update: {
          add_on_id?: string | null;
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          name?: string;
          trip_id?: string;
          type?: Database["public"]["Enums"]["chat_room_type"];
        };
        Relationships: [
          {
            foreignKeyName: "chat_rooms_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_on_availability";
            referencedColumns: ["add_on_id"];
          },
          {
            foreignKeyName: "chat_rooms_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "departure_add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_rooms_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      checkins: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          latitude: number;
          longitude: number;
          note: string | null;
          trip_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          note?: string | null;
          trip_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          note?: string | null;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkins_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      cms_blocks: {
        Row: {
          content: Json;
          id: string;
          page_id: string;
          position: number;
          type: string;
        };
        Insert: {
          content?: Json;
          id?: string;
          page_id: string;
          position?: number;
          type: string;
        };
        Update: {
          content?: Json;
          id?: string;
          page_id?: string;
          position?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cms_blocks_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "cms_pages";
            referencedColumns: ["id"];
          },
        ];
      };
      cms_pages: {
        Row: {
          author_name: string | null;
          body_markdown: string;
          created_at: string;
          excerpt: string | null;
          hero_image_url: string | null;
          id: string;
          is_published: boolean;
          kind: string;
          og_image_url: string | null;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          title: string;
          tour_id: string | null;
          updated_at: string;
        };
        Insert: {
          author_name?: string | null;
          body_markdown?: string;
          created_at?: string;
          excerpt?: string | null;
          hero_image_url?: string | null;
          id?: string;
          is_published?: boolean;
          kind?: string;
          og_image_url?: string | null;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          title: string;
          tour_id?: string | null;
          updated_at?: string;
        };
        Update: {
          author_name?: string | null;
          body_markdown?: string;
          created_at?: string;
          excerpt?: string | null;
          hero_image_url?: string | null;
          id?: string;
          is_published?: boolean;
          kind?: string;
          og_image_url?: string | null;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          title?: string;
          tour_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cms_pages_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      coupons: {
        Row: {
          amount_off: number | null;
          code: string;
          created_at: string;
          currency: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          max_redemptions: number | null;
          percent_off: number | null;
          redemptions: number;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          amount_off?: number | null;
          code: string;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          max_redemptions?: number | null;
          percent_off?: number | null;
          redemptions?: number;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          amount_off?: number | null;
          code?: string;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          max_redemptions?: number | null;
          percent_off?: number | null;
          redemptions?: number;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      departure_add_ons: {
        Row: {
          address: string | null;
          bookable_until_days_before: number;
          cancellable_until_days_before: number | null;
          capacity: number | null;
          created_at: string;
          currency: string;
          day_number: number | null;
          departure_id: string;
          description: string | null;
          end_time: string | null;
          excludes: string[];
          id: string;
          image_urls: string[];
          in_trip_only: boolean;
          includes: string[];
          is_active: boolean;
          is_featured: boolean;
          kind: Database["public"]["Enums"]["add_on_kind"];
          label: Database["public"]["Enums"]["option_label"] | null;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          meeting_point: string | null;
          min_age: number | null;
          operated_by: string | null;
          position: number;
          price_amount: number;
          pricing_basis: string;
          start_time: string | null;
          supplier_booking_url: string | null;
          supplier_service_id: string | null;
          supplier_terms_url: string | null;
          tier: Database["public"]["Enums"]["option_tier"] | null;
          tier_group: string | null;
          title: string;
          tour_itinerary_item_id: string | null;
          updated_at: string;
          why_price_note: string | null;
        };
        Insert: {
          address?: string | null;
          bookable_until_days_before?: number;
          cancellable_until_days_before?: number | null;
          capacity?: number | null;
          created_at?: string;
          currency: string;
          day_number?: number | null;
          departure_id: string;
          description?: string | null;
          end_time?: string | null;
          excludes?: string[];
          id?: string;
          image_urls?: string[];
          in_trip_only?: boolean;
          includes?: string[];
          is_active?: boolean;
          is_featured?: boolean;
          kind?: Database["public"]["Enums"]["add_on_kind"];
          label?: Database["public"]["Enums"]["option_label"] | null;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          meeting_point?: string | null;
          min_age?: number | null;
          operated_by?: string | null;
          position?: number;
          price_amount: number;
          pricing_basis?: string;
          start_time?: string | null;
          supplier_booking_url?: string | null;
          supplier_service_id?: string | null;
          supplier_terms_url?: string | null;
          tier?: Database["public"]["Enums"]["option_tier"] | null;
          tier_group?: string | null;
          title: string;
          tour_itinerary_item_id?: string | null;
          updated_at?: string;
          why_price_note?: string | null;
        };
        Update: {
          address?: string | null;
          bookable_until_days_before?: number;
          cancellable_until_days_before?: number | null;
          capacity?: number | null;
          created_at?: string;
          currency?: string;
          day_number?: number | null;
          departure_id?: string;
          description?: string | null;
          end_time?: string | null;
          excludes?: string[];
          id?: string;
          image_urls?: string[];
          in_trip_only?: boolean;
          includes?: string[];
          is_active?: boolean;
          is_featured?: boolean;
          kind?: Database["public"]["Enums"]["add_on_kind"];
          label?: Database["public"]["Enums"]["option_label"] | null;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          meeting_point?: string | null;
          min_age?: number | null;
          operated_by?: string | null;
          position?: number;
          price_amount?: number;
          pricing_basis?: string;
          start_time?: string | null;
          supplier_booking_url?: string | null;
          supplier_service_id?: string | null;
          supplier_terms_url?: string | null;
          tier?: Database["public"]["Enums"]["option_tier"] | null;
          tier_group?: string | null;
          title?: string;
          tour_itinerary_item_id?: string | null;
          updated_at?: string;
          why_price_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departure_add_ons_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_add_ons_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_add_ons_supplier_service_id_fkey";
            columns: ["supplier_service_id"];
            isOneToOne: false;
            referencedRelation: "supplier_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_add_ons_tour_itinerary_item_id_fkey";
            columns: ["tour_itinerary_item_id"];
            isOneToOne: false;
            referencedRelation: "tour_itinerary_items";
            referencedColumns: ["id"];
          },
        ];
      };
      departure_groups: {
        Row: {
          capacity: number | null;
          created_at: string;
          departure_id: string;
          id: string;
          name: string;
          position: number;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          departure_id: string;
          id?: string;
          name?: string;
          position?: number;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          departure_id?: string;
          id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "departure_groups_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_groups_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      departure_notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          departure_id: string;
          id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          departure_id: string;
          id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          departure_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departure_notes_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_notes_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      departure_stay_options: {
        Row: {
          area: string | null;
          capacity: number | null;
          created_at: string;
          departure_id: string;
          description: string | null;
          destination_id: string | null;
          details: Json;
          excludes: string[];
          hotel_id: string | null;
          hotel_name: string | null;
          hotel_room_id: string | null;
          id: string;
          image_urls: string[];
          includes: string[];
          is_active: boolean;
          is_default: boolean;
          label: Database["public"]["Enums"]["option_label"] | null;
          name: string;
          position: number;
          price_delta_amount: number;
          shared_room_discount_amount: number | null;
          star_rating: number | null;
          tagline: string | null;
          tier: Database["public"]["Enums"]["option_tier"] | null;
          updated_at: string;
          why_price_note: string | null;
        };
        Insert: {
          area?: string | null;
          capacity?: number | null;
          created_at?: string;
          departure_id: string;
          description?: string | null;
          destination_id?: string | null;
          details?: Json;
          excludes?: string[];
          hotel_id?: string | null;
          hotel_name?: string | null;
          hotel_room_id?: string | null;
          id?: string;
          image_urls?: string[];
          includes?: string[];
          is_active?: boolean;
          is_default?: boolean;
          label?: Database["public"]["Enums"]["option_label"] | null;
          name: string;
          position?: number;
          price_delta_amount?: number;
          shared_room_discount_amount?: number | null;
          star_rating?: number | null;
          tagline?: string | null;
          tier?: Database["public"]["Enums"]["option_tier"] | null;
          updated_at?: string;
          why_price_note?: string | null;
        };
        Update: {
          area?: string | null;
          capacity?: number | null;
          created_at?: string;
          departure_id?: string;
          description?: string | null;
          destination_id?: string | null;
          details?: Json;
          excludes?: string[];
          hotel_id?: string | null;
          hotel_name?: string | null;
          hotel_room_id?: string | null;
          id?: string;
          image_urls?: string[];
          includes?: string[];
          is_active?: boolean;
          is_default?: boolean;
          label?: Database["public"]["Enums"]["option_label"] | null;
          name?: string;
          position?: number;
          price_delta_amount?: number;
          shared_room_discount_amount?: number | null;
          star_rating?: number | null;
          tagline?: string | null;
          tier?: Database["public"]["Enums"]["option_tier"] | null;
          updated_at?: string;
          why_price_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departure_stay_options_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["hotel_id"];
          },
          {
            foreignKeyName: "departure_stay_options_hotel_room_id_fkey";
            columns: ["hotel_room_id"];
            isOneToOne: false;
            referencedRelation: "hotel_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      departure_tier_briefs: {
        Row: {
          brief: string;
          created_at: string;
          departure_id: string;
          tier: Database["public"]["Enums"]["option_tier"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          brief: string;
          created_at?: string;
          departure_id: string;
          tier: Database["public"]["Enums"]["option_tier"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          brief?: string;
          created_at?: string;
          departure_id?: string;
          tier?: Database["public"]["Enums"]["option_tier"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departure_tier_briefs_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_tier_briefs_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      departure_unlocks: {
        Row: {
          created_at: string;
          departure_id: string;
          granted_at: string | null;
          id: string;
          is_active: boolean;
          reward: string;
          threshold: number;
        };
        Insert: {
          created_at?: string;
          departure_id: string;
          granted_at?: string | null;
          id?: string;
          is_active?: boolean;
          reward: string;
          threshold: number;
        };
        Update: {
          created_at?: string;
          departure_id?: string;
          granted_at?: string | null;
          id?: string;
          is_active?: boolean;
          reward?: string;
          threshold?: number;
        };
        Relationships: [
          {
            foreignKeyName: "departure_unlocks_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_unlocks_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      departure_waitlist: {
        Row: {
          converted_booking_id: string | null;
          created_at: string;
          departure_id: string | null;
          email: string;
          id: string;
          name: string | null;
          note: string | null;
          notified_at: string | null;
          party_size: number;
          source: string;
          tour_id: string;
          user_id: string | null;
        };
        Insert: {
          converted_booking_id?: string | null;
          created_at?: string;
          departure_id?: string | null;
          email: string;
          id?: string;
          name?: string | null;
          note?: string | null;
          notified_at?: string | null;
          party_size?: number;
          source?: string;
          tour_id: string;
          user_id?: string | null;
        };
        Update: {
          converted_booking_id?: string | null;
          created_at?: string;
          departure_id?: string | null;
          email?: string;
          id?: string;
          name?: string | null;
          note?: string | null;
          notified_at?: string | null;
          party_size?: number;
          source?: string;
          tour_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departure_waitlist_converted_booking_id_fkey";
            columns: ["converted_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_waitlist_converted_booking_id_fkey";
            columns: ["converted_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_waitlist_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_waitlist_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_waitlist_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      departures: {
        Row: {
          balance_due_date: string | null;
          booking_deadline: string | null;
          cancellation_policy: Json;
          capacity: number;
          created_at: string;
          currency: string;
          deposit_amount: number;
          end_date: string;
          group_opens_days_before: number;
          id: string;
          minimum_travelers: number;
          opens_at: string | null;
          price_amount: number;
          shared_room_discount_amount: number;
          start_date: string;
          status: Database["public"]["Enums"]["departure_status"];
          timezone: string;
          tour_id: string;
          tour_version_id: string;
          updated_at: string;
        };
        Insert: {
          balance_due_date?: string | null;
          booking_deadline?: string | null;
          cancellation_policy?: Json;
          capacity: number;
          created_at?: string;
          currency: string;
          deposit_amount?: number;
          end_date: string;
          group_opens_days_before?: number;
          id?: string;
          minimum_travelers?: number;
          opens_at?: string | null;
          price_amount: number;
          shared_room_discount_amount?: number;
          start_date: string;
          status?: Database["public"]["Enums"]["departure_status"];
          timezone: string;
          tour_id: string;
          tour_version_id: string;
          updated_at?: string;
        };
        Update: {
          balance_due_date?: string | null;
          booking_deadline?: string | null;
          cancellation_policy?: Json;
          capacity?: number;
          created_at?: string;
          currency?: string;
          deposit_amount?: number;
          end_date?: string;
          group_opens_days_before?: number;
          id?: string;
          minimum_travelers?: number;
          opens_at?: string | null;
          price_amount?: number;
          shared_room_discount_amount?: number;
          start_date?: string;
          status?: Database["public"]["Enums"]["departure_status"];
          timezone?: string;
          tour_id?: string;
          tour_version_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departures_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departures_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      destination_alerts: {
        Row: {
          created_at: string;
          destination_id: string | null;
          email: string;
          id: string;
          name: string | null;
          note: string | null;
          notified_at: string | null;
          source: string;
          unsubscribed_at: string | null;
          user_id: string | null;
          wanted_place: string | null;
        };
        Insert: {
          created_at?: string;
          destination_id?: string | null;
          email: string;
          id?: string;
          name?: string | null;
          note?: string | null;
          notified_at?: string | null;
          source?: string;
          unsubscribed_at?: string | null;
          user_id?: string | null;
          wanted_place?: string | null;
        };
        Update: {
          created_at?: string;
          destination_id?: string | null;
          email?: string;
          id?: string;
          name?: string | null;
          note?: string | null;
          notified_at?: string | null;
          source?: string;
          unsubscribed_at?: string | null;
          user_id?: string | null;
          wanted_place?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "destination_alerts_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      destination_guides: {
        Row: {
          body_markdown: string;
          created_at: string;
          destination_id: string;
          id: string;
          is_published: boolean;
          position: number;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body_markdown?: string;
          created_at?: string;
          destination_id: string;
          id?: string;
          is_published?: boolean;
          position?: number;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body_markdown?: string;
          created_at?: string;
          destination_id?: string;
          id?: string;
          is_published?: boolean;
          position?: number;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "destination_guides_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      destinations: {
        Row: {
          country_code: string;
          country_name: string;
          created_at: string;
          description: string | null;
          emergency_numbers: Json;
          hero_image_url: string | null;
          id: string;
          is_published: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          region: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          summary: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          country_code: string;
          country_name: string;
          created_at?: string;
          description?: string | null;
          emergency_numbers?: Json;
          hero_image_url?: string | null;
          id?: string;
          is_published?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          region?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          summary?: string | null;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          country_code?: string;
          country_name?: string;
          created_at?: string;
          description?: string | null;
          emergency_numbers?: Json;
          hero_image_url?: string | null;
          id?: string;
          is_published?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          region?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          summary?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_events: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          payload: Json | null;
          provider: string;
          provider_message_id: string | null;
          recipient: string;
          status: string;
          template: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          payload?: Json | null;
          provider?: string;
          provider_message_id?: string | null;
          recipient: string;
          status?: string;
          template: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          payload?: Json | null;
          provider?: string;
          provider_message_id?: string | null;
          recipient?: string;
          status?: string;
          template?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      emergency_contacts: {
        Row: {
          email: string | null;
          id: string;
          is_primary: boolean;
          name: string;
          phone: string;
          relationship: string;
          traveler_id: string;
        };
        Insert: {
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name: string;
          phone: string;
          relationship: string;
          traveler_id: string;
        };
        Update: {
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name?: string;
          phone?: string;
          relationship?: string;
          traveler_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "traveler_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      experience_products: {
        Row: {
          address: string | null;
          currency: string | null;
          description: string | null;
          destination_id: string | null;
          duration_minutes: number | null;
          fetched_at: string;
          from_amount: number | null;
          id: string;
          image_url: string | null;
          latitude: number | null;
          longitude: number | null;
          product_url: string | null;
          rating: number | null;
          rating_count: number | null;
          raw: Json | null;
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_categories: string[];
          supplier_product_id: string;
          title: string;
        };
        Insert: {
          address?: string | null;
          currency?: string | null;
          description?: string | null;
          destination_id?: string | null;
          duration_minutes?: number | null;
          fetched_at?: string;
          from_amount?: number | null;
          id?: string;
          image_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          product_url?: string | null;
          rating?: number | null;
          rating_count?: number | null;
          raw?: Json | null;
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_categories?: string[];
          supplier_product_id: string;
          title: string;
        };
        Update: {
          address?: string | null;
          currency?: string | null;
          description?: string | null;
          destination_id?: string | null;
          duration_minutes?: number | null;
          fetched_at?: string;
          from_amount?: number | null;
          id?: string;
          image_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          product_url?: string | null;
          rating?: number | null;
          rating_count?: number | null;
          raw?: Json | null;
          supplier?: Database["public"]["Enums"]["experience_supplier"];
          supplier_categories?: string[];
          supplier_product_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "experience_products_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      experience_rates: {
        Row: {
          available: boolean;
          cancellation_policy: Json;
          capacity: number | null;
          currency: string;
          expires_at: string | null;
          fetched_at: string;
          id: string;
          net_amount: number;
          option_name: string;
          product_id: string;
          raw: Json | null;
          start_time: string | null;
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_option_id: string;
          total_amount: number;
          travel_date: string;
        };
        Insert: {
          available?: boolean;
          cancellation_policy?: Json;
          capacity?: number | null;
          currency: string;
          expires_at?: string | null;
          fetched_at?: string;
          id?: string;
          net_amount: number;
          option_name: string;
          product_id: string;
          raw?: Json | null;
          start_time?: string | null;
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_option_id: string;
          total_amount: number;
          travel_date: string;
        };
        Update: {
          available?: boolean;
          cancellation_policy?: Json;
          capacity?: number | null;
          currency?: string;
          expires_at?: string | null;
          fetched_at?: string;
          id?: string;
          net_amount?: number;
          option_name?: string;
          product_id?: string;
          raw?: Json | null;
          start_time?: string | null;
          supplier?: Database["public"]["Enums"]["experience_supplier"];
          supplier_option_id?: string;
          total_amount?: number;
          travel_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "experience_rates_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "experience_products";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          description: string | null;
          enabled: boolean;
          key: string;
          rollout: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          description?: string | null;
          enabled?: boolean;
          key: string;
          rollout?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          description?: string | null;
          enabled?: boolean;
          key?: string;
          rollout?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      group_codes: {
        Row: {
          code: string;
          created_at: string;
          departure_id: string;
          expires_at: string | null;
          id: string;
          label: string | null;
          max_uses: number;
          owner_booking_id: string | null;
          owner_user_id: string;
          uses: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          departure_id: string;
          expires_at?: string | null;
          id?: string;
          label?: string | null;
          max_uses?: number;
          owner_booking_id?: string | null;
          owner_user_id: string;
          uses?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          departure_id?: string;
          expires_at?: string | null;
          id?: string;
          label?: string | null;
          max_uses?: number;
          owner_booking_id?: string | null;
          owner_user_id?: string;
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: "group_codes_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_codes_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_codes_owner_booking_id_fkey";
            columns: ["owner_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_codes_owner_booking_id_fkey";
            columns: ["owner_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      host_applications: {
        Row: {
          city: string | null;
          community_description: string;
          community_size: number | null;
          created_at: string;
          email: string;
          id: string;
          links: string | null;
          name: string;
          preferred_month: string | null;
          preferred_tour_id: string | null;
          staff_notes: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          city?: string | null;
          community_description: string;
          community_size?: number | null;
          created_at?: string;
          email: string;
          id?: string;
          links?: string | null;
          name: string;
          preferred_month?: string | null;
          preferred_tour_id?: string | null;
          staff_notes?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          city?: string | null;
          community_description?: string;
          community_size?: number | null;
          created_at?: string;
          email?: string;
          id?: string;
          links?: string | null;
          name?: string;
          preferred_month?: string | null;
          preferred_tour_id?: string | null;
          staff_notes?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "host_applications_preferred_tour_id_fkey";
            columns: ["preferred_tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      hotel_bookings: {
        Row: {
          booking_id: string;
          cancellation_deadline: string | null;
          confirmation_number: string | null;
          created_at: string;
          hotel_id: string;
          id: string;
          rate_snapshot: Json;
          status: Database["public"]["Enums"]["hotel_booking_status"];
          stay_option_id: string | null;
          supplier: Database["public"]["Enums"]["hotel_supplier"];
          supplier_booking_id: string | null;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          cancellation_deadline?: string | null;
          confirmation_number?: string | null;
          created_at?: string;
          hotel_id: string;
          id?: string;
          rate_snapshot: Json;
          status?: Database["public"]["Enums"]["hotel_booking_status"];
          stay_option_id?: string | null;
          supplier: Database["public"]["Enums"]["hotel_supplier"];
          supplier_booking_id?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          cancellation_deadline?: string | null;
          confirmation_number?: string | null;
          created_at?: string;
          hotel_id?: string;
          id?: string;
          rate_snapshot?: Json;
          status?: Database["public"]["Enums"]["hotel_booking_status"];
          stay_option_id?: string | null;
          supplier?: Database["public"]["Enums"]["hotel_supplier"];
          supplier_booking_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hotel_bookings_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_bookings_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_bookings_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_bookings_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_bookings_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["hotel_id"];
          },
          {
            foreignKeyName: "hotel_bookings_stay_option_id_fkey";
            columns: ["stay_option_id"];
            isOneToOne: false;
            referencedRelation: "departure_stay_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_bookings_stay_option_id_fkey";
            columns: ["stay_option_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_availability";
            referencedColumns: ["stay_option_id"];
          },
          {
            foreignKeyName: "hotel_bookings_stay_option_id_fkey";
            columns: ["stay_option_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["stay_option_id"];
          },
        ];
      };
      hotel_rates: {
        Row: {
          available: boolean;
          bed_type: string | null;
          breakfast_included: boolean;
          cancellation_policy: Json;
          check_in: string;
          check_out: string;
          currency: string;
          expires_at: string | null;
          fees_amount: number;
          fetched_at: string;
          hotel_id: string;
          hotel_room_id: string | null;
          id: string;
          net_amount: number;
          occupancy_adults: number;
          occupancy_children: number;
          payment_type: Database["public"]["Enums"]["hotel_payment_type"];
          raw: Json | null;
          refundable: boolean;
          room_name: string;
          supplier: Database["public"]["Enums"]["hotel_supplier"];
          supplier_commission_amount: number | null;
          supplier_rate_id: string;
          taxes_amount: number;
          total_amount: number;
        };
        Insert: {
          available?: boolean;
          bed_type?: string | null;
          breakfast_included?: boolean;
          cancellation_policy?: Json;
          check_in: string;
          check_out: string;
          currency: string;
          expires_at?: string | null;
          fees_amount?: number;
          fetched_at?: string;
          hotel_id: string;
          hotel_room_id?: string | null;
          id?: string;
          net_amount: number;
          occupancy_adults: number;
          occupancy_children?: number;
          payment_type: Database["public"]["Enums"]["hotel_payment_type"];
          raw?: Json | null;
          refundable: boolean;
          room_name: string;
          supplier: Database["public"]["Enums"]["hotel_supplier"];
          supplier_commission_amount?: number | null;
          supplier_rate_id: string;
          taxes_amount?: number;
          total_amount: number;
        };
        Update: {
          available?: boolean;
          bed_type?: string | null;
          breakfast_included?: boolean;
          cancellation_policy?: Json;
          check_in?: string;
          check_out?: string;
          currency?: string;
          expires_at?: string | null;
          fees_amount?: number;
          fetched_at?: string;
          hotel_id?: string;
          hotel_room_id?: string | null;
          id?: string;
          net_amount?: number;
          occupancy_adults?: number;
          occupancy_children?: number;
          payment_type?: Database["public"]["Enums"]["hotel_payment_type"];
          raw?: Json | null;
          refundable?: boolean;
          room_name?: string;
          supplier?: Database["public"]["Enums"]["hotel_supplier"];
          supplier_commission_amount?: number | null;
          supplier_rate_id?: string;
          taxes_amount?: number;
          total_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "hotel_rates_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_rates_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_rates_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["hotel_id"];
          },
          {
            foreignKeyName: "hotel_rates_hotel_room_id_fkey";
            columns: ["hotel_room_id"];
            isOneToOne: false;
            referencedRelation: "hotel_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      hotel_rooms: {
        Row: {
          bed_type: string | null;
          created_at: string;
          description: string | null;
          hotel_id: string;
          id: string;
          image_urls: string[];
          max_occupancy: number;
          name: string;
          position: number;
          updated_at: string;
        };
        Insert: {
          bed_type?: string | null;
          created_at?: string;
          description?: string | null;
          hotel_id: string;
          id?: string;
          image_urls?: string[];
          max_occupancy?: number;
          name: string;
          position?: number;
          updated_at?: string;
        };
        Update: {
          bed_type?: string | null;
          created_at?: string;
          description?: string | null;
          hotel_id?: string;
          id?: string;
          image_urls?: string[];
          max_occupancy?: number;
          name?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["hotel_id"];
          },
        ];
      };
      hotel_supplier_mappings: {
        Row: {
          created_at: string;
          hotel_id: string;
          hotel_room_id: string | null;
          id: string;
          supplier: Database["public"]["Enums"]["hotel_supplier"];
          supplier_hotel_id: string;
          supplier_room_id: string | null;
        };
        Insert: {
          created_at?: string;
          hotel_id: string;
          hotel_room_id?: string | null;
          id?: string;
          supplier: Database["public"]["Enums"]["hotel_supplier"];
          supplier_hotel_id: string;
          supplier_room_id?: string | null;
        };
        Update: {
          created_at?: string;
          hotel_id?: string;
          hotel_room_id?: string | null;
          id?: string;
          supplier?: Database["public"]["Enums"]["hotel_supplier"];
          supplier_hotel_id?: string;
          supplier_room_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hotel_supplier_mappings_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_supplier_mappings_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hotel_supplier_mappings_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["hotel_id"];
          },
          {
            foreignKeyName: "hotel_supplier_mappings_hotel_room_id_fkey";
            columns: ["hotel_room_id"];
            isOneToOne: false;
            referencedRelation: "hotel_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      hotels: {
        Row: {
          address: string | null;
          amenities: string[];
          city: string;
          country_code: string;
          created_at: string;
          description: string | null;
          destination_id: string;
          id: string;
          image_urls: string[];
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          slug: string;
          star_rating: number | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          amenities?: string[];
          city: string;
          country_code: string;
          created_at?: string;
          description?: string | null;
          destination_id: string;
          id?: string;
          image_urls?: string[];
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          slug: string;
          star_rating?: number | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          amenities?: string[];
          city?: string;
          country_code?: string;
          created_at?: string;
          description?: string | null;
          destination_id?: string;
          id?: string;
          image_urls?: string[];
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          slug?: string;
          star_rating?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hotels_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      item_rsvps: {
        Row: {
          created_at: string;
          item_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          item_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          item_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_rsvps_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "trip_itinerary_items";
            referencedColumns: ["id"];
          },
        ];
      };
      live_moment_participants: {
        Row: {
          joined_at: string;
          moment_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          moment_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          moment_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_moment_participants_moment_id_fkey";
            columns: ["moment_id"];
            isOneToOne: false;
            referencedRelation: "live_moments";
            referencedColumns: ["id"];
          },
        ];
      };
      live_moments: {
        Row: {
          address: string | null;
          capacity: number | null;
          created_at: string;
          created_by: string;
          description: string | null;
          end_at: string | null;
          id: string;
          is_official: boolean;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          start_at: string;
          status: Database["public"]["Enums"]["live_moment_status"];
          timezone: string;
          title: string;
          trip_id: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["content_visibility"];
        };
        Insert: {
          address?: string | null;
          capacity?: number | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          end_at?: string | null;
          id?: string;
          is_official?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          start_at: string;
          status?: Database["public"]["Enums"]["live_moment_status"];
          timezone: string;
          title: string;
          trip_id: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Update: {
          address?: string | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          end_at?: string | null;
          id?: string;
          is_official?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          start_at?: string;
          status?: Database["public"]["Enums"]["live_moment_status"];
          timezone?: string;
          title?: string;
          trip_id?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "live_moments_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      meetup_rsvps: {
        Row: {
          created_at: string;
          meetup_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          meetup_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          meetup_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetup_rsvps_meetup_id_fkey";
            columns: ["meetup_id"];
            isOneToOne: false;
            referencedRelation: "meetups";
            referencedColumns: ["id"];
          },
        ];
      };
      meetups: {
        Row: {
          address: string | null;
          capacity: number | null;
          city: string;
          country_code: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          id: string;
          is_published: boolean;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at: string;
          venue_name: string | null;
        };
        Insert: {
          address?: string | null;
          capacity?: number | null;
          city: string;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_published?: boolean;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at?: string;
          venue_name?: string | null;
        };
        Update: {
          address?: string | null;
          capacity?: number | null;
          city?: string;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_published?: boolean;
          starts_at?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
          venue_name?: string | null;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachments: Json;
          body: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          edited_at: string | null;
          id: string;
          is_system: boolean;
          reply_to_id: string | null;
          room_id: string;
          sender_id: string | null;
        };
        Insert: {
          attachments?: Json;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          edited_at?: string | null;
          id?: string;
          is_system?: boolean;
          reply_to_id?: string | null;
          room_id: string;
          sender_id?: string | null;
        };
        Update: {
          attachments?: Json;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          edited_at?: string | null;
          id?: string;
          is_system?: boolean;
          reply_to_id?: string | null;
          room_id?: string;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          consent_at: string;
          created_at: string;
          email: string;
          id: string;
          resend_contact_id: string | null;
          source: string;
          status: string;
          unsubscribe_token: string;
          unsubscribed_at: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          consent_at?: string;
          created_at?: string;
          email: string;
          id?: string;
          resend_contact_id?: string | null;
          source?: string;
          status?: string;
          unsubscribe_token?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          consent_at?: string;
          created_at?: string;
          email?: string;
          id?: string;
          resend_contact_id?: string | null;
          source?: string;
          status?: string;
          unsubscribe_token?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          attempted_at: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          detail: string | null;
          id: string;
          notification_id: string;
          provider_id: string | null;
          status: string;
        };
        Insert: {
          attempted_at?: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          detail?: string | null;
          id?: string;
          notification_id: string;
          provider_id?: string | null;
          status: string;
        };
        Update: {
          attempted_at?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          detail?: string | null;
          id?: string;
          notification_id?: string;
          provider_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          marketing_email: boolean;
          marketing_push: boolean;
          operational_email: boolean;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          social_email: boolean;
          social_push: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          marketing_email?: boolean;
          marketing_push?: boolean;
          operational_email?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          social_email?: boolean;
          social_push?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          marketing_email?: boolean;
          marketing_push?: boolean;
          operational_email?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          social_email?: boolean;
          social_push?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          category: Database["public"]["Enums"]["notification_category"];
          created_at: string;
          dedupe_key: string | null;
          deep_link: Json | null;
          dispatched_at: string | null;
          id: string;
          read_at: string | null;
          title: string;
          trip_id: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          category: Database["public"]["Enums"]["notification_category"];
          created_at?: string;
          dedupe_key?: string | null;
          deep_link?: Json | null;
          dispatched_at?: string | null;
          id?: string;
          read_at?: string | null;
          title: string;
          trip_id?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          category?: Database["public"]["Enums"]["notification_category"];
          created_at?: string;
          dedupe_key?: string | null;
          deep_link?: Json | null;
          dispatched_at?: string | null;
          id?: string;
          read_at?: string | null;
          title?: string;
          trip_id?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          booking_id: string;
          created_at: string;
          currency: string;
          failure_code: string | null;
          failure_message: string | null;
          id: string;
          kind: string;
          paid_at: string | null;
          receipt_url: string | null;
          stripe_charge_id: string | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          booking_id: string;
          created_at?: string;
          currency: string;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          kind: string;
          paid_at?: string | null;
          receipt_url?: string | null;
          stripe_charge_id?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          kind?: string;
          paid_at?: string | null;
          receipt_url?: string | null;
          stripe_charge_id?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_rules: {
        Row: {
          applies_to: string;
          created_at: string;
          destination_id: string | null;
          effective_from: string | null;
          effective_to: string | null;
          fixed_markup_amount: number;
          hotel_id: string | null;
          id: string;
          is_active: boolean;
          min_markup_amount: number;
          percentage_markup: number;
          priority: number;
        };
        Insert: {
          applies_to?: string;
          created_at?: string;
          destination_id?: string | null;
          effective_from?: string | null;
          effective_to?: string | null;
          fixed_markup_amount?: number;
          hotel_id?: string | null;
          id?: string;
          is_active?: boolean;
          min_markup_amount?: number;
          percentage_markup?: number;
          priority?: number;
        };
        Update: {
          applies_to?: string;
          created_at?: string;
          destination_id?: string | null;
          effective_from?: string | null;
          effective_to?: string | null;
          fixed_markup_amount?: number;
          hotel_id?: string | null;
          id?: string;
          is_active?: boolean;
          min_markup_amount?: number;
          percentage_markup?: number;
          priority?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_rules_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_rules_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_rules_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_rules_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "stay_option_hotels_public";
            referencedColumns: ["hotel_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          excited_about: string | null;
          home_country: string | null;
          id: string;
          interests: string[];
          languages: string[];
          marketing_opt_in: boolean;
          onboarded_at: string | null;
          party_type: string | null;
          preferred_language: string;
          show_bio: boolean;
          show_home_country: boolean;
          show_interests: boolean;
          show_traveling_from: boolean;
          travel_style: string | null;
          traveling_from: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          excited_about?: string | null;
          home_country?: string | null;
          id: string;
          interests?: string[];
          languages?: string[];
          marketing_opt_in?: boolean;
          onboarded_at?: string | null;
          party_type?: string | null;
          preferred_language?: string;
          show_bio?: boolean;
          show_home_country?: boolean;
          show_interests?: boolean;
          show_traveling_from?: boolean;
          travel_style?: string | null;
          traveling_from?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          excited_about?: string | null;
          home_country?: string | null;
          id?: string;
          interests?: string[];
          languages?: string[];
          marketing_opt_in?: boolean;
          onboarded_at?: string | null;
          party_type?: string | null;
          preferred_language?: string;
          show_bio?: boolean;
          show_home_country?: boolean;
          show_interests?: boolean;
          show_traveling_from?: boolean;
          travel_style?: string | null;
          traveling_from?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          app_version: string | null;
          created_at: string;
          device_name: string | null;
          disabled_at: string | null;
          id: string;
          last_seen_at: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          device_name?: string | null;
          disabled_at?: string | null;
          id?: string;
          last_seen_at?: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          device_name?: string | null;
          disabled_at?: string | null;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          address: string | null;
          categories: Database["public"]["Enums"]["recommendation_category"][];
          created_at: string;
          day_number: number | null;
          description: string | null;
          destination_id: string;
          id: string;
          image_url: string | null;
          is_published: boolean;
          latitude: number | null;
          longitude: number | null;
          maps_url: string | null;
          neighborhood: string | null;
          position: number;
          price_level: number | null;
          time_of_day: string[];
          title: string;
          tour_version_id: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          categories?: Database["public"]["Enums"]["recommendation_category"][];
          created_at?: string;
          day_number?: number | null;
          description?: string | null;
          destination_id: string;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          maps_url?: string | null;
          neighborhood?: string | null;
          position?: number;
          price_level?: number | null;
          time_of_day?: string[];
          title: string;
          tour_version_id?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          categories?: Database["public"]["Enums"]["recommendation_category"][];
          created_at?: string;
          day_number?: number | null;
          description?: string | null;
          destination_id?: string;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          maps_url?: string | null;
          neighborhood?: string | null;
          position?: number;
          price_level?: number | null;
          time_of_day?: string[];
          title?: string;
          tour_version_id?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendations_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_codes: {
        Row: {
          code: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          booking_id: string;
          code: string;
          created_at: string;
          currency: string;
          earned_at: string | null;
          id: string;
          referred_user_id: string;
          referrer_id: string;
          reward_amount: number;
          status: string;
        };
        Insert: {
          booking_id: string;
          code: string;
          created_at?: string;
          currency: string;
          earned_at?: string | null;
          id?: string;
          referred_user_id: string;
          referrer_id: string;
          reward_amount: number;
          status?: string;
        };
        Update: {
          booking_id?: string;
          code?: string;
          created_at?: string;
          currency?: string;
          earned_at?: string | null;
          id?: string;
          referred_user_id?: string;
          referrer_id?: string;
          reward_amount?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          booking_id: string;
          created_at: string;
          currency: string;
          id: string;
          payment_id: string | null;
          reason: string | null;
          requested_by: string | null;
          stripe_refund_id: string | null;
          stripe_status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          booking_id: string;
          created_at?: string;
          currency: string;
          id?: string;
          payment_id?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          stripe_refund_id?: string | null;
          stripe_status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          payment_id?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          stripe_refund_id?: string | null;
          stripe_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          message_id: string | null;
          reason: string;
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          target_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message_id?: string | null;
          reason: string;
          reporter_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          target_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          message_id?: string | null;
          reason?: string;
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          author_name: string;
          body: string;
          booking_id: string;
          created_at: string;
          id: string;
          published_at: string | null;
          rating: number;
          staff_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          title: string | null;
          tour_id: string;
          trip_end_date: string | null;
          trip_id: string;
          updated_at: string;
          user_id: string;
          would_repeat: boolean | null;
        };
        Insert: {
          author_name?: string;
          body: string;
          booking_id: string;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          rating: number;
          staff_note?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          title?: string | null;
          tour_id: string;
          trip_end_date?: string | null;
          trip_id: string;
          updated_at?: string;
          user_id: string;
          would_repeat?: boolean | null;
        };
        Update: {
          author_name?: string;
          body?: string;
          booking_id?: string;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          rating?: number;
          staff_note?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          title?: string | null;
          tour_id?: string;
          trip_end_date?: string | null;
          trip_id?: string;
          updated_at?: string;
          user_id?: string;
          would_repeat?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          description: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          description: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          description?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      saved_tours: {
        Row: {
          created_at: string;
          note: string | null;
          tour_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          note?: string | null;
          tour_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          note?: string | null;
          tour_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_tours_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      social_accounts: {
        Row: {
          access_token: string;
          created_at: string;
          external_id: string;
          id: string;
          is_active: boolean;
          metadata: Json;
          platform: Database["public"]["Enums"]["social_platform"];
          token_expires_at: string | null;
          token_refreshed_at: string | null;
          updated_at: string;
          username: string;
        };
        Insert: {
          access_token: string;
          created_at?: string;
          external_id: string;
          id?: string;
          is_active?: boolean;
          metadata?: Json;
          platform: Database["public"]["Enums"]["social_platform"];
          token_expires_at?: string | null;
          token_refreshed_at?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          access_token?: string;
          created_at?: string;
          external_id?: string;
          id?: string;
          is_active?: boolean;
          metadata?: Json;
          platform?: Database["public"]["Enums"]["social_platform"];
          token_expires_at?: string | null;
          token_refreshed_at?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      social_posts: {
        Row: {
          account_id: string | null;
          alt_texts: string[];
          attempts: number;
          caption: string;
          created_at: string;
          created_by: string | null;
          destination_id: string | null;
          external_container_id: string | null;
          external_media_id: string | null;
          hashtags: string[];
          id: string;
          kind: Database["public"]["Enums"]["social_media_kind"];
          last_error: string | null;
          link_url: string | null;
          media_paths: string[];
          permalink: string | null;
          platform: Database["public"]["Enums"]["social_platform"];
          published_at: string | null;
          scheduled_at: string | null;
          source_files: string[];
          status: Database["public"]["Enums"]["social_post_status"];
          title: string | null;
          tour_id: string | null;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          alt_texts?: string[];
          attempts?: number;
          caption?: string;
          created_at?: string;
          created_by?: string | null;
          destination_id?: string | null;
          external_container_id?: string | null;
          external_media_id?: string | null;
          hashtags?: string[];
          id?: string;
          kind?: Database["public"]["Enums"]["social_media_kind"];
          last_error?: string | null;
          link_url?: string | null;
          media_paths?: string[];
          permalink?: string | null;
          platform?: Database["public"]["Enums"]["social_platform"];
          published_at?: string | null;
          scheduled_at?: string | null;
          source_files?: string[];
          status?: Database["public"]["Enums"]["social_post_status"];
          title?: string | null;
          tour_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          alt_texts?: string[];
          attempts?: number;
          caption?: string;
          created_at?: string;
          created_by?: string | null;
          destination_id?: string | null;
          external_container_id?: string | null;
          external_media_id?: string | null;
          hashtags?: string[];
          id?: string;
          kind?: Database["public"]["Enums"]["social_media_kind"];
          last_error?: string | null;
          link_url?: string | null;
          media_paths?: string[];
          permalink?: string | null;
          platform?: Database["public"]["Enums"]["social_platform"];
          published_at?: string | null;
          scheduled_at?: string | null;
          source_files?: string[];
          status?: Database["public"]["Enums"]["social_post_status"];
          title?: string | null;
          tour_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_posts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_posts_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_posts_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_contacts: {
        Row: {
          email: string | null;
          id: string;
          is_primary: boolean;
          name: string;
          phone: string | null;
          role: string | null;
          supplier_id: string;
        };
        Insert: {
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name: string;
          phone?: string | null;
          role?: string | null;
          supplier_id: string;
        };
        Update: {
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name?: string;
          phone?: string | null;
          role?: string | null;
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_services: {
        Row: {
          cancellation_deadline: string | null;
          confirmation_number: string | null;
          cost_amount: number | null;
          cost_currency: string | null;
          created_at: string;
          departure_id: string | null;
          id: string;
          internal_notes: string | null;
          reservation_date: string | null;
          service_end_at: string | null;
          service_start_at: string | null;
          status: Database["public"]["Enums"]["supplier_service_status"];
          supplier_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          cancellation_deadline?: string | null;
          confirmation_number?: string | null;
          cost_amount?: number | null;
          cost_currency?: string | null;
          created_at?: string;
          departure_id?: string | null;
          id?: string;
          internal_notes?: string | null;
          reservation_date?: string | null;
          service_end_at?: string | null;
          service_start_at?: string | null;
          status?: Database["public"]["Enums"]["supplier_service_status"];
          supplier_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          cancellation_deadline?: string | null;
          confirmation_number?: string | null;
          cost_amount?: number | null;
          cost_currency?: string | null;
          created_at?: string;
          departure_id?: string | null;
          id?: string;
          internal_notes?: string | null;
          reservation_date?: string | null;
          service_end_at?: string | null;
          service_start_at?: string | null;
          status?: Database["public"]["Enums"]["supplier_service_status"];
          supplier_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_services_departure_fk";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_services_departure_fk";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_services_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          country_code: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          notes: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      support_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          id: string;
          staff_id: string;
          thread_id: string;
          unassigned_at: string | null;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          id?: string;
          staff_id: string;
          thread_id: string;
          unassigned_at?: string | null;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          id?: string;
          staff_id?: string;
          thread_id?: string;
          unassigned_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_assignments_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "support_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      support_attachments: {
        Row: {
          bucket: string;
          created_at: string;
          id: string;
          message_id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          bucket?: string;
          created_at?: string;
          id?: string;
          message_id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          id?: string;
          message_id?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "support_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      support_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_from_staff: boolean;
          is_internal_note: boolean;
          sender_id: string | null;
          thread_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          is_from_staff?: boolean;
          is_internal_note?: boolean;
          sender_id?: string | null;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_from_staff?: boolean;
          is_internal_note?: boolean;
          sender_id?: string | null;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "support_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      support_threads: {
        Row: {
          assigned_to: string | null;
          booking_id: string | null;
          category: Database["public"]["Enums"]["support_category"];
          context: Json;
          created_at: string;
          customer_id: string;
          first_response_at: string | null;
          id: string;
          last_message_at: string;
          priority: string;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["support_thread_status"];
          subject: string;
          trip_id: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          booking_id?: string | null;
          category?: Database["public"]["Enums"]["support_category"];
          context?: Json;
          created_at?: string;
          customer_id: string;
          first_response_at?: string | null;
          id?: string;
          last_message_at?: string;
          priority?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["support_thread_status"];
          subject: string;
          trip_id?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          booking_id?: string | null;
          category?: Database["public"]["Enums"]["support_category"];
          context?: Json;
          created_at?: string;
          customer_id?: string;
          first_response_at?: string | null;
          id?: string;
          last_message_at?: string;
          priority?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["support_thread_status"];
          subject?: string;
          trip_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_threads_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_threads_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_threads_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      testimonials: {
        Row: {
          author_name: string;
          consent_confirmed: boolean;
          created_at: string;
          created_by: string | null;
          happened_in: number | null;
          id: string;
          image_url: string | null;
          position: number;
          published_at: string | null;
          quote: string;
          source_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          tour_id: string | null;
          trip_label: string;
          updated_at: string;
        };
        Insert: {
          author_name: string;
          consent_confirmed?: boolean;
          created_at?: string;
          created_by?: string | null;
          happened_in?: number | null;
          id?: string;
          image_url?: string | null;
          position?: number;
          published_at?: string | null;
          quote: string;
          source_note?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          tour_id?: string | null;
          trip_label: string;
          updated_at?: string;
        };
        Update: {
          author_name?: string;
          consent_confirmed?: boolean;
          created_at?: string;
          created_by?: string | null;
          happened_in?: number | null;
          id?: string;
          image_url?: string | null;
          position?: number;
          published_at?: string | null;
          quote?: string;
          source_note?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          tour_id?: string | null;
          trip_label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "testimonials_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_days: {
        Row: {
          day_number: number;
          destination_id: string | null;
          id: string;
          summary: string | null;
          title: string;
          tour_version_id: string;
        };
        Insert: {
          day_number: number;
          destination_id?: string | null;
          id?: string;
          summary?: string | null;
          title: string;
          tour_version_id: string;
        };
        Update: {
          day_number?: number;
          destination_id?: string | null;
          id?: string;
          summary?: string | null;
          title?: string;
          tour_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_days_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tour_days_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_excluded_items: {
        Row: {
          description: string | null;
          id: string;
          position: number;
          title: string;
          tour_version_id: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          position?: number;
          title: string;
          tour_version_id: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          position?: number;
          title?: string;
          tour_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_excluded_items_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_faqs: {
        Row: {
          answer: string;
          id: string;
          position: number;
          question: string;
          tour_version_id: string;
        };
        Insert: {
          answer: string;
          id?: string;
          position?: number;
          question: string;
          tour_version_id: string;
        };
        Update: {
          answer?: string;
          id?: string;
          position?: number;
          question?: string;
          tour_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_faqs_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_included_items: {
        Row: {
          description: string | null;
          id: string;
          position: number;
          title: string;
          tour_version_id: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          position?: number;
          title: string;
          tour_version_id: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          position?: number;
          title?: string;
          tour_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_included_items_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_itinerary_items: {
        Row: {
          address: string | null;
          description: string | null;
          end_time: string | null;
          id: string;
          instructions: string | null;
          is_anchor: boolean;
          is_optional: boolean;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          position: number;
          responsibility: Database["public"]["Enums"]["responsibility"];
          start_time: string | null;
          timezone: string;
          title: string;
          tour_day_id: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
          visibility: Database["public"]["Enums"]["content_visibility"];
        };
        Insert: {
          address?: string | null;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          instructions?: string | null;
          is_anchor?: boolean;
          is_optional?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          position?: number;
          responsibility?: Database["public"]["Enums"]["responsibility"];
          start_time?: string | null;
          timezone: string;
          title: string;
          tour_day_id: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Update: {
          address?: string | null;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          instructions?: string | null;
          is_anchor?: boolean;
          is_optional?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          position?: number;
          responsibility?: Database["public"]["Enums"]["responsibility"];
          start_time?: string | null;
          timezone?: string;
          title?: string;
          tour_day_id?: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "tour_itinerary_items_tour_day_id_fkey";
            columns: ["tour_day_id"];
            isOneToOne: false;
            referencedRelation: "tour_days";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_version_destinations: {
        Row: {
          destination_id: string;
          nights: number;
          position: number;
          tour_version_id: string;
        };
        Insert: {
          destination_id: string;
          nights?: number;
          position: number;
          tour_version_id: string;
        };
        Update: {
          destination_id?: string;
          nights?: number;
          position?: number;
          tour_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tour_version_destinations_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tour_version_destinations_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_versions: {
        Row: {
          character: Database["public"]["Enums"]["trip_character"][];
          created_at: string;
          created_by: string | null;
          description: string | null;
          gallery_image_urls: string[];
          hero_image_url: string | null;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          starting_price_amount: number | null;
          starting_price_currency: string | null;
          status: Database["public"]["Enums"]["tour_version_status"];
          summary: string | null;
          tagline: string | null;
          tour_id: string;
          updated_at: string;
          version_number: number;
          why_this_trip: string | null;
        };
        Insert: {
          character?: Database["public"]["Enums"]["trip_character"][];
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          gallery_image_urls?: string[];
          hero_image_url?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          starting_price_amount?: number | null;
          starting_price_currency?: string | null;
          status?: Database["public"]["Enums"]["tour_version_status"];
          summary?: string | null;
          tagline?: string | null;
          tour_id: string;
          updated_at?: string;
          version_number: number;
          why_this_trip?: string | null;
        };
        Update: {
          character?: Database["public"]["Enums"]["trip_character"][];
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          gallery_image_urls?: string[];
          hero_image_url?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          starting_price_amount?: number | null;
          starting_price_currency?: string | null;
          status?: Database["public"]["Enums"]["tour_version_status"];
          summary?: string | null;
          tagline?: string | null;
          tour_id?: string;
          updated_at?: string;
          version_number?: number;
          why_this_trip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tour_versions_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      tours: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"];
          created_at: string;
          current_version_id: string | null;
          duration_days: number;
          event_ends_on: string | null;
          event_location: string | null;
          event_name: string | null;
          event_starts_on: string | null;
          group_size_max: number;
          group_size_min: number;
          id: string;
          is_published: boolean;
          kind: string;
          name: string;
          slug: string;
          style: string;
          updated_at: string;
        };
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"];
          created_at?: string;
          current_version_id?: string | null;
          duration_days: number;
          event_ends_on?: string | null;
          event_location?: string | null;
          event_name?: string | null;
          event_starts_on?: string | null;
          group_size_max?: number;
          group_size_min?: number;
          id?: string;
          is_published?: boolean;
          kind?: string;
          name: string;
          slug: string;
          style?: string;
          updated_at?: string;
        };
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"];
          created_at?: string;
          current_version_id?: string | null;
          duration_days?: number;
          event_ends_on?: string | null;
          event_location?: string | null;
          event_name?: string | null;
          event_starts_on?: string | null;
          group_size_max?: number;
          group_size_min?: number;
          id?: string;
          is_published?: boolean;
          kind?: string;
          name?: string;
          slug?: string;
          style?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tours_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      transport_segments: {
        Row: {
          arrives_at: string;
          carrier: string | null;
          created_at: string;
          departs_at: string;
          departure_id: string;
          destination_address: string | null;
          destination_name: string;
          destination_timezone: string;
          id: string;
          meeting_instructions: string | null;
          origin_address: string | null;
          origin_name: string;
          origin_timezone: string;
          service_number: string | null;
          supplier_service_id: string | null;
          type: Database["public"]["Enums"]["transport_type"];
          updated_at: string;
        };
        Insert: {
          arrives_at: string;
          carrier?: string | null;
          created_at?: string;
          departs_at: string;
          departure_id: string;
          destination_address?: string | null;
          destination_name: string;
          destination_timezone: string;
          id?: string;
          meeting_instructions?: string | null;
          origin_address?: string | null;
          origin_name: string;
          origin_timezone: string;
          service_number?: string | null;
          supplier_service_id?: string | null;
          type: Database["public"]["Enums"]["transport_type"];
          updated_at?: string;
        };
        Update: {
          arrives_at?: string;
          carrier?: string | null;
          created_at?: string;
          departs_at?: string;
          departure_id?: string;
          destination_address?: string | null;
          destination_name?: string;
          destination_timezone?: string;
          id?: string;
          meeting_instructions?: string | null;
          origin_address?: string | null;
          origin_name?: string;
          origin_timezone?: string;
          service_number?: string | null;
          supplier_service_id?: string | null;
          type?: Database["public"]["Enums"]["transport_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transport_segments_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transport_segments_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transport_segments_supplier_service_id_fkey";
            columns: ["supplier_service_id"];
            isOneToOne: false;
            referencedRelation: "supplier_services";
            referencedColumns: ["id"];
          },
        ];
      };
      traveler_plans: {
        Row: {
          address: string | null;
          booking_id: string | null;
          created_at: string;
          end_time: string | null;
          id: string;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          maps_url: string | null;
          notes: string | null;
          place_ref: string | null;
          plan_date: string | null;
          recommendation_id: string | null;
          source: string;
          start_time: string | null;
          timezone: string;
          title: string;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          booking_id?: string | null;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          maps_url?: string | null;
          notes?: string | null;
          place_ref?: string | null;
          plan_date?: string | null;
          recommendation_id?: string | null;
          source?: string;
          start_time?: string | null;
          timezone: string;
          title: string;
          trip_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          booking_id?: string | null;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          maps_url?: string | null;
          notes?: string | null;
          place_ref?: string | null;
          plan_date?: string | null;
          recommendation_id?: string | null;
          source?: string;
          start_time?: string | null;
          timezone?: string;
          title?: string;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "traveler_plans_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "traveler_plans_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "traveler_plans_recommendation_id_fkey";
            columns: ["recommendation_id"];
            isOneToOne: false;
            referencedRelation: "recommendations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "traveler_plans_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      traveler_profiles: {
        Row: {
          accessibility_notes: string | null;
          created_at: string;
          date_of_birth: string | null;
          dietary_requirements: string | null;
          email: string | null;
          first_name: string;
          id: string;
          last_name: string;
          nationality: string | null;
          owner_user_id: string;
          phone: string | null;
          preferred_name: string | null;
          room_preference: Database["public"]["Enums"]["room_preference"];
          travel_preferences: Json;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          accessibility_notes?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          dietary_requirements?: string | null;
          email?: string | null;
          first_name: string;
          id?: string;
          last_name: string;
          nationality?: string | null;
          owner_user_id: string;
          phone?: string | null;
          preferred_name?: string | null;
          room_preference?: Database["public"]["Enums"]["room_preference"];
          travel_preferences?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          accessibility_notes?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          dietary_requirements?: string | null;
          email?: string | null;
          first_name?: string;
          id?: string;
          last_name?: string;
          nationality?: string | null;
          owner_user_id?: string;
          phone?: string | null;
          preferred_name?: string | null;
          room_preference?: Database["public"]["Enums"]["room_preference"];
          travel_preferences?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      traveler_signals: {
        Row: {
          categories: Database["public"]["Enums"]["recommendation_category"][];
          created_at: string;
          id: number;
          kind: string;
          ref_id: string | null;
          user_id: string;
        };
        Insert: {
          categories?: Database["public"]["Enums"]["recommendation_category"][];
          created_at?: string;
          id?: number;
          kind: string;
          ref_id?: string | null;
          user_id: string;
        };
        Update: {
          categories?: Database["public"]["Enums"]["recommendation_category"][];
          created_at?: string;
          id?: number;
          kind?: string;
          ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      trip_days: {
        Row: {
          date: string;
          day_number: number;
          destination_id: string | null;
          id: string;
          summary: string | null;
          timezone: string;
          title: string;
          trip_id: string;
        };
        Insert: {
          date: string;
          day_number: number;
          destination_id?: string | null;
          id?: string;
          summary?: string | null;
          timezone: string;
          title: string;
          trip_id: string;
        };
        Update: {
          date?: string;
          day_number?: number;
          destination_id?: string | null;
          id?: string;
          summary?: string | null;
          timezone?: string;
          title?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_days_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_documents: {
        Row: {
          bucket: string;
          created_at: string;
          for_user_id: string | null;
          id: string;
          kind: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          title: string;
          trip_id: string;
          uploaded_by: string | null;
          visibility: Database["public"]["Enums"]["content_visibility"];
        };
        Insert: {
          bucket?: string;
          created_at?: string;
          for_user_id?: string | null;
          id?: string;
          kind: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          title: string;
          trip_id: string;
          uploaded_by?: string | null;
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Update: {
          bucket?: string;
          created_at?: string;
          for_user_id?: string | null;
          id?: string;
          kind?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          title?: string;
          trip_id?: string;
          uploaded_by?: string | null;
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "trip_documents_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_itinerary_items: {
        Row: {
          accommodation_id: string | null;
          activity_id: string | null;
          address: string | null;
          change_note: string | null;
          changed_at: string | null;
          created_at: string;
          description: string | null;
          end_time: string | null;
          id: string;
          instructions: string | null;
          is_anchor: boolean;
          is_optional: boolean;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          position: number;
          replaced_by_item_id: string | null;
          responsibility: Database["public"]["Enums"]["responsibility"];
          source_item_id: string | null;
          start_time: string | null;
          status: Database["public"]["Enums"]["itinerary_item_status"];
          timezone: string;
          title: string;
          transport_segment_id: string | null;
          trip_day_id: string;
          trip_id: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["content_visibility"];
        };
        Insert: {
          accommodation_id?: string | null;
          activity_id?: string | null;
          address?: string | null;
          change_note?: string | null;
          changed_at?: string | null;
          created_at?: string;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          instructions?: string | null;
          is_anchor?: boolean;
          is_optional?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          position?: number;
          replaced_by_item_id?: string | null;
          responsibility?: Database["public"]["Enums"]["responsibility"];
          source_item_id?: string | null;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["itinerary_item_status"];
          timezone: string;
          title: string;
          transport_segment_id?: string | null;
          trip_day_id: string;
          trip_id: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Update: {
          accommodation_id?: string | null;
          activity_id?: string | null;
          address?: string | null;
          change_note?: string | null;
          changed_at?: string | null;
          created_at?: string;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          instructions?: string | null;
          is_anchor?: boolean;
          is_optional?: boolean;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          position?: number;
          replaced_by_item_id?: string | null;
          responsibility?: Database["public"]["Enums"]["responsibility"];
          source_item_id?: string | null;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["itinerary_item_status"];
          timezone?: string;
          title?: string;
          transport_segment_id?: string | null;
          trip_day_id?: string;
          trip_id?: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["content_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_items_accommodation_id_fkey";
            columns: ["accommodation_id"];
            isOneToOne: false;
            referencedRelation: "accommodations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_itinerary_items_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_itinerary_items_replaced_by_item_id_fkey";
            columns: ["replaced_by_item_id"];
            isOneToOne: false;
            referencedRelation: "trip_itinerary_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_itinerary_items_source_item_id_fkey";
            columns: ["source_item_id"];
            isOneToOne: false;
            referencedRelation: "tour_itinerary_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_itinerary_items_transport_segment_id_fkey";
            columns: ["transport_segment_id"];
            isOneToOne: false;
            referencedRelation: "transport_segments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_itinerary_items_trip_day_id_fkey";
            columns: ["trip_day_id"];
            isOneToOne: false;
            referencedRelation: "trip_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_itinerary_items_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_locations: {
        Row: {
          accuracy_meters: number | null;
          latitude: number;
          longitude: number;
          sharing_until: string;
          trip_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accuracy_meters?: number | null;
          latitude: number;
          longitude: number;
          sharing_until: string;
          trip_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accuracy_meters?: number | null;
          latitude?: number;
          longitude?: number;
          sharing_until?: string;
          trip_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_locations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_members: {
        Row: {
          booking_id: string | null;
          joined_at: string;
          member_role: string;
          removed_at: string | null;
          traveler_id: string | null;
          trip_id: string;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          joined_at?: string;
          member_role?: string;
          removed_at?: string | null;
          traveler_id?: string | null;
          trip_id: string;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          joined_at?: string;
          member_role?: string;
          removed_at?: string | null;
          traveler_id?: string | null;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_members_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_members_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_members_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "traveler_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_notes: {
        Row: {
          about_user_id: string | null;
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          trip_id: string;
        };
        Insert: {
          about_user_id?: string | null;
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          trip_id: string;
        };
        Update: {
          about_user_id?: string | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_notes_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_photos: {
        Row: {
          author_name: string;
          booking_id: string;
          caption: string | null;
          created_at: string;
          id: string;
          published_at: string | null;
          staff_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          storage_path: string;
          tour_id: string;
          trip_id: string;
          user_id: string;
        };
        Insert: {
          author_name?: string;
          booking_id: string;
          caption?: string | null;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          staff_note?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          storage_path: string;
          tour_id: string;
          trip_id: string;
          user_id: string;
        };
        Update: {
          author_name?: string;
          booking_id?: string;
          caption?: string | null;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          staff_note?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          storage_path?: string;
          tour_id?: string;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_photos_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_photos_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_photos_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_photos_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_surveys: {
        Row: {
          accommodation: number | null;
          answers: Json;
          best_bit: string | null;
          booking_id: string;
          created_at: string;
          expectations: string | null;
          freedom: number | null;
          group_feeling: number | null;
          id: string;
          kind: Database["public"]["Enums"]["survey_kind"];
          organisation: number | null;
          overall: number | null;
          submitted_at: string;
          tour_id: string | null;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
          value_for_money: number | null;
          worst_bit: string | null;
          would_repeat: boolean | null;
        };
        Insert: {
          accommodation?: number | null;
          answers?: Json;
          best_bit?: string | null;
          booking_id: string;
          created_at?: string;
          expectations?: string | null;
          freedom?: number | null;
          group_feeling?: number | null;
          id?: string;
          kind: Database["public"]["Enums"]["survey_kind"];
          organisation?: number | null;
          overall?: number | null;
          submitted_at?: string;
          tour_id?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          user_id: string;
          value_for_money?: number | null;
          worst_bit?: string | null;
          would_repeat?: boolean | null;
        };
        Update: {
          accommodation?: number | null;
          answers?: Json;
          best_bit?: string | null;
          booking_id?: string;
          created_at?: string;
          expectations?: string | null;
          freedom?: number | null;
          group_feeling?: number | null;
          id?: string;
          kind?: Database["public"]["Enums"]["survey_kind"];
          organisation?: number | null;
          overall?: number | null;
          submitted_at?: string;
          tour_id?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          user_id?: string;
          value_for_money?: number | null;
          worst_bit?: string | null;
          would_repeat?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_surveys_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_surveys_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_surveys_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_surveys_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          created_at: string;
          departure_group_id: string;
          departure_id: string;
          end_date: string;
          id: string;
          name: string;
          snapshot_taken_at: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["trip_status"];
          timezone: string;
          tour_version_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          departure_group_id: string;
          departure_id: string;
          end_date: string;
          id?: string;
          name: string;
          snapshot_taken_at?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["trip_status"];
          timezone: string;
          tour_version_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          departure_group_id?: string;
          departure_id?: string;
          end_date?: string;
          id?: string;
          name?: string;
          snapshot_taken_at?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["trip_status"];
          timezone?: string;
          tour_version_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_departure_group_id_fkey";
            columns: ["departure_group_id"];
            isOneToOne: true;
            referencedRelation: "departure_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["role"];
          },
        ];
      };
      webhook_events: {
        Row: {
          error: string | null;
          event_id: string;
          event_type: string;
          id: string;
          payload: Json | null;
          payload_hash: string;
          processed_at: string | null;
          provider: string;
          received_at: string;
          status: Database["public"]["Enums"]["webhook_event_status"];
        };
        Insert: {
          error?: string | null;
          event_id: string;
          event_type: string;
          id?: string;
          payload?: Json | null;
          payload_hash: string;
          processed_at?: string | null;
          provider: string;
          received_at?: string;
          status?: Database["public"]["Enums"]["webhook_event_status"];
        };
        Update: {
          error?: string | null;
          event_id?: string;
          event_type?: string;
          id?: string;
          payload?: Json | null;
          payload_hash?: string;
          processed_at?: string | null;
          provider?: string;
          received_at?: string;
          status?: Database["public"]["Enums"]["webhook_event_status"];
        };
        Relationships: [];
      };
    };
    Views: {
      add_on_availability: {
        Row: {
          add_on_id: string | null;
          capacity: number | null;
          confirmed: number | null;
          held: number | null;
        };
        Relationships: [];
      };
      add_on_headcounts: {
        Row: {
          add_on_id: string | null;
          going: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_on_availability";
            referencedColumns: ["add_on_id"];
          },
          {
            foreignKeyName: "booking_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "departure_add_ons";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_cost_by_booking: {
        Row: {
          booking_id: string | null;
          cost_micros: number | null;
          input_tokens: number | null;
          last_used: string | null;
          messages: number | null;
          output_tokens: number | null;
          travelers: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings_public: {
        Row: {
          amount_paid: number | null;
          amount_refunded: number | null;
          cancelled_at: string | null;
          confirmation_number: string | null;
          created_at: string | null;
          currency: string | null;
          customer_id: string | null;
          departure_id: string | null;
          deposit_amount: number | null;
          discount_amount: number | null;
          hold_expires_at: string | null;
          id: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"] | null;
          refund_percentage: number | null;
          status: Database["public"]["Enums"]["booking_status"] | null;
          subtotal_amount: number | null;
          terms_accepted_at: string | null;
          total_amount: number | null;
          tour_version_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount_paid?: number | null;
          amount_refunded?: number | null;
          cancelled_at?: string | null;
          confirmation_number?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_id?: string | null;
          departure_id?: string | null;
          deposit_amount?: number | null;
          discount_amount?: number | null;
          hold_expires_at?: string | null;
          id?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"] | null;
          refund_percentage?: number | null;
          status?: Database["public"]["Enums"]["booking_status"] | null;
          subtotal_amount?: number | null;
          terms_accepted_at?: string | null;
          total_amount?: number | null;
          tour_version_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount_paid?: number | null;
          amount_refunded?: number | null;
          cancelled_at?: string | null;
          confirmation_number?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_id?: string | null;
          departure_id?: string | null;
          deposit_amount?: number | null;
          discount_amount?: number | null;
          hold_expires_at?: string | null;
          id?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"] | null;
          refund_percentage?: number | null;
          status?: Database["public"]["Enums"]["booking_status"] | null;
          subtotal_amount?: number | null;
          terms_accepted_at?: string | null;
          total_amount?: number | null;
          tour_version_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      departures_public: {
        Row: {
          balance_due_date: string | null;
          booking_deadline: string | null;
          cancellation_policy: Json | null;
          capacity: number | null;
          created_at: string | null;
          currency: string | null;
          deposit_amount: number | null;
          end_date: string | null;
          group_opens_days_before: number | null;
          id: string | null;
          minimum_travelers: number | null;
          opens_at: string | null;
          price_amount: number | null;
          shared_room_discount_amount: number | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["departure_status"] | null;
          timezone: string | null;
          tour_id: string | null;
          tour_version_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          balance_due_date?: string | null;
          booking_deadline?: string | null;
          cancellation_policy?: Json | null;
          capacity?: number | null;
          created_at?: string | null;
          currency?: string | null;
          deposit_amount?: number | null;
          end_date?: string | null;
          group_opens_days_before?: number | null;
          id?: string | null;
          minimum_travelers?: number | null;
          opens_at?: string | null;
          price_amount?: number | null;
          shared_room_discount_amount?: number | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["departure_status"] | null;
          timezone?: string | null;
          tour_id?: string | null;
          tour_version_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          balance_due_date?: string | null;
          booking_deadline?: string | null;
          cancellation_policy?: Json | null;
          capacity?: number | null;
          created_at?: string | null;
          currency?: string | null;
          deposit_amount?: number | null;
          end_date?: string | null;
          group_opens_days_before?: number | null;
          id?: string | null;
          minimum_travelers?: number | null;
          opens_at?: string | null;
          price_amount?: number | null;
          shared_room_discount_amount?: number | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["departure_status"] | null;
          timezone?: string | null;
          tour_id?: string | null;
          tour_version_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departures_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departures_tour_version_id_fkey";
            columns: ["tour_version_id"];
            isOneToOne: false;
            referencedRelation: "tour_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      fulfilment_queue: {
        Row: {
          booking_id: string | null;
          confirmation_number: string | null;
          created_at: string | null;
          days_until: number | null;
          id: string | null;
          operated_by: string | null;
          status: Database["public"]["Enums"]["fulfilment_status"] | null;
          supplier: Database["public"]["Enums"]["experience_supplier"] | null;
          supplier_option_id: string | null;
          title: string | null;
          tour_name: string | null;
          travel_date: string | null;
          travelers: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "add_on_fulfilments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "add_on_fulfilments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings_public";
            referencedColumns: ["id"];
          },
        ];
      };
      hotels_public: {
        Row: {
          address: string | null;
          amenities: string[] | null;
          city: string | null;
          country_code: string | null;
          description: string | null;
          destination_id: string | null;
          id: string | null;
          image_urls: string[] | null;
          latitude: number | null;
          longitude: number | null;
          name: string | null;
          slug: string | null;
          star_rating: number | null;
        };
        Insert: {
          address?: string | null;
          amenities?: string[] | null;
          city?: string | null;
          country_code?: string | null;
          description?: string | null;
          destination_id?: string | null;
          id?: string | null;
          image_urls?: string[] | null;
          latitude?: number | null;
          longitude?: number | null;
          name?: string | null;
          slug?: string | null;
          star_rating?: number | null;
        };
        Update: {
          address?: string | null;
          amenities?: string[] | null;
          city?: string | null;
          country_code?: string | null;
          description?: string | null;
          destination_id?: string | null;
          id?: string | null;
          image_urls?: string[] | null;
          latitude?: number | null;
          longitude?: number | null;
          name?: string | null;
          slug?: string | null;
          star_rating?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "hotels_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      item_rsvp_counts: {
        Row: {
          going: number | null;
          item_id: string | null;
          maybe: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "item_rsvps_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "trip_itinerary_items";
            referencedColumns: ["id"];
          },
        ];
      };
      live_moment_counts: {
        Row: {
          joined: number | null;
          moment_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "live_moment_participants_moment_id_fkey";
            columns: ["moment_id"];
            isOneToOne: false;
            referencedRelation: "live_moments";
            referencedColumns: ["id"];
          },
        ];
      };
      meetup_rsvp_counts: {
        Row: {
          going: number | null;
          meetup_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "meetup_rsvps_meetup_id_fkey";
            columns: ["meetup_id"];
            isOneToOne: false;
            referencedRelation: "meetups";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews_public: {
        Row: {
          author_name: string | null;
          body: string | null;
          id: string | null;
          published_at: string | null;
          rating: number | null;
          title: string | null;
          tour_id: string | null;
          trip_end_date: string | null;
          would_repeat: boolean | null;
        };
        Insert: {
          author_name?: string | null;
          body?: string | null;
          id?: string | null;
          published_at?: string | null;
          rating?: number | null;
          title?: string | null;
          tour_id?: string | null;
          trip_end_date?: string | null;
          would_repeat?: boolean | null;
        };
        Update: {
          author_name?: string | null;
          body?: string | null;
          id?: string | null;
          published_at?: string | null;
          rating?: number | null;
          title?: string | null;
          tour_id?: string | null;
          trip_end_date?: string | null;
          would_repeat?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      stay_option_availability: {
        Row: {
          capacity: number | null;
          confirmed: number | null;
          departure_id: string | null;
          held: number | null;
          stay_option_id: string | null;
        };
        Insert: {
          capacity?: number | null;
          confirmed?: never;
          departure_id?: string | null;
          held?: never;
          stay_option_id?: string | null;
        };
        Update: {
          capacity?: number | null;
          confirmed?: never;
          departure_id?: string | null;
          held?: never;
          stay_option_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departure_stay_options_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      stay_option_hotels_public: {
        Row: {
          amenities: string[] | null;
          bed_type: string | null;
          city: string | null;
          country_code: string | null;
          departure_id: string | null;
          hotel_id: string | null;
          hotel_name: string | null;
          hotel_slug: string | null;
          image_urls: string[] | null;
          max_occupancy: number | null;
          room_name: string | null;
          star_rating: number | null;
          stay_option_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departure_stay_options_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departure_stay_options_departure_id_fkey";
            columns: ["departure_id"];
            isOneToOne: false;
            referencedRelation: "departures_public";
            referencedColumns: ["id"];
          },
        ];
      };
      testimonials_public: {
        Row: {
          author_name: string | null;
          id: string | null;
          image_url: string | null;
          position: number | null;
          published_at: string | null;
          quote: string | null;
          tour_id: string | null;
          trip_label: string | null;
        };
        Insert: {
          author_name?: string | null;
          id?: string | null;
          image_url?: string | null;
          position?: number | null;
          published_at?: string | null;
          quote?: string | null;
          tour_id?: string | null;
          trip_label?: string | null;
        };
        Update: {
          author_name?: string | null;
          id?: string | null;
          image_url?: string | null;
          position?: number | null;
          published_at?: string | null;
          quote?: string | null;
          tour_id?: string | null;
          trip_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "testimonials_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_review_stats: {
        Row: {
          average_rating: number | null;
          latest_published_at: string | null;
          review_count: number | null;
          tour_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_save_counts: {
        Row: {
          saves: number | null;
          tour_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "saved_tours_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      tour_survey_stats: {
        Row: {
          accommodation: number | null;
          freedom: number | null;
          group_feeling: number | null;
          kind: Database["public"]["Enums"]["survey_kind"] | null;
          organisation: number | null;
          overall: number | null;
          responses: number | null;
          tour_id: string | null;
          value_for_money: number | null;
          would_repeat: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_surveys_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_photos_public: {
        Row: {
          author_name: string | null;
          caption: string | null;
          id: string | null;
          published_at: string | null;
          storage_path: string | null;
          tour_id: string | null;
        };
        Insert: {
          author_name?: string | null;
          caption?: string | null;
          id?: string | null;
          published_at?: string | null;
          storage_path?: string | null;
          tour_id?: string | null;
        };
        Update: {
          author_name?: string | null;
          caption?: string | null;
          id?: string | null;
          published_at?: string | null;
          storage_path?: string | null;
          tour_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_photos_tour_id_fkey";
            columns: ["tour_id"];
            isOneToOne: false;
            referencedRelation: "tours";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_places: {
        Row: {
          first_asked: string | null;
          from_travelers: number | null;
          last_asked: string | null;
          place: string | null;
          requests: number | null;
        };
        Relationships: [];
      };
      whats_coming: {
        Row: {
          city: string | null;
          end_date: string | null;
          happens_at: string | null;
          id: string | null;
          kind: string | null;
          opens_at: string | null;
          slug: string | null;
          start_date: string | null;
          title: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      account_credit_balance: {
        Args: { p_currency: string; p_user_id: string };
        Returns: number;
      };
      add_on_bookable_until: {
        Args: {
          p_add_on: Database["public"]["Tables"]["departure_add_ons"]["Row"];
        };
        Returns: string;
      };
      add_on_date: {
        Args: {
          p_add_on: Database["public"]["Tables"]["departure_add_ons"]["Row"];
        };
        Returns: string;
      };
      add_on_room_participants: {
        Args: { p_add_on_id: string; p_trip_id: string };
        Returns: {
          user_id: string;
        }[];
      };
      ai_claim_message: {
        Args: { p_booking_id: string; p_user_id: string };
        Returns: boolean;
      };
      ai_daily_limit: { Args: never; Returns: number };
      ai_messages_left: { Args: { p_user_id?: string }; Returns: number };
      ai_record_cost: {
        Args: {
          p_cost_micros: number;
          p_input_tokens: number;
          p_output_tokens: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      assert_departure_capacity: {
        Args: { p_departure_id: string };
        Returns: undefined;
      };
      blocked_between: { Args: { p_a: string; p_b: string }; Returns: boolean };
      can_read_message: { Args: { p_sender_id: string }; Returns: boolean };
      can_review_booking: { Args: { p_booking_id: string }; Returns: boolean };
      can_survey_booking: {
        Args: {
          p_booking_id: string;
          p_kind: Database["public"]["Enums"]["survey_kind"];
        };
        Returns: boolean;
      };
      check_group_code: {
        Args: { p_code: string; p_departure_id: string };
        Returns: Json;
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      claim_due_social_posts: {
        Args: { p_limit?: number };
        Returns: {
          account_id: string | null;
          alt_texts: string[];
          attempts: number;
          caption: string;
          created_at: string;
          created_by: string | null;
          destination_id: string | null;
          external_container_id: string | null;
          external_media_id: string | null;
          hashtags: string[];
          id: string;
          kind: Database["public"]["Enums"]["social_media_kind"];
          last_error: string | null;
          link_url: string | null;
          media_paths: string[];
          permalink: string | null;
          platform: Database["public"]["Enums"]["social_platform"];
          published_at: string | null;
          scheduled_at: string | null;
          source_files: string[];
          status: Database["public"]["Enums"]["social_post_status"];
          title: string | null;
          tour_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "social_posts";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_pending_notifications: {
        Args: { p_limit?: number };
        Returns: {
          body: string;
          category: Database["public"]["Enums"]["notification_category"];
          created_at: string;
          deep_link: Json;
          display_name: string;
          id: string;
          marketing_email: boolean;
          marketing_push: boolean;
          operational_email: boolean;
          push_tokens: string[];
          quiet_hours_end: string;
          quiet_hours_start: string;
          recipient_email: string;
          social_email: boolean;
          social_push: boolean;
          title: string;
          trip_active: boolean;
          trip_id: string;
          trip_timezone: string;
          type: string;
          user_id: string;
        }[];
      };
      confirm_add_on_purchase: {
        Args: {
          p_amount: number;
          p_payment_intent_id: string;
          p_purchase_id: string;
          p_session_id: string;
        };
        Returns: boolean;
      };
      create_booking: {
        Args: {
          p_add_ons?: Json;
          p_code?: string;
          p_departure_id: string;
          p_emergency_contact: Json;
          p_group_code?: string;
          p_payment_option?: string;
          p_preferences: Json;
          p_stay_option_id?: string;
          p_terms_version?: string;
          p_travelers: Json;
        };
        Returns: {
          amount_due_now: number;
          booking_id: string;
          confirmation_number: string;
          currency: string;
          deposit_amount: number;
          hold_expires_at: string;
          total_amount: number;
        }[];
      };
      create_group_code: {
        Args: { p_booking_id: string };
        Returns: {
          code: string;
          created_at: string;
          departure_id: string;
          expires_at: string | null;
          id: string;
          label: string | null;
          max_uses: number;
          owner_booking_id: string | null;
          owner_user_id: string;
          uses: number;
        };
        SetofOptions: {
          from: "*";
          to: "group_codes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_trip_for_group: { Args: { p_group_id: string }; Returns: string };
      departure_roster_stats: {
        Args: { p_departure_id: string };
        Returns: Json;
      };
      departure_unlock_progress: {
        Args: { p_departure_id: string };
        Returns: Json;
      };
      enqueue_payment_reminders: { Args: never; Returns: number };
      enqueue_trip_reminders: { Args: never; Returns: number };
      ensure_add_on_chat_room: {
        Args: { p_add_on_id: string; p_trip_id: string };
        Returns: {
          add_on_id: string | null;
          created_at: string;
          id: string;
          is_archived: boolean;
          name: string;
          trip_id: string;
          type: Database["public"]["Enums"]["chat_room_type"];
        };
        SetofOptions: {
          from: "*";
          to: "chat_rooms";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fail_fulfilment: {
        Args: { p_fulfilment_id: string; p_reason: string };
        Returns: {
          add_on_id: string;
          booked_at: string | null;
          booked_by: string | null;
          booking_add_on_id: string;
          booking_id: string;
          cancellation_terms: Json;
          created_at: string;
          failure_reason: string | null;
          id: string;
          instructions: string | null;
          status: Database["public"]["Enums"]["fulfilment_status"];
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_booking_id: string | null;
          supplier_option_id: string;
          supplier_reference: string | null;
          travel_date: string;
          travelers: number;
          updated_at: string;
          voucher_url: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "add_on_fulfilments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      format_money: {
        Args: { p_amount: number; p_currency: string };
        Returns: string;
      };
      free_activities_on: {
        Args: { p_date: string; p_trip_id: string };
        Returns: {
          instructions: string;
          item_id: string;
          location_name: string;
          start_time: string;
          title: string;
        }[];
      };
      generate_confirmation_number: { Args: never; Returns: string };
      generate_referral_code: { Args: never; Returns: string };
      get_departure_availability: {
        Args: { p_departure_id: string };
        Returns: {
          available: number;
          capacity: number;
          confirmed: number;
          held: number;
        }[];
      };
      has_any_role: {
        Args: { required: Database["public"]["Enums"]["app_role"][] };
        Returns: boolean;
      };
      hotel_rate_free_until: { Args: { policy: Json }; Returns: string };
      hotel_rate_penalty_at: {
        Args: { at: string; policy: Json };
        Returns: number;
      };
      invoke_notify_dispatch: { Args: never; Returns: undefined };
      invoke_social_publish: { Args: never; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      is_chat_member: { Args: { p_room_id: string }; Returns: boolean };
      is_content_staff: { Args: never; Returns: boolean };
      is_departure_member: {
        Args: { p_departure_id: string };
        Returns: boolean;
      };
      is_finance_staff: { Args: never; Returns: boolean };
      is_moderator: { Args: never; Returns: boolean };
      is_ops_staff: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
      is_support_staff: { Args: never; Returns: boolean };
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean };
      join_waitlist: {
        Args: {
          p_departure_id?: string;
          p_email?: string;
          p_name?: string;
          p_party_size?: number;
          p_source?: string;
          p_tour_id: string;
        };
        Returns: string;
      };
      location_freshness: { Args: never; Returns: string };
      location_sharing_max: { Args: never; Returns: string };
      log_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"];
          p_entity_id: string;
          p_entity_type: string;
          p_metadata?: Json;
        };
        Returns: undefined;
      };
      notify_booking_paid: {
        Args: {
          p_booking_id: string;
          p_kind?: string;
          p_payment_intent_id: string;
        };
        Returns: boolean;
      };
      notify_trip_members: {
        Args: {
          p_body: string;
          p_category: Database["public"]["Enums"]["notification_category"];
          p_dedupe_prefix?: string;
          p_deep_link: Json;
          p_exclude?: string;
          p_title: string;
          p_trip_id: string;
          p_type: string;
        };
        Returns: number;
      };
      notify_waitlist: {
        Args: { p_body?: string; p_departure_id: string };
        Returns: number;
      };
      open_due_groups: { Args: never; Returns: number };
      open_surveys: {
        Args: never;
        Returns: {
          booking_id: string;
          end_date: string;
          kind: Database["public"]["Enums"]["survey_kind"];
          start_date: string;
          submitted_at: string;
          tour_id: string;
          tour_name: string;
          trip_id: string;
          trip_name: string;
        }[];
      };
      purge_stale_builder_drafts: { Args: never; Returns: number };
      purge_stale_trip_locations: { Args: never; Returns: number };
      quote_booking: {
        Args: {
          p_add_ons?: Json;
          p_apply_credit?: boolean;
          p_code?: string;
          p_departure_id: string;
          p_payment_option?: string;
          p_room_indexes: number[];
          p_stay_option_id?: string;
        };
        Returns: Json;
      };
      record_fulfilment: {
        Args: {
          p_cancellation_terms?: Json;
          p_fulfilment_id: string;
          p_instructions?: string;
          p_reference: string;
          p_supplier_booking_id?: string;
          p_voucher_url?: string;
        };
        Returns: {
          add_on_id: string;
          booked_at: string | null;
          booked_by: string | null;
          booking_add_on_id: string;
          booking_id: string;
          cancellation_terms: Json;
          created_at: string;
          failure_reason: string | null;
          id: string;
          instructions: string | null;
          status: Database["public"]["Enums"]["fulfilment_status"];
          supplier: Database["public"]["Enums"]["experience_supplier"];
          supplier_booking_id: string | null;
          supplier_option_id: string;
          supplier_reference: string | null;
          travel_date: string;
          travelers: number;
          updated_at: string;
          voucher_url: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "add_on_fulfilments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      referral_progress: { Args: { p_currency?: string }; Returns: Json };
      refund_percentage_for: {
        Args: { days_before: number; policy: Json };
        Returns: number;
      };
      release_expired_add_on_holds: { Args: never; Returns: number };
      release_expired_holds: { Args: never; Returns: number };
      request_cancellation: {
        Args: { p_booking_id: string; p_reason: string };
        Returns: string;
      };
      resolve_cancellation_request: {
        Args: { p_notes?: string; p_request_id: string; p_status: string };
        Returns: undefined;
      };
      review_author_name: { Args: { p_user_id: string }; Returns: string };
      reviewable_bookings: {
        Args: never;
        Returns: {
          booking_id: string;
          end_date: string;
          tour_id: string;
          tour_name: string;
          trip_id: string;
          trip_name: string;
        }[];
      };
      run_lifecycle_notifications: { Args: never; Returns: undefined };
      set_review_status: {
        Args: {
          p_note?: string;
          p_review_id: string;
          p_status: Database["public"]["Enums"]["review_status"];
        };
        Returns: {
          author_name: string;
          body: string;
          booking_id: string;
          created_at: string;
          id: string;
          published_at: string | null;
          rating: number;
          staff_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          title: string | null;
          tour_id: string;
          trip_end_date: string | null;
          trip_id: string;
          updated_at: string;
          user_id: string;
          would_repeat: boolean | null;
        };
        SetofOptions: {
          from: "*";
          to: "reviews";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_trip_photo_status: {
        Args: {
          p_note?: string;
          p_photo_id: string;
          p_status: Database["public"]["Enums"]["review_status"];
        };
        Returns: {
          author_name: string;
          booking_id: string;
          caption: string | null;
          created_at: string;
          id: string;
          published_at: string | null;
          staff_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          storage_path: string;
          tour_id: string;
          trip_id: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "trip_photos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      shares_trip_with: { Args: { p_user_id: string }; Returns: boolean };
      start_add_on_purchase: {
        Args: { p_add_ons: Json; p_booking_id: string };
        Returns: {
          amount: number;
          currency: string;
          purchase_id: string;
          summary: string;
        }[];
      };
      stay_option_availability_for: {
        Args: { p_departure_id: string };
        Returns: {
          capacity: number;
          confirmed: number;
          held: number;
          stay_option_id: string;
        }[];
      };
      submit_review: {
        Args: {
          p_body: string;
          p_booking_id: string;
          p_rating: number;
          p_title?: string;
          p_would_repeat?: boolean;
        };
        Returns: {
          author_name: string;
          body: string;
          booking_id: string;
          created_at: string;
          id: string;
          published_at: string | null;
          rating: number;
          staff_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          title: string | null;
          tour_id: string;
          trip_end_date: string | null;
          trip_id: string;
          updated_at: string;
          user_id: string;
          would_repeat: boolean | null;
        };
        SetofOptions: {
          from: "*";
          to: "reviews";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_trip_photo: {
        Args: {
          p_booking_id: string;
          p_caption?: string;
          p_storage_path: string;
        };
        Returns: {
          author_name: string;
          booking_id: string;
          caption: string | null;
          created_at: string;
          id: string;
          published_at: string | null;
          staff_note: string | null;
          status: Database["public"]["Enums"]["review_status"];
          storage_path: string;
          tour_id: string;
          trip_id: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "trip_photos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_trip_survey: {
        Args: {
          p_accommodation?: number;
          p_answers?: Json;
          p_best_bit?: string;
          p_booking_id: string;
          p_expectations?: string;
          p_freedom?: number;
          p_group_feeling?: number;
          p_kind: Database["public"]["Enums"]["survey_kind"];
          p_organisation?: number;
          p_overall?: number;
          p_value_for_money?: number;
          p_worst_bit?: string;
          p_would_repeat?: boolean;
        };
        Returns: {
          accommodation: number | null;
          answers: Json;
          best_bit: string | null;
          booking_id: string;
          created_at: string;
          expectations: string | null;
          freedom: number | null;
          group_feeling: number | null;
          id: string;
          kind: Database["public"]["Enums"]["survey_kind"];
          organisation: number | null;
          overall: number | null;
          submitted_at: string;
          tour_id: string | null;
          trip_id: string | null;
          updated_at: string;
          user_id: string;
          value_for_money: number | null;
          worst_bit: string | null;
          would_repeat: boolean | null;
        };
        SetofOptions: {
          from: "*";
          to: "trip_surveys";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      subscribe_newsletter: {
        Args: { p_email: string; p_source?: string };
        Returns: string;
      };
      suggest_experience_price: {
        Args: { p_product_id: string; p_retail_amount: number };
        Returns: number;
      };
      suggest_stay_price: {
        Args: {
          p_adults: number;
          p_check_in: string;
          p_check_out: string;
          p_hotel_id: string;
        };
        Returns: Json;
      };
      sync_add_on_chat_members: { Args: { p_trip_id: string }; Returns: number };
      sync_referral_tier: {
        Args: { p_currency: unknown; p_user_id: string };
        Returns: number;
      };
      tour_version_is_public: { Args: { version_id: string }; Returns: boolean };
      traveler_pace: { Args: { p_booking_id: string }; Returns: string };
      traveler_taste: {
        Args: { p_user_id?: string };
        Returns: {
          category: Database["public"]["Enums"]["recommendation_category"];
          weight: number;
        }[];
      };
      trip_add_on_participants: {
        Args: { p_trip_id: string };
        Returns: {
          add_on_id: string;
          display_name: string;
          first_name: string;
          user_id: string;
        }[];
      };
      trips_running_on: {
        Args: { p_date: string };
        Returns: {
          room_id: string;
          timezone: string;
          trip_id: string;
          trip_name: string;
        }[];
      };
      unsubscribe_newsletter: { Args: { p_token: string }; Returns: boolean };
      withdraw_cancellation_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      activity_level: "relaxed" | "moderate" | "active";
      add_on_kind:
        | "activity"
        | "ticket"
        | "transfer"
        | "dinner"
        | "extra_night"
        | "room_upgrade"
        | "group_moment"
        | "insurance"
        | "extension"
        | "other";
      app_role:
        | "customer"
        | "trip_staff"
        | "support"
        | "content_editor"
        | "finance"
        | "admin"
        | "super_admin";
      audit_action:
        | "booking_created"
        | "booking_cancelled"
        | "refund_created"
        | "payment_updated"
        | "traveler_added"
        | "traveler_removed"
        | "itinerary_changed"
        | "supplier_changed"
        | "admin_login"
        | "role_changed"
        | "support_assignment"
        | "message_deleted";
      booking_status:
        "draft" | "pending_payment" | "confirmed" | "cancelled" | "refunded" | "completed";
      chat_room_type: "trip_group" | "announcements" | "optional_activities";
      content_visibility: "public_preview" | "booked_customer" | "trip_member" | "staff_only";
      departure_status:
        | "draft"
        | "open"
        | "guaranteed"
        | "full"
        | "closed"
        | "in_progress"
        | "completed"
        | "cancelled";
      experience_supplier: "mock" | "viator";
      fulfilment_status: "pending" | "booked" | "failed" | "cancelled";
      hotel_booking_status: "quoted" | "booked" | "confirmed" | "cancelled" | "failed";
      hotel_payment_type: "pay_now" | "pay_at_property";
      hotel_supplier: "duffel" | "expedia" | "hotelbeds" | "manual" | "liteapi";
      itinerary_item_status: "planned" | "confirmed" | "pending_supplier" | "changed" | "cancelled";
      itinerary_item_type:
        | "hotel"
        | "transfer"
        | "train"
        | "flight"
        | "activity"
        | "meal"
        | "free_time"
        | "recommendation"
        | "meeting_point"
        | "check_in"
        | "check_out"
        | "live_moment"
        | "custom";
      live_moment_status: "draft" | "scheduled" | "live" | "completed" | "cancelled";
      notification_category: "operational" | "social" | "marketing";
      notification_channel: "push" | "email" | "in_app";
      option_label: "best_value" | "most_popular" | "social" | "luxury";
      option_tier: "explorer" | "classic" | "premium" | "elite";
      payment_status:
        | "unpaid"
        | "deposit_paid"
        | "partially_paid"
        | "paid"
        | "refunded"
        | "partially_refunded"
        | "failed";
      recommendation_category:
        | "food"
        | "coffee"
        | "bars"
        | "culture"
        | "shopping"
        | "nature"
        | "nightlife"
        | "local"
        | "hidden_gem"
        | "rainy_day"
        | "romantic"
        | "solo"
        | "group";
      responsibility: "guideless" | "traveler";
      review_status: "pending" | "published" | "rejected";
      room_preference: "single" | "shared_twin" | "shared_double" | "no_preference";
      social_media_kind: "image" | "carousel";
      social_platform: "instagram" | "pinterest";
      social_post_status:
        "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
      supplier_service_status: "requested" | "pending" | "confirmed" | "cancelled" | "failed";
      support_category:
        | "hotel"
        | "transportation"
        | "activity"
        | "booking"
        | "payment"
        | "lost_item"
        | "itinerary"
        | "emergency"
        | "other";
      support_thread_status:
        "open" | "waiting_on_customer" | "waiting_on_staff" | "resolved" | "closed";
      survey_kind: "pre_trip" | "post_trip";
      tour_version_status: "draft" | "published" | "archived";
      transfer_preference: "group_welcome_transfer" | "own_arrangement";
      transport_type: "train" | "flight" | "transfer" | "ferry" | "bus";
      trip_character:
        "social" | "nightlife" | "slow" | "culinary" | "cultural" | "outdoors" | "scenic" | "event";
      trip_status: "upcoming" | "active" | "completed" | "cancelled";
      webhook_event_status: "received" | "processed" | "failed" | "skipped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_level: ["relaxed", "moderate", "active"],
      add_on_kind: [
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
      ],
      app_role: [
        "customer",
        "trip_staff",
        "support",
        "content_editor",
        "finance",
        "admin",
        "super_admin",
      ],
      audit_action: [
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
      ],
      booking_status: [
        "draft",
        "pending_payment",
        "confirmed",
        "cancelled",
        "refunded",
        "completed",
      ],
      chat_room_type: ["trip_group", "announcements", "optional_activities"],
      content_visibility: ["public_preview", "booked_customer", "trip_member", "staff_only"],
      departure_status: [
        "draft",
        "open",
        "guaranteed",
        "full",
        "closed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      experience_supplier: ["mock", "viator"],
      fulfilment_status: ["pending", "booked", "failed", "cancelled"],
      hotel_booking_status: ["quoted", "booked", "confirmed", "cancelled", "failed"],
      hotel_payment_type: ["pay_now", "pay_at_property"],
      hotel_supplier: ["duffel", "expedia", "hotelbeds", "manual", "liteapi"],
      itinerary_item_status: ["planned", "confirmed", "pending_supplier", "changed", "cancelled"],
      itinerary_item_type: [
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
      ],
      live_moment_status: ["draft", "scheduled", "live", "completed", "cancelled"],
      notification_category: ["operational", "social", "marketing"],
      notification_channel: ["push", "email", "in_app"],
      option_label: ["best_value", "most_popular", "social", "luxury"],
      option_tier: ["explorer", "classic", "premium", "elite"],
      payment_status: [
        "unpaid",
        "deposit_paid",
        "partially_paid",
        "paid",
        "refunded",
        "partially_refunded",
        "failed",
      ],
      recommendation_category: [
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
      ],
      responsibility: ["guideless", "traveler"],
      review_status: ["pending", "published", "rejected"],
      room_preference: ["single", "shared_twin", "shared_double", "no_preference"],
      social_media_kind: ["image", "carousel"],
      social_platform: ["instagram", "pinterest"],
      social_post_status: ["draft", "scheduled", "publishing", "published", "failed", "cancelled"],
      supplier_service_status: ["requested", "pending", "confirmed", "cancelled", "failed"],
      support_category: [
        "hotel",
        "transportation",
        "activity",
        "booking",
        "payment",
        "lost_item",
        "itinerary",
        "emergency",
        "other",
      ],
      support_thread_status: [
        "open",
        "waiting_on_customer",
        "waiting_on_staff",
        "resolved",
        "closed",
      ],
      survey_kind: ["pre_trip", "post_trip"],
      tour_version_status: ["draft", "published", "archived"],
      transfer_preference: ["group_welcome_transfer", "own_arrangement"],
      transport_type: ["train", "flight", "transfer", "ferry", "bus"],
      trip_character: [
        "social",
        "nightlife",
        "slow",
        "culinary",
        "cultural",
        "outdoors",
        "scenic",
        "event",
      ],
      trip_status: ["upcoming", "active", "completed", "cancelled"],
      webhook_event_status: ["received", "processed", "failed", "skipped"],
    },
  },
} as const;
