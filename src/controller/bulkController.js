import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

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
    // Frontend'den gelen veriler (Multipart Form Data)
    // req.body.data -> JSON string formatında ürün listesi
    // req.files -> Yüklenen tüm resim dosyaları
    
    if (!req.body.data) {
      return res.status(400).json({ error: "Ürün verisi bulunamadı." });
    }

    const productsToUpdate = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    
    const results = [];

    // Her bir ürün satırı için işlem yap
    for (const item of productsToUpdate) {
      try {
        let mainImageUrl = null;

        // 1. Ana Resmi Bul ve Yükle
        if (item.mainImageName) {
          const fileMatch = uploadedFiles.find(f => f.originalname === item.mainImageName);
          if (fileMatch) {
            mainImageUrl = await uploadToCloudinary(fileMatch.path);
            fs.unlinkSync(fileMatch.path); // Temp dosyayı sil
          }
        }

        // 2. Veritabanı İşlemi (Güncelleme veya Ekleme)
        // Eğer ID varsa güncelle, yoksa yeni oluştur
        if (item.id && item.id !== "new") {
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
            results.push({ id: item.id, status: "Updated" });
        } else {
            // Yeni Ürün Ekleme Mantığı (Kategori bulma vb. eklenebilir)
            // Basitlik için şimdilik sadece güncelleme odaklı yazdım, 
            // create için kategori ID'sini de CSV'de almanız gerekir.
        }

      } catch (err) {
        console.error(`Ürün ID ${item.id} hatası:`, err);
        results.push({ id: item.id, status: "Failed", error: err.message });
      }
    }

    // Kullanılmayan dosyaları temizle (Garanti olsun)
    uploadedFiles.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });

    res.json({ success: true, processed: results.length, details: results });

  } catch (error) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: "Toplu işlem başarısız." });
  }
};