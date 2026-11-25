-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "afterImage" TEXT,
ADD COLUMN     "beforeImage" TEXT,
ADD COLUMN     "faqs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "introduction" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "process" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "serviceId" TEXT;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
