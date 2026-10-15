/*
  Warnings:

  - A unique constraint covering the columns `[coverImageId]` on the table `Post` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publishedSlug]` on the table `Post` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "coverImageId" TEXT,
ADD COLUMN     "publishedHook" TEXT,
ADD COLUMN     "publishedSlug" TEXT,
ADD COLUMN     "publishedTitle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Post_coverImageId_key" ON "Post"("coverImageId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_publishedSlug_key" ON "Post"("publishedSlug");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "PostImage"("imageId") ON DELETE SET NULL ON UPDATE CASCADE;
