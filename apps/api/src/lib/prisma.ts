// Prisma singleton — avoids exhausting connections in dev (tsx watch reloads).
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __hydyar_prisma?: PrismaClient };

export const prisma =
  globalForPrisma.__hydyar_prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__hydyar_prisma = prisma;
}
