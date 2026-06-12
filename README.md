# AHH WFM - Enterprise Workforce Management Suite

AHH WFM is a production-ready, full-stack monorepo system containing:
1.  **Web Admin Console (`apps/web`):** A desktop command center for workforce managers to track attendance maps, approve leaves, manage shift schedules, and review SuccessFactors integration mappings. Styled using the **Structured Efficiency** design theme (IBM Plex Sans, Inter, Deep Navy colors).
2.  **Mobile Employee Client (`apps/mobile`):** A mobile-first portal for field staff to log geo-fenced check-ins/outs, apply for leaves, and read company announcements. Styled using the **Corporate Integrity** design theme (Inter, Al Hattab Maroon & Bronze corporate colors).

The applications share configurations, types, visual components, and a local filesystem-based database to enable real-time updates (e.g. clocking in on the mobile app updates the web ledger instantly on localhost).

---

## Workspace Structure

The project is organized as an **npm workspaces monorepo**:

```
ahh-wfm/
├── package.json                 # Root monorepo workspace definition
├── tsconfig.json                # Shared absolute path configurations
├── apps/
│   ├── web/                     # Web Admin Next.js App (Runs on Port 3100)
│   └── mobile/                  # Mobile Employee Next.js App (Runs on Port 3101)
└── packages/
    ├── config/                  # Shared Tailwind & configuration presets
    ├── types/                   # Shared TypeScript models/interfaces
    ├── mock-data/               # Shared File-based JSON Database (db.json)
    └── ui/                      # Shared reusable React components (Button, Input, Card, Badge, Modal)
```

---

## Installation & Running Locally

### Prerequisites
- Node.js (version 18.0.0 or higher)
- npm (version 7.0.0 or higher)

### Step 1: Install Dependencies
From the root directory, run the installation command. This will download all packages and automatically link the shared packages inside the monorepo:
```bash
npm install
```

### Step 2: Run the Applications
You can run either application individually or start both in development mode.

- **To run the Web Admin Dashboard:**
  ```bash
  npm run dev:web
  ```
  The dashboard will start on [http://localhost:3100](http://localhost:3100).

- **To run the Mobile Employee Client:**
  ```bash
  npm run dev:mobile
  ```
  The mobile portal will start on [http://localhost:3101](http://localhost:3101).

---

## Core Workflows & Mock Data Layer

To simulate a real database state on localhost, the applications read/write from a shared JSON file (`packages/mock-data/db.json`):

1.  **Attendance Sync:** When you check in on the mobile client ([localhost:3101](http://localhost:3101)), the app records the GPS coordinate and appends a record to the shared `db.json` database. The Web Admin dashboard ([localhost:3100](http://localhost:3100)) polls the API and will display this check-in instantly in the **Field Operations Ledger** table.
2.  **Leave Approval:** When an employee submits a leave request on the mobile app, it appears in the Web Admin dashboard's **Critical Approvals** list. Approving the request on the Web Admin updates the state, and the employee will see their leave balance update in real-time.
3.  **Shifts Rotation:** Creating a new shift rule in the Admin dashboard adds it to the database, making it available for selection and logging shift rotation audits.

---

## Future Backend Integration Guide

When you are ready to transition from mock data to a live production backend database:

1.  **API Routes Translation:**
    Replace the database handlers inside `apps/web/app/api/db/route.ts` and `apps/mobile/app/api/db/route.ts` with database queries (e.g. Prisma or Mongoose) connecting to PostgreSQL/MongoDB.
2.  **SAP SuccessFactors Integration:**
    To connect to the real SuccessFactors ERP:
    - Update `apps/web/app/api/db/route.ts` to call the real SuccessFactors OData APIs.
    - Fetch the actual user schemas and map variables using the JSON rules created in the mapping screen.
3.  **Authentication:**
    Set up standard authentication (e.g., NextAuth.js or Auth0) using the hooks folders to authorize admin users and authenticate field employee check-ins.
