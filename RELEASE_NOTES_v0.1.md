# Release Notes: v0.1-foundation-complete

We are pleased to announce the completion of the **AHH WFM** (Workforce Management) foundation release (v0.1). This release establishes the core monorepo structure, builds the Web Admin & Mobile client frontend visual interfaces, and implements a dual-mode MySQL database integration layer using Prisma ORM.

---

## What's New in v0.1

### Architecture & Workspaces
*   **npm Workspaces Monorepo:** Structured codebase grouping frontend client applications and shared package libraries together in a single code repository to simplify development and deployment.
*   **Dual Design Branding:** Implemented **Structured Efficiency** styling (Deep Navy/Corporate Blue) for the Web App and **Corporate Integrity** styling (Al Hattab Maroon/Bronze) for the Mobile App.
*   **Smartphone Simulator Frame:** Designed a custom, desktop-responsive viewport mockup that wraps the Mobile Employee App interface.

### Database Backend Integration
*   **MySQL & Prisma Support:** Migrated the data layer to Prisma ORM connected to MySQL, defining schemas for Employees, Attendance logs, Shifts, Leaves, SAP Mappings, Sync logs, and Announcements.
*   **Environment Variable Configuration:** Implemented a togglable data broker. When `DATABASE_URL` is set, all API calls read/write from a live MySQL server. If not configured, the system falls back to local JSON database storage automatically.
*   **Auto-Seeding:** Integrated an automatic seeding script that populates the MySQL database tables with standard default records if the database is initially empty.
*   **Clean Port Assignment:** Updated default dev ports to `3100` (Web App) and `3101` (Mobile App) to prevent conflicts with local software instances.

---

## Getting Started

### Local Setup
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Generate Prisma Client:**
    ```bash
    npm run db:generate
    ```
3.  **Run with Local JSON Fallback (Default):**
    ```bash
    # Starts Web App on localhost:3100
    npm run dev:web
    # Starts Mobile App on localhost:3101
    npm run dev:mobile
    ```

### Run with MySQL Backend
1.  Create a database named `ahh_wfm` in your local MySQL instance.
2.  Create a `.env` file at the root workspace directory:
    ```env
    DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/ahh_wfm"
    ```
3.  Synchronize the tables:
    ```bash
    npm run db:push
    ```
4.  Launch both applications. The mock data broker will detect the configuration, seed the tables automatically, and establish live connection queries to your MySQL instance.
