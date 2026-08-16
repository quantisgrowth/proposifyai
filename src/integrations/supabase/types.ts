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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          company_id: string | null
          contact_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          default_payment_terms: string
          default_validity_days: number
          document: string | null
          email: string | null
          fidelity_policy: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          name: string
          next_steps_text: string | null
          objective_text: string | null
          phone: string | null
          scope_text: string | null
          solution_name: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_payment_terms?: string
          default_validity_days?: number
          document?: string | null
          email?: string | null
          fidelity_policy?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          name: string
          next_steps_text?: string | null
          objective_text?: string | null
          phone?: string | null
          scope_text?: string | null
          solution_name?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_payment_terms?: string
          default_validity_days?: number
          document?: string | null
          email?: string | null
          fidelity_policy?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          next_steps_text?: string | null
          objective_text?: string | null
          phone?: string | null
          scope_text?: string | null
          solution_name?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          created_at: string
          default_payment_terms: string
          default_validity_days: number
          document: string
          email: string
          id: string
          name: string
          phone: string
          tagline: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_payment_terms?: string
          default_validity_days?: number
          document?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_payment_terms?: string
          default_validity_days?: number
          document?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_columns: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          slug: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          max_price: number | null
          min_price: number | null
          name: string
          pricing_tier_notes: string | null
          pricing_tiers: Json | null
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          unit_price: number
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_price?: number | null
          min_price?: number | null
          name: string
          pricing_tier_notes?: string | null
          pricing_tiers?: Json | null
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          unit_price?: number
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_price?: number | null
          min_price?: number | null
          name?: string
          pricing_tier_notes?: string | null
          pricing_tiers?: Json | null
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_included: boolean | null
          original_price: number | null
          position: number
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          product_id: string | null
          proposal_id: string
          quantity: number
          title: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_included?: boolean | null
          original_price?: number | null
          position?: number
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          product_id?: string | null
          proposal_id: string
          quantity?: number
          title: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_included?: boolean | null
          original_price?: number | null
          position?: number
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          product_id?: string | null
          proposal_id?: string
          quantity?: number
          title?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          accepted_by_email: string | null
          accepted_by_name: string | null
          campaign_name: string | null
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          fidelity_policy: string | null
          id: string
          net_amount: number
          next_steps_text: string | null
          notes: string | null
          objective_text: string | null
          payment_terms: string | null
          proposal_code: string
          scope_text: string | null
          sent_at: string | null
          solution_name: string | null
          status: string
          total_amount: number
          validity_date: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          campaign_name?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          fidelity_policy?: string | null
          id?: string
          net_amount?: number
          next_steps_text?: string | null
          notes?: string | null
          objective_text?: string | null
          payment_terms?: string | null
          proposal_code: string
          scope_text?: string | null
          sent_at?: string | null
          solution_name?: string | null
          status?: string
          total_amount?: number
          validity_date?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          campaign_name?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          fidelity_policy?: string | null
          id?: string
          net_amount?: number
          next_steps_text?: string | null
          notes?: string | null
          objective_text?: string | null
          payment_terms?: string | null
          proposal_code?: string
          scope_text?: string | null
          sent_at?: string | null
          solution_name?: string | null
          status?: string
          total_amount?: number
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "colaborador"
      pricing_type: "recurring" | "one_time" | "setup" | "usage_based"
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
    Enums: {
      app_role: ["admin", "colaborador"],
      pricing_type: ["recurring", "one_time", "setup", "usage_based"],
    },
  },
} as const
