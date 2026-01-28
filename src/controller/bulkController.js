import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

const findOrCreateCategory = async (categoryName) => {
    if (!categoryName) return null;
    
    // Önce alt kategori olarak ara
    let subCat = await prisma.subCategory.findFirst({
        where: { name: { equals: categoryName, mode: 'insensitive' } }
    });

    if (subCat) return subCat.id;

    // Yoksa "Genel" adında bir ana kategori bul/oluştur ve altına ekle
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
    // Yükleme bitince dosyayı silmeyi unutma (Controller içinde silinecek)
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Error:", error);
    return null;
  }
};

// 1. MEVCUT ÜRÜNLERİ CSV OLARAK İNDİR
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true, categories: { include: { mainCategory: true } } },
      orderBy: { id: 'asc' }
    });

    const fields = ['id', 'name', 'price', 'stock', 'description', 'category', 'mainImageName', 'variantImages'];
    const opts = { fields };

    const csvData = products.map(p => {
      // Kategori ismini al
      const catName = p.categories[0]?.name || "";
      // Varyant resimlerini string yap
      const variantsStr = p.variants.map(v => v.vImageUrl).join(';');

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description || "",
        category: catName,
        mainImageName: "", // Kullanıcı buraya dosya adı girecek (örn: 123.jpg)
        variantImages: ""  // Kullanıcı buraya dosya adları girecek
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

// 2. TOPLU YÜKLEME VE GÜNCELLEME (Batch İşlemi)
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
      // ✅ 1. Değişkeni En Başta Tanımla (Hem productCode hem name desteği)
      const productCode = item.productCode || item.name; 
      const imageFileName = item.imageName || item.mainImageName;

      try {
        if (!productCode || !imageFileName) {
            console.log("Eksik bilgi:", item);
            continue; 
        }

        // 2. Veritabanında Ürünü Bul
        let product = await prisma.product.findFirst({
            where: {
                OR: [
                    { name: productCode }, 
                    { description: { contains: productCode } }
                ]
            },
            include: { variants: true }
        });

        // 3. Resmi Yükle
        let uploadedImageUrl = null;
        const fileMatch = uploadedFiles.find(f => f.originalname === imageFileName.trim());
        
        if (fileMatch) {
            uploadedImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} 
        }

        if (!uploadedImageUrl) {
            results.push({ code: productCode, status: "❌ RESİM YÜKLENEMEDİ" });
            continue;
        }

        if (product) {
            // ✅ DURUM 1: ÜRÜN VAR -> GÜNCELLE
            await prisma.productVariant.updateMany({
                where: { productId: product.id },
                data: { vImageUrl: uploadedImageUrl }
            });

            await prisma.product.update({
                where: { id: product.id },
                data: { imageUrl: uploadedImageUrl }
            });

            results.push({ code: productCode, status: "✅ GÜNCELLENDİ" });

        } else {
            // ✅ DURUM 2: ÜRÜN YOK -> YENİ OLUŞTUR
            // BURASI HATALIYDI, ARTIK productCode KULLANILIYOR
            
            const catId = await findOrCreateCategory(item.category || "Diğer");
            
            const newProduct = await prisma.product.create({
                data: {
                    name: productCode, // 👈 DÜZELTME BURADA (item.name yerine productCode)
                    description: `Nebim Kod: ${productCode}`,
                    price: 0, 
                    stock: 0, 
                    imageUrl: uploadedImageUrl,
                    isFeatured: true,
                    categories: { connect: [{ id: catId }] },
                    variants: {
                        create: [{ size: "STD", color: "Standart", stock: 0, vImageUrl: uploadedImageUrl }]
                    }
                }
            });
            results.push({ code: newProduct.name, status: "🆕 YENİ OLUŞTURULDU" });
        }

      } catch (err) {
        console.error(`Hata (${productCode}):`, err.message);
        results.push({ code: productCode, status: "⚠️ SİSTEM HATASI", error: err.message });
      }
    }

    uploadedFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

    res.json({ success: true, processed: results.length, details: results });

  } catch (error) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: "İşlem başarısız: " + error.message });
  }
};