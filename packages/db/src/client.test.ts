import { describe, expect, it } from "vitest";
import { prisma } from "./client";

describe("prisma client singleton", () => {
  it("exports a usable PrismaClient", () => {
    // Not toBeInstanceOf(PrismaClient): Prisma's client is a Proxy whose
    // prototype-chain walk blows the stack under Vitest's matcher.
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });

  it("reuses the same instance on repeated import", async () => {
    const { prisma: prismaAgain } = await import("./client");
    expect(prismaAgain).toBe(prisma);
  });
});
