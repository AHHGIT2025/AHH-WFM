import { PrismaClient, Prisma } from "./generated/client2/index.js";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export { PrismaClient, Prisma };
export type * from "./generated/client2/index.js";
