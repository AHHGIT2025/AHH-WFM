# Blue Collar Project-Site Deployment Verification Notes

This document captures the verification of Phase 6.2 extension: **Blue Collar Workforce Project-Site Deployment Tracking**.

---

## 1. Relational Database & Seed Data Verification

- **Schema Setup**: Verify that `BlueCollarPositionCategory`, `Project`, `ProjectSite`, and `EmployeeDeployment` are added and updated in `packages/database/prisma/schema.prisma`.
- **Database Alignment**: Migrated database models using `npx prisma db push`.
- **Seeders**: Updated `seedMySQL` to pre-seed default position trade categories (Carpenter, Electrician, Plumber, Driver, Supervisor, Mason, etc.) and mock projects with cost centers.

---

## 2. Implementation Overview

### Admin UI Elements

1. **Workforce Directory Page**:
   - Added Worker Category, default project and site dropdown selectors, and position categories to Register and Edit profile forms.
   - Displayed today's active deployments directly on each employee's card.
   - Filters updated to support filtering by worker category, trade category, project, and site location.
2. **Shift Master Page**:
   - Added new tabs: **Project Deployment View** (manage daily assignments for Blue Collar staff) and **Site Coverage View** (headcount distribution by site location).
   - Created a quick deployment panel on the deployments tab to easily deploy employees.

### API Endpoints

- GET / POST `/api/v1/employees` and PATCH `/api/v1/employees/[id]` updated to accept Blue Collar specific properties.
- Bulk preview `/api/v1/employees/bulk-preview` and import `/api/v1/employees/bulk-import` modified to validate, map, and import `workerCategory`, `positionCategory`, `defaultProjectCode`, `defaultSiteCode`, and `costCenter`.
- Bulk template `/api/v1/employees/bulk-template` updated to download CSV template with new columns.

### Mobile Portal Client

- Shows Today's Deployment Card with project name, site name, shift hours, and clock-in geofence badge status.

---

## 3. Conflict Checking Logic (Conflict Engine)

Strict non-overlapping logic verified for:
1. **Double Deployment**: Same employee deployed to non-overlapping hours on the same day is allowed; overlapping hours are rejected.
2. **Deactivation**: Deactivated employees are restricted from deployment.
3. **Leave**: Deployment during approved leave dates is blocked.
