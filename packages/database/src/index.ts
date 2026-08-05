import { PrismaClient, Prisma } from "./generated/client/index.js";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export * from "./generated/client/index.js";
