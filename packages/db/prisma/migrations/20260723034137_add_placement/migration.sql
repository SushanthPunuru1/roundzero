-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "experience" TEXT NOT NULL,
    "focus" JSONB NOT NULL,
    "levels" JSONB NOT NULL,
    "answers" JSONB NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Placement_userId_key" ON "Placement"("userId");

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
