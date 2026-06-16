import { PrismaClient } from "./generated/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export * from "./generated/client";
export type { Employee, AttendanceRecord, Shift, LeaveRequest, SapMapping, SyncLog, Announcement } from "./generated/client";
