# AHH WFM - REST API Roadmap

This document outlines the API transformation plan to transition from the current unified API route (`/api/db`) to a modular, production-ready RESTful API.

---

## 1. Current Architecture vs. Target Architecture

### Current v0.1 API Status
*   **Unified Route:** Both `apps/web` and `apps/mobile` hit `/api/db` for all database actions.
*   **Action Dispatcher Pattern:** Methods are triggered by passing an `action` string in the POST request body (e.g. `action: "checkIn"`).

### Target Production API Structure
*   **RESTful Standard:** Group endpoints under resource-specific paths (e.g., `/api/v1/attendance`, `/api/v1/employees`).
*   **HTTP Verbs:** Use standard GET, POST, PUT, DELETE operations rather than POST action bodies.

---

## 2. API Endpoints Map

Below is the planned route mapping for the production API:

### `/api/v1/employees`
*   `GET /` - List all employees with pagination, department, and shift filtering.
*   `GET /:id` - Retrieve employee profile and active status.
*   `POST /` - Add a new employee.
*   `PUT /:id` - Update employee details (status, role, shiftId).
*   `DELETE /:id` - Remove employee from active roster (Cascade deletes attendance/leaves).

### `/api/v1/attendance`
*   `GET /` - Retrieve attendance records ledger.
*   `GET /operative/:employeeId` - Retrieve check-in logs for a specific employee.
*   `POST /check-in` - Log an check-in event. Payload requires:
    ```json
    {
      "employeeId": "SK-90210",
      "lat": 25.2867,
      "lng": 51.5325,
      "device": "iPhone 15 Pro",
      "locationName": "West Bay Office"
    }
    ```
*   `POST /check-out` - Close active shift check-in for the employee.

### `/api/v1/leaves`
*   `GET /` - List all leave requests.
*   `POST /request` - Submit a new leave request.
*   `PUT /approve/:id` - Approve a leave request (updates request status to `"Approved"` and changes corresponding employee status to `"On Leave"`).
*   `PUT /reject/:id` - Reject a leave request.

### `/api/v1/shifts`
*   `GET /` - List all configured shifts.
*   `POST /` - Create a new shift rule block.
*   `PUT /assign` - Assign a shift ID to an employee list.

---

## 3. SAP SuccessFactors Integration Hub API

To make the SAP sync hub fully operational, the API will expose the following endpoint controls:

*   **`POST /api/v1/sap/sync`**
    *   Triggers manual replication. Calls the SuccessFactors OData API to fetch updated user roles/profiles and updates the local MySQL tables.
*   **`POST /api/v1/sap/push-attendance`**
    *   Iterates over local MySQL `AttendanceRecord` entries and pushes them to the SuccessFactors Timesheet replication endpoints.
*   **`GET /api/v1/sap/mapping-rules`**
    *   Returns the JSON key schema configurations.
