export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'STUDENT' | 'GUEST';
export type ItemType = 'LOST' | 'FOUND';
export type ItemStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLAIMED' | 'RESOLVED' | 'RETURNED' | 'ARCHIVED';
export type ClaimStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type DeviceType = 'WEB' | 'ANDROID' | 'IOS';
export type BroadcastTarget = 'ALL_USERS' | 'STUDENTS_ONLY' | 'ADMINS_ONLY' | 'SPECIFIC_DEPARTMENT' | 'SPECIFIC_COLLEGE';

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string;
          name: AppRole;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: AppRole;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: AppRole;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      colleges: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          aliases: string[];
          location: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          aliases?: string[];
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string | null;
          aliases?: string[];
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          college_name: string | null;
          student_id: string | null;
          department: string | null;
          phone_number: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          college_name?: string | null;
          student_id?: string | null;
          department?: string | null;
          phone_number?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          college_name?: string | null;
          student_id?: string | null;
          department?: string | null;
          phone_number?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          color: string;
          type: 'SCHEDULE' | 'REMINDER' | 'LOST_FOUND' | 'GENERAL';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          color?: string;
          type: 'SCHEDULE' | 'REMINDER' | 'LOST_FOUND' | 'GENERAL';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          color?: string;
          type?: 'SCHEDULE' | 'REMINDER' | 'LOST_FOUND' | 'GENERAL';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          title: string;
          description: string | null;
          location: string | null;
          instructor: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          recurrence: RecurrenceType;
          color: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          title: string;
          description?: string | null;
          location?: string | null;
          instructor?: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          recurrence?: RecurrenceType;
          color?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          title?: string;
          description?: string | null;
          location?: string | null;
          instructor?: string | null;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          recurrence?: RecurrenceType;
          color?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          schedule_id: string | null;
          title: string;
          description: string | null;
          due_date: string;
          priority: PriorityLevel;
          recurrence: RecurrenceType;
          is_completed: boolean;
          completed_at: string | null;
          notify_before_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          schedule_id?: string | null;
          title: string;
          description?: string | null;
          due_date: string;
          priority?: PriorityLevel;
          recurrence?: RecurrenceType;
          is_completed?: boolean;
          completed_at?: string | null;
          notify_before_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          schedule_id?: string | null;
          title?: string;
          description?: string | null;
          due_date?: string;
          priority?: PriorityLevel;
          recurrence?: RecurrenceType;
          is_completed?: boolean;
          completed_at?: string | null;
          notify_before_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lost_items: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          college_name: string | null;
          title: string;
          description: string;
          last_seen_location: string;
          lost_date: string;
          image_urls: string[];
          status: ItemStatus;
          reward_offered: string | null;
          contact_info: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          college_name?: string | null;
          title: string;
          description: string;
          last_seen_location: string;
          lost_date: string;
          image_urls?: string[];
          status?: ItemStatus;
          reward_offered?: string | null;
          contact_info?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          college_name?: string | null;
          title?: string;
          description?: string;
          last_seen_location?: string;
          lost_date?: string;
          image_urls?: string[];
          status?: ItemStatus;
          reward_offered?: string | null;
          contact_info?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      found_items: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          college_name: string | null;
          title: string;
          description: string;
          found_location: string;
          current_location: string;
          found_date: string;
          image_urls: string[];
          status: ItemStatus;
          handover_notes: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          college_name?: string | null;
          title: string;
          description: string;
          found_location: string;
          current_location: string;
          found_date: string;
          image_urls?: string[];
          status?: ItemStatus;
          handover_notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          college_name?: string | null;
          title?: string;
          description?: string;
          found_location?: string;
          current_location?: string;
          found_date?: string;
          image_urls?: string[];
          status?: ItemStatus;
          handover_notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      claims: {
        Row: {
          id: string;
          found_item_id: string;
          claimant_id: string;
          proof_description: string;
          proof_image_urls: string[];
          status: ClaimStatus;
          review_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          found_item_id: string;
          claimant_id: string;
          proof_description: string;
          proof_image_urls?: string[];
          status?: ClaimStatus;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          found_item_id?: string;
          claimant_id?: string;
          proof_description?: string;
          proof_image_urls?: string[];
          status?: ClaimStatus;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: 'LOST_ITEM' | 'FOUND_ITEM' | 'CLAIM' | 'USER';
          target_id: string;
          reason: string;
          details: string | null;
          status: ReportStatus;
          resolution_notes: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: 'LOST_ITEM' | 'FOUND_ITEM' | 'CLAIM' | 'USER';
          target_id: string;
          reason: string;
          details?: string | null;
          status?: ReportStatus;
          resolution_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: 'LOST_ITEM' | 'FOUND_ITEM' | 'CLAIM' | 'USER';
          target_id?: string;
          reason?: string;
          details?: string | null;
          status?: ReportStatus;
          resolution_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: string;
          data: Json;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          type: string;
          data?: Json;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          type?: string;
          data?: Json;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      admin_broadcasts: {
        Row: {
          id: string;
          created_by: string;
          title: string;
          message: string;
          target: BroadcastTarget;
          department: string | null;
          is_scheduled: boolean;
          scheduled_for: string | null;
          is_sent: boolean;
          sent_at: string | null;
          total_recipients: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          title: string;
          message: string;
          target?: BroadcastTarget;
          department?: string | null;
          is_scheduled?: boolean;
          scheduled_for?: string | null;
          is_sent?: boolean;
          sent_at?: string | null;
          total_recipients?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          title?: string;
          message?: string;
          target?: BroadcastTarget;
          department?: string | null;
          is_scheduled?: boolean;
          scheduled_for?: string | null;
          is_sent?: boolean;
          sent_at?: string | null;
          total_recipients?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          device_type: DeviceType;
          device_info: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          device_type: DeviceType;
          device_info?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          device_type?: DeviceType;
          device_info?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_table: string;
          target_id: string | null;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          action: string;
          target_table: string;
          target_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string | null;
          action?: string;
          target_table?: string;
          target_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      send_admin_broadcast: {
        Args: {
          broadcast_id: string;
        };
        Returns: number;
      };
      merge_colleges: {
        Args: {
          target_name: string;
          source_names: string[];
        };
        Returns: number;
      };
    };
  };
}
