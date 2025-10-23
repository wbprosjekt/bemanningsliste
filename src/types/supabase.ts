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
      audit_events: {
        Row: {
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          org_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          org_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          org_id: string | null
          request_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string | null
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
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
      befaring_oppgave_svar: {
        Row: {
          befaring_oppgave_id: string
          created_at: string | null
          id: string
          svar_fra_epost: string
          svar_fra_navn: string | null
          svar_text: string
          token_id: string | null
          vedlegg_urls: string[] | null
        }
        Insert: {
          befaring_oppgave_id: string
          created_at?: string | null
          id?: string
          svar_fra_epost: string
          svar_fra_navn?: string | null
          svar_text: string
          token_id?: string | null
          vedlegg_urls?: string[] | null
        }
        Update: {
          befaring_oppgave_id?: string
          created_at?: string | null
          id?: string
          svar_fra_epost?: string
          svar_fra_navn?: string | null
          svar_text?: string
          token_id?: string | null
          vedlegg_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "befaring_oppgave_svar_befaring_oppgave_id_fkey"
            columns: ["befaring_oppgave_id"]
            isOneToOne: false
            referencedRelation: "befaring_oppgaver"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "befaring_oppgave_svar_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "befaring_oppgave_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      befaring_oppgave_tokens: {
        Row: {
          befaring_oppgave_id: string
          created_at: string | null
          expires_at: string
          id: string
          scope: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          befaring_oppgave_id: string
          created_at?: string | null
          expires_at?: string
          id?: string
          scope?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          befaring_oppgave_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          scope?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "befaring_oppgave_tokens_befaring_oppgave_id_fkey"
            columns: ["befaring_oppgave_id"]
            isOneToOne: false
            referencedRelation: "befaring_oppgaver"
            referencedColumns: ["id"]
          },
        ]
      }
      befaring_oppgaver: {
        Row: {
          ansvarlig_person_id: string | null
          befaring_punkt_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          epost_sendt: boolean | null
          epost_sendt_at: string | null
          frist: string | null
          id: string
          prioritet: string | null
          status: string | null
          title: string
          underleverandor_id: string | null
          updated_at: string | null
        }
        Insert: {
          ansvarlig_person_id?: string | null
          befaring_punkt_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          epost_sendt?: boolean | null
          epost_sendt_at?: string | null
          frist?: string | null
          id?: string
          prioritet?: string | null
          status?: string | null
          title: string
          underleverandor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ansvarlig_person_id?: string | null
          befaring_punkt_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          epost_sendt?: boolean | null
          epost_sendt_at?: string | null
          frist?: string | null
          id?: string
          prioritet?: string | null
          status?: string | null
          title?: string
          underleverandor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "befaring_oppgaver_ansvarlig_person_id_fkey"
            columns: ["ansvarlig_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "befaring_oppgaver_befaring_punkt_id_fkey"
            columns: ["befaring_punkt_id"]
            isOneToOne: false
            referencedRelation: "befaring_punkter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "befaring_oppgaver_underleverandor_id_fkey"
            columns: ["underleverandor_id"]
            isOneToOne: false
            referencedRelation: "underleverandorer"
            referencedColumns: ["id"]
          },
        ]
      }
      befaring_punkter: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          fag: string | null
          fri_befaring_id: string
          frist: string | null
          id: string
          prioritet: string | null
          punkt_nummer: number
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fag?: string | null
          fri_befaring_id: string
          frist?: string | null
          id?: string
          prioritet?: string | null
          punkt_nummer: number
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fag?: string | null
          fri_befaring_id?: string
          frist?: string | null
          id?: string
          prioritet?: string | null
          punkt_nummer?: number
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "befaring_punkter_fri_befaring_id_fkey"
            columns: ["fri_befaring_id"]
            isOneToOne: false
            referencedRelation: "fri_befaringer"
            referencedColumns: ["id"]
          },
        ]
      }
      befaring_signaturer: {
        Row: {
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          fri_befaring_id: string
          id: string
          signatur_data: string
          signatur_dato: string | null
          signatur_navn: string
          signatur_png_url: string | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          fri_befaring_id: string
          id?: string
          signatur_data: string
          signatur_dato?: string | null
          signatur_navn: string
          signatur_png_url?: string | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          fri_befaring_id?: string
          id?: string
          signatur_data?: string
          signatur_dato?: string | null
          signatur_navn?: string
          signatur_png_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "befaring_signaturer_fri_befaring_id_fkey"
            columns: ["fri_befaring_id"]
            isOneToOne: false
            referencedRelation: "fri_befaringer"
            referencedColumns: ["id"]
          },
        ]
      }
      befaring_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          fri_befaring_id: string
          id: string
          payload: Json
          version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          fri_befaring_id: string
          id?: string
          payload: Json
          version: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          fri_befaring_id?: string
          id?: string
          payload?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "befaring_versions_fri_befaring_id_fkey"
            columns: ["fri_befaring_id"]
            isOneToOne: false
            referencedRelation: "fri_befaringer"
            referencedColumns: ["id"]
          },
        ]
      }
      befaringer: {
        Row: {
          adresse: string | null
          befaring_date: string
          befaring_type: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          org_id: string
          postnummer: string | null
          rapport_mottakere: Json | null
          signatur_dato: string | null
          signatur_navn: string | null
          signatur_rolle: string | null
          status: string | null
          sted: string | null
          title: string
          tripletex_project_id: number | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          befaring_date: string
          befaring_type?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          org_id: string
          postnummer?: string | null
          rapport_mottakere?: Json | null
          signatur_dato?: string | null
          signatur_navn?: string | null
          signatur_rolle?: string | null
          status?: string | null
          sted?: string | null
          title: string
          tripletex_project_id?: number | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          befaring_date?: string
          befaring_type?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          org_id?: string
          postnummer?: string | null
          rapport_mottakere?: Json | null
          signatur_dato?: string | null
          signatur_navn?: string | null
          signatur_rolle?: string | null
          status?: string | null
          sted?: string | null
          title?: string
          tripletex_project_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "befaringer_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "befaringer_tripletex_project_id_fkey"
            columns: ["tripletex_project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["tripletex_project_id"]
          },
          {
            foreignKeyName: "befaringer_tripletex_project_id_fkey"
            columns: ["tripletex_project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["tripletex_project_id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          org_id: string
          provider: string
          provider_response: Json | null
          recipient_email: string
          recipient_name: string | null
          reminder_type: string | null
          sent_at: string | null
          status: string
          subject: string
          template_type: string
          triggered_by: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          org_id: string
          provider?: string
          provider_response?: Json | null
          recipient_email: string
          recipient_name?: string | null
          reminder_type?: string | null
          sent_at?: string | null
          status: string
          subject: string
          template_type: string
          triggered_by: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          org_id?: string
          provider?: string
          provider_response?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          reminder_type?: string | null
          sent_at?: string | null
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
          created_at: string | null
          from_email: string
          from_name: string
          id: string
          is_active: boolean | null
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
          updated_at: string | null
        }
        Insert: {
          api_key: string
          created_at?: string | null
          from_email: string
          from_name?: string
          id?: string
          is_active?: boolean | null
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
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string | null
          from_email?: string
          from_name?: string
          id?: string
          is_active?: boolean | null
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
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string
          created_at: string | null
          id: string
          org_id: string
          subject: string
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string | null
          id?: string
          org_id: string
          subject: string
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string | null
          id?: string
          org_id?: string
          subject?: string
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      fri_befaringer: {
        Row: {
          befaring_date: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          parent_befaring_id: string | null
          reopen_reason: string | null
          status: string | null
          title: string
          tripletex_project_id: number | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          befaring_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          parent_befaring_id?: string | null
          reopen_reason?: string | null
          status?: string | null
          title: string
          tripletex_project_id?: number | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          befaring_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          parent_befaring_id?: string | null
          reopen_reason?: string | null
          status?: string | null
          title?: string
          tripletex_project_id?: number | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fri_befaringer_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fri_befaringer_parent_befaring_id_fkey"
            columns: ["parent_befaring_id"]
            isOneToOne: false
            referencedRelation: "fri_befaringer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fri_befaringer_tripletex_project_id_fkey"
            columns: ["tripletex_project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["tripletex_project_id"]
          },
          {
            foreignKeyName: "fri_befaringer_tripletex_project_id_fkey"
            columns: ["tripletex_project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["tripletex_project_id"]
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
            foreignKeyName: "invite_codes_org_id_fkey"
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
      notifikasjoner: {
        Row: {
          bruker_id: string
          created_at: string | null
          id: string
          lest: boolean | null
          melding: string
          oppgave_id: string | null
          type: string
        }
        Insert: {
          bruker_id: string
          created_at?: string | null
          id?: string
          lest?: boolean | null
          melding: string
          oppgave_id?: string | null
          type: string
        }
        Update: {
          bruker_id?: string
          created_at?: string | null
          id?: string
          lest?: boolean | null
          melding?: string
          oppgave_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifikasjoner_oppgave_id_fkey"
            columns: ["oppgave_id"]
            isOneToOne: false
            referencedRelation: "oppgaver"
            referencedColumns: ["id"]
          },
        ]
      }
      oppgave_bilder: {
        Row: {
          befaring_punkt_id: string | null
          comment: string | null
          created_at: string | null
          file_format: string | null
          file_size_bytes: number | null
          id: string
          image_source: string | null
          image_type: string | null
          image_url: string
          inbox_date: string | null
          is_optimized: boolean | null
          is_tagged: boolean | null
          oppgave_id: string | null
          original_height: number | null
          original_width: number | null
          prosjekt_id: string | null
          storage_path: string | null
          tagged_at: string | null
          tagged_by: string | null
          thumbnail_1024_path: string | null
          thumbnail_2048_path: string | null
          uploaded_by: string | null
          uploaded_by_email: string | null
        }
        Insert: {
          befaring_punkt_id?: string | null
          comment?: string | null
          created_at?: string | null
          file_format?: string | null
          file_size_bytes?: number | null
          id?: string
          image_source?: string | null
          image_type?: string | null
          image_url: string
          inbox_date?: string | null
          is_optimized?: boolean | null
          is_tagged?: boolean | null
          oppgave_id?: string | null
          original_height?: number | null
          original_width?: number | null
          prosjekt_id?: string | null
          storage_path?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          thumbnail_1024_path?: string | null
          thumbnail_2048_path?: string | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Update: {
          befaring_punkt_id?: string | null
          comment?: string | null
          created_at?: string | null
          file_format?: string | null
          file_size_bytes?: number | null
          id?: string
          image_source?: string | null
          image_type?: string | null
          image_url?: string
          inbox_date?: string | null
          is_optimized?: boolean | null
          is_tagged?: boolean | null
          oppgave_id?: string | null
          original_height?: number | null
          original_width?: number | null
          prosjekt_id?: string | null
          storage_path?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          thumbnail_1024_path?: string | null
          thumbnail_2048_path?: string | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oppgave_bilder_befaring_punkt_id_fkey"
            columns: ["befaring_punkt_id"]
            isOneToOne: false
            referencedRelation: "befaring_punkter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgave_bilder_oppgave_id_fkey"
            columns: ["oppgave_id"]
            isOneToOne: false
            referencedRelation: "oppgaver"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgave_bilder_prosjekt_id_fkey"
            columns: ["prosjekt_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "oppgave_bilder_prosjekt_id_fkey"
            columns: ["prosjekt_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "oppgave_bilder_prosjekt_id_fkey"
            columns: ["prosjekt_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "oppgave_bilder_prosjekt_id_fkey"
            columns: ["prosjekt_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgave_bilder_prosjekt_id_fkey"
            columns: ["prosjekt_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      oppgave_epost_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          oppgave_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          oppgave_id: string
          token?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          oppgave_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "oppgave_epost_tokens_oppgave_id_fkey"
            columns: ["oppgave_id"]
            isOneToOne: false
            referencedRelation: "oppgaver"
            referencedColumns: ["id"]
          },
        ]
      }
      oppgave_historikk: {
        Row: {
          endret_at: string | null
          endret_av: string
          felt_navn: string
          gammel_verdi: string | null
          id: string
          ny_verdi: string | null
          oppgave_id: string
        }
        Insert: {
          endret_at?: string | null
          endret_av: string
          felt_navn: string
          gammel_verdi?: string | null
          id?: string
          ny_verdi?: string | null
          oppgave_id: string
        }
        Update: {
          endret_at?: string | null
          endret_av?: string
          felt_navn?: string
          gammel_verdi?: string | null
          id?: string
          ny_verdi?: string | null
          oppgave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oppgave_historikk_oppgave_id_fkey"
            columns: ["oppgave_id"]
            isOneToOne: false
            referencedRelation: "oppgaver"
            referencedColumns: ["id"]
          },
        ]
      }
      oppgave_kommentarer: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          kommentar: string
          oppgave_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          kommentar: string
          oppgave_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          kommentar?: string
          oppgave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oppgave_kommentarer_oppgave_id_fkey"
            columns: ["oppgave_id"]
            isOneToOne: false
            referencedRelation: "oppgaver"
            referencedColumns: ["id"]
          },
        ]
      }
      oppgaver: {
        Row: {
          ansvarlig_person_id: string | null
          befaring_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          epost_sendt: boolean | null
          epost_sendt_at: string | null
          fag: string
          fag_color: string
          frist: string | null
          id: string
          oppgave_nummer: number
          plantegning_id: string | null
          prioritet: string | null
          project_id: string | null
          status: string | null
          title: string | null
          underleverandor_id: string | null
          updated_at: string | null
          x_normalized: number | null
          x_position: number
          y_normalized: number | null
          y_position: number
        }
        Insert: {
          ansvarlig_person_id?: string | null
          befaring_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          epost_sendt?: boolean | null
          epost_sendt_at?: string | null
          fag: string
          fag_color?: string
          frist?: string | null
          id?: string
          oppgave_nummer: number
          plantegning_id?: string | null
          prioritet?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
          underleverandor_id?: string | null
          updated_at?: string | null
          x_normalized?: number | null
          x_position: number
          y_normalized?: number | null
          y_position: number
        }
        Update: {
          ansvarlig_person_id?: string | null
          befaring_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          epost_sendt?: boolean | null
          epost_sendt_at?: string | null
          fag?: string
          fag_color?: string
          frist?: string | null
          id?: string
          oppgave_nummer?: number
          plantegning_id?: string | null
          prioritet?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
          underleverandor_id?: string | null
          updated_at?: string | null
          x_normalized?: number | null
          x_position?: number
          y_normalized?: number | null
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "oppgaver_ansvarlig_person_id_fkey"
            columns: ["ansvarlig_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_befaring_id_fkey"
            columns: ["befaring_id"]
            isOneToOne: false
            referencedRelation: "befaringer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_plantegning_id_fkey"
            columns: ["plantegning_id"]
            isOneToOne: false
            referencedRelation: "plantegninger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "oppgaver_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "oppgaver_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "oppgaver_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_underleverandor_id_fkey"
            columns: ["underleverandor_id"]
            isOneToOne: false
            referencedRelation: "underleverandorer"
            referencedColumns: ["id"]
          },
        ]
      }
      org: {
        Row: {
          created_at: string
          id: string
          modules: string[] | null
          name: string
          org_nr: string | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          modules?: string[] | null
          name: string
          org_nr?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          modules?: string[] | null
          name?: string
          org_nr?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      org_favorite_projects: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          org_id: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_favorite_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "org_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "org_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "org_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "person_prosjekt_pref_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "person_prosjekt_pref_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "person_prosjekt_pref_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
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
      plantegninger: {
        Row: {
          befaring_id: string
          created_at: string | null
          display_order: number
          file_type: string | null
          id: string
          image_url: string
          original_height: number | null
          original_width: number | null
          rotation: number | null
          title: string
        }
        Insert: {
          befaring_id: string
          created_at?: string | null
          display_order?: number
          file_type?: string | null
          id?: string
          image_url: string
          original_height?: number | null
          original_width?: number | null
          rotation?: number | null
          title: string
        }
        Update: {
          befaring_id?: string
          created_at?: string | null
          display_order?: number
          file_type?: string | null
          id?: string
          image_url?: string
          original_height?: number | null
          original_width?: number | null
          rotation?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantegninger_befaring_id_fkey"
            columns: ["befaring_id"]
            isOneToOne: false
            referencedRelation: "befaringer"
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
      project_activity: {
        Row: {
          activity_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          org_id: string | null
          project_id: string | null
          related_id: string | null
          related_type: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          project_id?: string | null
          related_id?: string | null
          related_type?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          project_id?: string | null
          related_id?: string | null
          related_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
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
      project_favorites: {
        Row: {
          created_at: string | null
          id: string
          is_org_favorite: boolean | null
          is_pinned: boolean | null
          org_id: string | null
          project_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_org_favorite?: boolean | null
          is_pinned?: boolean | null
          org_id?: string | null
          project_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_org_favorite?: boolean | null
          is_pinned?: boolean | null
          org_id?: string | null
          project_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_favorites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          identifier: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          identifier: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          identifier?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          org_id: string
          recipients_count: number | null
          reminder_type: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          recipients_count?: number | null
          reminder_type: string
          sent_at?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          recipients_count?: number | null
          reminder_type?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_settings: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          payroll_day_of_month: number | null
          payroll_days_before: number | null
          payroll_enabled: boolean | null
          send_to_all: boolean | null
          updated_at: string | null
          weekly_day: number | null
          weekly_enabled: boolean | null
          weekly_time: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          payroll_day_of_month?: number | null
          payroll_days_before?: number | null
          payroll_enabled?: boolean | null
          send_to_all?: boolean | null
          updated_at?: string | null
          weekly_day?: number | null
          weekly_enabled?: boolean | null
          weekly_time?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          payroll_day_of_month?: number | null
          payroll_days_before?: number | null
          payroll_enabled?: boolean | null
          send_to_all?: boolean | null
          updated_at?: string | null
          weekly_day?: number | null
          weekly_enabled?: boolean | null
          weekly_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      secrets: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
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
      tripletex_sync_state: {
        Row: {
          checksum: string | null
          created_at: string | null
          id: string
          last_modified: string | null
          last_synced: string | null
          org_id: string
          resource_id: string
          resource_type: string
          tripletex_checksum: string | null
          tripletex_last_modified: string | null
          updated_at: string | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string | null
          id?: string
          last_modified?: string | null
          last_synced?: string | null
          org_id: string
          resource_id: string
          resource_type: string
          tripletex_checksum?: string | null
          tripletex_last_modified?: string | null
          updated_at?: string | null
        }
        Update: {
          checksum?: string | null
          created_at?: string | null
          id?: string
          last_modified?: string | null
          last_synced?: string | null
          org_id?: string
          resource_id?: string
          resource_type?: string
          tripletex_checksum?: string | null
          tripletex_last_modified?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tripletex_sync_state_org_id_fkey"
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
          needs_sync: boolean | null
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
          needs_sync?: boolean | null
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
          needs_sync?: boolean | null
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
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_closed: boolean | null
          last_synced: string | null
          needs_sync: boolean | null
          org_id: string
          project_description: string | null
          project_manager_email: string | null
          project_manager_name: string | null
          project_manager_phone: string | null
          project_name: string | null
          project_number: number | null
          start_date: string | null
          tripletex_project_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          last_synced?: string | null
          needs_sync?: boolean | null
          org_id: string
          project_description?: string | null
          project_manager_email?: string | null
          project_manager_name?: string | null
          project_manager_phone?: string | null
          project_name?: string | null
          project_number?: number | null
          start_date?: string | null
          tripletex_project_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          last_synced?: string | null
          needs_sync?: boolean | null
          org_id?: string
          project_description?: string | null
          project_manager_email?: string | null
          project_manager_name?: string | null
          project_manager_phone?: string | null
          project_name?: string | null
          project_number?: number | null
          start_date?: string | null
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
      user_favorite_projects: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          dashboard_layout: Json | null
          id: string
          last_selected_project: string | null
          preferred_mode: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dashboard_layout?: Json | null
          id?: string
          last_selected_project?: string | null
          preferred_mode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dashboard_layout?: Json | null
          id?: string
          last_selected_project?: string | null
          preferred_mode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_last_selected_project_fkey"
            columns: ["last_selected_project"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_preferences_last_selected_project_fkey"
            columns: ["last_selected_project"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_preferences_last_selected_project_fkey"
            columns: ["last_selected_project"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_preferences_last_selected_project_fkey"
            columns: ["last_selected_project"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_last_selected_project_fkey"
            columns: ["last_selected_project"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recent_projects: {
        Row: {
          id: string
          last_accessed_at: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_accessed_at?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_accessed_at?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recent_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_recent_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_recent_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_recent_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recent_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ttx_project_cache"
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
            referencedRelation: "project_activity_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vakt_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vakt_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_photo_inbox"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vakt_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_stats"
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
      entity_audit_history: {
        Row: {
          action: string | null
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          ip_address: unknown
          user_name: string | null
          user_role: string | null
        }
        Relationships: []
      }
      project_activity_summary: {
        Row: {
          activity_score: number | null
          customer_name: string | null
          is_active: boolean | null
          last_activity_date: string | null
          last_befaring_date: string | null
          last_image_date: string | null
          last_task_date: string | null
          old_tasks: number | null
          open_tasks: number | null
          org_id: string | null
          planned_befaringer: number | null
          project_id: string | null
          project_name: string | null
          project_number: number | null
          recent_images: number | null
          total_befaringer: number | null
          tripletex_project_id: number | null
          untagged_images: number | null
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
      project_alerts: {
        Row: {
          alert_level: string | null
          critical_old_tasks: number | null
          org_id: string | null
          project_id: string | null
          project_name: string | null
          project_number: number | null
          untagged_images: number | null
          upcoming_befaringer: number | null
          warning_old_tasks: number | null
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
      project_photo_inbox: {
        Row: {
          images: Json[] | null
          org_id: string | null
          project_id: string | null
          project_name: string | null
          project_number: number | null
          untagged_count: number | null
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
      project_stats: {
        Row: {
          befaring_count: number | null
          id: string | null
          is_active: boolean | null
          last_activity: string | null
          open_oppgave_count: number | null
          project_name: string | null
          project_number: number | null
          total_oppgave_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: number }
      cleanup_old_tripletex_sync_state: { Args: never; Returns: undefined }
      create_befaring_snapshot: {
        Args: { fri_befaring_id: string }
        Returns: string
      }
      decrypt_token: { Args: { encrypted: string }; Returns: string }
      encrypt_token: { Args: { token: string }; Returns: string }
      generate_client_reference: {
        Args: { org_uuid: string; timer_uuid: string }
        Returns: string
      }
      generate_invite_code: { Args: never; Returns: string }
      get_befaring_punkt_image_count: {
        Args: { punkt_id: string }
        Returns: number
      }
      get_oppgave_image_count: { Args: { oppgave_id: string }; Returns: number }
      get_org_favorite_projects: {
        Args: never
        Returns: {
          befaring_count: number
          created_by_name: string
          favorited_at: string
          is_active: boolean
          last_activity: string
          open_oppgave_count: number
          project_id: string
          project_name: string
          project_number: number
        }[]
      }
      get_tripletex_checksum: {
        Args: {
          p_org_id: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: string
      }
      get_user_favorite_projects: {
        Args: never
        Returns: {
          befaring_count: number
          favorited_at: string
          is_active: boolean
          last_activity: string
          open_oppgave_count: number
          project_id: string
          project_name: string
          project_number: number
        }[]
      }
      get_user_org_id: { Args: never; Returns: string }
      get_user_recent_projects: {
        Args: { limit_count?: number }
        Returns: {
          befaring_count: number
          is_active: boolean
          last_accessed_at: string
          last_activity: string
          open_oppgave_count: number
          project_id: string
          project_name: string
          project_number: number
        }[]
      }
      is_token_encrypted: { Args: { token: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_ip_address?: unknown
          p_new_data?: Json
          p_old_data?: Json
          p_org_id: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      update_recent_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      update_tripletex_sync_state: {
        Args: {
          p_checksum?: string
          p_last_modified?: string
          p_org_id: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: undefined
      }
      validate_and_use_invite_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: {
          error_message: string
          org_id: string
          org_name: string
          role: string
          valid: boolean
        }[]
      }
      validate_and_use_token: { Args: { token_text: string }; Returns: string }
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
