# RELEASE NOTES v0.15

**Title**: Master Data Hub, Advanced Scheduler & Mobile Attendance Integration

## Overview
This release finalizes the integration between the Web Admin Master Data Hub, the Advanced Scheduler, and the Mobile PWA Attendance system. All data entities generated in the back-office now successfully flow into the mobile experience to orchestrate dynamic geofencing, deployment updates, and strict check-in priority validations.

## Features & Master Screens Included
- **Company Master**: Central multi-company setup.
- **Employee Master**: Employee management and synchronization.
- **Designation / Position Master**: Unified roles definition.
- **Trade Classification Master**: Blue-collar trade tracking.
- **Location Master**: Primary logical tracking points.
- **Cost Center Master**: Linkage for SAP financial operations.
- **Project Master**: Top-level operation structures.
- **Project Site Master**: Physical sub-locations of operations.
- **Allowed Punch Location Master**: Custom geographical boundaries.
- **Standby Rules**: Logic matrix for suggesting replacements.

## Advanced Grid Planning Board (Scheduler)
- **Cell Actions**: Interactive menu on the scheduler grid for assigning shifts, deployment, and leaves.
- **Split Shifts**: Capability to split standard shift allocations.
- **Leave/Off/Vacation**: Fast toggle cell actions for absence management.
- **Reliever Assignment**: Immediate linkage of standby coverage.
- **On-Call Duty Assignment**: Rapid reassignment of resources.

## Mobile Integration
- **Web-to-Mobile Flow**: Web-created master data feeding mobile attendance in real-time.
- **Geofence Priority Cascade**: Successful verification of the cascading priority algorithm (Deployment > On-Call > Custom Allowed > Office/Default).
