import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Weight unit enum matching the database enum
export type WeightUnit = 'g' | 'mg' | 'kg' | 'lb' | 'oz' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'piece' | 'pinch';

export const WEIGHT_UNITS: { value: WeightUnit; label: string; category: 'weight' | 'volume' | 'count' }[] = [
  { value: 'g', label: 'grams (g)', category: 'weight' },
  { value: 'mg', label: 'milligrams (mg)', category: 'weight' },
  { value: 'kg', label: 'kilograms (kg)', category: 'weight' },
  { value: 'lb', label: 'pounds (lb)', category: 'weight' },
  { value: 'oz', label: 'ounces (oz)', category: 'weight' },
  { value: 'ml', label: 'milliliters (ml)', category: 'volume' },
  { value: 'l', label: 'liters (L)', category: 'volume' },
  { value: 'tsp', label: 'teaspoons (tsp)', category: 'volume' },
  { value: 'tbsp', label: 'tablespoons (tbsp)', category: 'volume' },
  { value: 'cup', label: 'cups', category: 'volume' },
  { value: 'piece', label: 'pieces', category: 'count' },
  { value: 'pinch', label: 'pinches', category: 'count' },
];

export function formatAmount(value: number | null, unit: WeightUnit | null): string {
  if (value === null || unit === null) return '';

  const unitInfo = WEIGHT_UNITS.find(u => u.value === unit);
  if (!unitInfo) return `${value}`;

  switch (unit) {
    case 'g': return `${value}g`;
    case 'mg': return `${value}mg`;
    case 'kg': return `${value}kg`;
    case 'lb': return `${value} lb`;
    case 'oz': return `${value} oz`;
    case 'ml': return `${value}ml`;
    case 'l': return `${value}L`;
    case 'tsp': return `${value} tsp`;
    case 'tbsp': return `${value} tbsp`;
    case 'cup': return `${value} cup${value > 1 ? 's' : ''}`;
    case 'piece': return `${value} piece${value > 1 ? 's' : ''}`;
    case 'pinch': return `${value} pinch${value > 1 ? 'es' : ''}`;
    default: return `${value}`;
  }
}

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
          restaurant_code: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          qr_code?: string;
          restaurant_code?: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          qr_code?: string;
          restaurant_code?: string;
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
          description_allergens: string[];
          price: number | null;
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          carbs_fiber_g: number | null;
          carbs_sugar_g: number | null;
          carbs_added_sugar_g: number | null;
          fat_g: number | null;
          fat_saturated_g: number | null;
          fat_trans_g: number | null;
          fat_polyunsaturated_g: number | null;
          fat_monounsaturated_g: number | null;
          sodium_mg: number | null;
          cholesterol_mg: number | null;
          category: string | null;
          preparation: string | null;
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
          description_allergens?: string[];
          price?: number | null;
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          carbs_fiber_g?: number | null;
          carbs_sugar_g?: number | null;
          carbs_added_sugar_g?: number | null;
          fat_g?: number | null;
          fat_saturated_g?: number | null;
          fat_trans_g?: number | null;
          fat_polyunsaturated_g?: number | null;
          fat_monounsaturated_g?: number | null;
          sodium_mg?: number | null;
          cholesterol_mg?: number | null;
          category?: string | null;
          preparation?: string | null;
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
          description_allergens?: string[];
          price?: number | null;
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          carbs_fiber_g?: number | null;
          carbs_sugar_g?: number | null;
          carbs_added_sugar_g?: number | null;
          fat_g?: number | null;
          fat_saturated_g?: number | null;
          fat_trans_g?: number | null;
          fat_polyunsaturated_g?: number | null;
          fat_monounsaturated_g?: number | null;
          sodium_mg?: number | null;
          cholesterol_mg?: number | null;
          category?: string | null;
          preparation?: string | null;
          modification_policy?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      ingredients: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          contains_allergens: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          contains_allergens?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          contains_allergens?: string[];
          created_at?: string;
        };
      };
      menu_item_ingredients: {
        Row: {
          id: string;
          menu_item_id: string;
          ingredient_id: string;
          amount_value: number | null;
          amount_unit: WeightUnit | null;
          is_removable: boolean;
          is_substitutable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          ingredient_id: string;
          amount_value?: number | null;
          amount_unit?: WeightUnit | null;
          is_removable?: boolean;
          is_substitutable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          ingredient_id?: string;
          amount_value?: number | null;
          amount_unit?: WeightUnit | null;
          is_removable?: boolean;
          is_substitutable?: boolean;
          created_at?: string;
        };
      };
      ingredient_substitutes: {
        Row: {
          id: string;
          menu_item_ingredient_id: string;
          substitute_ingredient_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_item_ingredient_id: string;
          substitute_ingredient_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_ingredient_id?: string;
          substitute_ingredient_id?: string;
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
