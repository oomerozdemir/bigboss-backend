-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cargoCompany" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "couponId" INTEGER,
ADD COLUMN     "invoiceAddress" TEXT,
ADD COLUMN     "invoiceType" TEXT,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "taxOffice" TEXT,
ADD COLUMN     "tcNo" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
