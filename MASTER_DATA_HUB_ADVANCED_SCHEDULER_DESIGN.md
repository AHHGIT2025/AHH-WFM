# Master Data Hub & Advanced Scheduler Design

## 1. Overview
This module centralizes all foundational data for the AHH WFM system, establishing a Holding Company structure, and provides a Grid Planning Board with robust cell-action functionalities. It also enforces a strict Geofence priority sequence for mobile check-ins.

## 2. Database Models (Holding Company Structure)
All entities are now scoped under a `Company` model (`companyId`), reflecting AHH's multi-company holding structure:
- **Company**: Holding structure root.
- **LocationMaster**: Master of all logical locations.
- **AllowedPunchLocation**: Authorized geofences (Office, Project_Site, Client_Site).
- **EmployeeAllowedPunchLocation**: N-to-N assignment of allowed punch locations to employees.
- **Project & ProjectSite**: Master tables for deployments.
- **CostCenter & Department**: Financial & logical grouping.
- **TradeClassification & PositionCategory**: Skill/Role tracking.
- **RelieverRule**: Configurable coverage logic.

## 3. UI - Master Data Hub
**Location**: `/admin/masters/page.tsx`
A unified administrative dashboard leveraging a generic `MasterDataEntityTab` component to render dynamic CRUD tables based on configuration.
Supports standard actions: Search, Create, Edit, Activate/Deactivate.

## 4. UI - Advanced Scheduler (Grid Planning Board)
**Location**: `/shifts/page.tsx`
Provides an interactive date-grid where each cell corresponds to an employee's date.
Clicking a cell opens an action menu with the following capabilities:
- **Assign Shift / Split Shift**: Plan shift templates for specific days.
- **Mark Leave / Vacation / Day Off**: Update attendance expectation.
- **Assign Project / Site Deployment**: Dynamically shift blue-collar workers.
- **Assign On-Call Duty**: Used dynamically for facility management operations.
- **Link Reliever / Cover**: Intelligently recommends standbys based on rules.

## 5. Mobile Attendance Logic (Priority Sequence)
**Location**: `/api/v1/attendance/check-in` & `check-out`
Punch logic evaluates validation in a strict priority:
1. **Active deployment geofence** (Project site assignment matching `deploymentDate`).
2. **Active on-call assignment** (Priority fallback).
3. **Employee Allowed Punch Location** (Dynamic overrides for special cases).
4. **Office / Default** (Fallback location mapping).
5. **Company Policy** (Enforcement rules, strictly logged as OUT_OF_BOUNDS if no match).

**Mobile Interface**: `/employee/punch` allows employees to view their current GPS, their assigned geofence status, and perform punches seamlessly.
