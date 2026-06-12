import { Employee, AttendanceRecord, Shift, LeaveRequest, SapMapping, SyncLog, Announcement } from "@ahh-wfm/types";
import * as fs from "fs";
import * as path from "path";

// Initialize Prisma dynamically if DATABASE_URL is available
let prismaClient: any = null;
const isDbConnected = () => {
  if (typeof window !== "undefined") return false;
  if (!process.env.DATABASE_URL) return false;
  
  if (!prismaClient) {
    try {
      const { prisma } = require("@ahh-wfm/database");
      prismaClient = prisma;
    } catch (e) {
      console.error("Failed to load @ahh-wfm/database package", e);
    }
  }
  return !!prismaClient;
};

// In-memory fallback dataset (also used to seed MySQL)
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

// Seeding helper to pre-fill MySQL with mock data if it is empty
let isSeeded = false;
const seedMySQL = async () => {
  if (isSeeded) return;
  if (!isDbConnected()) return;
  
  try {
    const empCount = await prismaClient.employee.count();
    if (empCount === 0) {
      console.log("MySQL database is empty. Seeding mock data...");
      
      // Seed employees
      for (const emp of memoryDb.employees) {
        await prismaClient.employee.create({ data: emp });
      }
      
      // Seed shifts
      for (const shift of memoryDb.shifts) {
        await prismaClient.shift.create({ data: shift });
      }
      
      // Seed attendance records
      for (const att of memoryDb.attendance) {
        await prismaClient.attendanceRecord.create({
          data: {
            id: att.id,
            employeeId: att.employeeId,
            employeeName: att.employeeName,
            checkIn: new Date(att.checkIn),
            checkOut: att.checkOut ? new Date(att.checkOut) : null,
            lat: att.lat,
            lng: att.lng,
            device: att.device,
            status: att.status,
            locationName: att.locationName
          }
        });
      }
      
      // Seed leaves
      for (const leave of memoryDb.leaves) {
        await prismaClient.leaveRequest.create({ data: leave });
      }
      
      // Seed SAP mapping
      for (const map of memoryDb.sapMappings) {
        await prismaClient.sapMapping.create({ data: map });
      }
      
      // Seed logs
      for (const log of memoryDb.syncLogs) {
        await prismaClient.syncLog.create({
          data: {
            id: log.id,
            timestamp: new Date(log.timestamp.replace(" ", "T") + "Z"),
            operation: log.operation,
            subject: log.subject,
            status: log.status,
            details: log.details
          }
        });
      }
      
      // Seed announcements
      for (const ann of memoryDb.announcements) {
        await prismaClient.announcement.create({
          data: {
            id: ann.id,
            title: ann.title,
            content: ann.content,
            timestamp: new Date(ann.timestamp),
            author: ann.author,
            category: ann.category
          }
        });
      }
      console.log("MySQL Database seeded successfully!");
    }
    isSeeded = true;
  } catch (e) {
    console.error("Failed to seed MySQL database", e);
  }
};

// JSON file database resolution on disk (Node.js environment fallback)
const getDbPath = () => {
  if (typeof window !== "undefined") return "";
  
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

// Data Mapper Helpers for Prisma Types -> TypeScript Interfaces
const mapAttendance = (rec: any): AttendanceRecord => ({
  id: rec.id,
  employeeId: rec.employeeId,
  employeeName: rec.employeeName,
  checkIn: rec.checkIn.toISOString(),
  checkOut: rec.checkOut ? rec.checkOut.toISOString() : undefined,
  lat: rec.lat,
  lng: rec.lng,
  device: rec.device,
  status: rec.status,
  locationName: rec.locationName
});

const mapSyncLog = (log: any): SyncLog => ({
  id: log.id,
  timestamp: log.timestamp.toISOString().replace("T", " ").substring(0, 19),
  operation: log.operation,
  subject: log.subject,
  status: log.status,
  details: log.details
});

const mapAnnouncement = (ann: any): Announcement => ({
  id: ann.id,
  title: ann.title,
  content: ann.content,
  timestamp: ann.timestamp.toISOString(),
  author: ann.author,
  category: ann.category
});

// Database CRUD Actions API (All Async to support DB connection)
export const mockDb = {
  // Employees
  getEmployees: async (): Promise<Employee[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.employee.findMany();
    }
    return readDb().employees;
  },
  updateEmployeeStatus: async (id: string, status: Employee["status"]): Promise<Employee | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const emp = await prismaClient.employee.update({
          where: { id },
          data: { status }
        });
        return emp;
      } catch (e) {
        return null;
      }
    }
    
    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    employee.status = status;
    writeDb(db);
    return employee;
  },
  
  // Attendance
  getAttendance: async (): Promise<AttendanceRecord[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.attendanceRecord.findMany({
        orderBy: { checkIn: "desc" }
      });
      return records.map(mapAttendance);
    }
    return readDb().attendance;
  },
  checkIn: async (employeeId: string, lat: number, lng: number, device: string, locationName: string): Promise<AttendanceRecord> => {
    if (isDbConnected()) {
      await seedMySQL();
      const employee = await prismaClient.employee.findUnique({ where: { id: employeeId } });
      const employeeName = employee ? employee.name : "Unknown Employee";
      
      if (employee) {
        await prismaClient.employee.update({
          where: { id: employeeId },
          data: { status: "On Duty" }
        });
      }
      
      const record = await prismaClient.attendanceRecord.create({
        data: {
          employeeId,
          employeeName,
          lat,
          lng,
          device,
          status: "On Time",
          locationName,
          checkIn: new Date()
        }
      });
      
      await prismaClient.syncLog.create({
        data: {
          operation: "Data Push",
          subject: `Attendance_${employeeId}`,
          status: "Success",
          details: `Checked In from mobile at ${locationName}`,
          timestamp: new Date()
        }
      });
      
      return mapAttendance(record);
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === employeeId);
    const employeeName = employee ? employee.name : "Unknown Employee";
    
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
      status: "On Time",
      locationName
    };
    
    db.attendance.unshift(record);
    
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
  checkOut: async (employeeId: string): Promise<AttendanceRecord | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.attendanceRecord.findFirst({
        where: { employeeId, checkOut: null },
        orderBy: { checkIn: "desc" }
      });
      if (!record) return null;
      
      const updated = await prismaClient.attendanceRecord.update({
        where: { id: record.id },
        data: { checkOut: new Date() }
      });
      
      await prismaClient.employee.update({
        where: { id: employeeId },
        data: { status: "Offline" }
      });
      
      return mapAttendance(updated);
    }

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
  getShifts: async (): Promise<Shift[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.shift.findMany();
    }
    return readDb().shifts;
  },
  addShift: async (shift: Omit<Shift, "id">): Promise<Shift> => {
    if (isDbConnected()) {
      await seedMySQL();
      const newShift = await prismaClient.shift.create({
        data: {
          id: shift.code,
          ...shift
        }
      });
      
      await prismaClient.syncLog.create({
        data: {
          operation: "Schema Update",
          subject: `Shift_${shift.code}`,
          status: "Success",
          details: `Created new shift ${shift.name} (${shift.timeRange})`,
          timestamp: new Date()
        }
      });
      
      return newShift;
    }

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
  getLeaves: async (): Promise<LeaveRequest[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.leaveRequest.findMany();
    }
    return readDb().leaves;
  },
  applyLeave: async (employeeId: string, type: string, dateRange: string, reason: string): Promise<LeaveRequest> => {
    if (isDbConnected()) {
      await seedMySQL();
      const employee = await prismaClient.employee.findUnique({ where: { id: employeeId } });
      const employeeName = employee ? employee.name : "Unknown Employee";
      
      const request = await prismaClient.leaveRequest.create({
        data: {
          employeeId,
          employeeName,
          type,
          dateRange,
          reason,
          status: "Pending Approval"
        }
      });
      
      return request;
    }

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
  updateLeaveStatus: async (id: string, status: LeaveRequest["status"]): Promise<LeaveRequest | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const request = await prismaClient.leaveRequest.update({
          where: { id },
          data: { status }
        });
        
        if (status === "Approved") {
          await prismaClient.employee.update({
            where: { id: request.employeeId },
            data: { status: "On Leave" }
          });
        }
        
        return request;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const request = db.leaves.find(l => l.id === id);
    if (!request) return null;
    request.status = status;
    
    if (status === "Approved") {
      const employee = db.employees.find(e => e.id === request.employeeId);
      if (employee) {
        employee.status = "On Leave";
      }
    }
    
    writeDb(db);
    return request;
  },
  
  // SAP Mappings
  getSapMappings: async (): Promise<SapMapping[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapMapping.findMany();
    }
    return readDb().sapMappings;
  },
  updateSapMappingStatus: async (id: string, status: SapMapping["status"]): Promise<SapMapping | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const mapping = await prismaClient.sapMapping.update({
          where: { id },
          data: { status }
        });
        return mapping;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const mapping = db.sapMappings.find(m => m.id === id);
    if (!mapping) return null;
    mapping.status = status;
    writeDb(db);
    return mapping;
  },
  
  // Sync Logs
  getSyncLogs: async (): Promise<SyncLog[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const logs = await prismaClient.syncLog.findMany({
        orderBy: { timestamp: "desc" }
      });
      return logs.map(mapSyncLog);
    }
    return readDb().syncLogs;
  },
  addSyncLog: async (log: Omit<SyncLog, "id" | "timestamp">): Promise<SyncLog> => {
    if (isDbConnected()) {
      await seedMySQL();
      const newLog = await prismaClient.syncLog.create({
        data: {
          ...log,
          timestamp: new Date()
        }
      });
      return mapSyncLog(newLog);
    }

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
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const announcements = await prismaClient.announcement.findMany({
        orderBy: { timestamp: "desc" }
      });
      return announcements.map(mapAnnouncement);
    }
    return readDb().announcements;
  }
};
