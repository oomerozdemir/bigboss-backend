import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

// Yardımcı: Kategori Bul veya Oluştur
const findOrCreateCategory = async (categoryName) => {
    if (!categoryName) return null;
    let subCat = await prisma.subCategory.findFirst({
        where: { name: { equals: categoryName, mode: 'insensitive' } }
    });
    if (subCat) return subCat.id;
    let mainCat = await prisma.mainCategory.findFirst({ where: { name: "Genel" } });
    if (!mainCat) {
        mainCat = await prisma.mainCategory.create({ data: { name: "Genel" } });
    }
    subCat = await prisma.subCategory.create({
        data: { name: categoryName, mainCategoryId: mainCat.id }
    });
    return subCat.id;
};

// Yardımcı: Cloudinary Yükleme
const uploadToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "bigboss_products/bulk",
      format: 'webp',
      quality: 'auto'
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Error:", error);
    return null;
  }
};

// ✅ 1. EXPORT İŞLEMİ - Sadeleştirilmiş
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true },
      orderBy: { id: 'asc' }
    });

    const rows = [];
    products.forEach(product => {
      if (product.variants.length === 0) {
        rows.push({
          productCode: product.name,
          variantSize: "",
          variantImage: ""
        });
      } else {
        product.variants.forEach(variant => {
          rows.push({
            productCode: product.name,
            variantSize: variant.size,
            variantImage: ""
          });
        });
      }
    });

    const fields = ['productCode', 'variantSize', 'variantImage'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('varyantlar_export.csv');
    return res.send(csv);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "CSV oluşturulamadı." });
  }
};

// ✅ 2. IMPORT İŞLEMİ - BEDEN BAZLI (Renk yok)
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Veri bulunamadı." });
    }

    const items = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    const results = [];

    console.log(`📦 ${items.length} satır işleniyor...`);

    for (const item of items) {
      const productCode = item.productCode || item.name;
      const variantSize = item.variantSize?.trim(); // Beden (boş olabilir)
      const imageFileName = item.variantImage || item.mainImageName;

      try {
        if (!productCode) {
            results.push({ 
              code: "UNKNOWN", 
              status: "ATLAND", 
              error: "productCode bulunamadı" 
            });
            continue;
        }

        // --- ADIM 1: ÜRÜNÜ BUL ---
        let product = await prisma.product.findFirst({
            where: {
                OR: [
                    { description: { contains: `Nebim Kod: ${productCode}`, mode: 'insensitive' } },
                    { name: { equals: productCode, mode: 'insensitive' } }
                ]
            },
            include: { variants: true }
        });

        if (!product) {
            results.push({ 
              code: productCode,
              size: variantSize || "TÜM",
              status: "ÜRÜN BULUNAMADI ❌",
              error: "Bu ürün sistemde yok"
            });
            console.log(`⚠️  ÜRÜN YOK: ${productCode}`);
            continue;
        }

        // --- ADIM 2: RESMİ YÜKLE ---
        let variantImageUrl = null;
        if (imageFileName) {
          const fileMatch = uploadedFiles.find(f => f.originalname === imageFileName.trim());
          if (fileMatch) {
            variantImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} 
          } else {
            console.log(`⚠️  Resim bulunamadı: ${imageFileName}`);
          }
        }

        if (!variantImageUrl) {
            results.push({ 
              code: productCode,
              size: variantSize || "TÜM",
              status: "RESİM YÜKLENEMEDİ ❌",
              error: "Resim dosyası bulunamadı veya yüklenemedi"
            });
            continue;
        }

        // --- ADIM 3: VARYANT(LAR)I GÜNCELLE ---
        
        // DURUM A: Beden belirtilmişse SADECE o bedeni güncelle
        if (variantSize && variantSize !== "") {
            const variant = product.variants.find(v => 
              v.size.toLowerCase() === variantSize.toLowerCase()
            );

            if (!variant) {
                results.push({ 
                  code: productCode,
                  size: variantSize,
                  status: "VARYANT BULUNAMADI ❌",
                  error: `${variantSize} bedeni bu üründe yok`
                });
                console.log(`⚠️  BEDEN YOK: ${productCode} - Beden ${variantSize}`);
                continue;
            }

            // Sadece bu varyantı güncelle
            await prisma.productVariant.update({
                where: { id: variant.id },
                data: { vImageUrl: variantImageUrl }
            });

            results.push({ 
              code: productCode,
              size: variantSize,
              status: "✅ GÜNCELLENDİ (Tek Varyant)",
              changes: "vImageUrl"
            });

        } else {
            // DURUM B: Beden belirtilmemişse TÜM varyantları güncelle
            if (product.variants.length === 0) {
                results.push({ 
                  code: productCode,
                  size: "TÜM",
                  status: "VARYANT YOK ❌",
                  error: "Bu ürünün hiç varyantı yok"
                });
                continue;
            }

            // Tüm varyantları güncelle
            await prisma.productVariant.updateMany({
                where: { productId: product.id },
                data: { vImageUrl: variantImageUrl }
            });

            results.push({ 
              code: productCode,
              size: "TÜM",
              status: `✅ GÜNCELLENDİ (${product.variants.length} Varyant)`,
              changes: "vImageUrl"
            });
        }

        // Ana ürün resmini de güncelle (eğer yoksa)
        if (!product.imageUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { imageUrl: variantImageUrl }
            });
        }

      } catch (err) {
        console.error(`Hata (${productCode}):`, err.message);
        results.push({ 
          code: productCode,
          size: variantSize || "TÜM",
          status: "HATA ❌", 
          error: err.message 
        });
      }
    }

    // Temizlik
    uploadedFiles.forEach(f => { 
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path); 
    });

    const successCount = results.filter(r => r.status.includes("GÜNCELLENDİ")).length;
    const notFoundCount = results.filter(r => r.status.includes("BULUNAMADI")).length;
    const errorCount = results.filter(r => r.status.includes("HATA")).length;

    res.json({ 
      success: true, 
      processed: results.length,
      summary: {
        updated: successCount,
        notFound: notFoundCount,
        errors: errorCount
      },
      details: results 
    });

  } catch (error) {
    console.error("Hata:", error);
    res.status(500).json({ error: "İşlem başarısız." });
  }
};