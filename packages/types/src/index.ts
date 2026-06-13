export interface Department {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  department: string; // compatibility string
  departmentId?: string;
  role: string;
  status: "On Duty" | "On Break" | "Offline" | "On Leave" | string;
  avatarUrl?: string;
  email: string;
  phone?: string;
  shiftId?: string;
  passwordHash?: string;
  isActive?: boolean;
  employmentStatus?: string;
  dutyStatus?: string;
  workerCategory?: string;
  positionCategoryId?: string;
  defaultProjectId?: string;
  defaultSiteId?: string;
}

export interface Worksite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceCorrection {
  id: string;
  attendanceRecordId: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  reviewedById?: string;
  reviewNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string; // ISO timestamp (effective)
  checkOut?: string; // ISO timestamp (effective)
  originalCheckIn: string; // original check-in timestamp
  originalCheckOut?: string; // original check-out timestamp
  lat: number;
  lng: number;
  device: string;
  status: "ON_TIME" | "LATE" | "OUT_OF_ZONE" | "ABSENT" | "PENDING_CORRECTION" | "CORRECTED" | string;
  locationName: string;
  worksiteId?: string;
  shiftId?: string;
  shiftStartSnapshot?: string;
  shiftEndSnapshot?: string;
  lateMinutes: number;
  standardOtMinutes?: number;
  weekendOtMinutes?: number;
  holidayOtMinutes?: number;
  nightOtMinutes?: number;
  specialEventOtMinutes?: number;
  otApprovedMinutes?: number;
  overtimePayAmount?: number;
  otStatus?: "PENDING" | "APPROVED" | "REJECTED" | string;
  projectId?: string;
  siteId?: string;
  deploymentId?: string;
  projectStatusFlag?: string;
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
  status: "Approved" | "Rejected" | "Pending Approval" | string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  leaveTypeId?: string;
  currentStep?: number;
  totalSteps?: number;
  workflowId?: string;
  submittedAt?: string;
  firstActionAt?: string;
  approvedAt?: string;
  approvalDurationHours?: number;
  escalationCount?: number;
}

export interface LeaveApprovalWorkflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  conditionExpr?: string; // JSON configuration string
  steps?: LeaveApprovalStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveApprovalStep {
  id: string;
  workflowId: string;
  stepNumber: number;
  roleRequired: string; // "SUPERVISOR" | "MANAGER" | "HR"
  autoApprove: boolean;
  departmentFilter?: string;
  gradeFilter?: string;
  employeeGroupFilter?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveApprovalHistory {
  id: string;
  leaveRequestId: string;
  approverId?: string;
  action: "SUBMIT" | "APPROVE" | "REJECT" | "ESCALATE" | "REMIND" | "AUTO_APPROVE" | string;
  remarks?: string;
  previousStatus: string;
  newStatus: string;
  createdAt?: string;
}

export interface LeaveApprovalDelegation {
  id: string;
  employeeId: string; // original approver
  delegateApproverId: string; // delegate approver
  validFrom: string; // ISO date string
  validTo: string; // ISO date string
  reason: string;
  createdAt?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  accruable: boolean;
  carryForward: boolean;
  maxCarryOver: number;
  expiryMonths: number;
  colorCode: string;
  sapExternalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  carriedOver: number;
  sapExternalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalanceLedger {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  actionType: "INITIAL" | "ACCRUAL" | "LEAVE_TAKEN" | "CARRY_FORWARD" | "EXPIRY" | "MANUAL_ADJUSTMENT" | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  remarks?: string;
  createdAt?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // ISO date string (YYYY-MM-DD)
  isRecurring: boolean;
  scope: "NATIONAL" | "COMPANY" | "SITE" | string;
  siteId?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isSplit: boolean;
  splitStart?: string;
  splitEnd?: string;
  isFlexible: boolean;
  coreHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RotationTemplate {
  id: string;
  name: string;
  cycleDays: number;
  patternJson: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName?: string;
  shiftTemplateId: string;
  shiftTemplate?: ShiftTemplate;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftSwapRequest {
  id: string;
  requestorId: string;
  requestorName?: string;
  targetEmployeeId: string;
  targetEmployeeName?: string;
  requestorShiftId: string; // shift template id
  requestorShiftName?: string;
  targetShiftId: string; // shift template id
  targetShiftName?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reason?: string;
  reviewNotes?: string;
  approvedById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OvertimeRate {
  id: string;
  name: string;
  overtimeType: "STANDARD_OT" | "WEEKEND_OT" | "HOLIDAY_OT" | "NIGHT_OT" | "SPECIAL_EVENT_OT" | string;
  multiplier: number;
  fixedRateAmount?: number;
  currency: string;
  appliesOnWeekend: boolean;
  appliesOnHoliday: boolean;
  appliesAfterMinutes: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapConnection {
  id: string;
  systemName: string;
  odataUrl: string;
  clientId: string;
  companyId: string;
  userId: string;
  privateKeyVaultId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapSyncJob {
  id: string;
  connectionId: string;
  connection?: SapConnection;
  module: "EMPLOYEE" | "LEAVE" | "ATTENDANCE" | "OVERTIME" | "ROSTER" | string;
  syncType: "FULL" | "INCREMENTAL" | "MANUAL" | string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  deltaToken?: string;
}

export interface SapSyncLog {
  id: string;
  jobId: string;
  severity: "INFO" | "WARN" | "ERROR" | string;
  entityName?: string;
  entityId?: string;
  message: string;
  createdAt?: string;
}

export interface SapFieldMapping {
  id: string;
  module: "EMPLOYEE" | "LEAVE" | "ATTENDANCE" | string;
  sourceField: string;
  targetField: string;
  transformRule?: string;
  validationRules?: string;
  isRequired: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapRetryQueue {
  id: string;
  module: "EMPLOYEE" | "LEAVE" | "ATTENDANCE" | string;
  entityId: string;
  payload: string;
  retryCount: number;
  nextAttemptAt: string;
  lastError?: string;
  status: "PENDING" | "FAILED_DLQ" | "RESOLVED" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapExportQueue {
  id: string;
  module: "LEAVE" | "ATTENDANCE" | "OVERTIME" | "ROSTER" | string;
  recordId: string;
  payload: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | string;
  idempotencyKey: string;
  sapAckId?: string;
  sapAckStatus?: string;
  sapAckTimestamp?: string;
  retryCount: number;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapPayrollStage {
  id: string;
  employeeId: string;
  payrollPeriod: string;
  wageType: string;
  calculatedHours: number;
  calculatedPay: number;
  isApproved: boolean;
  isExported: boolean;
  exportedJobId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapReconciliationLog {
  id: string;
  employeeId: string;
  period: string;
  module: "LEAVE" | "ATTENDANCE" | "OVERTIME" | string;
  wfmHours: number;
  sapHours: number;
  discrepancy: number;
  status: "MATCHED" | "DISCREPANCY" | "RESOLVED" | string;
  comments?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapPayrollPeriodLock {
  id: string;
  period: string;
  locked: boolean;
  lockedById?: string;
  lockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedReport {
  id: string;
  name: string;
  reportType: string;
  filtersJson: string;
  createdById: string;
  isShared: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportExportLog {
  id: string;
  reportType: string;
  exportFormat: string;
  filtersJson: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  exportedById: string;
  createdAt?: string;
}

export interface UserActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: string;
  afterJson?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
}

export interface ProductionCheckLog {
  id: string;
  checkName: string;
  category: string;
  status: string;
  resultJson: string;
  checkedById?: string;
  checkedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackupJob {
  id: string;
  backupType: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  fileName: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  createdById: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackupAuditLog {
  id: string;
  backupJobId: string;
  action: "BACKUP_CREATED" | "BACKUP_DOWNLOADED" | "BACKUP_FAILED" | "BACKUP_DELETED" | "RESTORE_REQUESTED" | string;
  performedById: string;
  ipAddress?: string;
  userAgent?: string;
  details: string;
  createdAt?: string;
}

export interface EmployeeBulkUploadJob {
  id: string;
  fileName: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  failedRows: number;
  uploadedById: string;
  errorReportPath?: string;
  createdAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface SystemRole {
  id: string;
  name: string;
  description?: string;
  isSystemDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemPermission {
  id: string;
  key: string;
  label: string;
  module: string;
  pagePath?: string;
  action?: string;
  createdAt?: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserRoleAssignment {
  id: string;
  employeeId: string;
  roleId: string;
  assignedById: string;
  assignedAt?: string;
  isActive: boolean;
}

export interface BlueCollarPositionCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  clientName?: string;
  clientCode?: string;
  contractNumber?: string;
  costCenter: string;
  sapProjectCode?: string;
  sapCostCenterCode?: string;
  startDate?: string;
  endDate?: string;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectSite {
  id: string;
  projectId: string;
  siteCode: string;
  siteName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters: number;
  sapSiteCode?: string;
  status: "ACTIVE" | "INACTIVE" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeDeployment {
  id: string;
  employeeId: string;
  projectId: string;
  siteId: string;
  positionCategoryId: string;
  deploymentDate: string; // ISO date string or YYYY-MM-DD
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  plannedHours: number;
  actualHours?: number;
  shiftAssignmentId?: string;
  attendanceRecordId?: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | string;
  createdById: string;
  createdAt?: string;
  updatedAt?: string;
}




