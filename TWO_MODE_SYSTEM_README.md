# Two-Mode System Architecture

The app now features two completely separate interfaces with distinct visual themes and functionality.

## Overview

The application operates in two distinct modes:

1. **Guest Mode** - Light, welcoming theme for customers
2. **Restaurant Mode** - Dark, professional theme for restaurant owners

Users can switch between modes, but each mode provides a completely different experience with its own navigation flow and visual design.

## Mode Switching

### From Guest to Restaurant Mode
- On the guest landing page, click the discreet "For Restaurant Owners" link at the bottom
- This triggers a dramatic visual change to the dark theme
- User sees the Restaurant Owner Login screen

### From Restaurant to Guest Mode
- Click "Back to Guest View" link on restaurant login/registration screens
- Click "Sign Out" in the admin dashboard
- App returns to the light-themed guest experience

## Guest Mode (Light Theme)

### Visual Design
- Light background: `bg-gradient-to-br from-emerald-50 to-teal-50`
- Primary colors: Emerald and teal gradients
- White cards with soft shadows
- Clean, welcoming aesthetic

### Flow
1. **Landing Page**
   - Large "Scan Restaurant Menu" button
   - Simple, focused interface
   - Discreet "For Restaurant Owners" link at bottom

2. **Dietary Profile Setup**
   - Allergen selection interface
   - Dietary preferences
   - Severity levels

3. **Menu View**
   - Restaurant menu with allergen information
   - Safety indicators
   - Dish details

### Features
- QR code scanning
- Dietary profile management
- Safe dish recommendations
- Allergen warnings

## Restaurant Mode (Dark Theme)

### Visual Design
- Dark background: `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`
- Accent colors: Emerald and teal gradients on dark
- Dark cards with borders: `bg-slate-800 border border-slate-700`
- Professional, B2B aesthetic
- White text on dark backgrounds

### Flow

#### 1. Restaurant Owner Login
- Dark-themed login form
- Email and password fields
- "Register Your Restaurant" button
- "Back to Guest View" link

#### 2. Registration
- Dark-themed registration form
- Collects: Restaurant Name, Email, Password
- Creates Supabase auth user and restaurant record
- Automatically redirects to onboarding

#### 3. Onboarding Flow (if not completed)
- **Terms of Service** - Legal agreement screen
- **Menu Digitization** - Simulated menu scanning
- **Dish Details** - Ingredient and preparation input
- **QR Generation** - Final review and QR code creation

#### 4. Admin Dashboard (if onboarding complete)
- Dark-themed navigation
- Tabs: Menu Management, Accessibility Dashboard, Chef Requests
- "Share Menu" button (copies QR URL)
- "Sign Out" button (returns to guest mode)

### Features
- Restaurant account management
- Menu digitization and management
- QR code generation
- Allergen tracking
- Customer request monitoring
- Analytics dashboard

## Technical Implementation

### State Management

#### Mode Context (`AppModeContext.tsx`)
```typescript
type UserMode = 'guest' | 'restaurant';
```
- Manages current mode
- Persists across component renders
- Controls theme and navigation

#### App Structure (`App.tsx`)
- Separate view states for guest and restaurant modes
- Conditional rendering based on `userMode`
- Complete flow separation

### Component Architecture

```
src/
├── contexts/
│   ├── AppModeContext.tsx (Mode management)
│   └── AuthContext.tsx (Authentication)
├── pages/
│   ├── CustomerLanding.tsx (Guest: Landing)
│   ├── DietaryProfileSetup.tsx (Guest: Profile)
│   ├── CustomerMenu.tsx (Guest: Menu)
│   ├── RestaurantOwnerLogin.tsx (Restaurant: Login/Register)
│   ├── RestaurantOnboarding.tsx (Restaurant: Onboarding)
│   └── AdminDashboard.tsx (Restaurant: Dashboard)
└── components/
    ├── customer/ (Guest components)
    ├── admin/ (Restaurant components)
    └── onboarding/ (Restaurant onboarding components)
```

### Theme System

#### Guest Mode Classes
```css
/* Background */
bg-gradient-to-br from-emerald-50 to-teal-50

/* Cards */
bg-white shadow-2xl

/* Buttons */
bg-gradient-to-r from-emerald-500 to-teal-600

/* Text */
text-slate-900 (headings)
text-slate-600 (body)
```

#### Restaurant Mode Classes
```css
/* Background */
bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900

/* Cards */
bg-slate-800 border border-slate-700

/* Buttons */
bg-gradient-to-r from-emerald-500 to-teal-600

/* Text */
text-white (headings)
text-slate-400 (body)
text-slate-300 (labels)
```

### Authentication Flow

#### Guest Mode
- No authentication required
- Anonymous usage
- Session-based dietary profiles

#### Restaurant Mode
- Required authentication via Supabase
- Email/password registration
- JWT-based sessions
- Row-level security policies

### Database Integration

#### Guest Data
- Stored in browser session/local storage
- No server persistence required
- Privacy-focused

#### Restaurant Data
- `restaurants` table: Restaurant info, QR codes
- `menu_items` table: Dishes with allergen data
- `ingredients` table: Detailed ingredient lists
- `chef_requests` table: Customer special requests

## Mode Isolation

### Complete Separation
- Guest users never see restaurant features
- Restaurant owners can't access guest features while logged in
- No shared navigation or UI elements between modes
- Different color schemes prevent confusion

### Security
- Restaurant features require authentication
- RLS policies protect restaurant data
- Guest mode has no access to admin functions
- Mode switching requires intentional action

## User Experience Benefits

### For Guests
- Simple, focused interface
- No distractions from restaurant features
- Fast, intuitive navigation
- Privacy-first design

### For Restaurant Owners
- Professional, business-focused interface
- Clear separation from consumer features
- Comprehensive management tools
- Secure, authenticated environment

## Navigation Flow Diagram

```
┌─────────────────────────────────────────────┐
│                                             │
│         GUEST MODE (Light Theme)            │
│                                             │
│  Landing → Dietary Setup → Menu View        │
│     ↓                                       │
│  "For Restaurant Owners" link               │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│                                             │
│     RESTAURANT MODE (Dark Theme)            │
│                                             │
│  Login → Onboarding → Dashboard             │
│     ↑                      ↓                │
│  "Back to Guest View" / "Sign Out"          │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
          Back to Guest Mode
```

## Testing the Modes

### Guest Mode Test
1. Open app (default view)
2. Verify light theme with emerald/teal colors
3. Click "Scan Restaurant Menu"
4. Verify QR scanner or manual entry
5. Complete dietary profile
6. View menu with safety indicators

### Restaurant Mode Test
1. From guest landing, click "For Restaurant Owners"
2. Verify dramatic switch to dark theme
3. Test registration: Create account
4. Verify onboarding flow activation
5. Complete terms, menu scan, dish details
6. Verify QR code generation
7. Access dashboard
8. Test "Sign Out" returns to guest mode

## Future Enhancements

- Persistent mode preference (cookie/localStorage)
- Animated theme transitions
- Mode-specific analytics
- Different branding per mode
- White-label options for restaurants
- Progressive web app installation per mode
