# Restaurant Onboarding Flow

A complete, secure multi-step onboarding system for restaurant owners to digitize their menus and provide allergen information to customers.

## Overview

The onboarding flow guides restaurant owners through a professional, linear process:

1. **Authentication Gate** - Login or registration
2. **Liability Agreement** - Legal terms and responsibility acknowledgment
3. **Menu Digitization** - Simulated menu scanning
4. **Dish Information Input** - Detailed ingredient and preparation entry
5. **Final Review & QR Generation** - Menu review and QR code creation

## Access Points

Restaurant owners can access the onboarding flow through:
- Direct URL: `/onboarding` or `/restaurant/signup`
- Link from customer landing page: "Register Your Restaurant"

## Step-by-Step Flow

### Step 1: Authentication Gate

**Location:** `/onboarding`

**Features:**
- Professional welcome screen with two options:
  - "Restaurant Owner Login"
  - "Register Your Restaurant"
- Registration form collects:
  - Restaurant Name
  - Chef/Manager's Email
  - Secure Password (minimum 6 characters)
- Validation and error handling
- Creates Supabase auth user and restaurant record
- Generates unique QR code for the restaurant

**Design:** Clean B2B interface with professional branding

### Step 2: Liability Agreement

**Features:**
- Full terms of service display
- Comprehensive legal language covering:
  - Information accuracy responsibility
  - Limitation of liability
  - Restaurant obligations
  - Guest safety protocols
  - Acceptance requirements
- Scrollable terms section (max-height with overflow)
- Required checkbox: "I have read and agree to the Terms of Service"
- Continue button only enabled after checkbox is checked
- Saves acceptance timestamp to database

**Critical Legal Language:**
> "This tool displays information provided directly by the restaurant. Safe Dining does not verify the accuracy of ingredient lists or preparation methods and cannot guarantee the absence of cross-contamination. The restaurant is solely responsible for the information entered and the safety of its guests."

### Step 3: Menu Digitization

**Features:**
- Simulated menu scanning interface
- "Scan Physical Menu with Camera" button
- 2.5-second scanning animation with loader
- Mock data returns 12 dishes across categories:
  - Main Courses (6 dishes)
  - Appetizers (3 dishes)
  - Desserts (3 dishes)
  - Sides (1 dish)
- Success screen shows:
  - Total dish count
  - Sample of detected dishes
  - Next steps information

**Mock Dishes Included:**
- Grilled Salmon, Caesar Salad, Chocolate Lava Cake
- Chicken Alfredo, Tomato Basil Soup, New York Strip Steak
- Margherita Pizza, Tiramisu, Caprese Salad
- Fish and Chips, Garlic Bread, Crème Brûlée

### Step 4: Dish Information Input

**Features:**
- Dashboard showing all scanned dishes
- Progress bar tracking completion
- Each dish card shows:
  - Dish name, category, and price
  - "Add Details" button
  - Checkmark when completed
- Individual dish form includes:
  - **Dish Name** (pre-filled from scan)
  - **Ingredients** - Multi-line text area with guidance:
    - "List every ingredient and its exact amount"
    - Example format provided
  - **Preparation** - Multi-line text area with guidance:
    - "Describe the cooking process"
    - Reminder to note shared surfaces and equipment
  - **Photo Upload** - Optional:
    - File upload or camera capture
    - Image preview with remove option
    - Uploads to Supabase storage
- "Save Dish" button
- Returns to dish list after save
- Cannot continue until all dishes completed

**Validation:**
- Ingredients and preparation fields are required
- Photo is optional
- Real-time completion tracking

### Step 5: Final Review & QR Generation

**Features:**
- Complete menu review screen
- Each dish displayed with:
  - Name, description, category, price
  - Photo thumbnail (if uploaded)
  - Allergen summary badges:
    - Green: "No common allergens detected"
    - Red: "Contains: [allergen]"
- "Generate My QR Code & Publish Menu" button
- After generation:
  - Large QR code canvas display
  - "Download QR Code" button (PNG format)
  - Direct menu URL with copy functionality
  - Next steps checklist:
    1. Print QR code for tables
    2. Add to physical menus
    3. Train staff on system
    4. Keep information up-to-date
  - "Go to Dashboard" button

**QR Code Details:**
- Generated using `qrcode` library
- 300x300 pixels
- Links to: `[domain]/?qr=[restaurant-qr-code]`
- Dark color: #0F172A (slate-900)
- Light color: #FFFFFF (white)
- Downloadable as PNG with restaurant name

## Database Schema Changes

### Required Migration

Run the SQL in `database_migration_onboarding.sql`:

```sql
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
```

### Storage Bucket Setup

Create a storage bucket named `dish-photos` in Supabase:
1. Go to Storage in Supabase Dashboard
2. Create new bucket: `dish-photos`
3. Make it public
4. Set up RLS policies (see migration file)

## Technical Implementation

### Components Structure

```
src/
├── pages/
│   └── RestaurantOnboarding.tsx (Main coordinator)
├── components/
│   └── onboarding/
│       ├── AuthGate.tsx (Step 1)
│       ├── LiabilityAgreement.tsx (Step 2)
│       ├── MenuDigitization.tsx (Step 3)
│       ├── DishDetailsInput.tsx (Step 4)
│       └── FinalReview.tsx (Step 5)
```

### State Management

The main `RestaurantOnboarding` component manages:
- Current step tracking
- Restaurant ID propagation
- Scanned dishes array
- Step transitions

### Dependencies Added

```json
{
  "qrcode": "^1.5.x",
  "@types/qrcode": "^1.5.x"
}
```

### Routing

Routes handled in `App.tsx`:
- `/onboarding` → Restaurant onboarding flow
- `/restaurant/signup` → Restaurant onboarding flow (alias)
- `/admin` → Admin dashboard (for existing restaurants)

## Design Principles

### B2B Professional Design
- Clean, trustworthy interface
- Slate color scheme (slate-900, slate-600, slate-50)
- Clear typography hierarchy
- Ample white space
- Professional tone throughout

### User Experience
- Linear, non-skippable flow
- Clear progress indicators
- Helpful guidance text
- Error handling and validation
- Mobile-responsive layouts

### Security & Compliance
- Strong legal disclaimer
- Required terms acceptance
- Timestamp tracking for acceptance
- Secure authentication via Supabase
- Data ownership clearly defined

## Testing Checklist

- [ ] Registration creates auth user and restaurant record
- [ ] Terms must be accepted before continuing
- [ ] Menu scan simulation completes successfully
- [ ] All dishes must be filled before proceeding
- [ ] Photo upload works and stores in Supabase
- [ ] QR code generates correctly
- [ ] QR code downloads as PNG
- [ ] QR code links to correct menu URL
- [ ] Onboarding completion is saved to database
- [ ] Dashboard link works after completion

## Future Enhancements

- Real OCR menu scanning using camera
- AI-powered ingredient extraction
- Bulk dish import via CSV
- Integration with POS systems
- Multi-language support
- Advanced allergen parsing
- Nutrition calculator

## Support

For issues or questions about the onboarding flow, refer to:
- Database setup: `database_migration_onboarding.sql`
- Component source: `src/components/onboarding/`
- Main flow: `src/pages/RestaurantOnboarding.tsx`
