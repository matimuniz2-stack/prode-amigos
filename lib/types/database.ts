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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: unknown
          reason: string
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          reason: string
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          reason?: string
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      global_predictions: {
        Row: {
          category: string
          created_at: string
          id: string
          is_auto_random: boolean
          locked_at: string | null
          player_name: string | null
          player_team_id: string | null
          scored_at: string | null
          state: string
          team_id: string | null
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_auto_random?: boolean
          locked_at?: string | null
          player_name?: string | null
          player_team_id?: string | null
          scored_at?: string | null
          state?: string
          team_id?: string | null
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_auto_random?: boolean
          locked_at?: string | null
          player_name?: string | null
          player_team_id?: string | null
          scored_at?: string | null
          state?: string
          team_id?: string | null
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_predictions_player_team_id_fkey"
            columns: ["player_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_predictions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_predictions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          code: string
          id: string
          tournament_id: string
        }
        Insert: {
          code: string
          id?: string
          tournament_id: string
        }
        Update: {
          code?: string
          id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          detail: Json
          external_event_id: string | null
          id: string
          kind: string
          match_id: string
          minute: number | null
          occurred_at: string
          player_name: string | null
          team_id: string | null
        }
        Insert: {
          detail?: Json
          external_event_id?: string | null
          id?: string
          kind: string
          match_id: string
          minute?: number | null
          occurred_at?: string
          player_name?: string | null
          team_id?: string | null
        }
        Update: {
          detail?: Json
          external_event_id?: string | null
          id?: string
          kind?: string
          match_id?: string
          minute?: number | null
          occurred_at?: string
          player_name?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_prediction_history: {
        Row: {
          edited_at: string
          edited_by: string | null
          id: string
          is_auto_random: boolean | null
          match_id: string
          predicted_away: number | null
          predicted_home: number | null
          predicted_ko_winner_team_id: string | null
          predicted_winner: string | null
          prediction_id: string
          state: string | null
          user_id: string
        }
        Insert: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_auto_random?: boolean | null
          match_id: string
          predicted_away?: number | null
          predicted_home?: number | null
          predicted_ko_winner_team_id?: string | null
          predicted_winner?: string | null
          prediction_id: string
          state?: string | null
          user_id: string
        }
        Update: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_auto_random?: boolean | null
          match_id?: string
          predicted_away?: number | null
          predicted_home?: number | null
          predicted_ko_winner_team_id?: string | null
          predicted_winner?: string | null
          prediction_id?: string
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leaderboard_snapshots: {
        Row: {
          captured_at: string
          id: string
          rank: number
          snapshot_date: string
          total_points: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          id?: string
          rank: number
          snapshot_date: string
          total_points: number
          tournament_id: string
          user_id: string
        }
        Update: {
          captured_at?: string
          id?: string
          rank?: number
          snapshot_date?: string
          total_points?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: []
      }
      match_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          match_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          match_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          match_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pick_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          match_id: string
          reactor_user_id: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          match_id: string
          reactor_user_id: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          match_id?: string
          reactor_user_id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      match_predictions: {
        Row: {
          created_at: string
          id: string
          is_auto_random: boolean
          locked_at: string | null
          match_id: string
          predicted_away: number
          predicted_home: number
          predicted_ko_winner_team_id: string | null
          predicted_winner: string
          scored_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_auto_random?: boolean
          locked_at?: string | null
          match_id: string
          predicted_away: number
          predicted_home: number
          predicted_ko_winner_team_id?: string | null
          predicted_winner: string
          scored_at?: string | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_auto_random?: boolean
          locked_at?: string | null
          match_id?: string
          predicted_away?: number
          predicted_home?: number
          predicted_ko_winner_team_id?: string | null
          predicted_winner?: string
          scored_at?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_predicted_ko_winner_team_id_fkey"
            columns: ["predicted_ko_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_placeholder: string | null
          away_team_id: string | null
          created_at: string
          espn_event_id: string | null
          external_api_id: string | null
          finalized_at: string | null
          group_id: string | null
          home_placeholder: string | null
          home_team_id: string | null
          id: string
          kickoff_at: string
          ko_winner_team_id: string | null
          lock_at: string
          match_number: number
          result_source: string | null
          score_away: number | null
          score_home: number | null
          stage_id: string
          status: string
          tournament_id: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_placeholder?: string | null
          away_team_id?: string | null
          created_at?: string
          espn_event_id?: string | null
          external_api_id?: string | null
          finalized_at?: string | null
          group_id?: string | null
          home_placeholder?: string | null
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          ko_winner_team_id?: string | null
          lock_at: string
          match_number: number
          result_source?: string | null
          score_away?: number | null
          score_home?: number | null
          stage_id: string
          status?: string
          tournament_id: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_placeholder?: string | null
          away_team_id?: string | null
          created_at?: string
          espn_event_id?: string | null
          external_api_id?: string | null
          finalized_at?: string | null
          group_id?: string | null
          home_placeholder?: string | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          ko_winner_team_id?: string | null
          lock_at?: string
          match_number?: number
          result_source?: string | null
          score_away?: number | null
          score_home?: number | null
          stage_id?: string
          status?: string
          tournament_id?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_ko_winner_team_id_fkey"
            columns: ["ko_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      points_log: {
        Row: {
          awarded_at: string
          breakdown: Json
          id: string
          points: number
          rule_key: string
          scope_stage: string | null
          source_id: string
          source_kind: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          breakdown?: Json
          id?: string
          points: number
          rule_key: string
          scope_stage?: string | null
          source_id: string
          source_kind: string
          tournament_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          breakdown?: Json
          id?: string
          points?: number
          rule_key?: string
          scope_stage?: string | null
          source_id?: string
          source_kind?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          created_at: string
          currency: string
          id: string
          notes: string | null
          status: string
          total_amount: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_rules: {
        Row: {
          description: string | null
          fixed_amount: number | null
          id: string
          pool_id: string
          rule_key: string
          share_pct: number | null
        }
        Insert: {
          description?: string | null
          fixed_amount?: number | null
          id?: string
          pool_id: string
          rule_key: string
          share_pct?: number | null
        }
        Update: {
          description?: string | null
          fixed_amount?: number | null
          id?: string
          pool_id?: string
          rule_key?: string
          share_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_rules_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      declarations: {
        Row: {
          id: string
          user_id: string
          day_key: string
          text: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day_key: string
          text: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day_key?: string
          text?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nickname: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nickname: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nickname?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          active_from: string
          active_to: string | null
          id: string
          params: Json
          points: number
          rule_key: string
          scope_stage: string | null
          tournament_id: string
          version: number
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          id?: string
          params?: Json
          points: number
          rule_key: string
          scope_stage?: string | null
          tournament_id: string
          version?: number
        }
        Update: {
          active_from?: string
          active_to?: string | null
          id?: string
          params?: Json
          points?: number
          rule_key?: string
          scope_stage?: string | null
          tournament_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          code: string
          id: string
          name: string
          order_idx: number
          scoring_profile: string
          tournament_id: string
        }
        Insert: {
          code: string
          id?: string
          name: string
          order_idx: number
          scoring_profile: string
          tournament_id: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
          order_idx?: number
          scoring_profile?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          flag_emoji: string | null
          group_id: string | null
          id: string
          name: string
          seed_pot: number | null
          tournament_id: string
        }
        Insert: {
          code: string
          flag_emoji?: string | null
          group_id?: string | null
          id?: string
          name: string
          seed_pot?: number | null
          tournament_id: string
        }
        Update: {
          code?: string
          flag_emoji?: string | null
          group_id?: string | null
          id?: string
          name?: string
          seed_pot?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          config: Json
          created_at: string
          ends_at: string
          globals_lock_at: string
          id: string
          name: string
          slug: string
          starts_at: string
          status: string
        }
        Insert: {
          config?: Json
          created_at?: string
          ends_at: string
          globals_lock_at: string
          id?: string
          name: string
          slug: string
          starts_at: string
          status?: string
        }
        Update: {
          config?: Json
          created_at?: string
          ends_at?: string
          globals_lock_at?: string
          id?: string
          name?: string
          slug?: string
          starts_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          globals_scored: number | null
          match_picks_scored: number | null
          nickname: string | null
          total_points: number | null
          tournament_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_projection: {
        Row: {
          avatar_url: string | null
          currency: string | null
          nickname: string | null
          pool_total: number | null
          projected_prize: number | null
          rank: number | null
          total_points: number | null
          tournament_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_view_predictions: {
        Args: { p_reason: string; p_user_id: string }
        Returns: {
          created_at: string
          id: string
          is_auto_random: boolean
          locked_at: string | null
          match_id: string
          predicted_away: number
          predicted_home: number
          predicted_ko_winner_team_id: string | null
          predicted_winner: string
          scored_at: string | null
          state: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "match_predictions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      calculate_match: { Args: { p_match_id: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_match_visible: { Args: { p_match_id: string }; Returns: boolean }
      lock_due_predictions: { Args: never; Returns: number }
      match_set_result: {
        Args: {
          p_finalize: boolean
          p_ko_winner_team_id: string
          p_match_id: string
          p_reason: string
          p_score_away: number
          p_score_home: number
        }
        Returns: undefined
      }
      recalc_all: {
        Args: { p_reason: string; p_tournament_id: string }
        Returns: number
      }
      recalc_match: {
        Args: { p_match_id: string; p_reason: string }
        Returns: number
      }
      resolve_global: {
        Args: {
          p_category: string
          p_player_name: string
          p_reason: string
          p_team_id: string
          p_tournament_id: string
        }
        Returns: number
      }
      resolve_ko_round: {
        Args: {
          p_reason: string
          p_stage_code: string
          p_tournament_id: string
        }
        Returns: number
      }
      revert_ko_round: {
        Args: {
          p_reason: string
          p_stage_code: string
          p_tournament_id: string
        }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
