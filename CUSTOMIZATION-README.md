# Customer Interface Customization Guide

This guide covers all customization options for the guest/customer-facing part of your restaurant allergy platform.

## 📁 Customer Interface Files

```
src/
├── pages/
│   ├── CustomerLanding.tsx      ← QR code entry page
│   ├── DietaryProfileSetup.tsx  ← Dietary restrictions selector
│   └── CustomerMenu.tsx         ← Main menu display
├── components/
│   └── customer/
│       └── DishDetail.tsx       ← Individual dish view
└── lib/
    ├── safetyAnalysis.ts        ← Safety logic & icons
    └── customerSession.ts       ← Session management
```

## 🎨 Quick Customizations

### 1. **Change Brand Colors** (5 minutes)
See: `color-customization-guide.md`

Global find & replace:
- `emerald-500` → `blue-500` (or any Tailwind color)
- `emerald-600` → `blue-600`
- `teal-600` → `blue-600`

Files to update:
- CustomerLanding.tsx
- DietaryProfileSetup.tsx
- CustomerMenu.tsx
- DishDetail.tsx

---

### 2. **Change App Name/Branding** (2 minutes)

**File:** `src/pages/CustomerLanding.tsx`

```tsx
// Line ~28
<h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
  Your Restaurant Name  {/* ← Change this */}
</h1>
<p className="text-center text-slate-600 mb-8">
  Your tagline here  {/* ← And this */}
</p>
```

---

### 3. **Change Safety Icons** (2 minutes)
See: `feature-customization-guide.md` Section 1

**File:** `src/lib/safetyAnalysis.ts` (Lines 117-126)

```tsx
export function getStatusIcon(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return '✅';  // ← Change these
    case 'safe-with-modifications':
      return '⚠️';
    case 'unsafe':
      return '❌';
  }
}
```

**Options:**
- Emojis: ✅ ⚠️ ❌ / 😊 😐 😟 / 👍 🤔 👎
- Or use Lucide icons (see guide)

---

### 4. **Modify Safety Status Labels** (2 minutes)

**File:** `src/lib/safetyAnalysis.ts` (Lines 128-137)

```tsx
export function getStatusLabel(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'Perfect Choice!';  // ← Make it friendlier
    case 'safe-with-modifications':
      return 'Talk to Your Server';
    case 'unsafe':
      return 'Not Recommended';
  }
}
```

---

### 5. **Add/Edit Dietary Restrictions** (5 minutes)
See: `database-customization-guide.md`

In **Supabase Dashboard** → SQL Editor:

```sql
-- Add new restriction
INSERT INTO dietary_restrictions (name, allergens, description)
VALUES (
  'Paleo',
  ARRAY['grains', 'dairy', 'legumes', 'processed'],
  'Paleo diet compliant'
);

-- Edit existing
UPDATE dietary_restrictions
SET allergens = ARRAY['wheat', 'barley', 'rye', 'gluten', 'bread']
WHERE name = 'Gluten-Free';
```

The app will automatically show these options to customers!

---

## 🎯 Popular Customizations

### Remove Features

❌ **Remove "Ask Chef" Button**
- File: `DishDetail.tsx`
- Delete lines 100-130 (the request form section)

❌ **Remove Settings Button**
- File: `CustomerMenu.tsx`
- Delete lines 164-169 (settings icon)

❌ **Remove Admin Link from Landing**
- File: `CustomerLanding.tsx`
- Delete lines 60-70 (admin panel link)

---

### Add Features

✅ **Add "Show Only Safe" Toggle**
- See: `feature-customization-guide.md` Section 7
- Filters menu to safe items only

✅ **Add Price Range Filter**
- See: `feature-customization-guide.md` Section 6
- Under $10, Under $20, $20+

✅ **Add Dish Images**
- See: `database-customization-guide.md` (Add Menu Item Images)
- Requires adding `image_url` column to database

✅ **Add Restaurant Logo**
- See: `database-customization-guide.md` (Add Restaurant Logo)
- Requires adding `logo_url` column to restaurants table

✅ **Add Customer Favorites**
- See: `database-customization-guide.md` (Add Customer Favorites)
- Let customers save favorite dishes

---

## 🎨 Complete Theme Change Example

Want to change from Emerald/Teal to Blue/Purple?

### Step 1: Color Search & Replace

In all customer files:

```bash
# Find:
from-emerald-50 to-teal-50
from-emerald-500 to-teal-600
from-emerald-600 to-teal-700
emerald-50
emerald-500
emerald-600
teal-600

# Replace with:
from-blue-50 to-purple-50
from-blue-500 to-purple-600
from-blue-600 to-purple-700
blue-50
blue-500
blue-600
purple-600
```

### Step 2: Update Safety Colors

In `src/lib/safetyAnalysis.ts`:

```tsx
export function getStatusColor(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'text-blue-600 bg-blue-50';
    case 'safe-with-modifications':
      return 'text-purple-600 bg-purple-50';
    case 'unsafe':
      return 'text-red-600 bg-red-50';
  }
}
```

### Step 3: Update Icons (Optional)

Change emojis or use different colored icons.

---

## 📱 Layout Customization

### Make Text Bigger

```tsx
// Headers
text-2xl → text-3xl or text-4xl

// Body text
text-sm → text-base

// Buttons
py-2 → py-3
text-sm → text-base
```

### Make Cards Rounded More/Less

```tsx
rounded-xl → rounded-2xl (more)
rounded-xl → rounded-lg (less)
```

### Adjust Spacing

```tsx
gap-4 → gap-6 (more space)
p-4 → p-6 (more padding)
mb-4 → mb-6 (more margin)
```

---

## 🗄️ Database-Driven Customization

These changes affect customer experience automatically:

### Add Dietary Restrictions
Customers will see new options immediately in profile setup.

### Add Allergens to Restrictions
Updates safety analysis for all menu items automatically.

### Add Restaurant Custom Fields
- Logo URL
- Accent color
- Welcome message
- Operating hours

See `database-customization-guide.md` for SQL examples.

---

## 🚀 Testing Your Changes

After making customizations:

1. **Run build to check for errors:**
   ```bash
   npm run build
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Test the customer flow:**
   - Enter a QR code
   - Select dietary restrictions
   - Browse menu
   - View dish details
   - Test all buttons and filters

---

## 📚 Full Documentation

For detailed examples and code snippets:

1. **color-customization-guide.md** - Complete color theming
2. **feature-customization-guide.md** - 12+ feature modifications
3. **database-customization-guide.md** - Schema changes and data

---

## 💡 Common Questions

**Q: How do I change what allergens are tracked?**
A: Edit the `dietary_restrictions` table in Supabase. Update the `allergens` array for each restriction.

**Q: Can I change the emoji indicators?**
A: Yes! Edit `getStatusIcon()` in `src/lib/safetyAnalysis.ts`.

**Q: How do I translate the app?**
A: See Section 10 in `feature-customization-guide.md` for a language translation starter.

**Q: Can I hide certain dietary restrictions?**
A: Yes, delete them from the `dietary_restrictions` table in Supabase.

**Q: How do I change the main color theme?**
A: See `color-customization-guide.md` for step-by-step instructions.

**Q: Can I add restaurant-specific branding?**
A: Yes! Add fields like `logo_url`, `primary_color`, `welcome_message` to the restaurants table. See `database-customization-guide.md`.

---

## 🎓 Need Help?

1. Check the specific guide for your customization
2. Review the code comments in each file
3. Test changes in development before deploying
4. Use browser dev tools to inspect styling

Happy customizing! 🎨
