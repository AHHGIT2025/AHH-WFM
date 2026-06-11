import { Employee, AttendanceRecord, Shift, LeaveRequest, SapMapping, SyncLog, Announcement } from "@ahh-wfm/types";
import * as fs from "fs";
import * as path from "path";

// In-memory fallback
let memoryDb: {
  employees: Employee[];
  attendance: AttendanceRecord[];
  shifts: Shift[];
  leaves: LeaveRequest[];
  sapMappings: SapMapping[];
  syncLogs: SyncLog[];
  announcements: Announcement[];
} = {
  employees: [
    { id: "SK-90210", name: "Sarah Kim", department: "Operations", role: "Site Inspector", status: "On Break", email: "sarah.kim@alhattab.qa", phone: "+974 5555 1234", shiftId: "MOR-102" },
    { id: "AM-8821", name: "Alex Martinez", department: "Engineering", role: "Field Engineer", status: "On Duty", email: "alex.m@alhattab.qa", phone: "+974 5555 5678", shiftId: "GEN-001" },
    { id: "BR-8823", name: "Brandon Reed", department: "Logistics", role: "Logistics Driver", status: "On Duty", email: "brandon.r@alhattab.qa", phone: "+974 5555 9012", shiftId: "AFT-103" },
    { id: "JL-8824", name: "Jordan Lee", department: "Sales", role: "Field Sales", status: "Offline", email: "jordan.lee@alhattab.qa", phone: "+974 5555 3456", shiftId: "ROT-A" },
    { id: "AA-1001", name: "Ahmed Ali", department: "Operations", role: "Maintenance Lead", status: "Offline", email: "ahmed.ali@alhattab.qa", phone: "+974 6666 1111", shiftId: "GEN-001" }
  ],
  attendance: [
    { id: "ATT-001", employeeId: "AM-8821", employeeName: "Alex Martinez", checkIn: "2026-06-11T08:55:00Z", checkOut: "2026-06-11T18:02:00Z", lat: 25.2854, lng: 51.5310, device: "Galaxy S23 · 5G · GPS Active", status: "On Time", locationName: "Doha Headquarters" },
    { id: "ATT-002", employeeId: "SK-90210", employeeName: "Sarah Kim", checkIn: "2026-06-11T09:15:00Z", lat: 25.2867, lng: 51.5325, device: "iPhone 15 Pro · Wi-Fi", status: "Late", locationName: "West Bay Office" },
    { id: "ATT-003", employeeId: "BR-8823", employeeName: "Brandon Reed", checkIn: "2026-06-11T13:58:00Z", lat: 25.2905, lng: 51.5201, device: "iPad Mini · 4G LTE", status: "On Time", locationName: "Industrial Area Depot" }
  ],
  shifts: [
    { id: "GEN-001", name: "General Shift", code: "GEN-001", timeRange: "09:00 AM — 06:00 PM", breakDuration: "60 mins", status: "Active" },
    { id: "MOR-102", name: "Morning Shift", code: "MOR-102", timeRange: "06:00 AM — 02:00 PM", breakDuration: "45 mins", status: "Active" },
    { id: "AFT-103", name: "Afternoon Shift", code: "AFT-103", timeRange: "02:00 PM — 10:00 PM", breakDuration: "45 mins", status: "Active" },
    { id: "NGT-201", name: "Night Shift", code: "NGT-201", timeRange: "10:00 PM — 06:00 AM", breakDuration: "30 mins", status: "Active" },
    { id: "ROT-A", name: "Rotational A", code: "ROT-A", timeRange: "Variable", breakDuration: "Flexible", status: "Inactive" }
  ],
  leaves: [
    { id: "LV-001", employeeId: "SK-90210", employeeName: "Sarah Kim", type: "Annual Leave", dateRange: "25 Jun - 28 Jun 2026", reason: "Family trip to Dubai", status: "Pending Approval" },
    { id: "LV-002", employeeId: "AM-8821", employeeName: "Alex Martinez", type: "Sick Leave", dateRange: "14 Jun - 15 Jun 2026", reason: "Medical Appointment", status: "Approved" }
  ],
  sapMappings: [
    { id: "MAP-001", sourceField: "userId", targetField: "employeeId", transformationRule: "Direct string mapping", status: "Mapped" },
    { id: "MAP-002", sourceField: "jobTitle", targetField: "role", transformationRule: "Title case parsing", status: "Mapped" },
    { id: "MAP-003", sourceField: "custom_status", targetField: "status", transformationRule: "Value mapping list", status: "Mapped" },
    { id: "MAP-004", sourceField: "cost_center", targetField: "department", transformationRule: "Prefix removal and routing", status: "Mapped" },
    { id: "MAP-005", sourceField: "dept_code", targetField: "department_id", transformationRule: "Lookup code table", status: "Conflict" }
  ],
  syncLogs: [
    { id: "LOG-001", timestamp: "2026-06-11 23:45:00", operation: "Data Push", subject: "Attendance_Feed", status: "Success", details: "Pushed 45 records to SuccessFactors endpoint" },
    { id: "LOG-002", timestamp: "2026-06-11 23:30:12", operation: "Schema Update", subject: "User_Object_Extension", status: "Failed", details: "SuccessFactors API rejected schema extension: Out of limits" },
    { id: "LOG-003", timestamp: "2026-06-11 23:10:55", operation: "Field Map", subject: "Employee_Dept_Code", status: "Warning", details: "Implicit mapping resolver used for code: QA_OPS" }
  ],
  announcements: [
    { id: "ANN-001", title: "Summer Working Hours", content: "Following the national directives, summer working hours for outdoor sites will change starting next week. Please check in early.", timestamp: "2026-06-11T12:00:00Z", author: "HR Department", category: "Urgent" },
    { id: "ANN-002", title: "SuccessFactors Sync Upgrade", content: "The SAP SuccessFactors bridge integration will undergo a schema update this Friday night. System availability might be affected for 10 minutes.", timestamp: "2026-06-10T15:00:00Z", author: "IT Infrastructure", category: "System Update" }
  ]
};

// JSON file database resolution on disk (Node.js environment)
const getDbPath = () => {
  // If running in browser, path resolution is unavailable
  if (typeof window !== "undefined") return "";
  
  // Save database inside the packages/mock-data folder
  try {
    const rootPath = "D:\\AI Projects\\AHH WFM\\app";
    const dbDir = path.join(rootPath, "packages", "mock-data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    return path.join(dbDir, "db.json");
  } catch (e) {
    return "";
  }
};

const readDb = (): typeof memoryDb => {
  const dbPath = getDbPath();
  if (!dbPath) return memoryDb;
  
  try {
    if (!fs.existsSync(dbPath)) {
      writeDb(memoryDb);
      return memoryDb;
    }
    const data = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read JSON DB, using memory fallback", e);
    return memoryDb;
  }
};

const writeDb = (data: typeof memoryDb) => {
  memoryDb = data;
  const dbPath = getDbPath();
  if (!dbPath) return;
  
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write to JSON DB", e);
  }
};

// Database CRUD Actions API
export const mockDb = {
  // Employees
  getEmployees: (): Employee[] => {
    return readDb().employees;
  },
  updateEmployeeStatus: (id: string, status: Employee["status"]): Employee | null => {
    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    employee.status = status;
    writeDb(db);
    return employee;
  },
  
  // Attendance
  getAttendance: (): AttendanceRecord[] => {
    return readDb().attendance;
  },
  checkIn: (employeeId: string, lat: number, lng: number, device: string, locationName: string): AttendanceRecord => {
    const db = readDb();
    const employee = db.employees.find(e => e.id === employeeId);
    const employeeName = employee ? employee.name : "Unknown Employee";
    
    // Set employee status to "On Duty"
    if (employee) {
      employee.status = "On Duty";
    }
    
    const record: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      employeeId,
      employeeName,
      checkIn: new Date().toISOString(),
      lat,
      lng,
      device,
      status: "On Time", // In mock, check-ins are always on time unless late threshold is exceeded
      locationName
    };
    
    db.attendance.unshift(record);
    
    // Add a sync log too
    db.syncLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operation: "Data Push",
      subject: `Attendance_${employeeId}`,
      status: "Success",
      details: `Checked In from mobile at ${locationName}`
    });
    
    writeDb(db);
    return record;
  },
  checkOut: (employeeId: string): AttendanceRecord | null => {
    const db = readDb();
    const record = db.attendance.find(r => r.employeeId === employeeId && !r.checkOut);
    if (!record) return null;
    
    record.checkOut = new Date().toISOString();
    
    const employee = db.employees.find(e => e.id === employeeId);
    if (employee) {
      employee.status = "Offline";
    }
    
    writeDb(db);
    return record;
  },
  
  // Shifts
  getShifts: (): Shift[] => {
    return readDb().shifts;
  },
  addShift: (shift: Omit<Shift, "id">): Shift => {
    const db = readDb();
    const newShift: Shift = {
      ...shift,
      id: shift.code
    };
    db.shifts.push(newShift);
    
    db.syncLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operation: "Schema Update",
      subject: `Shift_${shift.code}`,
      status: "Success",
      details: `Created new shift ${shift.name} (${shift.timeRange})`
    });
    
    writeDb(db);
    return newShift;
  },
  
  // Leaves
  getLeaves: (): LeaveRequest[] => {
    return readDb().leaves;
  },
  applyLeave: (employeeId: string, type: string, dateRange: string, reason: string): LeaveRequest => {
    const db = readDb();
    const employee = db.employees.find(e => e.id === employeeId);
    const employeeName = employee ? employee.name : "Unknown Employee";
    
    const request: LeaveRequest = {
      id: `LV-${Date.now()}`,
      employeeId,
      employeeName,
      type,
      dateRange,
      reason,
      status: "Pending Approval"
    };
    db.leaves.unshift(request);
    writeDb(db);
    return request;
  },
  updateLeaveStatus: (id: string, status: LeaveRequest["status"]): LeaveRequest | null => {
    const db = readDb();
    const request = db.leaves.find(l => l.id === id);
    if (!request) return null;
    request.status = status;
    
    // Update employee status if leave is approved and active
    if (status === "Approved") {
      const employee = db.employees.find(e => e.id === request.employeeId);
      if (employee) {
        employee.status = "On Leave";
      }
    }
    
    writeDb(db);
    return request;
  },
  
  // SAP mappings
  getSapMappings: (): SapMapping[] => {
    return readDb().sapMappings;
  },
  updateSapMappingStatus: (id: string, status: SapMapping["status"]): SapMapping | null => {
    const db = readDb();
    const mapping = db.sapMappings.find(m => m.id === id);
    if (!mapping) return null;
    mapping.status = status;
    writeDb(db);
    return mapping;
  },
  
  // Sync Logs
  getSyncLogs: (): SyncLog[] => {
    return readDb().syncLogs;
  },
  addSyncLog: (log: Omit<SyncLog, "id" | "timestamp">): SyncLog => {
    const db = readDb();
    const newLog: SyncLog = {
      ...log,
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19)
    };
    db.syncLogs.unshift(newLog);
    writeDb(db);
    return newLog;
  },
  
  // Announcements
  getAnnouncements: (): Announcement[] => {
    return readDb().announcements;
  }
};
