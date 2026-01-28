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

// ✅ 2. IMPORT İŞLEMİ (Akıllı Eşleştirme ve Resim Güncelleme)
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
      const imageFileName = item.imageName || item.mainImageName;

      try {
        if (!productCode) {
            continue; // Kod yoksa atla
        }

        // --- ADIM 1: ÜRÜNÜ BUL (ID veya İSİM ile) ---
        let product = null;

        // A) Önce ID varsa ona bak
        if (item.id && item.id.toString().trim() !== "" && item.id !== "new") {
            product = await prisma.product.findUnique({ where: { id: parseInt(item.id) } });
        }

        // B) ID yoksa veya bulamadıysa İSİM/KOD ile ara (Önemli Kısım Burası)
        if (!product) {
            product = await prisma.product.findFirst({
                where: {
                    OR: [
                        { name: { equals: productCode, mode: 'insensitive' } }, // Tam eşleşme
                        { description: { contains: productCode } } // Açıklamada geçiyor mu?
                    ]
                }
            });
        }

        // --- ADIM 2: RESMİ YÜKLE ---
        let mainImageUrl = null;
        if (imageFileName) {
          const fileMatch = uploadedFiles.find(f => f.originalname === imageFileName.trim());
          if (fileMatch) {
            mainImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} 
          }
        }

        // --- ADIM 3: GÜNCELLEME VEYA OLUŞTURMA ---
        if (product) {
            // ✅ ÜRÜN VARSA -> Sadece Gerekli Alanları Güncelle
            
            const updateData = {};
            // CSV'de fiyat/stok varsa güncelle, yoksa eskisi kalsın
            if (item.price && parseFloat(item.price) > 0) updateData.price = parseFloat(item.price);
            if (item.stock && parseInt(item.stock) > 0) updateData.stock = parseInt(item.stock);
            
            // Resim Yüklendiyse
            if (mainImageUrl) {
                updateData.imageUrl = mainImageUrl; // Ana resim
                
                // 🔥 KRİTİK: Varyantları SİLMEDEN sadece resimlerini güncelle
                await prisma.productVariant.updateMany({
                    where: { productId: product.id },
                    data: { vImageUrl: mainImageUrl }
                });
            }

            // Ana ürün güncelleme işlemini yap
            if (Object.keys(updateData).length > 0) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: updateData
                });
            }

            results.push({ code: productCode, status: "GÜNCELLENDİ (Mevcut Ürün)" });

        } else {
            // ✅ ÜRÜN YOKSA -> Yeni Oluştur
            const catId = await findOrCreateCategory(item.category || "Diğer");

            const newProduct = await prisma.product.create({
                data: {
                    name: productCode, 
                    description: item.description || `Nebim Kod: ${productCode}`,
                    price: parseFloat(item.price || 0),
                    stock: parseInt(item.stock || 0),
                    imageUrl: mainImageUrl,
                    isFeatured: true,
                    categories: { connect: [{ id: catId }] },
                    // Yeni ürün olduğu için varsayılan varyant oluştur
                    variants: {
                        create: [{
                            size: "STD",
                            color: "Standart",
                            stock: parseInt(item.stock || 0),
                            vImageUrl: mainImageUrl
                        }]
                    }
                }
            });
            results.push({ code: newProduct.name, status: "YENİ EKLENDİ" });
        }

      } catch (err) {
        console.error(`Hata (${productCode}):`, err.message);
        results.push({ code: productCode, status: "HATA", error: err.message });
      }
    }

    // Temizlik
    uploadedFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

    res.json({ success: true, processed: results.length, details: results });

  } catch (error) {
    console.error("Hata:", error);
    res.status(500).json({ error: "İşlem başarısız." });
  }
};