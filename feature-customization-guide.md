# Feature Customization Guide

## Customer Interface Features

### 1. Change Safety Icons (Emojis)

**File:** `/src/lib/safetyAnalysis.ts`

**Current (Lines 117-126):**
```tsx
export function getStatusIcon(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return '🟢';
    case 'safe-with-modifications':
      return '🟠';
    case 'unsafe':
      return '🔴';
  }
}
```

**Option 1: Different Emojis**
```tsx
export function getStatusIcon(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return '✅';  // Checkmark
    case 'safe-with-modifications':
      return '⚠️';   // Warning
    case 'unsafe':
      return '❌';  // X mark
  }
}
```

**Option 2: Use Lucide React Icons**

First, update the function to return JSX instead:
```tsx
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function getStatusIcon(status: SafetyStatus) {
  switch (status) {
    case 'safe':
      return <CheckCircle className="w-6 h-6 text-green-600" />;
    case 'safe-with-modifications':
      return <AlertTriangle className="w-6 h-6 text-orange-600" />;
    case 'unsafe':
      return <XCircle className="w-6 h-6 text-red-600" />;
  }
}
```

---

### 2. Customize Safety Labels

**File:** `/src/lib/safetyAnalysis.ts`

**Current (Lines 128-137):**
```tsx
export function getStatusLabel(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'Safe';
    case 'safe-with-modifications':
      return 'Safe with modifications';
    case 'unsafe':
      return 'Unsafe';
  }
}
```

**Customize:**
```tsx
export function getStatusLabel(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'Good to Go!';           // Friendly
    case 'safe-with-modifications':
      return 'Ask About Options';     // Action-oriented
    case 'unsafe':
      return 'Not Recommended';       // Softer language
  }
}
```

---

### 3. Add Restaurant Logo/Image Display

**File:** `/src/pages/CustomerMenu.tsx`

Find the header section (around line 155) and add an image:

**Before:**
```tsx
<h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
```

**After:**
```tsx
<div className="flex items-center gap-3">
  {restaurant.logo_url && (
    <img
      src={restaurant.logo_url}
      alt={restaurant.name}
      className="w-12 h-12 rounded-lg object-cover"
    />
  )}
  <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
</div>
```

Note: You'll need to add `logo_url` to the restaurant database table first.

---

### 4. Remove "Ask Chef" Feature

If you don't want customers to send requests:

**File:** `/src/components/customer/DishDetail.tsx`

Find and delete/comment out (around lines 100-130):
```tsx
{!showRequestForm ? (
  <button
    onClick={() => setShowRequestForm(true)}
    className="w-full flex items-center justify-center gap-2..."
  >
    <MessageCircle className="w-5 h-5" />
    Ask Chef About This Dish
  </button>
) : (
  // ... request form code
)}
```

---

### 5. Hide Settings Button (Prevent Profile Changes)

**File:** `/src/pages/CustomerMenu.tsx`

Around line 164, remove:
```tsx
<button
  onClick={onEditProfile}
  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
>
  <Settings className="w-5 h-5 text-slate-600" />
</button>
```

---

### 6. Add Price Range Filter

**File:** `/src/pages/CustomerMenu.tsx`

Add after the category filter section:

```tsx
const [priceFilter, setPriceFilter] = useState<'all' | 'under10' | 'under20' | 'over20'>('all');

// Update filteredItems logic
const filteredItems = menuItems.filter((item) => {
  const matchesCategory = filterCategory === 'all' || item.category === filterCategory;

  let matchesPrice = true;
  if (priceFilter === 'under10' && item.price && item.price >= 10) matchesPrice = false;
  if (priceFilter === 'under20' && item.price && item.price >= 20) matchesPrice = false;
  if (priceFilter === 'over20' && item.price && item.price < 20) matchesPrice = false;

  return matchesCategory && matchesPrice;
});

// Add UI buttons
<div className="flex gap-2">
  <button onClick={() => setPriceFilter('all')}>All Prices</button>
  <button onClick={() => setPriceFilter('under10')}>Under $10</button>
  <button onClick={() => setPriceFilter('under20')}>Under $20</button>
  <button onClick={() => setPriceFilter('over20')}>$20+</button>
</div>
```

---

### 7. Show Only Safe Items by Default

**File:** `/src/pages/CustomerMenu.tsx`

Add a toggle switch:

```tsx
const [showOnlySafe, setShowOnlySafe] = useState(false);

const filteredItems = menuItems
  .filter((item) => {
    // Existing category filter
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;

    // New safety filter
    if (showOnlySafe) {
      const analysis = analyzeDishSafety(item, item.ingredients, item.cookingSteps, customerAllergens);
      return matchesCategory && (analysis.status === 'safe' || analysis.status === 'safe-with-modifications');
    }

    return matchesCategory;
  });

// Add toggle UI after the header
<div className="flex items-center justify-between mb-4">
  <span className="text-sm text-slate-700">Show only safe options</span>
  <button
    onClick={() => setShowOnlySafe(!showOnlySafe)}
    className={`relative w-12 h-6 rounded-full transition-colors ${
      showOnlySafe ? 'bg-green-500' : 'bg-slate-300'
    }`}
  >
    <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
      showOnlySafe ? 'translate-x-6' : 'translate-x-0.5'
    }`} />
  </button>
</div>
```

---

### 8. Add Dish Images

First, add `image_url` field to menu_items in database, then:

**File:** `/src/pages/CustomerMenu.tsx`

Update the menu item card (around line 230):

```tsx
<div className="flex items-start gap-4">
  {/* Add image */}
  {item.image_url && (
    <img
      src={item.image_url}
      alt={item.name}
      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
    />
  )}

  <div className="text-2xl flex-shrink-0">{getStatusIcon(analysis.status)}</div>
  {/* rest of the card */}
</div>
```

---

### 9. Change "Skip" to "No Restrictions"

**File:** `/src/pages/DietaryProfileSetup.tsx`

Around line 130, change:

```tsx
// Before
<button
  type="button"
  onClick={onComplete}
  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
>
  Skip
</button>

// After
<button
  type="button"
  onClick={onComplete}
  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
>
  I have no restrictions
</button>
```

---

### 10. Add Language Support Placeholder

**File:** `/src/pages/CustomerLanding.tsx`

Add a language selector:

```tsx
const [language, setLanguage] = useState('en');

// In the UI, add at top right
<div className="absolute top-4 right-4">
  <select
    value={language}
    onChange={(e) => setLanguage(e.target.value)}
    className="px-3 py-1 border border-slate-300 rounded-lg"
  >
    <option value="en">English</option>
    <option value="es">Español</option>
    <option value="fr">Français</option>
  </select>
</div>

// Then create translation objects
const translations = {
  en: {
    title: "Safe Dining",
    subtitle: "Get instant allergen information for your meal",
  },
  es: {
    title: "Comida Segura",
    subtitle: "Obtén información instantánea sobre alérgenos",
  }
};

// Use throughout
<h1>{translations[language].title}</h1>
```

---

### 11. Modify Dietary Restrictions Available

**Database:** Add/edit in Supabase

Go to your Supabase dashboard → Table Editor → `dietary_restrictions` table:

- Add new rows for custom restrictions
- Edit existing ones
- Set `allergens` array to match ingredients you want to flag

Example new restriction:
```json
{
  "name": "Low-Sodium",
  "allergens": ["salt", "sodium", "soy sauce"],
  "description": "Reduced sodium intake"
}
```

The app will automatically show these in the DietaryProfileSetup screen.

---

### 12. Customize Empty States

**File:** `/src/pages/CustomerMenu.tsx`

Around line 211, customize when no items are found:

```tsx
// Before
<p className="text-slate-600">No menu items available</p>

// After - Add helpful message
<div className="text-center py-12 bg-white rounded-xl border border-slate-200">
  <p className="text-slate-600 text-lg mb-2">No dishes match your filters</p>
  <p className="text-slate-500 text-sm">Try adjusting your category or dietary settings</p>
  <button
    onClick={() => setFilterCategory('all')}
    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg"
  >
    View All Items
  </button>
</div>
```
