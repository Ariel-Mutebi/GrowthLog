/*
  Warnings:

  - The values [SAW] on the enum `ViewType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ViewType_new" AS ENUM ('OPENED', 'READ');
ALTER TABLE "View" ALTER COLUMN "type" TYPE "ViewType_new" USING ("type"::text::"ViewType_new");
ALTER TYPE "ViewType" RENAME TO "ViewType_old";
ALTER TYPE "ViewType_new" RENAME TO "ViewType";
DROP TYPE "public"."ViewType_old";
COMMIT;
