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
          display_name: string | null
          avatar_url: string | null
          locale: string
          time_zone: string
          date_style: 'short' | 'medium' | 'long' | 'full'
          time_format: '12h' | '24h'
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          locale?: string
          time_zone?: string
          date_style?: 'short' | 'medium' | 'long' | 'full'
          time_format?: '12h' | '24h'
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          locale?: string
          time_zone?: string
          date_style?: 'short' | 'medium' | 'long' | 'full'
          time_format?: '12h' | '24h'
          created_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string
          created_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'admin' | 'member'
          created_at?: string
        }
      }
      user_integrations: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          provider: string
          access_token_encrypted: string
          token_iv: string
          refresh_token_encrypted: string | null
          expires_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          provider: string
          access_token_encrypted: string
          token_iv: string
          refresh_token_encrypted?: string | null
          expires_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          provider?: string
          access_token_encrypted?: string
          token_iv?: string
          refresh_token_encrypted?: string | null
          expires_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      planner_tasks: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          title: string
          description: string | null
          scheduled_at: string
          duration_minutes: number
          status: string
          kind: string
          platform: string | null
          link_url: string | null
          color: string | null
          external_source: string | null
          external_id: string | null
          external_calendar_id: string | null
          payload: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          title: string
          description?: string | null
          scheduled_at: string
          duration_minutes?: number
          status?: string
          kind?: string
          platform?: string | null
          link_url?: string | null
          color?: string | null
          external_source?: string | null
          external_id?: string | null
          external_calendar_id?: string | null
          payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          title?: string
          description?: string | null
          scheduled_at?: string
          duration_minutes?: number
          status?: string
          kind?: string
          platform?: string | null
          link_url?: string | null
          color?: string | null
          external_source?: string | null
          external_id?: string | null
          external_calendar_id?: string | null
          payload?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      scheduled_posts: {
        Row: {
          id: string
          planner_task_id: string
          platform: string
          content: string
          media_urls: string[] | null
          published_at: string | null
          published_url: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          planner_task_id: string
          platform: string
          content: string
          media_urls?: string[] | null
          published_at?: string | null
          published_url?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          planner_task_id?: string
          platform?: string
          content?: string
          media_urls?: string[] | null
          published_at?: string | null
          published_url?: string | null
          error?: string | null
          created_at?: string
        }
      }
      meta_ads_onboarding: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          answers: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          answers?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          answers?: Json
          created_at?: string
          updated_at?: string
        }
      }
      workspace_ai_settings: {
        Row: {
          id: string
          workspace_id: string
          updated_by: string
          content_provider: 'openrouter' | 'lmstudio'
          openrouter_api_key_encrypted: string | null
          openrouter_api_key_iv: string | null
          openrouter_content_model: string | null
          openrouter_image_model: string | null
          fal_api_key_encrypted: string | null
          fal_api_key_iv: string | null
          fal_video_model: string | null
          lmstudio_base_url: string
          lmstudio_content_model: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          updated_by: string
          content_provider?: 'openrouter' | 'lmstudio'
          openrouter_api_key_encrypted?: string | null
          openrouter_api_key_iv?: string | null
          openrouter_content_model?: string | null
          openrouter_image_model?: string | null
          fal_api_key_encrypted?: string | null
          fal_api_key_iv?: string | null
          fal_video_model?: string | null
          lmstudio_base_url?: string
          lmstudio_content_model?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          updated_by?: string
          content_provider?: 'openrouter' | 'lmstudio'
          openrouter_api_key_encrypted?: string | null
          openrouter_api_key_iv?: string | null
          openrouter_content_model?: string | null
          openrouter_image_model?: string | null
          fal_api_key_encrypted?: string | null
          fal_api_key_iv?: string | null
          fal_video_model?: string | null
          lmstudio_base_url?: string
          lmstudio_content_model?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      has_role: {
        Args: { user_uuid: string; role_name: string }
        Returns: boolean
      }
    }
  }
}
