export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      allowed_users: {
        Row: {
          id: string;
          email: string;
          role: string;
          is_club_member: boolean;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: string;
          is_club_member?: boolean;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          is_club_member?: boolean;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "allowed_users_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: string;
          name: string;
          used_count: number;
          last_used_by: string | null;
          last_used_date: string | null;
          created_by: string | null;
          created_at: string;
          in_bank: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          used_count?: number;
          last_used_by?: string | null;
          last_used_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          in_bank?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          used_count?: number;
          last_used_by?: string | null;
          last_used_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          in_bank?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_last_used_by_fkey";
            columns: ["last_used_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      recipes: {
        Row: {
          id: string;
          name: string;
          url: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          url?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          url?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      recipe_contributions: {
        Row: {
          id: string;
          recipe_id: string;
          user_id: string | null;
          event_id: string | null;
          notes: string | null;
          photos: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          user_id?: string | null;
          event_id?: string | null;
          notes?: string | null;
          photos?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          user_id?: string | null;
          event_id?: string | null;
          notes?: string | null;
          photos?: string[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_contributions_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_contributions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_contributions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_events";
            referencedColumns: ["id"];
          }
        ];
      };
      recipe_ratings: {
        Row: {
          id: string;
          recipe_id: string;
          user_id: string;
          event_id: string;
          would_cook_again: boolean;
          overall_rating: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          user_id: string;
          event_id: string;
          would_cook_again: boolean;
          overall_rating: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          user_id?: string;
          event_id?: string;
          would_cook_again?: boolean;
          overall_rating?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ratings_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ratings_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_events";
            referencedColumns: ["id"];
          }
        ];
      };
      scheduled_events: {
        Row: {
          id: string;
          ingredient_id: string | null;
          event_date: string;
          event_time: string | null;
          created_by: string | null;
          status: string;
          calendar_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ingredient_id?: string | null;
          event_date: string;
          event_time?: string | null;
          created_by?: string | null;
          status?: string;
          calendar_event_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ingredient_id?: string | null;
          event_date?: string;
          event_time?: string | null;
          created_by?: string | null;
          status?: string;
          calendar_event_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_events_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;
