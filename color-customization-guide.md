# Color Customization Guide

## Customer Interface Color Scheme

The guest interface uses an emerald/teal color palette by default. Here's how to change it:

### Global Search & Replace

Use your editor's find/replace across all customer files:

**Current Colors → Your Colors**
```
from-emerald-50 to-teal-50     →  from-[your]-50 to-[your]-50
from-emerald-500 to-teal-600   →  from-[your]-500 to-[your]-600
from-emerald-600 to-teal-700   →  from-[your]-600 to-[your]-700

emerald-50   →  [your]-50
emerald-100  →  [your]-100
emerald-200  →  [your]-200
emerald-500  →  [your]-500
emerald-600  →  [your]-600
emerald-700  →  [your]-700
emerald-900  →  [your]-900

teal-50      →  [your]-50
teal-600     →  [your]-600
teal-700     →  [your]-700
```

### Available Tailwind Colors
- `blue` - Professional, trustworthy
- `purple` - Modern, creative
- `pink` - Friendly, welcoming
- `indigo` - Sophisticated
- `cyan` - Clean, fresh
- `violet` - Elegant
- `fuchsia` - Bold, energetic

### Example: Change to Blue Theme

In these files:
- `/src/pages/CustomerLanding.tsx`
- `/src/pages/DietaryProfileSetup.tsx`
- `/src/pages/CustomerMenu.tsx`
- `/src/components/customer/DishDetail.tsx`

Replace:
```tsx
// Old (Emerald/Teal)
className="bg-gradient-to-br from-emerald-50 to-teal-50"
className="bg-gradient-to-r from-emerald-500 to-teal-600"
className="bg-emerald-50 border border-emerald-200"
className="text-emerald-600"

// New (Blue)
className="bg-gradient-to-br from-blue-50 to-blue-50"
className="bg-gradient-to-r from-blue-500 to-blue-600"
className="bg-blue-50 border border-blue-200"
className="text-blue-600"
```

---

## Status Indicator Colors

Safety status colors are defined in `/src/lib/safetyAnalysis.ts`:

```tsx
export function getStatusColor(status: SafetyStatus): string {
  switch (status) {
    case 'safe':
      return 'text-green-600 bg-green-50';      // ✅ Customize here
    case 'safe-with-modifications':
      return 'text-orange-600 bg-orange-50';    // ⚠️ Customize here
    case 'unsafe':
      return 'text-red-600 bg-red-50';          // ❌ Customize here
  }
}
```

---

## Custom Logo/Branding

### Replace the Icon in CustomerLanding.tsx

**Current (Icon):**
```tsx
<div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl">
  <Utensils className="w-10 h-10 text-white" />
</div>
```

**Option 1: Use Image**
```tsx
<div className="rounded-2xl overflow-hidden">
  <img src="/logo.png" alt="Logo" className="w-20 h-20" />
</div>
```

**Option 2: Use Different Icon**
```tsx
import { ShieldCheck, Heart, Leaf } from 'lucide-react';

<div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl">
  <ShieldCheck className="w-10 h-10 text-white" />
</div>
```

---

## Typography Customization

### Change Font Sizes

**Headers:**
```tsx
// Extra large headers
text-3xl  →  text-4xl or text-5xl

// Section headers
text-2xl  →  text-3xl

// Card titles
text-lg   →  text-xl
```

### Change Font Weights

```tsx
font-bold       →  font-extrabold
font-semibold   →  font-bold
font-medium     →  font-semibold
```

### Example: Make Everything Bigger
```tsx
// Before
<h1 className="text-3xl font-bold">Safe Dining</h1>

// After
<h1 className="text-5xl font-extrabold">Safe Dining</h1>
```
