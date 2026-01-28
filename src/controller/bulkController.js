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
      return res.status(400).json({ error: "Ürün verisi bulunamadı." });
    }

    const productsToProcess = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    
    const results = [];

    for (const item of productsToProcess) {
      try {
        let mainImageUrl = null;

        // 1. Resim Eşleştirme (CSV'deki isim = Yüklenen dosya ismi)
        if (item.mainImageName) {
          const fileMatch = uploadedFiles.find(f => f.originalname === item.mainImageName.trim());
          if (fileMatch) {
            mainImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} // Temp dosyayı sil
          }
        }

        // 2. İşlem Tipi Belirleme (Update vs Create)
        if (item.id && item.id !== "new" && item.id.trim() !== "") {
            // --- GÜNCELLEME ---
            const updateData = {
                name: item.name,
                description: item.description,
                price: parseFloat(item.price),
                stock: parseInt(item.stock),
            };
            if (mainImageUrl) updateData.imageUrl = mainImageUrl;

            await prisma.product.update({
                where: { id: parseInt(item.id) },
                data: updateData
            });
            results.push({ id: item.id, name: item.name, status: "GÜNCELLENDİ" });

        } else {
            // --- YENİ EKLEME ---
            // Kategori ID'sini bul veya oluştur
            const catId = await findOrCreateCategory(item.category || "Diğer");

            const newProduct = await prisma.product.create({
                data: {
                    name: item.name,
                    description: item.description || "",
                    price: parseFloat(item.price || 0),
                    stock: parseInt(item.stock || 0),
                    imageUrl: mainImageUrl, // Resim bulunduysa ekle, yoksa null
                    isFeatured: true,
                    categories: {
                        connect: [{ id: catId }]
                    },
                    // Otomatik varsayılan varyant ekle (Stok yönetimi için gerekli)
                    variants: {
                        create: [{
                            size: "STD",
                            color: "Standart",
                            stock: parseInt(item.stock || 0)
                        }]
                    }
                }
            });
            results.push({ id: newProduct.id, name: newProduct.name, status: "YENİ EKLENDİ" });
        }

      } catch (err) {
        console.error(`Satır Hatası (${item.name}):`, err.message);
        results.push({ name: item.name, status: "HATA", error: err.message });
      }
    }

    // Kullanılmayan kalan dosyaları temizle
    uploadedFiles.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });

    res.json({ success: true, processed: results.length, details: results });

  } catch (error) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: "Toplu işlem başarısız." });
  }
};