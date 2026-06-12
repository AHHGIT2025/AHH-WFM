import { Employee, AttendanceRecord, Shift, LeaveRequest, SapMapping, SyncLog, Announcement, Department, Worksite, AttendanceCorrection } from "@ahh-wfm/types";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";

// Generate default hash for mock passwords during local development
const defaultHash = bcrypt.hashSync("Password123!", 10);

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
  departments: Department[];
  worksites: Worksite[];
  attendanceCorrections: AttendanceCorrection[];
} = {
  departments: [
    { id: "DEPT-001", name: "Operations", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-002", name: "Engineering", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-003", name: "Logistics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-004", name: "Sales", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-005", name: "IT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
  employees: [
    { id: "SK-90210", name: "Sarah Kim", department: "Operations", departmentId: "DEPT-001", role: "SUPERVISOR", status: "On Break", email: "sarah.kim@alhattab.qa", phone: "+974 5555 1234", shiftId: "MOR-102", passwordHash: defaultHash, isActive: true },
    { id: "AM-8821", name: "Alex Martinez", department: "Engineering", departmentId: "DEPT-002", role: "EMPLOYEE", status: "On Duty", email: "alex.m@alhattab.qa", phone: "+974 5555 5678", shiftId: "GEN-001", passwordHash: defaultHash, isActive: true },
    { id: "BR-8823", name: "Brandon Reed", department: "Logistics", departmentId: "DEPT-003", role: "EMPLOYEE", status: "On Duty", email: "brandon.r@alhattab.qa", phone: "+974 5555 9012", shiftId: "AFT-103", passwordHash: defaultHash, isActive: true },
    { id: "JL-8824", name: "Jordan Lee", department: "Sales", departmentId: "DEPT-004", role: "EMPLOYEE", status: "Offline", email: "jordan.lee@alhattab.qa", phone: "+974 5555 3456", shiftId: "ROT-A", passwordHash: defaultHash, isActive: true },
    { id: "AA-1001", name: "Ahmed Ali", department: "Operations", departmentId: "DEPT-001", role: "EMPLOYEE", status: "Offline", email: "ahmed.ali@alhattab.qa", phone: "+974 6666 1111", shiftId: "GEN-001", passwordHash: defaultHash, isActive: true },
    { id: "AD-0001", name: "System Administrator", department: "IT", departmentId: "DEPT-005", role: "ADMIN", status: "Offline", email: "admin@alhattab.qa", phone: "+974 0000 0000", shiftId: "GEN-001", passwordHash: defaultHash, isActive: true }
  ],
  attendance: [
    { id: "ATT-001", employeeId: "AM-8821", employeeName: "Alex Martinez", checkIn: "2026-06-11T08:55:00Z", checkOut: "2026-06-11T18:02:00Z", originalCheckIn: "2026-06-11T08:55:00Z", originalCheckOut: "2026-06-11T18:02:00Z", lat: 25.2854, lng: 51.5310, device: "Galaxy S23 · 5G · GPS Active", status: "ON_TIME", locationName: "Doha Headquarters", lateMinutes: 0 },
    { id: "ATT-002", employeeId: "SK-90210", employeeName: "Sarah Kim", checkIn: "2026-06-11T09:15:00Z", originalCheckIn: "2026-06-11T09:15:00Z", lat: 25.2867, lng: 51.5325, device: "iPhone 15 Pro · Wi-Fi", status: "LATE", locationName: "West Bay Office", lateMinutes: 15 },
    { id: "ATT-003", employeeId: "BR-8823", employeeName: "Brandon Reed", checkIn: "2026-06-11T13:58:00Z", originalCheckIn: "2026-06-11T13:58:00Z", lat: 25.2905, lng: 51.5201, device: "iPad Mini · 4G LTE", status: "ON_TIME", locationName: "Industrial Area Depot", lateMinutes: 0 }
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
  ],
  worksites: [
    { id: "WORK-001", name: "Doha Headquarters (West Bay)", lat: 25.3186, lng: 51.5284, radiusMeters: 150.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
  attendanceCorrections: []
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
      
      // Seed departments
      for (const dept of memoryDb.departments) {
        await prismaClient.department.create({
          data: {
            id: dept.id,
            name: dept.name,
            createdAt: new Date(dept.createdAt),
            updatedAt: new Date(dept.updatedAt)
          }
        });
      }
      
      // Seed employees
      for (const emp of memoryDb.employees) {
        await prismaClient.employee.create({ data: emp });
      }
      
      // Seed shifts
      for (const shift of memoryDb.shifts) {
        await prismaClient.shift.create({ data: shift });
      }

      // Seed worksites
      for (const site of (memoryDb as any).worksites) {
        await prismaClient.worksite.create({
          data: {
            id: site.id,
            name: site.name,
            lat: site.lat,
            lng: site.lng,
            radiusMeters: site.radiusMeters,
            isActive: site.isActive,
            createdAt: new Date(site.createdAt),
            updatedAt: new Date(site.updatedAt)
          }
        });
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
            originalCheckIn: new Date(att.checkIn),
            originalCheckOut: att.checkOut ? new Date(att.checkOut) : null,
            lat: att.lat,
            lng: att.lng,
            device: att.device,
            status: att.status === "On Time" ? "ON_TIME" : (att.status === "Late" ? "LATE" : att.status),
            locationName: att.locationName,
            worksiteId: "WORK-001"
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
    const rootPath = "D:\\AI Projects\\AHH WFM\app";
    const dbDir = path.join(rootPath, "packages", "mock-data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    return path.join(dbDir, "db.json");
  } catch (e) {
    return "";
  }
};

const readDb = (): typeof memoryDb & { worksites: Worksite[]; attendanceCorrections: AttendanceCorrection[] } => {
  const dbPath = getDbPath();
  if (!dbPath) return memoryDb as any;
  
  try {
    if (!fs.existsSync(dbPath)) {
      writeDb(memoryDb as any);
      return memoryDb as any;
    }
    const data = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.worksites) {
      parsed.worksites = memoryDb.worksites;
    }
    if (!parsed.attendanceCorrections) {
      parsed.attendanceCorrections = [];
    }
    return parsed;
  } catch (e) {
    console.error("Failed to read JSON DB, using memory fallback", e);
    return memoryDb as any;
  }
};

const writeDb = (data: typeof memoryDb & { worksites: Worksite[]; attendanceCorrections: AttendanceCorrection[] }) => {
  memoryDb = data as any;
  const dbPath = getDbPath();
  if (!dbPath) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write to JSON DB", e);
  }
};
  
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function getShiftStartTimeToday(timeRange: string): Date | null {
  try {
    const startStr = timeRange.split(/—|-|to/)[0].trim(); // e.g. "09:00 AM"
    const parts = startStr.split(" ");
    const timeParts = parts[0].split(":");
    let hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    const ampm = parts[1].toUpperCase();

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  } catch (e) {
    return null;
  }
}

// Data Mapper Helpers for Prisma Types -> TypeScript Interfaces
const mapAttendance = (rec: any): AttendanceRecord => ({
  id: rec.id,
  employeeId: rec.employeeId,
  employeeName: rec.employeeName,
  checkIn: rec.checkIn instanceof Date ? rec.checkIn.toISOString() : rec.checkIn,
  checkOut: rec.checkOut ? (rec.checkOut instanceof Date ? rec.checkOut.toISOString() : rec.checkOut) : undefined,
  originalCheckIn: rec.originalCheckIn instanceof Date ? rec.originalCheckIn.toISOString() : rec.originalCheckIn,
  originalCheckOut: rec.originalCheckOut ? (rec.originalCheckOut instanceof Date ? rec.originalCheckOut.toISOString() : rec.originalCheckOut) : undefined,
  lat: rec.lat,
  lng: rec.lng,
  device: rec.device,
  status: rec.status,
  locationName: rec.locationName,
  worksiteId: rec.worksiteId || undefined,
  shiftId: rec.shiftId || undefined,
  shiftStartSnapshot: rec.shiftStartSnapshot || undefined,
  shiftEndSnapshot: rec.shiftEndSnapshot || undefined,
  lateMinutes: rec.lateMinutes || 0
});

const mapWorksite = (rec: any): Worksite => ({
  id: rec.id,
  name: rec.name,
  lat: rec.lat,
  lng: rec.lng,
  radiusMeters: rec.radiusMeters,
  isActive: rec.isActive,
  createdAt: rec.createdAt instanceof Date ? rec.createdAt.toISOString() : rec.createdAt,
  updatedAt: rec.updatedAt instanceof Date ? rec.updatedAt.toISOString() : rec.updatedAt
});

const mapCorrection = (rec: any): AttendanceCorrection => ({
  id: rec.id,
  attendanceRecordId: rec.attendanceRecordId,
  requestedCheckIn: rec.requestedCheckIn ? (rec.requestedCheckIn instanceof Date ? rec.requestedCheckIn.toISOString() : rec.requestedCheckIn) : undefined,
  requestedCheckOut: rec.requestedCheckOut ? (rec.requestedCheckOut instanceof Date ? rec.requestedCheckOut.toISOString() : rec.requestedCheckOut) : undefined,
  reason: rec.reason,
  status: rec.status,
  reviewedById: rec.reviewedById || undefined,
  reviewNotes: rec.reviewNotes || undefined,
  createdAt: rec.createdAt instanceof Date ? rec.createdAt.toISOString() : rec.createdAt,
  updatedAt: rec.updatedAt instanceof Date ? rec.updatedAt.toISOString() : rec.updatedAt
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
    // Validate coordinates
    if (lat === undefined || lng === undefined || (lat === 0 && lng === 0) || isNaN(lat) || isNaN(lng)) {
      throw new Error("Invalid GPS coordinates");
    }

    if (isDbConnected()) {
      await seedMySQL();
      
      const employee = await prismaClient.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new Error("Employee not found");
      if (employee.isActive === false) {
        throw new Error("Deactivated employees are not allowed to check in");
      }

      // Prevent duplicate open check-ins
      const active = await prismaClient.attendanceRecord.findFirst({
        where: { employeeId, checkOut: null }
      });
      if (active) {
        throw new Error("Employee already has an active check-in session");
      }

      // Check geofencing
      const worksites = await prismaClient.worksite.findMany();
      let matchedWorksite = null;
      let isOutOfZone = true;
      for (const site of worksites) {
        if (site.isActive) {
          const dist = calculateDistance(lat, lng, site.lat, site.lng);
          if (dist <= site.radiusMeters) {
            matchedWorksite = site;
            isOutOfZone = false;
            break;
          }
        }
      }

      // Calculate shift times & late minutes
      let lateMinutes = 0;
      let status = "ON_TIME";
      let shiftStartSnapshot = null;
      let shiftEndSnapshot = null;

      if (employee.shiftId) {
        const shift = await prismaClient.shift.findUnique({ where: { id: employee.shiftId } });
        if (shift) {
          const times = shift.timeRange.split(/—|-|to/);
          shiftStartSnapshot = times[0]?.trim() || null;
          shiftEndSnapshot = times[1]?.trim() || null;

          const expectedStart = getShiftStartTimeToday(shift.timeRange);
          if (expectedStart) {
            const now = new Date();
            const diffMs = now.getTime() - expectedStart.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins > 5) { // 5 mins grace
              lateMinutes = diffMins;
              status = "LATE";
            }
          }
        }
      }

      if (isOutOfZone) {
        status = "OUT_OF_ZONE";
      }

      // Update employee status to On Duty
      await prismaClient.employee.update({
        where: { id: employeeId },
        data: { status: "On Duty" }
      });

      const checkInTime = new Date();
      const record = await prismaClient.attendanceRecord.create({
        data: {
          employeeId,
          employeeName: employee.name,
          lat,
          lng,
          device,
          status,
          locationName,
          checkIn: checkInTime,
          originalCheckIn: checkInTime,
          worksiteId: matchedWorksite ? matchedWorksite.id : null,
          shiftId: employee.shiftId || null,
          shiftStartSnapshot,
          shiftEndSnapshot,
          lateMinutes
        }
      });

      await prismaClient.syncLog.create({
        data: {
          operation: "Data Push",
          subject: `Attendance_${employeeId}`,
          status: "Success",
          details: `Checked In from mobile at ${locationName} (${status})`,
          timestamp: new Date()
        }
      });

      return mapAttendance(record);
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === employeeId);
    if (!employee) throw new Error("Employee not found");
    if (employee.isActive === false) {
      throw new Error("Deactivated employees are not allowed to check in");
    }

    const activeFallback = db.attendance.find(r => r.employeeId === employeeId && !r.checkOut);
    if (activeFallback) {
      throw new Error("Employee already has an active check-in session");
    }

    // Geofencing fallback
    let matchedWorksiteId: string | undefined = undefined;
    let isOutOfZone = true;
    for (const site of db.worksites) {
      if (site.isActive) {
        const dist = calculateDistance(lat, lng, site.lat, site.lng);
        if (dist <= site.radiusMeters) {
          matchedWorksiteId = site.id;
          isOutOfZone = false;
          break;
        }
      }
    }

    // Late logic fallback
    let lateMinutes = 0;
    let status = "ON_TIME";
    let shiftStartSnapshot: string | undefined = undefined;
    let shiftEndSnapshot: string | undefined = undefined;

    if (employee.shiftId) {
      const shift = db.shifts.find(s => s.id === employee.shiftId);
      if (shift) {
        const times = shift.timeRange.split(/—|-|to/);
        shiftStartSnapshot = times[0]?.trim() || undefined;
        shiftEndSnapshot = times[1]?.trim() || undefined;

        const expectedStart = getShiftStartTimeToday(shift.timeRange);
        if (expectedStart) {
          const now = new Date();
          const diffMs = now.getTime() - expectedStart.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins > 5) {
            lateMinutes = diffMins;
            status = "LATE";
          }
        }
      }
    }

    if (isOutOfZone) {
      status = "OUT_OF_ZONE";
    }

    employee.status = "On Duty";
    const checkInTimeStr = new Date().toISOString();
    const record: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      employeeId,
      employeeName: employee.name,
      checkIn: checkInTimeStr,
      originalCheckIn: checkInTimeStr,
      lat,
      lng,
      device,
      status,
      locationName,
      worksiteId: matchedWorksiteId,
      shiftId: employee.shiftId || undefined,
      shiftStartSnapshot,
      shiftEndSnapshot,
      lateMinutes
    };

    db.attendance.unshift(record);

    db.syncLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operation: "Data Push",
      subject: `Attendance_${employeeId}`,
      status: "Success",
      details: `Checked In from mobile at ${locationName} (${status})`
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
      if (!record) {
        throw new Error("No active check-in session found for this employee");
      }

      const checkOutTime = new Date();
      const updated = await prismaClient.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkOut: checkOutTime,
          originalCheckOut: checkOutTime
        }
      });

      await prismaClient.employee.update({
        where: { id: employeeId },
        data: { status: "Offline" }
      });

      return mapAttendance(updated);
    }

    const db = readDb();
    const record = db.attendance.find(r => r.employeeId === employeeId && !r.checkOut);
    if (!record) {
      throw new Error("No active check-in session found for this employee");
    }

    const checkOutTimeStr = new Date().toISOString();
    record.checkOut = checkOutTimeStr;
    record.originalCheckOut = checkOutTimeStr;

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
  },

  // Departments CRUD
  getDepartments: async (): Promise<Department[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const departments = await prismaClient.department.findMany({
        orderBy: { name: "asc" }
      });
      return departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      }));
    }
    const db = readDb();
    if (!db.departments) {
      db.departments = [
        { id: "DEPT-001", name: "Operations", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-002", name: "Engineering", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-003", name: "Logistics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-004", name: "Sales", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-005", name: "IT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ];
      writeDb(db);
    }
    return db.departments;
  },
  createDepartment: async (name: string): Promise<Department> => {
    if (isDbConnected()) {
      await seedMySQL();
      const dept = await prismaClient.department.create({
        data: { name }
      });
      return {
        id: dept.id,
        name: dept.name,
        createdAt: dept.createdAt.toISOString(),
        updatedAt: dept.updatedAt.toISOString()
      };
    }
    const db = readDb();
    if (!db.departments) db.departments = [];
    const newDept: Department = {
      id: `DEPT-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.departments.push(newDept);
    writeDb(db);
    return newDept;
  },
  updateDepartment: async (id: string, name: string): Promise<Department | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const dept = await prismaClient.department.update({
          where: { id },
          data: { name }
        });
        return {
          id: dept.id,
          name: dept.name,
          createdAt: dept.createdAt.toISOString(),
          updatedAt: dept.updatedAt.toISOString()
        };
      } catch (e) {
        return null;
      }
    }
    const db = readDb();
    if (!db.departments) db.departments = [];
    const dept = db.departments.find(d => d.id === id);
    if (!dept) return null;
    dept.name = name;
    dept.updatedAt = new Date().toISOString();
    writeDb(db);
    return dept;
  },

  // Employees Extended CRUD
  createEmployee: async (data: Omit<Employee, "passwordHash"> & { password?: string }): Promise<Employee> => {
    const passwordHash = data.password ? bcrypt.hashSync(data.password, 10) : defaultHash;
    const { password, ...empData } = data;
    
    // Auto-resolve department name for compatibility string
    let departmentName = empData.department;
    if (empData.departmentId) {
      const depts = await mockDb.getDepartments();
      const matched = depts.find(d => d.id === empData.departmentId);
      if (matched) {
        departmentName = matched.name;
      }
    }

    const payload = {
      ...empData,
      department: departmentName,
      passwordHash,
      isActive: true
    };

    if (isDbConnected()) {
      await seedMySQL();
      const emp = await prismaClient.employee.create({
        data: payload
      });
      return emp;
    }

    const db = readDb();
    db.employees.push(payload);
    writeDb(db);
    return payload;
  },
  updateEmployee: async (id: string, data: Partial<Employee>): Promise<Employee | null> => {
    let departmentName = data.department;
    if (data.departmentId && !departmentName) {
      const depts = await mockDb.getDepartments();
      const matched = depts.find(d => d.id === data.departmentId);
      if (matched) {
        departmentName = matched.name;
      }
    }

    const payload = {
      ...data,
      ...(departmentName ? { department: departmentName } : {})
    };

    if (isDbConnected()) {
      await seedMySQL();
      try {
        const emp = await prismaClient.employee.update({
          where: { id },
          data: payload as any
        });
        return emp;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    Object.assign(employee, payload);
    writeDb(db);
    return employee;
  },
  deactivateEmployee: async (id: string): Promise<Employee | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const emp = await prismaClient.employee.update({
          where: { id },
          data: { isActive: false }
        });
        return emp;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    employee.isActive = false;
    writeDb(db);
    return employee;
  },

  // Worksites CRUD
  getWorksites: async (): Promise<Worksite[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const worksites = await prismaClient.worksite.findMany({
        orderBy: { name: "asc" }
      });
      return worksites.map(mapWorksite);
    }
    return readDb().worksites;
  },
  createWorksite: async (name: string, lat: number, lng: number, radiusMeters: number): Promise<Worksite> => {
    if (isDbConnected()) {
      await seedMySQL();
      const site = await prismaClient.worksite.create({
        data: { name, lat, lng, radiusMeters, isActive: true }
      });
      return mapWorksite(site);
    }
    const db = readDb();
    const newSite: Worksite = {
      id: `WORK-${Date.now()}`,
      name,
      lat,
      lng,
      radiusMeters,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.worksites.push(newSite);
    writeDb(db);
    return newSite;
  },
  updateWorksite: async (id: string, data: Partial<Worksite>): Promise<Worksite | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const site = await prismaClient.worksite.update({
          where: { id },
          data
        });
        return mapWorksite(site);
      } catch (e) {
        return null;
      }
    }
    const db = readDb();
    const site = db.worksites.find(s => s.id === id);
    if (!site) return null;
    Object.assign(site, data);
    site.updatedAt = new Date().toISOString();
    writeDb(db);
    return site;
  },

  // Corrections CRUD
  getCorrections: async (): Promise<AttendanceCorrection[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const corrections = await prismaClient.attendanceCorrection.findMany({
        orderBy: { createdAt: "desc" }
      });
      return corrections.map(mapCorrection);
    }
    return readDb().attendanceCorrections;
  },
  submitCorrection: async (attendanceRecordId: string, requestedCheckIn: string | undefined, requestedCheckOut: string | undefined, reason: string): Promise<AttendanceCorrection> => {
    if (isDbConnected()) {
      await seedMySQL();
      const correction = await prismaClient.attendanceCorrection.create({
        data: {
          attendanceRecordId,
          requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
          requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
          reason,
          status: "Pending"
        }
      });
      // Mark attendance record status as PENDING_CORRECTION
      await prismaClient.attendanceRecord.update({
        where: { id: attendanceRecordId },
        data: { status: "PENDING_CORRECTION" }
      });
      return mapCorrection(correction);
    }
    const db = readDb();
    const newCorrection: AttendanceCorrection = {
      id: `CORR-${Date.now()}`,
      attendanceRecordId,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.attendanceCorrections.unshift(newCorrection);
    
    // Mark fallback record
    const att = db.attendance.find(a => a.id === attendanceRecordId);
    if (att) {
      att.status = "PENDING_CORRECTION";
    }
    
    writeDb(db);
    return newCorrection;
  },
  reviewCorrection: async (id: string, status: "Approved" | "Rejected", reviewedById: string | undefined, reviewNotes: string | undefined): Promise<AttendanceCorrection | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const correction = await prismaClient.attendanceCorrection.update({
          where: { id },
          data: { status, reviewedById, reviewNotes }
        });

        const attRecord = await prismaClient.attendanceRecord.findUnique({
          where: { id: correction.attendanceRecordId }
        });

        if (attRecord) {
          if (status === "Approved") {
            const checkInVal = correction.requestedCheckIn || attRecord.checkIn;
            const checkOutVal = correction.requestedCheckOut || attRecord.checkOut;

            // Recalculate late minutes
            let lateMinutes = attRecord.lateMinutes;
            let finalStatus = "CORRECTED";

            if (attRecord.shiftId) {
              const shift = await prismaClient.shift.findUnique({ where: { id: attRecord.shiftId } });
              if (shift) {
                const expectedStart = getShiftStartTimeToday(shift.timeRange);
                if (expectedStart) {
                  const checkInTime = new Date(checkInVal);
                  const diffMs = checkInTime.getTime() - expectedStart.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  lateMinutes = diffMins > 5 ? diffMins : 0;
                }
              }
            }

            await prismaClient.attendanceRecord.update({
              where: { id: attRecord.id },
              data: {
                checkIn: checkInVal,
                checkOut: checkOutVal,
                status: finalStatus,
                lateMinutes
              }
            });
          } else {
            // Revert PENDING_CORRECTION back to its proper status based on original details
            let originalStatus = "ON_TIME";
            if (attRecord.shiftId) {
              const shift = await prismaClient.shift.findUnique({ where: { id: attRecord.shiftId } });
              if (shift) {
                const expectedStart = getShiftStartTimeToday(shift.timeRange);
                if (expectedStart) {
                  const checkInTime = new Date(attRecord.originalCheckIn);
                  const diffMs = checkInTime.getTime() - expectedStart.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  if (diffMins > 5) {
                    originalStatus = "LATE";
                  }
                }
              }
            }
            // Check if originally it was out of zone
            if (attRecord.worksiteId === null) {
              originalStatus = "OUT_OF_ZONE";
            }
            await prismaClient.attendanceRecord.update({
              where: { id: attRecord.id },
              data: { status: originalStatus }
            });
          }
        }

        return mapCorrection(correction);
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const correction = db.attendanceCorrections.find(c => c.id === id);
    if (!correction) return null;
    correction.status = status;
    correction.reviewedById = reviewedById;
    correction.reviewNotes = reviewNotes;
    correction.updatedAt = new Date().toISOString();

    const attRecord = db.attendance.find(a => a.id === correction.attendanceRecordId);
    if (attRecord) {
      if (status === "Approved") {
        attRecord.checkIn = correction.requestedCheckIn ? correction.requestedCheckIn : attRecord.checkIn;
        attRecord.checkOut = correction.requestedCheckOut ? correction.requestedCheckOut : attRecord.checkOut;
        attRecord.status = "CORRECTED";

        if (attRecord.shiftId) {
          const shift = db.shifts.find(s => s.id === attRecord.shiftId);
          if (shift) {
            const expectedStart = getShiftStartTimeToday(shift.timeRange);
            if (expectedStart) {
              const checkInTime = new Date(attRecord.checkIn);
              const diffMs = checkInTime.getTime() - expectedStart.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              attRecord.lateMinutes = diffMins > 5 ? diffMins : 0;
            }
          }
        }
      } else {
        let originalStatus = "ON_TIME";
        if (attRecord.shiftId) {
          const shift = db.shifts.find(s => s.id === attRecord.shiftId);
          if (shift) {
            const expectedStart = getShiftStartTimeToday(shift.timeRange);
            if (expectedStart) {
              const checkInTime = new Date(attRecord.originalCheckIn);
              const diffMs = checkInTime.getTime() - expectedStart.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              if (diffMins > 5) {
                originalStatus = "LATE";
              }
            }
          }
        }
        if (!attRecord.worksiteId) {
          originalStatus = "OUT_OF_ZONE";
        }
        attRecord.status = originalStatus;
      }
    }

    writeDb(db);
    return correction;
  }
};
