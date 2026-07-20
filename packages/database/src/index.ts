import { PrismaClient } from "./generated/client2/index.js";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export * from "./generated/client2/index.js";
export type {
  Employee,
  AttendanceRecord,
  Shift,
  LeaveRequest,
  SapMapping,
  SyncLog,
  Announcement,
  SecurityOperationalEmployee,
  SecFacAlertRule,
  SecFacOperationalAlert,
  SecFacAlertEvent,
  SecFacAlertNotification,
  SecFacNotificationPreference,
  SecFacNotificationAttempt,
  SecFacWorkerJob,
  SecFacWorkerLock,
  SecFacChannelConfiguration
} from "./generated/client2/index.js";
