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

// ✅ 1. EXPORT İŞLEMİ (Varyantları da gösterir)
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true, categories: { include: { mainCategory: true } } },
      orderBy: { id: 'asc' }
    });

    const fields = ['id', 'name', 'price', 'stock', 'description', 'category', 'mainImageName', 'variants_summary'];
    const opts = { fields };

    const csvData = products.map(p => {
      const catName = p.categories[0]?.name || "";
      // Varyantları okunabilir string yap: "S (10) | M (20)"
      const vSummary = p.variants.map(v => `${v.size} (${v.stock})`).join(" | ");

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description || "",
        category: catName,
        mainImageName: "", 
        variants_summary: vSummary 
      };
    });

    const parser = new Parser(opts);
    const csv = parser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.attachment('urunler_export.csv');
    return res.send(csv);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "CSV oluşturulamadı." });
  }
};

// ✅ 2. IMPORT İŞLEMİ - SADECE MEVCUT ÜRÜNLERİ GÜNCELLER
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Veri bulunamadı." });
    }

    const items = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    const results = [];

    console.log(`📦 ${items.length} ürün işleniyor...`);

    for (const item of items) {
      // CSV sütun isimlerine göre kod ve resim adını al
      const productCode = item.productCode || item.name; 
      const imageFileName = item.mainImageName || item.imageName;

      try {
        if (!productCode) {
            results.push({ code: "UNKNOWN", status: "ATLAND", error: "productCode bulunamadı" });
            continue;
        }

        // --- ADIM 1: ÜRÜNÜ BUL (productCode ile) ---
        let product = null;

        // A) Önce ID varsa ona bak
        if (item.id && item.id.toString().trim() !== "" && item.id !== "new") {
            product = await prisma.product.findUnique({ 
              where: { id: parseInt(item.id) },
              include: { variants: true } 
            });
        }

        // B) ID yoksa productCode ile ara - description içinde "Nebim Kod: XXX" formatında ara
        if (!product && productCode) {
            product = await prisma.product.findFirst({
                where: {
                    description: { contains: `Nebim Kod: ${productCode}`, mode: 'insensitive' }
                },
                include: { variants: true }
            });
        }

        // C) Hala bulamadıysa name ile direkt eşleşme dene
        if (!product && productCode) {
            product = await prisma.product.findFirst({
                where: {
                    name: { equals: productCode, mode: 'insensitive' }
                },
                include: { variants: true }
            });
        }

        // ❌ ÜRÜN BULUNAMADIYSA -> YENİ ÜRÜN OLUŞTURMA, SADECE UYARI VER
        if (!product) {
            results.push({ 
              code: productCode, 
              status: "BULUNAMADI ❌", 
              error: "Sistemde bu kod/isimle ürün yok - önce manuel olarak eklenmeli" 
            });
            console.log(`⚠️  ATLAND: ${productCode} - Ürün bulunamadı`);
            continue;
        }

        // --- ADIM 2: RESMİ YÜKLE ---
        let mainImageUrl = null;
        if (imageFileName) {
          const fileMatch = uploadedFiles.find(f => f.originalname === imageFileName.trim());
          if (fileMatch) {
            mainImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} 
          } else {
            console.log(`⚠️  Resim bulunamadı: ${imageFileName}`);
          }
        }

        // --- ADIM 3: MEVCUT ÜRÜNÜ GÜNCELLE ---
        const updateData = {};
        
        // CSV'de fiyat/stok varsa güncelle
        if (item.price && parseFloat(item.price) > 0) {
          updateData.price = parseFloat(item.price);
        }
        if (item.stock && parseInt(item.stock) >= 0) {
          updateData.stock = parseInt(item.stock);
        }
        
        // Resim Yüklendiyse
        if (mainImageUrl) {
            updateData.imageUrl = mainImageUrl; // Ana resim
            
            // 🔥 Varyantların resimlerini de güncelle (varyantları silmeden)
            if (product.variants && product.variants.length > 0) {
              await prisma.productVariant.updateMany({
                  where: { productId: product.id },
                  data: { vImageUrl: mainImageUrl }
              });
            }
        }

        // Kategori güncellenmesi isteniyor mu?
        if (item.category) {
          const catId = await findOrCreateCategory(item.category);
          if (catId) {
            updateData.categories = { set: [{ id: catId }] };
          }
        }

        // Ana ürün güncelleme
        if (Object.keys(updateData).length > 0) {
            await prisma.product.update({
                where: { id: product.id },
                data: updateData
            });
            results.push({ 
              code: productCode, 
              status: "✅ GÜNCELLENDİ",
              productId: product.id,
              changes: Object.keys(updateData).join(", ")
            });
        } else {
            results.push({ 
              code: productCode, 
              status: "DEĞİŞİKLİK YOK",
              productId: product.id
            });
        }

      } catch (err) {
        console.error(`Hata (${productCode}):`, err.message);
        results.push({ code: productCode, status: "HATA ❌", error: err.message });
      }
    }

    // Temizlik
    uploadedFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

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