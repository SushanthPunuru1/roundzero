-- AlterTable
ALTER TABLE "TeamChecklistItem" ADD COLUMN     "actionSnapshot" TEXT,
ADD COLUMN     "commandsSnapshot" JSONB,
ADD COLUMN     "whySnapshot" TEXT;
