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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          org_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          aktiv: boolean | null
          created_at: string
          id: string
          integration_type: string
          org_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string
          id?: string
          integration_type: string
          org_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string
          id?: string
          integration_type?: string
          org_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      org: {
        Row: {
          created_at: string
          id: string
          name: string
          org_nr: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_nr?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_nr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      person: {
        Row: {
          aktiv: boolean
          created_at: string
          epost: string | null
          etternavn: string
          fornavn: string
          forventet_dagstimer: number | null
          id: string
          org_id: string
          person_type: string | null
          tripletex_employee_id: number | null
          underleverandor_id: string | null
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          epost?: string | null
          etternavn: string
          fornavn: string
          forventet_dagstimer?: number | null
          id?: string
          org_id: string
          person_type?: string | null
          tripletex_employee_id?: number | null
          underleverandor_id?: string | null
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          epost?: string | null
          etternavn?: string
          fornavn?: string
          forventet_dagstimer?: number | null
          id?: string
          org_id?: string
          person_type?: string | null
          tripletex_employee_id?: number | null
          underleverandor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_underleverandor_id_fkey"
            columns: ["underleverandor_id"]
            isOneToOne: false
            referencedRelation: "underleverandorer"
            referencedColumns: ["id"]
          },
        ]
      }
      person_prosjekt_pref: {
        Row: {
          id: string
          last_aktivitet_id: string | null
          org_id: string
          person_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_aktivitet_id?: string | null
          org_id: string
          person_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_aktivitet_id?: string | null
          org_id?: string
          person_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_prosjekt_pref_last_aktivitet_id_fkey"
            columns: ["last_aktivitet_id"]
            isOneToOne: false
            referencedRelation: "ttx_activity_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_prosjekt_pref_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_prosjekt_pref_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_prosjekt_pref_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          org_id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          org_id: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          org_id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          org_id: string
          results: Json
          sync_type: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          org_id: string
          results?: Json
          sync_type: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          org_id?: string
          results?: Json
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      ttx_activity_cache: {
        Row: {
          aktiv: boolean | null
          created_at: string
          id: string
          last_synced: string | null
          navn: string
          org_id: string
          ttx_id: number | null
          updated_at: string
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string
          id?: string
          last_synced?: string | null
          navn: string
          org_id: string
          ttx_id?: number | null
          updated_at?: string
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string
          id?: string
          last_synced?: string | null
          navn?: string
          org_id?: string
          ttx_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ttx_activity_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      ttx_employee_cache: {
        Row: {
          aktiv: boolean | null
          created_at: string
          epost: string | null
          etternavn: string
          fornavn: string
          id: string
          last_synced: string | null
          org_id: string
          tripletex_employee_id: number
          updated_at: string
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string
          epost?: string | null
          etternavn: string
          fornavn: string
          id?: string
          last_synced?: string | null
          org_id: string
          tripletex_employee_id: number
          updated_at?: string
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string
          epost?: string | null
          etternavn?: string
          fornavn?: string
          id?: string
          last_synced?: string | null
          org_id?: string
          tripletex_employee_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ttx_employee_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      ttx_project_cache: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          is_active: boolean | null
          last_synced: string | null
          org_id: string
          project_name: string | null
          project_number: number | null
          tripletex_project_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          org_id: string
          project_name?: string | null
          project_number?: number | null
          tripletex_project_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          org_id?: string
          project_name?: string | null
          project_number?: number | null
          tripletex_project_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ttx_project_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      underleverandorer: {
        Row: {
          adresse: string | null
          aktiv: boolean | null
          created_at: string
          epost: string | null
          id: string
          kontaktperson: string | null
          navn: string
          notater: string | null
          org_id: string
          organisasjonsnummer: string | null
          telefon: string | null
          timepris: number | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean | null
          created_at?: string
          epost?: string | null
          id?: string
          kontaktperson?: string | null
          navn: string
          notater?: string | null
          org_id: string
          organisasjonsnummer?: string | null
          telefon?: string | null
          timepris?: number | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean | null
          created_at?: string
          epost?: string | null
          id?: string
          kontaktperson?: string | null
          navn?: string
          notater?: string | null
          org_id?: string
          organisasjonsnummer?: string | null
          telefon?: string | null
          timepris?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "underleverandorer_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      vakt: {
        Row: {
          beskrivelse: string | null
          created_at: string
          created_by: string | null
          dato: string
          id: string
          org_id: string
          person_id: string
          project_id: string | null
          slutt_tid: string | null
          start_tid: string | null
          timer: number | null
          tripletex_project_id: number | null
          updated_at: string
        }
        Insert: {
          beskrivelse?: string | null
          created_at?: string
          created_by?: string | null
          dato: string
          id?: string
          org_id: string
          person_id: string
          project_id?: string | null
          slutt_tid?: string | null
          start_tid?: string | null
          timer?: number | null
          tripletex_project_id?: number | null
          updated_at?: string
        }
        Update: {
          beskrivelse?: string | null
          created_at?: string
          created_by?: string | null
          dato?: string
          id?: string
          org_id?: string
          person_id?: string
          project_id?: string | null
          slutt_tid?: string | null
          start_tid?: string | null
          timer?: number | null
          tripletex_project_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vakt_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      vakt_kommentar: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kommentar: string
          org_id: string
          vakt_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kommentar: string
          org_id: string
          vakt_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kommentar?: string
          org_id?: string
          vakt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vakt_kommentar_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_kommentar_vakt_id_fkey"
            columns: ["vakt_id"]
            isOneToOne: false
            referencedRelation: "vakt"
            referencedColumns: ["id"]
          },
        ]
      }
      vakt_timer: {
        Row: {
          aktivitet_id: string | null
          client_reference: string | null
          created_at: string
          created_by: string | null
          id: string
          kilde: string | null
          lonnstype: string | null
          notat: string | null
          org_id: string
          status: string | null
          timer: number
          tripletex_entry_id: number | null
          updated_at: string
          vakt_id: string
        }
        Insert: {
          aktivitet_id?: string | null
          client_reference?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kilde?: string | null
          lonnstype?: string | null
          notat?: string | null
          org_id: string
          status?: string | null
          timer: number
          tripletex_entry_id?: number | null
          updated_at?: string
          vakt_id: string
        }
        Update: {
          aktivitet_id?: string | null
          client_reference?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kilde?: string | null
          lonnstype?: string | null
          notat?: string | null
          org_id?: string
          status?: string | null
          timer?: number
          tripletex_entry_id?: number | null
          updated_at?: string
          vakt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vakt_timer_aktivitet_id_fkey"
            columns: ["aktivitet_id"]
            isOneToOne: false
            referencedRelation: "ttx_activity_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_timer_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_timer_vakt_id_fkey"
            columns: ["vakt_id"]
            isOneToOne: false
            referencedRelation: "vakt"
            referencedColumns: ["id"]
          },
        ]
      }
      vakt_vedlegg: {
        Row: {
          created_at: string
          created_by: string | null
          file_size: number | null
          filnavn: string
          id: string
          mime_type: string | null
          org_id: string
          storage_path: string
          vakt_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          filnavn: string
          id?: string
          mime_type?: string | null
          org_id: string
          storage_path: string
          vakt_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          filnavn?: string
          id?: string
          mime_type?: string | null
          org_id?: string
          storage_path?: string
          vakt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vakt_vedlegg_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_vedlegg_vakt_id_fkey"
            columns: ["vakt_id"]
            isOneToOne: false
            referencedRelation: "vakt"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_client_reference: {
        Args: { org_uuid: string; timer_uuid: string }
        Returns: string
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
