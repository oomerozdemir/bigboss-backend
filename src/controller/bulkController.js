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

// ✅ 1. EXPORT İŞLEMİ - Varyant detaylarıyla
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { 
        variants: true, 
        categories: { include: { mainCategory: true } } 
      },
      orderBy: { id: 'asc' }
    });

    // Her ürün için her varyantı ayrı satır olarak ekle
    const rows = [];
    products.forEach(product => {
      const catName = product.categories[0]?.name || "";
      
      if (product.variants.length === 0) {
        // Varyant yoksa ürün satırı ekle
        rows.push({
          productCode: product.name,
          variantSize: "STD",
          variantColor: "Standart",
          variantImage: "",
          variantStock: product.stock,
          category: catName
        });
      } else {
        // Her varyant için ayrı satır
        product.variants.forEach(variant => {
          rows.push({
            productCode: product.name,
            variantSize: variant.size,
            variantColor: variant.color,
            variantImage: "",
            variantStock: variant.stock,
            category: catName
          });
        });
      }
    });

    const fields = ['productCode', 'variantSize', 'variantColor', 'variantImage', 'variantStock', 'category'];
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

// ✅ 2. IMPORT İŞLEMİ - VARYANT BAZLI GÜNCELLEME
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Veri bulunamadı." });
    }

    const items = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    const results = [];

    console.log(`📦 ${items.length} varyant güncelleniyor...`);

    for (const item of items) {
      const productCode = item.productCode || item.name;
      const variantSize = item.variantSize || "STD";
      const variantColor = item.variantColor || "Standart";
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
              variant: `${variantSize}/${variantColor}`,
              status: "ÜRÜN BULUNAMADI ❌",
              error: "Bu ürün sistemde yok"
            });
            console.log(`⚠️  ÜRÜN YOK: ${productCode}`);
            continue;
        }

        // --- ADIM 2: VARYANTI BUL ---
        const variant = product.variants.find(v => 
          v.size.toLowerCase() === variantSize.toLowerCase() && 
          v.color.toLowerCase() === variantColor.toLowerCase()
        );

        if (!variant) {
            results.push({ 
              code: productCode,
              variant: `${variantSize}/${variantColor}`,
              status: "VARYANT BULUNAMADI ❌",
              error: `Bu ürünün ${variantSize}/${variantColor} varyantı yok`
            });
            console.log(`⚠️  VARYANT YOK: ${productCode} - ${variantSize}/${variantColor}`);
            continue;
        }

        // --- ADIM 3: RESMİ YÜKLE ---
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

        // --- ADIM 4: VARYANTI GÜNCELLE ---
        const updateData = {};
        
        if (variantImageUrl) {
          updateData.vImageUrl = variantImageUrl;
        }
        
        if (item.variantStock && parseInt(item.variantStock) >= 0) {
          updateData.stock = parseInt(item.variantStock);
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: updateData
          });

          // Ürünün ana resmini de güncelle (eğer variantImageUrl varsa)
          if (variantImageUrl && !product.imageUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { imageUrl: variantImageUrl }
            });
          }

          // Toplam stoku yeniden hesapla
          const allVariants = await prisma.productVariant.findMany({
            where: { productId: product.id }
          });
          const totalStock = allVariants.reduce((sum, v) => sum + v.stock, 0);
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: totalStock }
          });

          results.push({ 
            code: productCode,
            variant: `${variantSize}/${variantColor}`,
            status: "✅ GÜNCELLENDİ",
            changes: Object.keys(updateData).join(", ")
          });
        } else {
          results.push({ 
            code: productCode,
            variant: `${variantSize}/${variantColor}`,
            status: "DEĞİŞİKLİK YOK"
          });
        }

      } catch (err) {
        console.error(`Hata (${productCode}):`, err.message);
        results.push({ 
          code: productCode,
          variant: `${variantSize}/${variantColor}`,
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