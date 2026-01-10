# Database Customization Guide

## Customizing Available Dietary Restrictions

The dietary restrictions shown to customers come from the database.

### View Current Restrictions

In Supabase Dashboard:
1. Go to **Table Editor**
2. Select **dietary_restrictions** table
3. You'll see 10 default restrictions

### Add New Dietary Restriction

**Example: Add "Low-Carb" restriction**

In Supabase Dashboard → SQL Editor, run:

```sql
INSERT INTO dietary_restrictions (name, allergens, description)
VALUES (
  'Low-Carb',
  ARRAY['bread', 'pasta', 'rice', 'potato', 'wheat', 'flour'],
  'Reduced carbohydrate intake'
);
```

### Edit Existing Restriction

```sql
UPDATE dietary_restrictions
SET allergens = ARRAY['milk', 'cheese', 'butter', 'cream', 'dairy', 'whey', 'casein']
WHERE name = 'Dairy-Free';
```

### Remove a Restriction

```sql
DELETE FROM dietary_restrictions
WHERE name = 'Kosher';
```

---

## Add Custom Fields to Menu Items

Want to track extra information? Here's how:

### Example: Add "Spice Level" to Menu Items

**1. Update Database Schema**

In Supabase → SQL Editor:

```sql
-- Add column to menu_items table
ALTER TABLE menu_items
ADD COLUMN spice_level integer DEFAULT 0;

-- Add a check constraint (0-5 scale)
ALTER TABLE menu_items
ADD CONSTRAINT spice_level_range CHECK (spice_level >= 0 AND spice_level <= 5);
```

**2. Update TypeScript Types**

In `/src/lib/supabase.ts`, add to `menu_items` Row type:

```tsx
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
    spice_level: number;  // ← Add this
    created_at: string;
    updated_at: string;
  };
  // Also add to Insert and Update types
}
```

**3. Add to Menu Item Form**

In `/src/components/admin/MenuItemForm.tsx`, add input field:

```tsx
const [spiceLevel, setSpiceLevel] = useState(0);

// In the form JSX:
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Spice Level (0-5)
  </label>
  <input
    type="number"
    min="0"
    max="5"
    value={spiceLevel}
    onChange={(e) => setSpiceLevel(parseInt(e.target.value))}
    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
  />
</div>

// In handleSubmit, add to insert/update:
spice_level: spiceLevel,
```

**4. Display in Customer Menu**

In `/src/pages/CustomerMenu.tsx`, add to menu card:

```tsx
{item.spice_level > 0 && (
  <div className="flex items-center gap-1 text-sm text-red-600">
    {'🌶️'.repeat(item.spice_level)}
  </div>
)}
```

---

## Add Restaurant Customization Options

### Example: Add Restaurant Logo

**1. Add Database Column**

```sql
ALTER TABLE restaurants
ADD COLUMN logo_url text;
```

**2. Update TypeScript Types**

In `/src/lib/supabase.ts`:

```tsx
restaurants: {
  Row: {
    id: string;
    name: string;
    description: string | null;
    qr_code: string;
    owner_id: string;
    logo_url: string | null;  // ← Add this
    created_at: string;
    updated_at: string;
  };
  // Also add to Insert and Update
}
```

**3. Add to Restaurant Setup Form**

In `/src/components/admin/RestaurantSetup.tsx`:

```tsx
const [logoUrl, setLogoUrl] = useState('');

// Add input field
<div>
  <label htmlFor="logoUrl" className="block text-sm font-medium text-slate-700 mb-2">
    Logo URL (Optional)
  </label>
  <input
    id="logoUrl"
    type="url"
    value={logoUrl}
    onChange={(e) => setLogoUrl(e.target.value)}
    className="w-full px-4 py-3 border border-slate-300 rounded-lg"
    placeholder="https://example.com/logo.png"
  />
</div>

// In insert:
logo_url: logoUrl || null,
```

**4. Display Logo in Customer Menu**

In `/src/pages/CustomerMenu.tsx`:

```tsx
<div className="flex items-center gap-3">
  {restaurant.logo_url && (
    <img
      src={restaurant.logo_url}
      alt={restaurant.name}
      className="w-12 h-12 rounded-lg object-cover"
    />
  )}
  <div>
    <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
    {restaurant.description && (
      <p className="text-sm text-slate-600 mt-1">{restaurant.description}</p>
    )}
  </div>
</div>
```

---

## Add Customer Favorites/History

Track what customers viewed or favorited:

**1. Create New Table**

```sql
CREATE TABLE IF NOT EXISTS customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id uuid REFERENCES customer_profiles(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_profile_id, menu_item_id)
);

CREATE INDEX idx_customer_favorites_profile ON customer_favorites(customer_profile_id);

ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites"
  ON customer_favorites FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
```

**2. Add TypeScript Types**

In `/src/lib/supabase.ts`, add to Database type:

```tsx
customer_favorites: {
  Row: {
    id: string;
    customer_profile_id: string;
    menu_item_id: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    customer_profile_id: string;
    menu_item_id: string;
    created_at?: string;
  };
}
```

**3. Add Favorite Button to Menu**

In `/src/pages/CustomerMenu.tsx`:

```tsx
import { Heart } from 'lucide-react';

const [favorites, setFavorites] = useState<string[]>([]);

// Load favorites on mount
useEffect(() => {
  loadFavorites();
}, []);

const loadFavorites = async () => {
  const sessionId = getOrCreateSessionId();
  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (profile) {
    const { data } = await supabase
      .from('customer_favorites')
      .select('menu_item_id')
      .eq('customer_profile_id', profile.id);

    if (data) {
      setFavorites(data.map(f => f.menu_item_id));
    }
  }
};

const toggleFavorite = async (itemId: string) => {
  const sessionId = getOrCreateSessionId();
  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (!profile) return;

  if (favorites.includes(itemId)) {
    await supabase
      .from('customer_favorites')
      .delete()
      .eq('customer_profile_id', profile.id)
      .eq('menu_item_id', itemId);
    setFavorites(favorites.filter(id => id !== itemId));
  } else {
    await supabase
      .from('customer_favorites')
      .insert({
        customer_profile_id: profile.id,
        menu_item_id: itemId,
      });
    setFavorites([...favorites, itemId]);
  }
};

// Add button in menu card
<button
  onClick={(e) => {
    e.stopPropagation();
    toggleFavorite(item.id);
  }}
  className="p-2 hover:bg-slate-100 rounded-lg"
>
  <Heart
    className={`w-5 h-5 ${
      favorites.includes(item.id)
        ? 'fill-red-500 text-red-500'
        : 'text-slate-400'
    }`}
  />
</button>
```

---

## Add Menu Item Images

**1. Add Database Column**

```sql
ALTER TABLE menu_items
ADD COLUMN image_url text;
```

**2. Update Types** (see previous examples)

**3. Add Image Upload to Admin Form**

In `/src/components/admin/MenuItemForm.tsx`:

```tsx
const [imageUrl, setImageUrl] = useState('');

// Add input
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Image URL
  </label>
  <input
    type="url"
    value={imageUrl}
    onChange={(e) => setImageUrl(e.target.value)}
    placeholder="https://example.com/dish.jpg"
    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
  />
  {imageUrl && (
    <img
      src={imageUrl}
      alt="Preview"
      className="mt-2 w-32 h-32 object-cover rounded-lg"
    />
  )}
</div>

// Include in insert/update
image_url: imageUrl || null,
```

**4. Display in Customer Menu**

See Feature Customization Guide section 8.

---

## Modify Allergen Detection Logic

The safety analysis logic is in `/src/lib/safetyAnalysis.ts`.

### Example: Make Analysis More Strict

Current logic checks if allergen name is contained in ingredient name. To make it stricter:

```tsx
// Before (substring match)
if (ingredientName.includes(allergen) || ingredientAllergens.includes(allergen))

// After (exact match only)
if (ingredientName === allergen || ingredientAllergens.includes(allergen))
```

### Example: Add Warning Thresholds

```tsx
// Add a warning level between safe and unsafe
export type SafetyStatus = 'safe' | 'caution' | 'safe-with-modifications' | 'unsafe';

// In analyzeDishSafety function:
if (foundAllergens.size === 1 && crossContactRisks.length === 0) {
  return {
    status: 'caution',
    reasons: [`May contain trace amounts of ${Array.from(foundAllergens)[0]}`],
  };
}
```

---

## Common Database Queries

### See All Customer Profiles
```sql
SELECT
  cp.*,
  COUNT(DISTINCT cr.id) as total_requests
FROM customer_profiles cp
LEFT JOIN chef_requests cr ON cr.customer_profile_id = cp.id
GROUP BY cp.id
ORDER BY cp.created_at DESC;
```

### Most Common Dietary Restrictions
```sql
SELECT
  unnest(dietary_restrictions) as restriction,
  COUNT(*) as count
FROM customer_profiles
GROUP BY restriction
ORDER BY count DESC;
```

### Popular Menu Items
```sql
SELECT
  mi.name,
  mi.category,
  COUNT(cr.id) as request_count
FROM menu_items mi
LEFT JOIN chef_requests cr ON cr.menu_item_id = mi.id
GROUP BY mi.id, mi.name, mi.category
ORDER BY request_count DESC;
```

### Accessibility Report
```sql
SELECT
  mi.name,
  mi.category,
  COUNT(DISTINCT i.id) as ingredient_count,
  array_agg(DISTINCT unnest(i.contains_allergens)) as all_allergens
FROM menu_items mi
LEFT JOIN ingredients i ON i.menu_item_id = mi.id
WHERE mi.is_active = true
GROUP BY mi.id, mi.name, mi.category
ORDER BY ingredient_count DESC;
```
