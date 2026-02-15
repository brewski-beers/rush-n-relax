# Rush n Relax - Cannabis Retail PWA

A modern, mobile-first Progressive Web App for cannabis retail operations and staff POS management built with TypeScript, Vite, and Firebase.

## Features

- **Mobile-First Design** - Optimized for mobile devices with progressive enhancement for larger screens
- **PWA Support** - Offline functionality, installable, fast loading
- **Firebase Integration** - Real-time Firestore database with secure rules
- **POS Mode** - Staff point-of-sale functionality for retail operations
- **Customer Ordering** - E-commerce interface for product browsing and orders
- **Real-Time Sync** - Live inventory and order updates

## Project Structure

\\\
rush-n-relax/
 src/                    # TypeScript source code
    main.ts            # Application entry point
    firebase.ts        # Firebase initialization
    style.css          # Global styles (mobile-first)
    components/        # UI components
    utils/
        auth.ts        # Authentication utilities
 public/                 # Static assets
    manifest.json      # PWA manifest
 functions/             # Cloud Functions
    src/
       index.ts       # Functions entry point
    package.json
    tsconfig.json
 vite.config.ts         # Vite configuration
 tsconfig.json          # TypeScript configuration
 firebase.json          # Firebase hosting config
 firestore.rules        # Firestore security rules
 package.json
 index.html             # HTML entry point
\\\

## Development

### Prerequisites

- Node.js 16+
- Firebase CLI
- npm or pnpm

### Setup

\\\ash
npm install
firebase login
\\\

### Running Locally

\\\ash
# Start development server and Firebase emulators
npm run dev
firebase emulators:start

# In another terminal
npm run firebase:emulate
\\\

### Building

\\\ash
npm run build
\\\

### Testing

\\\ash
npm test
npm run test:ui  # UI test runner
\\\

### Deployment

\\\ash
npm run deploy
\\\

## Architecture Principles

### SOLID
- **S**ingle Responsibility: Each module has one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes are substitutable for base types
- **I**nterface Segregation: Specific interfaces over general ones
- **D**ependency Inversion: Depend on abstractions, not concretions

### DRY (Don't Repeat Yourself)
- Reusable utilities and components
- Shared logic in dedicated modules
- No code duplication

### YAGNI (You Aren't Gonna Need It)
- Build what's needed now
- Avoid speculative features
- Embrace incremental development

### KISS (Keep It Simple, Stupid)
- Simple, readable code
- Straightforward solutions
- Avoid unnecessary complexity

### Mobile-First UI
- Design for smallest screen first
- Progressive enhancement for larger screens
- Touch-friendly interactions
- Performance optimized for mobile networks

### BDD/Value-Added Tests
- Test behavior, not implementation
- Only tests that provide real value
- No bloat or trivial assertions
- Focus on user-visible functionality

## Firebase Configuration

### Firestore Rules

Security rules enforce:
- Authentication requirements
- Role-based access (admin, staff, user)
- Location-based access for staff
- Data ownership validation

### Cloud Functions

Handles:
- Order processing
- Inventory management
- Payment processing
- Email notifications

## License

MIT
