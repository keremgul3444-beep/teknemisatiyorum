-- Fotoğrafların algısal izi: aynı fotoğrafın başka ilanda kullanılması moderatöre gösterilir.
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "phash" TEXT;
