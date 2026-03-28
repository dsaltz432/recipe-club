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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allowed_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
          is_club_member: boolean
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
          is_club_member?: boolean
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          is_club_member?: boolean
          role?: string
        }
        Relationships: []
      }
      combined_grocery_items: {
        Row: {
          checked_items: Json
          context_id: string
          context_type: string
          created_at: string
          id: string
          items: Json
          per_recipe_items: Json | null
          recipe_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_items?: Json
          context_id: string
          context_type: string
          created_at?: string
          id?: string
          items?: Json
          per_recipe_items?: Json | null
          recipe_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_items?: Json
          context_id?: string
          context_type?: string
          created_at?: string
          id?: string
          items?: Json
          per_recipe_items?: Json | null
          recipe_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cook_mode_timelines: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          model: string | null
          recipe_ids_hash: string
          steps: Json
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          model?: string | null
          recipe_ids_hash: string
          steps: Json
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          model?: string | null
          recipe_ids_hash?: string
          steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cook_mode_timelines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "scheduled_events"
            referencedColumns: ["id"]
          },
        ]
      }
      general_grocery_items: {
        Row: {
          context_id: string
          context_type: string
          created_at: string
          id: string
          name: string
          quantity: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          context_id: string
          context_type: string
          created_at?: string
          id?: string
          name: string
          quantity?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          context_id?: string
          context_type?: string
          created_at?: string
          id?: string
          name?: string
          quantity?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          in_bank: boolean
          last_used_by: string | null
          last_used_date: string | null
          name: string
          used_count: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          in_bank?: boolean
          last_used_by?: string | null
          last_used_date?: string | null
          name: string
          used_count?: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          in_bank?: boolean
          last_used_by?: string | null
          last_used_date?: string | null
          name?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_used_by_fkey"
            columns: ["last_used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_items: {
        Row: {
          cooked_at: string | null
          custom_name: string | null
          custom_url: string | null
          day_of_week: number
          event_id: string | null
          id: string
          meal_type: string
          plan_id: string
          recipe_id: string | null
          sort_order: number | null
        }
        Insert: {
          cooked_at?: string | null
          custom_name?: string | null
          custom_url?: string | null
          day_of_week: number
          event_id?: string | null
          id?: string
          meal_type: string
          plan_id: string
          recipe_id?: string | null
          sort_order?: number | null
        }
        Update: {
          cooked_at?: string | null
          custom_name?: string | null
          custom_url?: string | null
          day_of_week?: number
          event_id?: string | null
          id?: string
          meal_type?: string
          plan_id?: string
          recipe_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "scheduled_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          status: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          status?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          status?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      recipe_content: {
        Row: {
          cook_time: string | null
          created_at: string | null
          description: string | null
          error_message: string | null
          id: string
          instructions: Json | null
          parsed_at: string | null
          prep_time: string | null
          recipe_id: string
          servings: string | null
          source_title: string | null
          status: string
          total_time: string | null
        }
        Insert: {
          cook_time?: string | null
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          instructions?: Json | null
          parsed_at?: string | null
          prep_time?: string | null
          recipe_id: string
          servings?: string | null
          source_title?: string | null
          status?: string
          total_time?: string | null
        }
        Update: {
          cook_time?: string | null
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          instructions?: Json | null
          parsed_at?: string | null
          prep_time?: string | null
          recipe_id?: string
          servings?: string | null
          source_title?: string | null
          status?: string
          total_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_content_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          category: string
          created_at: string | null
          id: string
          name: string
          quantity: number | null
          raw_text: string | null
          recipe_id: string
          sort_order: number | null
          unit: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          name: string
          quantity?: number | null
          raw_text?: string | null
          recipe_id: string
          sort_order?: number | null
          unit?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          name?: string
          quantity?: number | null
          raw_text?: string | null
          recipe_id?: string
          sort_order?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_notes: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          photos: string[] | null
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          photos?: string[] | null
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          photos?: string[] | null
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_notes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ratings: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          overall_rating: number
          recipe_id: string
          user_id: string
          would_cook_again: boolean
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          overall_rating: number
          recipe_id: string
          user_id: string
          would_cook_again: boolean
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          overall_rating?: number
          recipe_id?: string
          user_id?: string
          would_cook_again?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ratings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "scheduled_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ratings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_tips: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          tip_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          tip_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          tip_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tips_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_id: string | null
          id: string
          ingredient_id: string | null
          name: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_id?: string | null
          id?: string
          ingredient_id?: string | null
          name: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_id?: string | null
          id?: string
          ingredient_id?: string | null
          name?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "scheduled_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_new_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_events: {
        Row: {
          calendar_event_id: string | null
          created_at: string | null
          created_by: string | null
          event_date: string
          event_time: string | null
          id: string
          ingredient_id: string | null
          status: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          ingredient_id?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          ingredient_id?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_events_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pantry_items: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          ai_model_combine: string
          ai_model_parse: string
          cooking_skill: string | null
          cuisine_preferences: string[] | null
          dietary_restrictions: string[] | null
          disliked_ingredients: string[] | null
          household_size: number | null
          id: string
          max_cook_time_minutes: number | null
          meal_types: string[]
          updated_at: string | null
          user_id: string
          week_start_day: number
        }
        Insert: {
          ai_model_combine?: string
          ai_model_parse?: string
          cooking_skill?: string | null
          cuisine_preferences?: string[] | null
          dietary_restrictions?: string[] | null
          disliked_ingredients?: string[] | null
          household_size?: number | null
          id?: string
          max_cook_time_minutes?: number | null
          meal_types?: string[]
          updated_at?: string | null
          user_id: string
          week_start_day?: number
        }
        Update: {
          ai_model_combine?: string
          ai_model_parse?: string
          cooking_skill?: string | null
          cuisine_preferences?: string[] | null
          dietary_restrictions?: string[] | null
          disliked_ingredients?: string[] | null
          household_size?: number | null
          id?: string
          max_cook_time_minutes?: number | null
          meal_types?: string[]
          updated_at?: string | null
          user_id?: string
          week_start_day?: number
        }
        Relationships: []
      }
      user_tokens: {
        Row: {
          id: string
          provider: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          provider?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          provider?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_is_member_or_admin: { Args: never; Returns: boolean }
      detach_meal_plan_recipes: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      get_club_member_names: { Args: never; Returns: string[] }
      increment_ingredient_used_count: {
        Args: { p_ingredient_id: string; p_user_id?: string }
        Returns: undefined
      }
      is_admin_user: { Args: never; Returns: boolean }
      replace_recipe_ingredients: {
        Args: { p_ingredients: Json; p_recipe_id: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
