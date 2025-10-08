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
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          org_id: string
          provider: string
          provider_response: Json | null
          recipient_email: string
          recipient_name: string | null
          reminder_type: string | null
          sent_at: string
          status: string
          subject: string
          template_type: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          org_id: string
          provider?: string
          provider_response?: Json | null
          recipient_email: string
          recipient_name?: string | null
          reminder_type?: string | null
          sent_at?: string
          status: string
          subject: string
          template_type: string
          triggered_by: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          org_id?: string
          provider?: string
          provider_response?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          reminder_type?: string | null
          sent_at?: string
          status?: string
          subject?: string
          template_type?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          api_key: string
          created_at: string
          from_email: string
          from_name: string
          id: string
          is_active: boolean
          last_tested_at: string | null
          org_id: string
          provider: string
          site_url: string
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_username: string | null
          test_error_message: string | null
          test_status: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          from_email: string
          from_name?: string
          id?: string
          is_active?: boolean
          last_tested_at?: string | null
          org_id: string
          provider?: string
          site_url?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          test_error_message?: string | null
          test_status?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          from_email?: string
          from_name?: string
          id?: string
          is_active?: boolean
          last_tested_at?: string | null
          org_id?: string
          provider?: string
          site_url?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          test_error_message?: string | null
          test_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string
          created_at: string
          id: string
          org_id: string
          subject: string
          template_type: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string
          id?: string
          org_id: string
          subject: string
          template_type: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string
          id?: string
          org_id?: string
          subject?: string
          template_type?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["org_id"]
          },
        ]
      }
      frie_bobler: {
        Row: {
          color: string
          created_at: string | null
          created_by: string | null
          date: string
          display_order: number
          frie_linje_id: string
          id: string
          text: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          date: string
          display_order?: number
          frie_linje_id: string
          id?: string
          text: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          display_order?: number
          frie_linje_id?: string
          id?: string
          text?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frie_bobler_frie_linje_id_fkey"
            columns: ["frie_linje_id"]
            isOneToOne: false
            referencedRelation: "frie_linjer"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_code_uses: {
        Row: {
          id: string
          invite_code_id: string
          ip_address: string | null
          used_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          invite_code_id: string
          ip_address?: string | null
          used_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          invite_code_id?: string
          ip_address?: string | null
          used_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_uses_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          current_uses: number
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          metadata: Json | null
          org_id: string
          role: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          current_uses?: number
          expires_at: string
          id?: string
          is_active?: boolean
          max_uses?: number
          metadata?: Json | null
          org_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          current_uses?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number
          metadata?: Json | null
          org_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      frie_linjer: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_order: number
          id: string
          name: string | null
          org_id: string
          updated_at: string | null
          updated_by: string | null
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          id?: string
          name?: string | null
          org_id: string
          updated_at?: string | null
          updated_by?: string | null
          week_number: number
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          id?: string
          name?: string | null
          org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "frie_linjer_org_id_fkey"
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
      kalender_dag: {
        Row: {
          dato: string
          holiday_name: string | null
          is_holiday: boolean
          is_weekend: boolean
          iso_ar: number
          iso_uke: number
        }
        Insert: {
          dato: string
          holiday_name?: string | null
          is_holiday?: boolean
          is_weekend?: boolean
          iso_ar: number
          iso_uke: number
        }
        Update: {
          dato?: string
          holiday_name?: string | null
          is_holiday?: boolean
          is_weekend?: boolean
          iso_ar?: number
          iso_uke?: number
        }
        Relationships: []
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
      project_color: {
        Row: {
          hex: string
          org_id: string
          tripletex_project_id: number
          updated_at: string
        }
        Insert: {
          hex: string
          org_id: string
          tripletex_project_id: number
          updated_at?: string
        }
        Update: {
          hex?: string
          org_id?: string
          tripletex_project_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_color_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_settings: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payroll_day_of_month: number
          payroll_days_before: number
          payroll_enabled: boolean
          send_to_all: boolean
          updated_at: string
          weekly_day: number
          weekly_enabled: boolean
          weekly_time: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payroll_day_of_month?: number
          payroll_days_before?: number
          payroll_enabled?: boolean
          send_to_all?: boolean
          updated_at?: string
          weekly_day?: number
          weekly_enabled?: boolean
          weekly_time?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payroll_day_of_month?: number
          payroll_days_before?: number
          payroll_enabled?: boolean
          send_to_all?: boolean
          updated_at?: string
          weekly_day?: number
          weekly_enabled?: boolean
          weekly_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_settings_org_id_fkey"
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
          approved_at: string | null
          approved_by: string | null
          client_reference: string | null
          created_at: string
          created_by: string | null
          id: string
          is_overtime: boolean | null
          kilde: string | null
          lonnstype: string | null
          notat: string | null
          org_id: string
          original_aktivitet_id: string | null
          original_notat: string | null
          original_status: string | null
          original_timer: number | null
          overtime_aktivitet_id: string | null
          overtime_type: string | null
          status: string | null
          sync_error: string | null
          timer: number
          tripletex_entry_id: number | null
          tripletex_synced_at: string | null
          updated_at: string
          vakt_id: string
        }
        Insert: {
          aktivitet_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_reference?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_overtime?: boolean | null
          kilde?: string | null
          lonnstype?: string | null
          notat?: string | null
          org_id: string
          original_aktivitet_id?: string | null
          original_notat?: string | null
          original_status?: string | null
          original_timer?: number | null
          overtime_aktivitet_id?: string | null
          overtime_type?: string | null
          status?: string | null
          sync_error?: string | null
          timer: number
          tripletex_entry_id?: number | null
          tripletex_synced_at?: string | null
          updated_at?: string
          vakt_id: string
        }
        Update: {
          aktivitet_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_reference?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_overtime?: boolean | null
          kilde?: string | null
          lonnstype?: string | null
          notat?: string | null
          org_id?: string
          original_aktivitet_id?: string | null
          original_notat?: string | null
          original_status?: string | null
          original_timer?: number | null
          overtime_aktivitet_id?: string | null
          overtime_type?: string | null
          status?: string | null
          sync_error?: string | null
          timer?: number
          tripletex_entry_id?: number | null
          tripletex_synced_at?: string | null
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
            foreignKeyName: "vakt_timer_original_aktivitet_id_fkey"
            columns: ["original_aktivitet_id"]
            isOneToOne: false
            referencedRelation: "ttx_activity_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vakt_timer_overtime_aktivitet_id_fkey"
            columns: ["overtime_aktivitet_id"]
            isOneToOne: false
            referencedRelation: "ttx_activity_cache"
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
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      validate_and_use_invite_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: {
          valid: boolean
          org_id: string | null
          org_name: string | null
          role: string | null
          error_message: string | null
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
