export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: any }
  | any[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
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
      bd_marketing_tasks: {
        Row: {
          assignee_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_marketing_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_partnerships: {
        Row: {
          company_or_person: string
          created_at: string
          duration_months: number | null
          forecasted_value: number | null
          id: string
          lead_admin_id: string | null
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          company_or_person: string
          created_at?: string
          duration_months?: number | null
          forecasted_value?: number | null
          id?: string
          lead_admin_id?: string | null
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          company_or_person?: string
          created_at?: string
          duration_months?: number | null
          forecasted_value?: number | null
          id?: string
          lead_admin_id?: string | null
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_partnerships_lead_admin_id_fkey"
            columns: ["lead_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_partnerships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_books: {
        Row: {
          id: string
          client_id: string
          project_title: string
          client_slug: string
          portal_password: string
          figma_file_url: string | null
          figma_access_token: string | null
          canvas_blocks: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          project_title: string
          client_slug: string
          portal_password: string
          figma_file_url?: string | null
          figma_access_token?: string | null
          canvas_blocks?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          project_title?: string
          client_slug?: string
          portal_password?: string
          figma_file_url?: string | null
          figma_access_token?: string | null
          canvas_blocks?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_books_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
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
      client_delivery_gates: {
        Row: {
          client_id: string
          creative_routes: Json
          current_kickoff_phase: string
          phase_3_alignment_signed_at: string | null
          phase_3_selected_route_id: string | null
          phase_3_signed_by: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          creative_routes?: Json
          current_kickoff_phase?: string
          phase_3_alignment_signed_at?: string | null
          phase_3_selected_route_id?: string | null
          phase_3_signed_by?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          creative_routes?: Json
          current_kickoff_phase?: string
          phase_3_alignment_signed_at?: string | null
          phase_3_selected_route_id?: string | null
          phase_3_signed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_delivery_gates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_manager_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          manager_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          manager_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_manager_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_manager_assignments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_manager_profiles: {
        Row: {
          bio: string | null
          created_at: string
          google_calendar_meeting_url: string | null
          job_title: string | null
          linkedin_url: string | null
          phone: string | null
          public_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          google_calendar_meeting_url?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          phone?: string | null
          public_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          google_calendar_meeting_url?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          phone?: string | null
          public_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_manager_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_proposals: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_value: number
          id: string
          published_at: string | null
          recommended_headline: string | null
          show_on_dashboard: boolean
          status: string
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_value?: number
          id?: string
          published_at?: string | null
          recommended_headline?: string | null
          show_on_dashboard?: boolean
          status?: string
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_value?: number
          id?: string
          published_at?: string | null
          recommended_headline?: string | null
          show_on_dashboard?: boolean
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      dashboard_layouts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          layout_config: Json
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          layout_config?: Json
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          layout_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      expertise_tracks: {
        Row: {
          created_at: string
          description: string
          domain: string | null
          id: string
          is_active: boolean
          label: string
          linked_service_slugs: string[]
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          label: string
          linked_service_slugs?: string[]
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          label?: string
          linked_service_slugs?: string[]
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_actual_costs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date_processed: string | null
          date_received: string | null
          id: string
          invoice_ref: string | null
          notes: string | null
          paid_for: string
          project_name: string | null
          recurrence: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          paid_for: string
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          paid_for?: string
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_actual_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_actual_revenues: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          created_by: string | null
          date_processed: string | null
          date_sent: string | null
          id: string
          invoice_ref: string | null
          notes: string | null
          project_name: string | null
          recurrence: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          client_name: string
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_sent?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_sent?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_actual_revenues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_identified_costs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date_processed: string | null
          date_received: string | null
          id: string
          notes: string | null
          paid_for: string
          project_name: string | null
          prospect_id: string | null
          quote_number: string | null
          recurrence: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          notes?: string | null
          paid_for: string
          project_name?: string | null
          prospect_id?: string | null
          quote_number?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          notes?: string | null
          paid_for?: string
          project_name?: string | null
          prospect_id?: string | null
          quote_number?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_identified_costs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_identified_costs_workspace_id_fkey"
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
      finance_identified_revenues: {
        Row: {
          amount: number
          assumed_processed_date: string | null
          client_name: string
          client_proposal_id: string | null
          created_at: string
          created_by: string | null
          date_sent: string | null
          id: string
          notes: string | null
          project_name: string | null
          prospect_id: string | null
          quote_number: string | null
          recurrence: string
          revenue_source: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          assumed_processed_date?: string | null
          client_name: string
          client_proposal_id?: string | null
          created_at?: string
          created_by?: string | null
          date_sent?: string | null
          id?: string
          notes?: string | null
          project_name?: string | null
          prospect_id?: string | null
          quote_number?: string | null
          recurrence?: string
          revenue_source?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          assumed_processed_date?: string | null
          client_name?: string
          client_proposal_id?: string | null
          created_at?: string
          created_by?: string | null
          date_sent?: string | null
          id?: string
          notes?: string | null
          project_name?: string | null
          prospect_id?: string | null
          quote_number?: string | null
          recurrence?: string
          revenue_source?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_identified_revenues_client_proposal_id_fkey"
            columns: ["client_proposal_id"]
            isOneToOne: false
            referencedRelation: "client_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_identified_revenues_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_identified_revenues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_unidentified_costs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date_processed: string | null
          date_received: string | null
          id: string
          notes: string | null
          project_name: string | null
          recurrence: string
          updated_at: string
          will_pay_for: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          notes?: string | null
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          will_pay_for: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          notes?: string | null
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          will_pay_for?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_unidentified_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_unidentified_revenues: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          created_by: string | null
          id: string
          months_label: string
          notes: string | null
          project_name: string | null
          recurrence: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          client_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          months_label: string
          notes?: string | null
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          months_label?: string
          notes?: string | null
          project_name?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_unidentified_revenues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
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
      portal_activity: {
        Row: {
          actor_id: string | null
          client_id: string | null
          created_at: string
          id: string
          kind: string | null
          metadata: Json | null
          meta: Json | null
          summary: string | null
          event_type: string | null
          title: string | null
        }
        Insert: {
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          metadata?: Json | null
          meta?: Json | null
          summary?: string | null
          event_type?: string | null
          title?: string | null
        }
        Update: {
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          meta?: Json | null
          summary?: string
          event_type?: string | null
          title?: string | null
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
      process_edges: {
        Row: {
          created_at: string
          id: string
          source_step_id: string
          target_step_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_step_id: string
          target_step_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_step_id?: string
          target_step_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_edges_source_step_id_fkey"
            columns: ["source_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_edges_target_step_id_fkey"
            columns: ["target_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_edges_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_services: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      process_steps: {
        Row: {
          action_gate: string | null
          cost_buffer_percent: number
          created_at: string
          default_unit_cost_amount: number
          default_unit_cost_is_billable: boolean
          default_unit_cost_name: string | null
          duration_days: number | null
          duration_hours: number
          id: string
          is_locked: boolean
          linked_resource_id: string | null
          node_position_x: number | null
          node_position_y: number | null
          operational_intent: string
          phase_number: number | null
          sort_order: number
          step_key: string
          suggested_expertise_role: string | null
          task_components: Json
          template_id: string
          title: string
          track: string
          updated_at: string
        }
        Insert: {
          action_gate?: string | null
          cost_buffer_percent?: number
          created_at?: string
          default_unit_cost_amount?: number
          default_unit_cost_is_billable?: boolean
          default_unit_cost_name?: string | null
          duration_days?: number | null
          duration_hours?: number
          id?: string
          is_locked?: boolean
          linked_resource_id?: string | null
          node_position_x?: number | null
          node_position_y?: number | null
          operational_intent?: string
          phase_number?: number | null
          sort_order: number
          step_key: string
          suggested_expertise_role?: string | null
          task_components?: Json
          template_id: string
          title: string
          track: string
          updated_at?: string
        }
        Update: {
          action_gate?: string | null
          cost_buffer_percent?: number
          created_at?: string
          default_unit_cost_amount?: number
          default_unit_cost_is_billable?: boolean
          default_unit_cost_name?: string | null
          duration_days?: number | null
          duration_hours?: number
          id?: string
          is_locked?: boolean
          linked_resource_id?: string | null
          node_position_x?: number | null
          node_position_y?: number | null
          operational_intent?: string
          phase_number?: number | null
          sort_order?: number
          step_key?: string
          suggested_expertise_role?: string | null
          task_components?: Json
          template_id?: string
          title?: string
          track?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_linked_resource_id_fkey"
            columns: ["linked_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          billing_cadence: string | null
          canvas_layout: Json
          created_at: string
          description: string
          id: string
          is_active: boolean
          label: string
          package_tier: string
          service_model: string | null
          service_slugs: string[]
          slug: string
          template_base_cost: number
          template_kind: string
          total_duration_days: number
          updated_at: string
          version: string
        }
        Insert: {
          billing_cadence?: string | null
          canvas_layout?: Json
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          label: string
          package_tier: string
          service_model?: string | null
          service_slugs?: string[]
          slug: string
          template_base_cost?: number
          template_kind?: string
          total_duration_days?: number
          updated_at?: string
          version?: string
        }
        Update: {
          billing_cadence?: string | null
          canvas_layout?: Json
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          label?: string
          package_tier?: string
          service_model?: string | null
          service_slugs?: string[]
          slug?: string
          template_base_cost?: number
          template_kind?: string
          total_duration_days?: number
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      marketing_daily_snapshots: {
        Row: {
          clicks: number | null
          client_id: string
          conversions: number | null
          cost: number | null
          created_at: string
          id: string
          impressions: number | null
          log_date: string
          metadata: Json | null
          sessions: number | null
          source: string
          updated_at: string
          users: number | null
        }
        Insert: {
          clicks?: number | null
          client_id: string
          conversions?: number | null
          cost?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          log_date: string
          metadata?: Json | null
          sessions?: number | null
          source: string
          updated_at?: string
          users?: number | null
        }
        Update: {
          clicks?: number | null
          client_id?: string
          conversions?: number | null
          cost?: number | null
          created_at?: string
          id?: string
          impressions?: number | null
          log_date?: string
          metadata?: Json | null
          sessions?: number | null
          source?: string
          updated_at?: string
          users?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_daily_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
          }
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
      projects: {
        Row: {
          client_id: string
          contract_renews_at: string | null
          created_at: string
          end_date: string | null
          id: string
          launch_date: string | null
          lead_admin_id: string | null
          scope: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          milestones: Json | null
          deliverables: Json | null
        }
        Insert: {
          client_id: string
          contract_renews_at?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          launch_date?: string | null
          lead_admin_id?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          milestones?: Json | null
          deliverables?: Json | null
        }
        Update: {
          client_id?: string
          contract_renews_at?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          launch_date?: string | null
          lead_admin_id?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          milestones?: Json | null
          deliverables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_admin_id_fkey"
            columns: ["lead_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_budget_costs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date_processed: string | null
          date_received: string | null
          id: string
          paid_for: string
          project_name: string | null
          prospect_id: string
          quote_number: string | null
          recurrence: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          paid_for: string
          project_name?: string | null
          prospect_id: string
          quote_number?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date_processed?: string | null
          date_received?: string | null
          id?: string
          paid_for?: string
          project_name?: string | null
          prospect_id?: string
          quote_number?: string | null
          recurrence?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_budget_costs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_budget_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      step_system_automations: {
        Row: {
          automation_trigger: string
          created_at: string
          id: string
          is_active: boolean
          step_id: string
          system_action: string
        }
        Insert: {
          automation_trigger: string
          created_at?: string
          id?: string
          is_active?: boolean
          step_id: string
          system_action: string
        }
        Update: {
          automation_trigger?: string
          created_at?: string
          id?: string
          is_active?: boolean
          step_id?: string
          system_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_system_automations_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
        ]
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
          client_id: string
          created_at: string
          id: string
          mime_type: string | null
          original_filename: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
          workspace_id: string | null
          category: string | null
          external_provider: string | null
          external_url: string | null
          file_name: string | null
          folder_key: string | null
          is_current: boolean | null
          is_legal: boolean | null
          label: string | null
          version: number | null
          replaces_file_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id?: string | null
          category?: string | null
          external_provider?: string | null
          external_url?: string | null
          file_name?: string | null
          folder_key?: string | null
          is_current?: boolean | null
          is_legal?: boolean | null
          label?: string | null
          version?: number | null
          replaces_file_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id?: string | null
          category?: string | null
          external_provider?: string | null
          external_url?: string | null
          file_name?: string | null
          folder_key?: string | null
          is_current?: boolean | null
          is_legal?: boolean | null
          label?: string | null
          version?: number | null
          replaces_file_id?: string | null
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
      workspace_assets: {
        Row: {
          category: string | null
          created_at: string
          file_path_url: string | null
          id: string
          structured_json_payload: Json | null
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_path_url?: string | null
          id?: string
          structured_json_payload?: Json | null
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_path_url?: string | null
          id?: string
          structured_json_payload?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          process_step_id: string | null
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
          process_step_id?: string | null
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
          process_step_id?: string | null
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
            foreignKeyName: "workspace_assignments_process_step_id_fkey"
            columns: ["process_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
