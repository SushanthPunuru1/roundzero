-- CreateEnum
CREATE TYPE "ForensicsArchetype" AS ENUM ('DECODING', 'FILE_HUNTING', 'HASHING', 'LOGIN_HISTORY', 'ANSWER_FORMAT', 'STEGO', 'PORTS', 'ACCOUNTS');

-- CreateTable
CREATE TABLE "ForensicsQuestion" (
    "id" TEXT NOT NULL,
    "archetype" "ForensicsArchetype" NOT NULL,
    "skillNodeId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "given" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ForensicsQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForensicsProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "archetype" "ForensicsArchetype" NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForensicsProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForensicsQuestion_archetype_idx" ON "ForensicsQuestion"("archetype");

-- CreateIndex
CREATE UNIQUE INDEX "ForensicsProgress_userId_archetype_key" ON "ForensicsProgress"("userId", "archetype");

-- AddForeignKey
ALTER TABLE "ForensicsQuestion" ADD CONSTRAINT "ForensicsQuestion_skillNodeId_fkey" FOREIGN KEY ("skillNodeId") REFERENCES "SkillNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForensicsProgress" ADD CONSTRAINT "ForensicsProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
