export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      plantegninger: {
        Row: {
          id: string
          befaring_id: string
          title: string
          image_url: string
          display_order: number
          created_at: string | null
          file_type: string | null
          original_width: number | null
          original_height: number | null
          rotation: number | null
        }
        Insert: {
          id?: string
          befaring_id: string
          title: string
          image_url: string
          display_order: number
          created_at?: string | null
          file_type?: string | null
          original_width?: number | null
          original_height?: number | null
          rotation?: number | null
        }
        Update: {
          id?: string
          befaring_id?: string
          title?: string
          image_url?: string
          display_order?: number
          created_at?: string | null
          file_type?: string | null
          original_width?: number | null
          original_height?: number | null
          rotation?: number | null
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          role: string | null
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name?: string | null
          role?: string | null
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string | null
          role?: string | null
          org_id?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

