import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          qr_code: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          qr_code?: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          qr_code?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          price: number | null;
          category: string | null;
          modification_policy: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          description?: string | null;
          price?: number | null;
          category?: string | null;
          modification_policy: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          description?: string | null;
          price?: number | null;
          category?: string | null;
          modification_policy?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      ingredients: {
        Row: {
          id: string;
          menu_item_id: string;
          name: string;
          amount: string;
          contains_allergens: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          name: string;
          amount: string;
          contains_allergens?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          name?: string;
          amount?: string;
          contains_allergens?: string[];
          created_at?: string;
        };
      };
      cooking_steps: {
        Row: {
          id: string;
          menu_item_id: string;
          step_number: number;
          description: string;
          cross_contact_risk: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          step_number: number;
          description: string;
          cross_contact_risk?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          step_number?: number;
          description?: string;
          cross_contact_risk?: string[];
          created_at?: string;
        };
      };
      dietary_restrictions: {
        Row: {
          id: string;
          name: string;
          allergens: string[];
          description: string | null;
          created_at: string;
        };
      };
      customer_profiles: {
        Row: {
          id: string;
          session_id: string;
          dietary_restrictions: string[];
          custom_allergens: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          dietary_restrictions?: string[];
          custom_allergens?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          dietary_restrictions?: string[];
          custom_allergens?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      chef_requests: {
        Row: {
          id: string;
          restaurant_id: string;
          menu_item_id: string;
          customer_profile_id: string;
          request_details: string;
          status: 'pending' | 'approved' | 'declined';
          chef_response: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          menu_item_id: string;
          customer_profile_id: string;
          request_details: string;
          status?: 'pending' | 'approved' | 'declined';
          chef_response?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          menu_item_id?: string;
          customer_profile_id?: string;
          request_details?: string;
          status?: 'pending' | 'approved' | 'declined';
          chef_response?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
