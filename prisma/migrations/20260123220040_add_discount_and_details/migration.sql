-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountPrice" DECIMAL(10,2),
ADD COLUMN     "isOnSale" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductDetail" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "sectionType" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductDetail_productId_idx" ON "ProductDetail"("productId");

-- AddForeignKey
ALTER TABLE "ProductDetail" ADD CONSTRAINT "ProductDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
