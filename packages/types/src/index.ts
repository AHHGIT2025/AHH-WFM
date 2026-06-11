export interface Employee {
  id: string;
  name: string;
  department: string;
  role: string;
  status: "On Duty" | "On Break" | "Offline" | "On Leave";
  avatarUrl?: string;
  email: string;
  phone?: string;
  shiftId?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string; // ISO timestamp
  checkOut?: string; // ISO timestamp
  lat: number;
  lng: number;
  device: string;
  status: "On Time" | "Late" | "Absent" | "Sync Exception";
  locationName: string;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  timeRange: string; // e.g. "09:00 AM — 06:00 PM"
  breakDuration: string; // e.g. "60 mins"
  status: "Active" | "Inactive";
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string; // e.g. "Annual Leave", "Sick Leave"
  dateRange: string; // e.g. "25 Oct - 27 Oct 2023"
  reason: string;
  status: "Approved" | "Rejected" | "Pending Approval";
}

export interface SapMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformationRule: string;
  status: "Mapped" | "Conflict" | "Unmapped";
}

export interface SyncLog {
  id: string;
  timestamp: string;
  operation: string; // e.g. "Data Pull", "Data Push", "Schema Update"
  subject: string; // e.g. "Payroll_Info_v2"
  status: "Success" | "Failed" | "Warning";
  details: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  author: string;
  category: "General" | "Urgent" | "System Update";
}
