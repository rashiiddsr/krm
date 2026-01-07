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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'sales'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'sales'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'sales'
          created_at?: string
          updated_at?: string
        }
      }
      prospects: {
        Row: {
          id: string
          nama: string
          no_hp: string
          alamat: string
          kebutuhan: string
          status: 'menunggu_follow_up' | 'dalam_follow_up' | 'selesai'
          sales_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nama: string
          no_hp: string
          alamat: string
          kebutuhan: string
          status?: 'menunggu_follow_up' | 'dalam_follow_up' | 'selesai'
          sales_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nama?: string
          no_hp?: string
          alamat?: string
          kebutuhan?: string
          status?: 'menunggu_follow_up' | 'dalam_follow_up' | 'selesai'
          sales_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      follow_ups: {
        Row: {
          id: string
          prospect_id: string
          assigned_by: string
          assigned_to: string
          scheduled_date: string
          status: 'pending' | 'in_progress' | 'completed' | 'rescheduled'
          notes: string
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          prospect_id: string
          assigned_by: string
          assigned_to: string
          scheduled_date: string
          status?: 'pending' | 'in_progress' | 'completed' | 'rescheduled'
          notes?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prospect_id?: string
          assigned_by?: string
          assigned_to?: string
          scheduled_date?: string
          status?: 'pending' | 'in_progress' | 'completed' | 'rescheduled'
          notes?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'new_prospect' | 'follow_up_assigned' | 'follow_up_updated'
          title: string
          message: string
          reference_id: string
          reference_type: 'prospect' | 'follow_up'
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'new_prospect' | 'follow_up_assigned' | 'follow_up_updated'
          title: string
          message: string
          reference_id: string
          reference_type: 'prospect' | 'follow_up'
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'new_prospect' | 'follow_up_assigned' | 'follow_up_updated'
          title?: string
          message?: string
          reference_id?: string
          reference_type?: 'prospect' | 'follow_up'
          is_read?: boolean
          created_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Prospect = Database['public']['Tables']['prospects']['Row'];
export type FollowUp = Database['public']['Tables']['follow_ups']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
