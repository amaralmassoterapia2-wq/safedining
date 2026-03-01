import { supabase } from './supabase';

const ORIGINAL_USER_KEY = 'safedining_dev_original_user_id';

async function signInAsUser(userId: string): Promise<{ error: string | null }> {
  // Call the edge function to get a magic link token (service role key stays server-side)
  const { data, error: fnError } = await supabase.functions.invoke('dev-impersonate', {
    body: { user_id: userId },
  });

  if (fnError) return { error: fnError.message };
  if (data?.error) return { error: data.error };
  if (!data?.hashed_token) return { error: 'No token returned from edge function' };

  const { error } = await supabase.auth.verifyOtp({
    token_hash: data.hashed_token,
    type: 'magiclink',
  });

  return { error: error?.message || null };
}

export function isImpersonating(): boolean {
  return !!localStorage.getItem(ORIGINAL_USER_KEY);
}

export async function impersonateRestaurant(restaurantId: string): Promise<{ error: string | null }> {
  // 1. Get the restaurant's owner_id
  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select('owner_id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restError || !restaurant) {
    return { error: restError?.message || 'Restaurant not found' };
  }

  // 2. Save current user ID before switching
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser && !isImpersonating()) {
    localStorage.setItem(ORIGINAL_USER_KEY, currentUser.id);
  }

  // 3. Sign in as the restaurant owner via edge function
  return signInAsUser(restaurant.owner_id);
}

export async function exitImpersonation(): Promise<{ error: string | null }> {
  const originalUserId = localStorage.getItem(ORIGINAL_USER_KEY);
  if (!originalUserId) {
    return { error: 'No original user to restore' };
  }

  localStorage.removeItem(ORIGINAL_USER_KEY);
  return signInAsUser(originalUserId);
}
