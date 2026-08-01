import { PrismaClient, Prisma } from "./generated/client/index.js";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export { PrismaClient, Prisma };
export type * from "./generated/client/index.js";
