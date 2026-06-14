# Release Notes v0.16: Flexible Employee Punch Location Policies

## Overview
This release introduces highly granular, per-employee mobile punch location policies, decoupling strict office assignments from field deployment tracking. The system now supports explicit allowances for out-of-zone punches, multiple overlapping site assignments, and dynamic radius overrides directly from the Web Admin dashboard.

## Key Features & Enhancements
- **Employee-Level Punch Policy Toggles**: Added toggles for `allowMultiplePunchLocations`, `allowOfficePunch`, `allowProjectSitePunch`, `allowOnCallPunch`, and `allowOutOfZonePunch` to give HR control over individual permissions.
- **Default Punch Location Support**: Separated `defaultLocationId` (HR/Cost Center) from `defaultPunchLocationId` (Mobile Geofence rule), ensuring accurate payroll without breaking field geofencing rules.
- **Multiple Allowed Punch Locations**: Built `EmployeeAllowedPunchLocation` joining structure, allowing hybrid employees to clock-in at several independent locations or offices.
- **Fixed Blank Location Dropdown Issue**: Resolved the UI mapping bug in `/workforce` that displayed empty arrays `()` instead of location names.
- **Mobile Geofence Cascade Update**: The Mobile Check-in BFF `/api/v1/attendance/check-in` now strictly cascades and evaluates coordinates against: Active Deployment -> On-Call -> Shift -> Custom Allowed -> Office -> Fallback.
- **Out-of-Zone Review Flagging**: Employees with `allowOutOfZonePunch` and `requireOutOfZoneReview` enabled are now securely captured but flagged as `OUT_OF_ZONE_REVIEW_REQUIRED` for supervisor sign-off instead of being blocked.
- **Web/Mobile Integration**: End-to-end integration proving policies configured in the Web Admin dynamically flow to the Mobile App and restrict the Check-In engine.
