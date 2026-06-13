# Blue Collar Project Site Deployment Design

This document details the architectural specifications for introducing Blue Collar Position Categories, Projects, Project Sites, and Time-based Employee Deployments to the AHH WFM system.

---

## 1. Relational Database Schema Proposal

We will define four new models and extend two existing models in `schema.prisma`.

### A. New Models

#### 1. `BlueCollarPositionCategory`
- `id`: String (Primary Key, UUID)
- `code`: String (Unique, e.g., "foreman", "carpenter")
- `name`: String (Human readable name)
- `description`: String (Optional)
- `isActive`: Boolean (Default: true)
- `createdAt`: DateTime (Default: now)
- `updatedAt`: DateTime (@updatedAt)

#### 2. `Project`
- `id`: String (Primary Key, UUID)
- `projectCode`: String (Unique)
- `projectName`: String
- `clientName`: String (Optional)
- `contractNumber`: String (Optional)
- `costCenter`: String (Optional)
- `sapProjectCode`: String (Optional)
- `sapCostCenterCode`: String (Optional)
- `startDate`: DateTime (Optional)
- `endDate`: DateTime (Optional)
- `status`: String (Default: "ACTIVE", Options: "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED")
- `createdAt`: DateTime (Default: now)
- `updatedAt`: DateTime (@updatedAt)

#### 3. `ProjectSite`
- `id`: String (Primary Key, UUID)
- `projectId`: String
- `siteCode`: String (Unique code)
- `siteName`: String
- `address`: String (Optional)
- `latitude`: Float (Optional)
- `longitude`: Float (Optional)
- `geofenceRadiusMeters`: Float (Optional, Default: 150.0)
- `sapSiteCode`: String (Optional)
- `status`: String (Default: "ACTIVE", Options: "ACTIVE", "INACTIVE")
- `createdAt`: DateTime (Default: now)
- `updatedAt`: DateTime (@updatedAt)

#### 4. `EmployeeDeployment`
- `id`: String (Primary Key, UUID)
- `employeeId`: String
- `projectId`: String
- `siteId`: String
- `positionCategoryId`: String
- `deploymentDate`: DateTime
- `startTime`: String (Format: "HH:MM")
- `endTime`: String (Format: "HH:MM")
- `plannedHours`: Float
- `actualHours`: Float (Optional)
- `shiftAssignmentId`: String (Optional)
- `attendanceRecordId`: String (Optional)
- `status`: String (Default: "PLANNED", Options: "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED")
- `createdById`: String
- `createdAt`: DateTime (Default: now)
- `updatedAt`: DateTime (@updatedAt)

### B. Extended Models

#### 1. `Employee`
- `positionCategoryId`: String (Optional)
- `defaultProjectId`: String (Optional)
- `defaultSiteId`: String (Optional)

#### 2. `AttendanceRecord`
- `projectId`: String (Optional)
- `siteId`: String (Optional)
- `deploymentId`: String (Optional)
- `projectStatusFlag`: String (Optional, e.g., "UNASSIGNED_PROJECT", "OUT_OF_ZONE", "MATCHED")

---

## 2. API Endpoint Layout

The following REST endpoints will be constructed to handle administrative queries and mobile client state reads:

### A. Position Categories
- `GET /api/v1/blue-collar/position-categories` - Fetch all trade listings.
- `POST /api/v1/blue-collar/position-categories` - Add a custom Position/Trade category.
- `PATCH /api/v1/blue-collar/position-categories/[id]` - Modify category attributes.

### B. Projects & Sites
- `GET /api/v1/projects` - List all projects.
- `POST /api/v1/projects` - Register a new Project contract.
- `PATCH /api/v1/projects/[id]` - Edit project metadata or status.
- `GET /api/v1/projects/[id]/sites` - Fetch sites belonging to the specified project.
- `POST /api/v1/projects/[id]/sites` - Add a project site with custom coordinates and geofences.
- `PATCH /api/v1/project-sites/[id]` - Update site details.

### C. Deployments
- `GET /api/v1/deployments` - Query deployments by date, employeeId, or project/site filters.
- `POST /api/v1/deployments` - Allocate an employee to a project/site.
- `POST /api/v1/deployments/bulk` - Apply deployments to multiple employees.
- `GET /api/v1/deployments/coverage` - Read site headcount metrics.

---

## 3. Deployment Conflict Checks & Safety Guards

All allocations must pass a series of validation rules:
1. **Overlap Prevention**: Resolves employee allocations for the target date and verifies that new deployment time blocks do not intersect existing windows.
2. **Leave Guards**: Cross-references `LeaveRequest` records to block deployments if the employee has approved leave on the target date.
3. **Inactive Blocks**: Rejects scheduling assignments if the project status is not `"ACTIVE"`, the site status is not `"ACTIVE"`, or the employee is deactivated.
4. **Shift Overlay Warnings**: Warns the administrator if the deployment overlaps with the employee's standard shift assignments.

---

## 4. Mobile Check-In Integration
- **Auto-allocation**: When a Blue Collar worker marks attendance, the backend checks for an active deployment at that timestamp.
- **Geofencing validation**: If a matching deployment is found with a geofence (`latitude` & `longitude`), check-in coordinates are verified against the site's bounds.
- **Unassigned Checks**: If no active deployment exists, the check-in is flagged with `projectStatusFlag = "UNASSIGNED_PROJECT"`.
