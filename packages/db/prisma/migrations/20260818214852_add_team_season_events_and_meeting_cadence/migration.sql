-- CreateEnum
CREATE TYPE "MeetingCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'OTHER');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "meetingCadence" "MeetingCadence",
ADD COLUMN     "meetingDay" "Weekday";

-- AlterTable
ALTER TABLE "SeasonEvent" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "SeasonEvent_seasonId_organizationId_idx" ON "SeasonEvent"("seasonId", "organizationId");

-- AddForeignKey
ALTER TABLE "SeasonEvent" ADD CONSTRAINT "SeasonEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
