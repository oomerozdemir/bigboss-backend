import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

// Cloudinary Yükleme
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

// ✅ EXPORT - Beden-Renk kombinasyonları
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true },
      orderBy: { id: 'asc' }
    });

    const rows = [];
    
    products.forEach(product => {
      // Ürün adından rengi çıkar
      const parts = product.name.split(' ');
      const color = parts[parts.length - 1];
      const base = parts.slice(0, -1).join(' ');
      
      if (product.variants.length === 0) {
        rows.push({
          productBase: base,
          variantSize: "",
          variantColor: color,
          variantImage: ""
        });
      } else {
        // Her varyant için ayrı satır
        product.variants.forEach(variant => {
          rows.push({
            productBase: base,
            variantSize: variant.size,
            variantColor: variant.color,
            variantImage: ""
          });
        });
      }
    });

    const fields = ['productBase', 'variantSize', 'variantColor', 'variantImage'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('beden_renk_export.csv');
    return res.send(csv);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "CSV oluşturulamadı." });
  }
};

export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Veri bulunamadı." });
    }

    const items = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    const results = [];

    console.log(`📦 ${items.length} varyant işleniyor...`);

    for (const item of items) {
      // CSV'den gelen veriler (Scriptimizde oluşturduğumuz yapı)
      const productBase = item.productBase?.trim(); // Klasör ismi = Ürün ismi
      const variantSize = item.variantSize?.trim(); // Boş string
      const variantColor = item.variantColor?.trim(); // Dosya ismi = Renk
      const imageFileName = item.variantImage || item.mainImageName;

      try {
        if (!productBase || !variantColor) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "ATLANDI", 
              error: "Ürün adı veya renk eksik" 
            });
            continue;
        }

        // --- DÜZELTME 1: ÜRÜNÜ DOĞRU ARA ---
        // Eski kod rengi de isme ekliyordu, bunu kaldırdık. Sadece productBase arıyoruz.
        
        let product = await prisma.product.findFirst({
            where: {
                // İsmi tam eşleşen VEYA Nebim kodu içinde geçen (açıklamada)
                OR: [
                    { name: { equals: productBase, mode: 'insensitive' } }, // Büyük/küçük harf duyarsız tam eşleşme
                    { description: { contains: `Nebim Kod: ${productBase}`, mode: 'insensitive' } }
                ]
            },
            include: { variants: true }
        });

        if (!product) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "ÜRÜN BULUNAMADI ❌",
              error: `"${productBase}" isminde ürün veritabanında yok.`
            });
            console.log(`⚠️  ÜRÜN YOK: ${productBase}`);
            continue;
        }

        // --- ADIM 2: RESMİ BUL VE YÜKLE ---
        let variantImageUrl = null;
        if (imageFileName) {
          // Upload edilen dosyalar arasında ismen eşleşeni bul
          const fileMatch = uploadedFiles.find(f => f.originalname === imageFileName.trim());
          
          if (fileMatch) {
            variantImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} 
          } else {
            console.log(`⚠️  Resim dosyası yüklenenler arasında yok: ${imageFileName}`);
          }
        }

        if (!variantImageUrl) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "RESİM EKSİK ❌",
              error: "CSV'deki resim dosyası sunucuya gelmedi."
            });
            continue;
        }

        // --- ADIM 3: VARYANTLARI GÜNCELLE ---
        
        // CSV'de Beden BOŞ olduğu için, o rengin TÜM bedenlerine resmi atıyoruz.
        // Veritabanındaki renk isimleri ile Dosya isminin (variantColor) eşleşmesi gerekir.
        
        const matchingVariants = product.variants.filter(v => 
          v.color.trim().toLowerCase() === variantColor.toLowerCase()
        );

        if (matchingVariants.length === 0) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "RENK BULUNAMADI ❌",
              error: `Üründe "${variantColor}" adında bir renk varyantı yok.`
            });
            continue;
        }

        // Bulunan tüm varyantları güncelle (Örn: Siyah S, Siyah M, Siyah L...)
        const variantIds = matchingVariants.map(v => v.id);
        
        await prisma.productVariant.updateMany({
            where: { 
              id: { in: variantIds }
            },
            data: { vImageUrl: variantImageUrl }
        });

        // Eğer ürünün ana resmi yoksa, bu resmi ana resim yap
        if (!product.imageUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { imageUrl: variantImageUrl }
            });
        }

        results.push({ 
            base: productBase,
            color: variantColor,
            bedenler: matchingVariants.map(v => v.size).join(", "),
            status: "✅ BAŞARILI",
            changes: `${matchingVariants.length} varyant güncellendi.`
        });

      } catch (err) {
        console.error(`Hata (${productBase}):`, err);
        results.push({ 
          base: productBase,
          status: "SİSTEM HATASI ❌", 
          error: err.message 
        });
      }
    }

    // Temizlik
    uploadedFiles.forEach(f => { 
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path); 
    });

    res.json({ 
      success: true, 
      results: results 
    });

  } catch (error) {
    console.error("Genel Hata:", error);
    res.status(500).json({ error: "İşlem başarısız." });
  }
};