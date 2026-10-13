/*
  Warnings:

  - You are about to drop the column `avatarId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_avatarId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarId";

-- CreateTable
CREATE TABLE "PostImage" (
    "imageId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "PostImage_pkey" PRIMARY KEY ("imageId")
);

-- CreateIndex
CREATE INDEX "PostImage_postId_idx" ON "PostImage"("postId");

-- AddForeignKey
ALTER TABLE "PostImage" ADD CONSTRAINT "PostImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostImage" ADD CONSTRAINT "PostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
