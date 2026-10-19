/*
  Warnings:

  - The values [GLANCE,COMPLETE_READ] on the enum `ViewType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `publishedSlug` on the `Post` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Comment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ViewType_new" AS ENUM ('SAW', 'OPENED', 'READ');
ALTER TABLE "View" ALTER COLUMN "type" TYPE "ViewType_new" USING ("type"::text::"ViewType_new");
ALTER TYPE "ViewType" RENAME TO "ViewType_old";
ALTER TYPE "ViewType_new" RENAME TO "ViewType";
DROP TYPE "public"."ViewType_old";
COMMIT;

-- DropIndex
DROP INDEX "Post_publishedSlug_key";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "publishedSlug",
ADD COLUMN     "readingTime" INTEGER;

-- CreateIndex
CREATE INDEX "Comment_postId_parentId_createdAt_idx" ON "Comment"("postId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
