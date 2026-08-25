/*
  Warnings:

  - A unique constraint covering the columns `[userId,sourceId]` on the table `TeamChecklist` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TeamChecklist" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "TeamChecklist_organizationId_idx" ON "TeamChecklist"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamChecklist_userId_sourceId_key" ON "TeamChecklist"("userId", "sourceId");

-- AddForeignKey
ALTER TABLE "TeamChecklist" ADD CONSTRAINT "TeamChecklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
