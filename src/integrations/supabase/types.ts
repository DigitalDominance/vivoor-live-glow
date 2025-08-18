export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          created_at: string
          end_seconds: number
          id: string
          start_seconds: number
          thumbnail_url: string | null
          title: string
          user_id: string
          vod_id: string
        }
        Insert: {
          created_at?: string
          end_seconds: number
          id?: string
          start_seconds: number
          thumbnail_url?: string | null
          title: string
          user_id: string
          vod_id: string
        }
        Update: {
          created_at?: string
          end_seconds?: number
          id?: string
          start_seconds?: number
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          vod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_vod_id_fkey"
            columns: ["vod_id"]
            isOneToOne: false
            referencedRelation: "vods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          id: string
          kaspa_address: string | null
          last_avatar_change: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id: string
          kaspa_address?: string | null
          last_avatar_change?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          kaspa_address?: string | null
          last_avatar_change?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      streams: {
        Row: {
          category: string | null
          created_at: string
          ended_at: string | null
          id: string
          is_live: boolean
          playback_url: string | null
          started_at: string
          thumbnail_url: string | null
          title: string
          treasury_block_time: number | null
          treasury_txid: string | null
          updated_at: string
          user_id: string
          viewers: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_live?: boolean
          playback_url?: string | null
          started_at?: string
          thumbnail_url?: string | null
          title: string
          treasury_block_time?: number | null
          treasury_txid?: string | null
          updated_at?: string
          user_id: string
          viewers?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_live?: boolean
          playback_url?: string | null
          started_at?: string
          thumbnail_url?: string | null
          title?: string
          treasury_block_time?: number | null
          treasury_txid?: string | null
          updated_at?: string
          user_id?: string
          viewers?: number
        }
        Relationships: [
          {
            foreignKeyName: "streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount_sompi: number
          block_time: number
          created_at: string
          decrypted_message: string | null
          encrypted_message: string | null
          id: string
          processed_at: string | null
          recipient_address: string
          sender_address: string
          stream_id: string
          txid: string
        }
        Insert: {
          amount_sompi: number
          block_time: number
          created_at?: string
          decrypted_message?: string | null
          encrypted_message?: string | null
          id?: string
          processed_at?: string | null
          recipient_address: string
          sender_address: string
          stream_id: string
          txid: string
        }
        Update: {
          amount_sompi?: number
          block_time?: number
          created_at?: string
          decrypted_message?: string | null
          encrypted_message?: string | null
          id?: string
          processed_at?: string | null
          recipient_address?: string
          sender_address?: string
          stream_id?: string
          txid?: string
        }
        Relationships: [
          {
            foreignKeyName: "tips_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      vods: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          src_url: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          src_url: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          src_url?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      live_stream_tips: {
        Row: {
          amount_sompi: number | null
          created_at: string | null
          decrypted_message: string | null
          masked_sender_address: string | null
          stream_id: string | null
        }
        Insert: {
          amount_sompi?: number | null
          created_at?: string | null
          decrypted_message?: string | null
          masked_sender_address?: never
          stream_id?: string | null
        }
        Update: {
          amount_sompi?: number | null
          created_at?: string | null
          decrypted_message?: string | null
          masked_sender_address?: never
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          handle: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      end_user_active_streams: {
        Args: { user_id_param: string }
        Returns: number
      }
      get_current_user_kaspa_address: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_kaspa_address: {
        Args: { _id: string } | { _id: string }
        Returns: string
      }
      get_public_profile: {
        Args: { _id: string } | { _id: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          handle: string
          id: string
          updated_at: string
        }[]
      }
      get_public_profiles: {
        Args: { _limit?: number; _offset?: number; _query?: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          handle: string
          id: string
          updated_at: string
        }[]
      }
      is_stream_live: {
        Args: { stream_id_param: string }
        Returns: boolean
      }
      user_has_active_stream: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      user_owns_stream: {
        Args: { stream_id_param: string }
        Returns: boolean
      }
      validate_treasury_payment: {
        Args: {
          treasury_address_param?: string
          txid_param: string
          user_address_param: string
        }
        Returns: {
          amount_sompi: number
          block_time: number
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
