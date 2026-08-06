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
      activity_types: {
        Row: {
          created_at: string
          default_billing_rate: number | null
          default_costing_rate: number | null
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          default_billing_rate?: number | null
          default_costing_rate?: number | null
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          default_billing_rate?: number | null
          default_costing_rate?: number | null
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_integrations: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          profile_id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_integrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_hq_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_draft: boolean
          prompt: string
          result_json: Json | null
          status: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_draft?: boolean
          prompt: string
          result_json?: Json | null
          status?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_draft?: boolean
          prompt?: string
          result_json?: Json | null
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_hq_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_books: {
        Row: {
          canvas_blocks: Json | null
          client_id: string
          client_slug: string
          created_at: string
          figma_access_token: string
          figma_file_url: string
          id: string
          portal_password: string
          project_title: string
          updated_at: string
        }
        Insert: {
          canvas_blocks?: Json | null
          client_id: string
          client_slug: string
          created_at?: string
          figma_access_token: string
          figma_file_url: string
          id?: string
          portal_password: string
          project_title: string
          updated_at?: string
        }
        Update: {
          canvas_blocks?: Json | null
          client_id?: string
          client_slug?: string
          created_at?: string
          figma_access_token?: string
          figma_file_url?: string
          id?: string
          portal_password?: string
          project_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_books_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_hubs: {
        Row: {
          brand_colors: Json | null
          client_id: string
          created_at: string
          guideline_document: Json | null
          guideline_source_path: string | null
          id: string
          logo_url: string | null
          typography: Json | null
          updated_at: string
        }
        Insert: {
          brand_colors?: Json | null
          client_id: string
          created_at?: string
          guideline_document?: Json | null
          guideline_source_path?: string | null
          id?: string
          logo_url?: string | null
          typography?: Json | null
          updated_at?: string
        }
        Update: {
          brand_colors?: Json | null
          client_id?: string
          created_at?: string
          guideline_document?: Json | null
          guideline_source_path?: string | null
          id?: string
          logo_url?: string | null
          typography?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_hubs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_assets: {
        Row: {
          caption: string | null
          created_at: string | null
          guideline_id: string
          id: string
          kind: string | null
          label: string | null
          metadata: Json | null
          public_url: string
          section_id: string | null
          sort_order: number | null
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          guideline_id: string
          id?: string
          kind?: string | null
          label?: string | null
          metadata?: Json | null
          public_url: string
          section_id?: string | null
          sort_order?: number | null
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          guideline_id?: string
          id?: string
          kind?: string | null
          label?: string | null
          metadata?: Json | null
          public_url?: string
          section_id?: string | null
          sort_order?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_assets_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "ci_guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_assets_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ci_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_guideline_versions: {
        Row: {
          content: Json
          created_at: string | null
          guideline_id: string
          id: string
          is_published: boolean | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          guideline_id: string
          id?: string
          is_published?: boolean | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          guideline_id?: string
          id?: string
          is_published?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_guideline_versions_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "ci_guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_guidelines: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          published_at: string | null
          slug: string | null
          status: string | null
          theme: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          published_at?: string | null
          slug?: string | null
          status?: string | null
          theme?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          published_at?: string | null
          slug?: string | null
          status?: string | null
          theme?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_guidelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_sections: {
        Row: {
          data: Json | null
          description: string | null
          eyebrow_label: string | null
          guideline_id: string
          headline: string | null
          headline_emphasis: string | null
          id: string
          is_visible: boolean | null
          position: number | null
          section_type: string
        }
        Insert: {
          data?: Json | null
          description?: string | null
          eyebrow_label?: string | null
          guideline_id: string
          headline?: string | null
          headline_emphasis?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number | null
          section_type: string
        }
        Update: {
          data?: Json | null
          description?: string | null
          eyebrow_label?: string | null
          guideline_id?: string
          headline?: string | null
          headline_emphasis?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number | null
          section_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_sections_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "ci_guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      client_integrations: {
        Row: {
          client_id: string
          created_at: string
          credentials: Json
          id: string
          is_connected: boolean
          last_synced_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          credentials?: Json
          id?: string
          is_connected?: boolean
          last_synced_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          credentials?: Json
          id?: string
          is_connected?: boolean
          last_synced_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_requests: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          form_answers: Json
          id: string
          preferred_response_date: string | null
          responded_at: string | null
          responded_by: string | null
          response_note: string | null
          service: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          form_answers?: Json
          id?: string
          preferred_response_date?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          service?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          form_answers?: Json
          id?: string
          preferred_response_date?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          service?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          company: string | null
          contract_type: string | null
          contract_value: number | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          lead_status: string | null
          linkedin: string | null
          name: string
          notes: string | null
          position: string | null
          project_type: string | null
          role: string | null
          services_package: Json | null
          source: string | null
          source_category: string | null
          start_date: string | null
          status: string | null
          subscriber_status: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          lead_status?: string | null
          linkedin?: string | null
          name: string
          notes?: string | null
          position?: string | null
          project_type?: string | null
          role?: string | null
          services_package?: Json | null
          source?: string | null
          source_category?: string | null
          start_date?: string | null
          status?: string | null
          subscriber_status?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          lead_status?: string | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          position?: string | null
          project_type?: string | null
          role?: string | null
          services_package?: Json | null
          source?: string | null
          source_category?: string | null
          start_date?: string | null
          status?: string | null
          subscriber_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          layout_config: Json
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          layout_config?: Json
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          layout_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      dataset_rows: {
        Row: {
          created_at: string | null
          dataset_id: string
          id: string
          row_data: Json
          row_index: number
        }
        Insert: {
          created_at?: string | null
          dataset_id: string
          id?: string
          row_data?: Json
          row_index: number
        }
        Update: {
          created_at?: string | null
          dataset_id?: string
          id?: string
          row_data?: Json
          row_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "dataset_rows_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          category: string
          columns: Json
          created_at: string | null
          created_by: string | null
          file_size_bytes: number | null
          id: string
          name: string
          project_id: string
          row_count: number
          updated_at: string | null
        }
        Insert: {
          category?: string
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          file_size_bytes?: number | null
          id?: string
          name: string
          project_id: string
          row_count?: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          file_size_bytes?: number | null
          id?: string
          name?: string
          project_id?: string
          row_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_activity_costs: {
        Row: {
          activity_type_id: string
          billing_rate: number | null
          costing_rate: number | null
          created_at: string
          id: string
          person_id: string
        }
        Insert: {
          activity_type_id: string
          billing_rate?: number | null
          costing_rate?: number | null
          created_at?: string
          id?: string
          person_id: string
        }
        Update: {
          activity_type_id?: string
          billing_rate?: number | null
          costing_rate?: number | null
          created_at?: string
          id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_activity_costs_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_activity_costs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          expense_date: string
          id: string
          incurred_by: string | null
          project_id: string | null
          receipt_url: string | null
          status: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          incurred_by?: string | null
          project_id?: string | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          incurred_by?: string | null
          project_id?: string | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_expenses_incurred_by_fkey"
            columns: ["incurred_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_invoices: {
        Row: {
          amount_paid: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          due_date: string | null
          grand_total: number | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          project_id: string | null
          status: string | null
          subtotal: number | null
          tax_total: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          project_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_total?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          project_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_total?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_project_settings: {
        Row: {
          created_at: string
          default_completion_method: string | null
          default_project_type_id: string | null
          id: string
          ignore_employee_time_overlap: boolean | null
          ignore_weekends: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_completion_method?: string | null
          default_project_type_id?: string | null
          id?: string
          ignore_employee_time_overlap?: boolean | null
          ignore_weekends?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_completion_method?: string | null
          default_project_type_id?: string | null
          id?: string
          ignore_employee_time_overlap?: boolean | null
          ignore_weekends?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_project_settings_default_project_type_id_fkey"
            columns: ["default_project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_project_updates: {
        Row: {
          challenges: string | null
          created_at: string
          created_by: string | null
          id: string
          next_steps: string | null
          progress_snapshot: number | null
          project_id: string
          status: string | null
          summary: string | null
          update_date: string
        }
        Insert: {
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_steps?: string | null
          progress_snapshot?: number | null
          project_id: string
          status?: string | null
          summary?: string | null
          update_date?: string
        }
        Update: {
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_steps?: string | null
          progress_snapshot?: number | null
          project_id?: string
          status?: string | null
          summary?: string | null
          update_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_project_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_project_users: {
        Row: {
          created_at: string
          id: string
          project_id: string
          project_role: string | null
          user_id: string
          welcome_email_sent: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          project_role?: string | null
          user_id: string
          welcome_email_sent?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          project_role?: string | null
          user_id?: string
          welcome_email_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_project_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_project_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "erp_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "erp_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_task_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      erp_tasks: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          actual_time: number | null
          assigned_to: string | null
          closing_date: string | null
          color: string | null
          completed_by: string | null
          completed_on: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          expected_end_date: string | null
          expected_start_date: string | null
          expected_time: number | null
          id: string
          is_group: boolean | null
          is_milestone: boolean | null
          parent_task_id: string | null
          priority: string | null
          progress: number | null
          project_id: string | null
          review_date: string | null
          status: string | null
          task_type_id: string | null
          title: string
          updated_at: string
          weight: number | null
          workspace_id: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          actual_time?: number | null
          assigned_to?: string | null
          closing_date?: string | null
          color?: string | null
          completed_by?: string | null
          completed_on?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          expected_end_date?: string | null
          expected_start_date?: string | null
          expected_time?: number | null
          id?: string
          is_group?: boolean | null
          is_milestone?: boolean | null
          parent_task_id?: string | null
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          review_date?: string | null
          status?: string | null
          task_type_id?: string | null
          title: string
          updated_at?: string
          weight?: number | null
          workspace_id?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          actual_time?: number | null
          assigned_to?: string | null
          closing_date?: string | null
          color?: string | null
          completed_by?: string | null
          completed_on?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          expected_end_date?: string | null
          expected_start_date?: string | null
          expected_time?: number | null
          id?: string
          is_group?: boolean | null
          is_milestone?: boolean | null
          parent_task_id?: string | null
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          review_date?: string | null
          status?: string | null
          task_type_id?: string | null
          title?: string
          updated_at?: string
          weight?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "erp_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "erp_task_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_timesheet_details: {
        Row: {
          activity_type_id: string | null
          billing_amount: number | null
          billing_rate: number | null
          costing_amount: number | null
          costing_rate: number | null
          description: string | null
          from_time: string | null
          hours: number
          id: string
          is_billable: boolean | null
          project_id: string | null
          sort_order: number | null
          task_id: string | null
          timesheet_id: string
          to_time: string | null
        }
        Insert: {
          activity_type_id?: string | null
          billing_amount?: number | null
          billing_rate?: number | null
          costing_amount?: number | null
          costing_rate?: number | null
          description?: string | null
          from_time?: string | null
          hours?: number
          id?: string
          is_billable?: boolean | null
          project_id?: string | null
          sort_order?: number | null
          task_id?: string | null
          timesheet_id: string
          to_time?: string | null
        }
        Update: {
          activity_type_id?: string | null
          billing_amount?: number | null
          billing_rate?: number | null
          costing_amount?: number | null
          costing_rate?: number | null
          description?: string | null
          from_time?: string | null
          hours?: number
          id?: string
          is_billable?: boolean | null
          project_id?: string | null
          sort_order?: number | null
          task_id?: string | null
          timesheet_id?: string
          to_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_timesheet_details_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheet_details_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheet_details_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "erp_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheet_details_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "erp_timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_timesheets: {
        Row: {
          activity_type_id: string | null
          billing_rate: number | null
          created_at: string
          end_date: string | null
          hours: number
          id: string
          is_billable: boolean | null
          log_date: string
          note: string | null
          notes: string | null
          person_id: string | null
          project_id: string | null
          start_date: string | null
          status: string | null
          task_id: string | null
          total_billable_amount: number | null
          total_billable_hours: number | null
          total_costing_amount: number | null
          total_hours: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          activity_type_id?: string | null
          billing_rate?: number | null
          created_at?: string
          end_date?: string | null
          hours: number
          id?: string
          is_billable?: boolean | null
          log_date?: string
          note?: string | null
          notes?: string | null
          person_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          task_id?: string | null
          total_billable_amount?: number | null
          total_billable_hours?: number | null
          total_costing_amount?: number | null
          total_hours?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          activity_type_id?: string | null
          billing_rate?: number | null
          created_at?: string
          end_date?: string | null
          hours?: number
          id?: string
          is_billable?: boolean | null
          log_date?: string
          note?: string | null
          notes?: string | null
          person_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          task_id?: string | null
          total_billable_amount?: number | null
          total_billable_hours?: number | null
          total_costing_amount?: number | null
          total_hours?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_timesheets_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheets_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "erp_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_timesheets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_identified_opportunities: {
        Row: {
          amount: number
          company_name: string
          id: string
          lifecycle_status: string
          synced_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          company_name: string
          id?: string
          lifecycle_status: string
          synced_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          company_name?: string
          id?: string
          lifecycle_status?: string
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_identified_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          severity_level: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          severity_level?: string
          title: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          severity_level?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      global_announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          starts_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
        }
        Relationships: []
      }
      marketing_daily_snapshots: {
        Row: {
          clicks: number | null
          client_id: string
          conversions: number | null
          cost: number | null
          created_at: string | null
          id: string
          impressions: number | null
          log_date: string
          metadata: Json | null
          sessions: number | null
          source: string
          updated_at: string | null
          users: number | null
        }
        Insert: {
          clicks?: number | null
          client_id: string
          conversions?: number | null
          cost?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          log_date: string
          metadata?: Json | null
          sessions?: number | null
          source: string
          updated_at?: string | null
          users?: number | null
        }
        Update: {
          clicks?: number | null
          client_id?: string
          conversions?: number | null
          cost?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          log_date?: string
          metadata?: Json | null
          sessions?: number | null
          source?: string
          updated_at?: string | null
          users?: number | null
        }
        Relationships: []
      }
      marketing_metrics: {
        Row: {
          category: string
          created_at: string | null
          date: string
          id: string
          metric_name: string
          metric_value: number
          project_id: string
          stage: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          date: string
          id?: string
          metric_name: string
          metric_value: number
          project_id: string
          stage: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          date?: string
          id?: string
          metric_name?: string
          metric_value?: number
          project_id?: string
          stage?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          auth_user_id: string | null
          availability_status: string | null
          capacity_score: number | null
          communication_handle: string | null
          compliance_document_path: string | null
          created_at: string
          expertise_tags: string[] | null
          full_name: string
          hourly_rate_cost: number | null
          ica_document_path: string | null
          id: string
          max_weekly_hours: number
          name: string | null
          nda_document_path: string | null
          person_type: string | null
          primary_email: string | null
          salary_base: number | null
          target_load_ceiling: number
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          availability_status?: string | null
          capacity_score?: number | null
          communication_handle?: string | null
          compliance_document_path?: string | null
          created_at?: string
          expertise_tags?: string[] | null
          full_name: string
          hourly_rate_cost?: number | null
          ica_document_path?: string | null
          id?: string
          max_weekly_hours?: number
          name?: string | null
          nda_document_path?: string | null
          person_type?: string | null
          primary_email?: string | null
          salary_base?: number | null
          target_load_ceiling?: number
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          availability_status?: string | null
          capacity_score?: number | null
          communication_handle?: string | null
          compliance_document_path?: string | null
          created_at?: string
          expertise_tags?: string[] | null
          full_name?: string
          hourly_rate_cost?: number | null
          ica_document_path?: string | null
          id?: string
          max_weekly_hours?: number
          name?: string | null
          nda_document_path?: string | null
          person_type?: string | null
          primary_email?: string | null
          salary_base?: number | null
          target_load_ceiling?: number
          updated_at?: string
        }
        Relationships: []
      }
      performance_reports: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          generated_at: string | null
          generated_report: Json | null
          id: string
          input_payload: Json
          package_tier: string
          published_at: string | null
          report_period_end: string
          report_period_start: string
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          generated_report?: Json | null
          id?: string
          input_payload?: Json
          package_tier?: string
          published_at?: string | null
          report_period_end: string
          report_period_start: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          generated_report?: Json | null
          id?: string
          input_payload?: Json
          package_tier?: string
          published_at?: string | null
          report_period_end?: string
          report_period_start?: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_activity: {
        Row: {
          actor_id: string | null
          client_id: string | null
          created_at: string
          event_type: string
          id: string
          meta: Json | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
          title: string
        }
        Update: {
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_activity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          last_portal_visit: string | null
          primary_account_id: string | null
          prospect_id: string | null
          role: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_portal_visit?: string | null
          primary_account_id?: string | null
          prospect_id?: string | null
          role?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_portal_visit?: string | null
          primary_account_id?: string | null
          prospect_id?: string | null
          role?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_account_id_fkey"
            columns: ["primary_account_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          phase_order: number
          phase_title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          phase_order: number
          phase_title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          phase_order?: number
          phase_title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_tasks: {
        Row: {
          created_at: string
          depends_on_task_idx: number | null
          description: string | null
          duration_days: number | null
          expected_time: number | null
          id: string
          is_milestone: boolean | null
          priority: string | null
          sort_order: number | null
          start_offset_days: number | null
          template_id: string
          title: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          depends_on_task_idx?: number | null
          description?: string | null
          duration_days?: number | null
          expected_time?: number | null
          id?: string
          is_milestone?: boolean | null
          priority?: string | null
          sort_order?: number | null
          start_offset_days?: number | null
          template_id: string
          title: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          depends_on_task_idx?: number | null
          description?: string | null
          duration_days?: number | null
          expected_time?: number | null
          id?: string
          is_milestone?: boolean | null
          priority?: string | null
          sort_order?: number | null
          start_offset_days?: number | null
          template_id?: string
          title?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_type_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_type_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_type_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          actual_time: number | null
          client_id: string
          company: string | null
          completion_method: string | null
          contract_renews_at: string | null
          copied_from: string | null
          cost_center: string | null
          created_at: string
          department: string | null
          end_date: string | null
          estimated_cost: number | null
          expected_end_date: string | null
          expected_start_date: string | null
          gross_margin: number | null
          id: string
          is_active: boolean | null
          launch_date: string | null
          lead_admin_id: string | null
          notes: string | null
          percent_complete: number | null
          priority: string | null
          project_template_id: string | null
          project_type_id: string | null
          sales_order: string | null
          scope: string | null
          start_date: string | null
          status: string
          title: string
          total_billable_amount: number | null
          total_billed_amount: number | null
          total_costing_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          actual_time?: number | null
          client_id: string
          company?: string | null
          completion_method?: string | null
          contract_renews_at?: string | null
          copied_from?: string | null
          cost_center?: string | null
          created_at?: string
          department?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          expected_end_date?: string | null
          expected_start_date?: string | null
          gross_margin?: number | null
          id?: string
          is_active?: boolean | null
          launch_date?: string | null
          lead_admin_id?: string | null
          notes?: string | null
          percent_complete?: number | null
          priority?: string | null
          project_template_id?: string | null
          project_type_id?: string | null
          sales_order?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string
          title: string
          total_billable_amount?: number | null
          total_billed_amount?: number | null
          total_costing_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          actual_time?: number | null
          client_id?: string
          company?: string | null
          completion_method?: string | null
          contract_renews_at?: string | null
          copied_from?: string | null
          cost_center?: string | null
          created_at?: string
          department?: string | null
          end_date?: string | null
          estimated_cost?: number | null
          expected_end_date?: string | null
          expected_start_date?: string | null
          gross_margin?: number | null
          id?: string
          is_active?: boolean | null
          launch_date?: string | null
          lead_admin_id?: string | null
          notes?: string | null
          percent_complete?: number | null
          priority?: string | null
          project_template_id?: string | null
          project_type_id?: string | null
          sales_order?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string
          title?: string
          total_billable_amount?: number | null
          total_billed_amount?: number | null
          total_costing_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_copied_from_fkey"
            columns: ["copied_from"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_admin_id_fkey"
            columns: ["lead_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_template_id_fkey"
            columns: ["project_template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_proposals: {
        Row: {
          created_at: string
          executive_summary: string | null
          investment: Json
          is_published: boolean
          prospect_id: string
          published_at: string | null
          scope_sections: Json
          sow_draft: string | null
          timeline: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          executive_summary?: string | null
          investment?: Json
          is_published?: boolean
          prospect_id: string
          published_at?: string | null
          scope_sections?: Json
          sow_draft?: string | null
          timeline?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          executive_summary?: string | null
          investment?: Json
          is_published?: boolean
          prospect_id?: string
          published_at?: string | null
          scope_sections?: Json
          sow_draft?: string | null
          timeline?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_proposals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          client_profile_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          duration_months: number | null
          id: string
          lead_admin_id: string | null
          links: Json
          notes: string | null
          possible_start_date: string | null
          project_name: string | null
          services: string | null
          status: string
          updated_at: string
          value_amount: number | null
          workspace_id: string | null
        }
        Insert: {
          client_profile_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          duration_months?: number | null
          id?: string
          lead_admin_id?: string | null
          links?: Json
          notes?: string | null
          possible_start_date?: string | null
          project_name?: string | null
          services?: string | null
          status?: string
          updated_at?: string
          value_amount?: number | null
          workspace_id?: string | null
        }
        Update: {
          client_profile_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          duration_months?: number | null
          id?: string
          lead_admin_id?: string | null
          links?: Json
          notes?: string | null
          possible_start_date?: string | null
          project_name?: string | null
          services?: string | null
          status?: string
          updated_at?: string
          value_amount?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_lead_admin_id_fkey"
            columns: ["lead_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      published_reports: {
        Row: {
          category: string
          config: Json
          id: string
          project_id: string
          published_at: string | null
        }
        Insert: {
          category?: string
          config?: Json
          id?: string
          project_id: string
          published_at?: string | null
        }
        Update: {
          category?: string
          config?: Json
          id?: string
          project_id?: string
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "published_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          access_link: string | null
          billing_type: string
          cost_amount: number
          created_at: string
          id: string
          resource_name: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          access_link?: string | null
          billing_type?: string
          cost_amount?: number
          created_at?: string
          id?: string
          resource_name: string
          resource_type: string
          updated_at?: string
        }
        Update: {
          access_link?: string | null
          billing_type?: string
          cost_amount?: number
          created_at?: string
          id?: string
          resource_name?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_person_id: string | null
          assigned_resource_id: string | null
          confirmation_deadline: string | null
          created_at: string
          description: string | null
          duration_hours: number
          id: string
          is_confirmed: boolean
          needs_client_confirmation: boolean
          phase_id: string
          task_name: string
          task_type: string
          updated_at: string
        }
        Insert: {
          assigned_person_id?: string | null
          assigned_resource_id?: string | null
          confirmation_deadline?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          id?: string
          is_confirmed?: boolean
          needs_client_confirmation?: boolean
          phase_id: string
          task_name: string
          task_type?: string
          updated_at?: string
        }
        Update: {
          assigned_person_id?: string | null
          assigned_resource_id?: string | null
          confirmation_deadline?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number
          id?: string
          is_confirmed?: boolean
          needs_client_confirmation?: boolean
          phase_id?: string
          task_name?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_person_id_fkey"
            columns: ["assigned_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_resource_id_fkey"
            columns: ["assigned_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          notify_email: boolean
          notify_in_app: boolean
          notify_sms: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          notify_email?: boolean
          notify_in_app?: boolean
          notify_sms?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          notify_email?: boolean
          notify_in_app?: boolean
          notify_sms?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_downloads: {
        Row: {
          downloaded_at: string
          file_id: string
          id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string
          file_id: string
          id?: string
          user_id: string
        }
        Update: {
          downloaded_at?: string
          file_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_downloads_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "vault_files"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_files: {
        Row: {
          category: string
          client_id: string
          created_at: string
          external_provider: string | null
          external_url: string | null
          file_name: string
          folder_key: string
          id: string
          is_current: boolean
          is_legal: boolean
          label: string
          mime_type: string | null
          original_filename: string | null
          replaces_file_id: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
          version: number
          workspace_id: string | null
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          external_provider?: string | null
          external_url?: string | null
          file_name: string
          folder_key?: string
          id?: string
          is_current?: boolean
          is_legal?: boolean
          label: string
          mime_type?: string | null
          original_filename?: string | null
          replaces_file_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          version?: number
          workspace_id?: string | null
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          external_provider?: string | null
          external_url?: string | null
          file_name?: string
          folder_key?: string
          id?: string
          is_current?: boolean
          is_legal?: boolean
          label?: string
          mime_type?: string | null
          original_filename?: string | null
          replaces_file_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_files_replaces_file_id_fkey"
            columns: ["replaces_file_id"]
            isOneToOne: false
            referencedRelation: "vault_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      web_style_guide_items: {
        Row: {
          client_id: string
          component_kind: string
          created_at: string
          donts: string | null
          dos: string | null
          id: string
          screenshot_storage_path: string | null
          sort_order: number
          staging_url: string | null
          title: string
          updated_at: string
          why_notes: string | null
        }
        Insert: {
          client_id: string
          component_kind?: string
          created_at?: string
          donts?: string | null
          dos?: string | null
          id?: string
          screenshot_storage_path?: string | null
          sort_order?: number
          staging_url?: string | null
          title: string
          updated_at?: string
          why_notes?: string | null
        }
        Update: {
          client_id?: string
          component_kind?: string
          created_at?: string
          donts?: string | null
          dos?: string | null
          id?: string
          screenshot_storage_path?: string | null
          sort_order?: number
          staging_url?: string | null
          title?: string
          updated_at?: string
          why_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_style_guide_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      web_style_guide_snapshots: {
        Row: {
          body_class: string
          client_id: string
          created_at: string
          html_fragment: string
          inline_head_styles: string
          pdf_notes: string | null
          source_filename: string | null
          style_guide_document: Json | null
          stylesheet_hrefs: Json
          updated_at: string
        }
        Insert: {
          body_class?: string
          client_id: string
          created_at?: string
          html_fragment?: string
          inline_head_styles?: string
          pdf_notes?: string | null
          source_filename?: string | null
          style_guide_document?: Json | null
          stylesheet_hrefs?: Json
          updated_at?: string
        }
        Update: {
          body_class?: string
          client_id?: string
          created_at?: string
          html_fragment?: string
          inline_head_styles?: string
          pdf_notes?: string | null
          source_filename?: string | null
          style_guide_document?: Json | null
          stylesheet_hrefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_style_guide_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_assignments: {
        Row: {
          assigned_at: string
          due_date: string | null
          hours_per_week: number
          id: string
          notes: string | null
          package_track: string | null
          person_id: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_at?: string
          due_date?: string | null
          hours_per_week?: number
          id?: string
          notes?: string | null
          package_track?: string | null
          person_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_at?: string
          due_date?: string | null
          hours_per_week?: number
          id?: string
          notes?: string | null
          package_track?: string | null
          person_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          member_role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          member_role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          member_role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          actual_revenue: number | null
          agreement_signed_at: string | null
          agreement_signed_by: string | null
          billing_sequence: string | null
          burn_rate_override: number | null
          client_profile_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contract_ip_address: string | null
          contract_signature_name: string | null
          contract_signed_at: string | null
          created_at: string
          creative_routes: Json
          current_phase: number | null
          current_tier: string | null
          domain: string | null
          estimated_value: number | null
          id: string
          industry: string | null
          lifecycle_status: string
          onboarding_automated: boolean
          owner_auth_user_id: string | null
          phase_3_signed_at: string | null
          phase_3_signed_by: string | null
          project_id: string | null
          proposal_data: Json
          prospect_auth_user_id: string | null
          updated_at: string
          wizard_config: Json
          workspace_kind: string
        }
        Insert: {
          actual_revenue?: number | null
          agreement_signed_at?: string | null
          agreement_signed_by?: string | null
          billing_sequence?: string | null
          burn_rate_override?: number | null
          client_profile_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contract_ip_address?: string | null
          contract_signature_name?: string | null
          contract_signed_at?: string | null
          created_at?: string
          creative_routes?: Json
          current_phase?: number | null
          current_tier?: string | null
          domain?: string | null
          estimated_value?: number | null
          id?: string
          industry?: string | null
          lifecycle_status?: string
          onboarding_automated?: boolean
          owner_auth_user_id?: string | null
          phase_3_signed_at?: string | null
          phase_3_signed_by?: string | null
          project_id?: string | null
          proposal_data?: Json
          prospect_auth_user_id?: string | null
          updated_at?: string
          wizard_config?: Json
          workspace_kind?: string
        }
        Update: {
          actual_revenue?: number | null
          agreement_signed_at?: string | null
          agreement_signed_by?: string | null
          billing_sequence?: string | null
          burn_rate_override?: number | null
          client_profile_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contract_ip_address?: string | null
          contract_signature_name?: string | null
          contract_signed_at?: string | null
          created_at?: string
          creative_routes?: Json
          current_phase?: number | null
          current_tier?: string | null
          domain?: string | null
          estimated_value?: number | null
          id?: string
          industry?: string | null
          lifecycle_status?: string
          onboarding_automated?: boolean
          owner_auth_user_id?: string | null
          phase_3_signed_at?: string | null
          phase_3_signed_by?: string | null
          project_id?: string | null
          proposal_data?: Json
          prospect_auth_user_id?: string | null
          updated_at?: string
          wizard_config?: Json
          workspace_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_client: {
        Args: { target_client_id: string }
        Returns: boolean
      }
      can_access_prospect: {
        Args: { target_prospect_id: string }
        Returns: boolean
      }
      effective_client_id: { Args: never; Returns: string }
      ensure_workspace_phases: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      get_user_role: { Args: never; Returns: string }
      is_agency_staff: { Args: never; Returns: boolean }
      is_bd_staff: { Args: never; Returns: boolean }
      is_client_manager: { Args: never; Returns: boolean }
      is_finance_staff: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      recompute_person_capacity_score: {
        Args: { p_person_id: string }
        Returns: undefined
      }
      refresh_all_process_template_metrics: { Args: never; Returns: undefined }
      refresh_process_template_metrics: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      storage_object_client_id: {
        Args: { object_name: string }
        Returns: string
      }
      workspace_member_role: { Args: { ws_id: string }; Returns: string }
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
