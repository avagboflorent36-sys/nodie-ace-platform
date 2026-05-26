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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annonces: {
        Row: {
          cohort_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          cohort_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          cohort_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "annonces_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_enrollments: {
        Row: {
          cohort_id: string
          enrolled_at: string
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Insert: {
          cohort_id: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Update: {
          cohort_id?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_payment_schedule: {
        Row: {
          amount: number | null
          cohort_id: string
          created_at: string
          due_offset_days: number
          id: string
          label: string | null
          percent: number | null
          position: number
        }
        Insert: {
          amount?: number | null
          cohort_id: string
          created_at?: string
          due_offset_days?: number
          id?: string
          label?: string | null
          percent?: number | null
          position?: number
        }
        Update: {
          amount?: number | null
          cohort_id?: string
          created_at?: string
          due_offset_days?: number
          id?: string
          label?: string | null
          percent?: number | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "cohort_payment_schedule_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_reminder_rules: {
        Row: {
          channel: string
          cohort_id: string
          created_at: string
          enabled: boolean
          id: string
          offset_days: number
          template_key: string
        }
        Insert: {
          channel?: string
          cohort_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          offset_days?: number
          template_key?: string
        }
        Update: {
          channel?: string
          cohort_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          offset_days?: number
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_reminder_rules_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      cohortes: {
        Row: {
          created_at: string
          end_date: string | null
          formation_id: string
          id: string
          installment_1_deadline_days: number
          installment_2_deadline_days: number
          installment_deadline_days: number
          name: string
          price_full: number | null
          price_installment: number | null
          reminder_days_before: number[]
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["cohort_status"]
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          formation_id: string
          id?: string
          installment_1_deadline_days?: number
          installment_2_deadline_days?: number
          installment_deadline_days?: number
          name: string
          price_full?: number | null
          price_installment?: number | null
          reminder_days_before?: number[]
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["cohort_status"]
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          formation_id?: string
          id?: string
          installment_1_deadline_days?: number
          installment_2_deadline_days?: number
          installment_deadline_days?: number
          name?: string
          price_full?: number | null
          price_installment?: number | null
          reminder_days_before?: number[]
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["cohort_status"]
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohortes_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          cohort_id: string
          created_at: string
          field_type: Database["public"]["Enums"]["form_field_type"]
          id: string
          label: string
          options: Json | null
          position: number
          required: boolean
        }
        Insert: {
          cohort_id: string
          created_at?: string
          field_type: Database["public"]["Enums"]["form_field_type"]
          id?: string
          label: string
          options?: Json | null
          position?: number
          required?: boolean
        }
        Update: {
          cohort_id?: string
          created_at?: string
          field_type?: Database["public"]["Enums"]["form_field_type"]
          id?: string
          label?: string
          options?: Json | null
          position?: number
          required?: boolean
        }
        Relationships: []
      }
      form_responses: {
        Row: {
          answers: Json
          cohort_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          answers?: Json
          cohort_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          answers?: Json
          cohort_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      formation_resources: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          formation_id: string
          id: string
          position: number
          title: string
          type: Database["public"]["Enums"]["resource_type"]
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          formation_id: string
          id?: string
          position?: number
          title: string
          type: Database["public"]["Enums"]["resource_type"]
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          formation_id?: string
          id?: string
          position?: number
          title?: string
          type?: Database["public"]["Enums"]["resource_type"]
          url?: string | null
        }
        Relationships: []
      }
      formations: {
        Row: {
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          duration_weeks: number | null
          id: string
          image_url: string | null
          is_active: boolean
          long_description: string | null
          price_amount: number
          program: Json | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          long_description?: string | null
          price_amount?: number
          program?: Json | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          long_description?: string | null
          price_amount?: number
          program?: Json | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          cohort_id: string
          created_at: string
          description: string | null
          id: string
          meeting_link: string | null
          scheduled_at: string
          title: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          description?: string | null
          id?: string
          meeting_link?: string | null
          scheduled_at: string
          title: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          description?: string | null
          id?: string
          meeting_link?: string | null
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          cohort_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payment_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          payment_id: string
          position: number
          proof_path: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["installment_status"]
          student_confirmed_at: string | null
          submitted_at: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          id?: string
          payment_id: string
          position: number
          proof_path?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          student_confirmed_at?: string | null
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          payment_id?: string
          position?: number
          proof_path?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          student_confirmed_at?: string | null
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          channel: string
          error: string | null
          id: string
          installment_id: string
          sent_at: string
          status: string
        }
        Insert: {
          channel?: string
          error?: string | null
          id?: string
          installment_id: string
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          error?: string | null
          id?: string
          installment_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paid: number
          amount_total: number
          cohort_id: string
          created_at: string
          currency: string
          final_deadline: string | null
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          amount_total: number
          cohort_id: string
          created_at?: string
          currency?: string
          final_deadline?: string | null
          id?: string
          mode: Database["public"]["Enums"]["payment_mode"]
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          amount_total?: number
          cohort_id?: string
          created_at?: string
          currency?: string
          final_deadline?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohortes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name?: string
          id: string
          last_name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      progress_tracking: {
        Row: {
          completed: boolean
          completed_at: string
          id: string
          ressource_id: string
          student_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string
          id?: string
          ressource_id: string
          student_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string
          id?: string
          ressource_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_tracking_ressource_id_fkey"
            columns: ["ressource_id"]
            isOneToOne: false
            referencedRelation: "ressources"
            referencedColumns: ["id"]
          },
        ]
      }
      ressources: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          module_id: string
          position: number
          title: string
          type: Database["public"]["Enums"]["resource_type"]
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          module_id: string
          position?: number
          title: string
          type: Database["public"]["Enums"]["resource_type"]
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          module_id?: string
          position?: number
          title?: string
          type?: Database["public"]["Enums"]["resource_type"]
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ressources_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_student_active: {
        Args: { _cohort_id: string; _student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "student"
      cohort_status:
        | "inscription_open"
        | "in_progress"
        | "completed"
        | "cancelled"
      enrollment_status:
        | "active"
        | "suspended"
        | "completed"
        | "cancelled"
        | "restricted"
      form_field_type:
        | "short_text"
        | "long_text"
        | "email"
        | "phone"
        | "single_choice"
        | "multiple_choice"
        | "file"
        | "number"
        | "date"
      installment_status: "pending" | "submitted" | "validated" | "rejected"
      notification_type:
        | "new_enrollment"
        | "payment_received"
        | "payment_validated"
        | "payment_overdue"
        | "new_resource"
        | "live_session"
        | "suspension"
        | "reactivation"
        | "announcement"
      payment_mode: "full" | "installments_2"
      payment_status: "paid" | "partial" | "pending" | "overdue" | "suspended"
      resource_type: "video" | "document" | "link" | "exercise"
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
      app_role: ["super_admin", "admin", "student"],
      cohort_status: [
        "inscription_open",
        "in_progress",
        "completed",
        "cancelled",
      ],
      enrollment_status: [
        "active",
        "suspended",
        "completed",
        "cancelled",
        "restricted",
      ],
      form_field_type: [
        "short_text",
        "long_text",
        "email",
        "phone",
        "single_choice",
        "multiple_choice",
        "file",
        "number",
        "date",
      ],
      installment_status: ["pending", "submitted", "validated", "rejected"],
      notification_type: [
        "new_enrollment",
        "payment_received",
        "payment_validated",
        "payment_overdue",
        "new_resource",
        "live_session",
        "suspension",
        "reactivation",
        "announcement",
      ],
      payment_mode: ["full", "installments_2"],
      payment_status: ["paid", "partial", "pending", "overdue", "suspended"],
      resource_type: ["video", "document", "link", "exercise"],
    },
  },
} as const
