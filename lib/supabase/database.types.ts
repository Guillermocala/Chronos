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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      backup_runs: {
        Row: {
          commit_sha: string | null
          created_at: string
          deleted_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          mode: Database["public"]["Enums"]["backup_mode"]
          projects_exported: number
          projects_skipped: number
          started_at: string
          status: Database["public"]["Enums"]["backup_status"]
          summary_md: string | null
          trigger: Database["public"]["Enums"]["backup_trigger"]
          updated_at: string
          user_id: string
        }
        Insert: {
          commit_sha?: string | null
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode: Database["public"]["Enums"]["backup_mode"]
          projects_exported?: number
          projects_skipped?: number
          started_at?: string
          status?: Database["public"]["Enums"]["backup_status"]
          summary_md?: string | null
          trigger: Database["public"]["Enums"]["backup_trigger"]
          updated_at?: string
          user_id: string
        }
        Update: {
          commit_sha?: string | null
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["backup_mode"]
          projects_exported?: number
          projects_skipped?: number
          started_at?: string
          status?: Database["public"]["Enums"]["backup_status"]
          summary_md?: string | null
          trigger?: Database["public"]["Enums"]["backup_trigger"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_notes: {
        Row: {
          attendees: string[]
          content_md: string
          created_at: string
          deleted_at: string | null
          id: string
          meeting_date: string
          project_id: string | null
          source: Database["public"]["Enums"]["note_source"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendees?: string[]
          content_md: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          meeting_date?: string
          project_id?: string | null
          source?: Database["public"]["Enums"]["note_source"]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          attendees?: string[]
          content_md?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          meeting_date?: string
          project_id?: string | null
          source?: Database["public"]["Enums"]["note_source"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      note_action_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          note_id: string
          position: number
          status: Database["public"]["Enums"]["action_item_status"]
          text: string
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          note_id: string
          position?: number
          status?: Database["public"]["Enums"]["action_item_status"]
          text: string
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          note_id?: string
          position?: number
          status?: Database["public"]["Enums"]["action_item_status"]
          text?: string
          ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_action_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_action_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cop: number
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          note: string | null
          paid_at: string | null
          project_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cop: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          note?: string | null
          paid_at?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_cop?: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          note?: string | null
          paid_at?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          client: string | null
          code_prefix: string
          color: string | null
          contract_months: number | null
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          drive_folder_url: string | null
          end_date: string | null
          estimated_total_hours: number | null
          expected_hours_per_month: number | null
          fixed_amount_cop: number | null
          id: string
          monthly_fee_cop: number | null
          name: string
          phase: Database["public"]["Enums"]["project_phase"]
          start_date: string | null
          support_days: number
          support_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          client?: string | null
          code_prefix: string
          color?: string | null
          contract_months?: number | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          drive_folder_url?: string | null
          end_date?: string | null
          estimated_total_hours?: number | null
          expected_hours_per_month?: number | null
          fixed_amount_cop?: number | null
          id?: string
          monthly_fee_cop?: number | null
          name: string
          phase?: Database["public"]["Enums"]["project_phase"]
          start_date?: string | null
          support_days?: number
          support_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          client?: string | null
          code_prefix?: string
          color?: string | null
          contract_months?: number | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          drive_folder_url?: string | null
          end_date?: string | null
          estimated_total_hours?: number | null
          expected_hours_per_month?: number | null
          fixed_amount_cop?: number | null
          id?: string
          monthly_fee_cop?: number | null
          name?: string
          phase?: Database["public"]["Enums"]["project_phase"]
          start_date?: string | null
          support_days?: number
          support_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sprints: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string
          goal: string | null
          id: string
          is_support: boolean
          name: string
          project_id: string
          start_date: string
          updated_at: string
          user_id: string
          value_cop_override: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date: string
          goal?: string | null
          id?: string
          is_support?: boolean
          name: string
          project_id: string
          start_date: string
          updated_at?: string
          user_id?: string
          value_cop_override?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          goal?: string | null
          id?: string
          is_support?: boolean
          name?: string
          project_id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
          value_cop_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          billable: boolean
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          doc_kind: Database["public"]["Enums"]["doc_kind"] | null
          doc_url: string | null
          done_at: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          number: number
          position: number
          priority: number
          project_id: string
          source_note_id: string | null
          sprint_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          doc_kind?: Database["public"]["Enums"]["doc_kind"] | null
          doc_url?: string | null
          done_at?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          number: number
          position?: number
          priority?: number
          project_id: string
          source_note_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          billable?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          doc_kind?: Database["public"]["Enums"]["doc_kind"] | null
          doc_url?: string | null
          done_at?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          number?: number
          position?: number
          priority?: number
          project_id?: string
          source_note_id?: string | null
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          hours: number | null
          id: string
          note: string | null
          started_at: string
          ticket_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          hours?: number | null
          id?: string
          note?: string | null
          started_at?: string
          ticket_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          hours?: number | null
          id?: string
          note?: string | null
          started_at?: string
          ticket_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ping: { Args: never; Returns: string }
    }
    Enums: {
      action_item_status: "pending" | "converted" | "dismissed"
      backup_mode: "incremental" | "full"
      backup_status: "running" | "success" | "failed"
      backup_trigger: "scheduled" | "manual"
      billing_type: "fixed" | "retainer"
      doc_kind: "doc" | "sheet" | "slides" | "folder" | "file"
      note_source: "granola" | "manual"
      payment_kind: "advance" | "partial" | "final" | "monthly" | "extra"
      payment_status: "expected" | "received"
      project_phase: "active" | "delivered" | "support" | "closed"
      ticket_kind: "scope" | "support" | "extra"
      ticket_status: "backlog" | "todo" | "in_progress" | "review" | "done"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      action_item_status: ["pending", "converted", "dismissed"],
      backup_mode: ["incremental", "full"],
      backup_status: ["running", "success", "failed"],
      backup_trigger: ["scheduled", "manual"],
      billing_type: ["fixed", "retainer"],
      doc_kind: ["doc", "sheet", "slides", "folder", "file"],
      note_source: ["granola", "manual"],
      payment_kind: ["advance", "partial", "final", "monthly", "extra"],
      payment_status: ["expected", "received"],
      project_phase: ["active", "delivered", "support", "closed"],
      ticket_kind: ["scope", "support", "extra"],
      ticket_status: ["backlog", "todo", "in_progress", "review", "done"],
    },
  },
} as const
