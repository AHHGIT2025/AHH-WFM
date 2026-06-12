# AHH WFM - System Architecture Specification

This document details the system architecture of the **AHH WFM** (Workforce Management) monorepo application.

---

## 1. Monorepo Structure

The project is configured as an npm workspaces monorepo to manage frontend client applications and shared package libraries together in a single code repository.

```
ahh-wfm/ (Root Workspace)
├── package.json                 # Workspace configurations, dependencies, & root command scripts
├── tsconfig.json                # Shared TypeScript compiler options and workspace aliases
├── apps/
│   ├── web/                     # Web Admin Command Center (Runs on Port 3100)
│   └── mobile/                  # Mobile Employee Portal (Runs on Port 3101)
└── packages/
    ├── config/                  # Shared Tailwind CSS configurations and presets
    ├── types/                   # Reusable TypeScript model interfaces
    ├── database/                # Prisma ORM MySQL schemas and Client singleton
    ├── mock-data/               # Database wrapper (MySQL query layer with filesystem fallback)
    └── ui/                      # Reusable visual components (Button, Input, Card, Badge, Modal)
```

---

## 2. Front-End Architectures

### Web Admin App (`apps/web`)
*   **Design Paradigm:** *Structured Efficiency* (theme optimized for desktop management dashboards, utilizing Deep Navy `#091426` and Corporate Blue `#0058be`).
*   **Framework:** Next.js (latest stable App Router, React 18).
*   **Navigation & Layout:** Features a fixed sidebar navigation with a responsive layout shell. On mobile screens, the navigation collapses into an animated slide-over drawer menu.
*   **API Client:** Communicates with the local route handler `/api/db` to load real-time geofenced check-ins, approve leaves, and push mappings to SAP.

### Mobile Employee App (`apps/mobile`)
*   **Design Paradigm:** *Corporate Integrity* (theme optimized for outdoor site operative use, featuring Al Hattab Maroon `#800040` and Bronze `#b89d7e`).
*   **Framework:** Next.js (App Router, mobile-first responsive viewport).
*   **Smartphone Simulator:** Embedded inside a desktop-responsive smartphone frame mockup container. On real mobile displays, it scales to native full-screen.
*   **API Client:** Interacts with `/api/db` to submit attendance entries, check shift assignments, and send leave requisitions.

---

## 3. Database & Persistence Layer

The database is built on **MySQL** and managed using **Prisma ORM**. It handles data querying in a dual-mode strategy via `@ahh-wfm/mock-data`.

```
                  ┌──────────────────────────────┐
                  │      Next.js API Handler     │
                  │   (/api/db/route.ts endpoint) │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    @ahh-wfm/mock-data Broker │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
      DATABASE_URL env defined?        DATABASE_URL env NOT defined?
                 │                               │
                 ▼                               ▼
  ┌──────────────────────────────┐┌──────────────────────────────┐
  │      Prisma Client (MySQL)   ││      Filesystem Database     │
  │     `@ahh-wfm/database`      ││     (`mock-data/db.json`)    │
  └──────────────────────────────┘└──────────────────────────────┘
```

---

## 4. MySQL Schema Specification

Below is the database entity-relationship schema defined in the Prisma schema file:

### `Employee`
*   `id` (String, Primary Key)
*   `name` (String)
*   `department` (String)
*   `role` (String)
*   `status` (String) - Represents active duty states: `"On Duty"`, `"On Break"`, `"Offline"`, or `"On Leave"`.
*   `email` (String, Unique)
*   `phone` (String, Optional)
*   `shiftId` (String, Optional)

### `AttendanceRecord`
*   `id` (String, UUID, Primary Key)
*   `employeeId` (String, Foreign Key mapping to `Employee.id` with cascade deletions)
*   `employeeName` (String)
*   `checkIn` (DateTime, Defaults to `now()`)
*   `checkOut` (DateTime, Optional)
*   `lat` (Float)
*   `lng` (Float)
*   `device` (String) - Client device model and GPS configuration metadata.
*   `status` (String) - `"On Time"`, `"Late"`, `"Absent"`, or `"Sync Exception"`.
*   `locationName` (String) - Resolved geofenced name.

### `Shift`
*   `id` (String, Primary Key)
*   `name` (String)
*   `code` (String, Unique)
*   `timeRange` (String)
*   `breakDuration` (String)
*   `status` (String) - `"Active"` or `"Inactive"`.

### `LeaveRequest`
*   `id` (String, UUID, Primary Key)
*   `employeeId` (String, Foreign Key mapping to `Employee.id` with cascade deletions)
*   `employeeName` (String)
*   `type` (String) - Type of absence, e.g., `"Annual Leave"` or `"Sick Leave"`.
*   `dateRange` (String)
*   `reason` (String)
*   `status` (String) - `"Approved"`, `"Rejected"`, or `"Pending Approval"`.

### `SapMapping`
*   `id` (String, Primary Key)
*   `sourceField` (String) - SuccessFactors OData field name.
*   `targetField` (String) - Local database field name.
*   `transformationRule` (String)
*   `status` (String) - `"Mapped"`, `"Conflict"`, or `"Unmapped"`.

### `SyncLog`
*   `id` (String, UUID, Primary Key)
*   `timestamp` (DateTime, Defaults to `now()`)
*   `operation` (String) - `"Data Pull"`, `"Data Push"`, or `"Schema Update"`.
*   `subject` (String)
*   `status` (String) - `"Success"`, `"Failed"`, or `"Warning"`.
*   `details` (String)

### `Announcement`
*   `id` (String, UUID, Primary Key)
*   `title` (String)
*   `content` (String, Text block)
*   `timestamp` (DateTime, Defaults to `now()`)
*   `author` (String)
*   `category` (String) - `"General"`, `"Urgent"`, or `"System Update"`.
