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
      groups: {
        Row: {
          id: string
          name: string
          default_currency: string
          additional_currency_1: string | null
          additional_currency_2: string | null
          group_code: string
          pin_code: string
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          default_currency: string
          additional_currency_1?: string | null
          additional_currency_2?: string | null
          group_code: string
          pin_code: string
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          default_currency?: string
          additional_currency_1?: string | null
          additional_currency_2?: string | null
          group_code?: string
          pin_code?: string
          owner_id?: string
          created_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          display_name?: string
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          group_id: string
          payer_id: string
          amount: number
          currency: string
          description: string
          date: string
          receipt_url: string | null
          split_type: 'even' | 'percentage' | 'specific'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          payer_id: string
          amount: number
          currency: string
          description: string
          date: string
          receipt_url?: string | null
          split_type: 'even' | 'percentage' | 'specific'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          payer_id?: string
          amount?: number
          currency?: string
          description?: string
          date?: string
          receipt_url?: string | null
          split_type?: 'even' | 'percentage' | 'specific'
          created_at?: string
          updated_at?: string
        }
      }
      expense_splits: {
        Row: {
          id: string
          expense_id: string
          member_id: string
          amount: number
          percentage: number | null
        }
        Insert: {
          id?: string
          expense_id: string
          member_id: string
          amount: number
          percentage?: number | null
        }
        Update: {
          id?: string
          expense_id?: string
          member_id?: string
          amount?: number
          percentage?: number | null
        }
      }
      settlements: {
        Row: {
          id: string
          group_id: string
          sender_id: string
          receiver_id: string
          amount: number
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          sender_id: string
          receiver_id: string
          amount: number
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          sender_id?: string
          receiver_id?: string
          amount?: number
          date?: string
          created_at?: string
        }
      }
    }
  }
}

export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseSplit = Database['public']['Tables']['expense_splits']['Row']
export type Settlement = Database['public']['Tables']['settlements']['Row']

export type SplitType = 'even' | 'percentage' | 'specific'

export interface ExpenseWithDetails extends Expense {
  payer?: GroupMember
  splits?: ExpenseSplit[]
}

export interface Balance {
  member_id: string
  display_name: string
  amount: number
}

export interface MemberBalance {
  from_member_id: string
  from_display_name: string
  to_member_id: string
  to_display_name: string
  amount: number
}
