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

    console.log(`📦 ${items.length} satır işleniyor...`);

    for (const item of items) {
      // CSV'den gelen verileri temizle
      const productBase = item.productBase?.trim();  // "3360 POZDA POZ"
      const variantSize = item.variantSize?.trim();  // "" (Boş)
      const variantColor = item.variantColor?.trim(); // "Beyaz" veya "Fuşya"
      const imageFileName = item.variantImage?.trim() || item.mainImageName?.trim(); // "Beyaz.jpg"

      try {
        if (!productBase || !variantColor) {
            results.push({ base: productBase, color: variantColor, status: "ATLANDI", error: "İsim veya renk eksik" });
            continue;
        }

        // 🔍 ADIM 1: ÜRÜNÜ ARA (SADECE productBase İLE)
        // Eski kod burada rengi de ekliyordu, bunu kaldırdık.
        let product = await prisma.product.findFirst({
            where: {
                OR: [
                    { name: { equals: productBase, mode: 'insensitive' } }, // Tam isim eşleşmesi
                    { description: { contains: `Nebim Kod: ${productBase}`, mode: 'insensitive' } }
                ]
            },
            include: { variants: true }
        });

        if (!product) {
            results.push({ 
              base: productBase, 
              color: variantColor, 
              status: "ÜRÜN YOK ❌", 
              error: `"${productBase}" bulunamadı.` 
            });
            console.log(`⚠️ Ürün Bulunamadı: ${productBase}`);
            continue;
        }

        // 🔍 ADIM 2: RESİM DOSYASINI BUL
        let variantImageUrl = null;
        if (imageFileName) {
          // Dosya ismini bulurken Türkçe karakter ve encoding sorunlarını aşmak için normalize ediyoruz
          const fileMatch = uploadedFiles.find(f => 
            f.originalname.normalize('NFC') === imageFileName.normalize('NFC') || 
            f.originalname.toLowerCase() === imageFileName.toLowerCase()
          );

          if (fileMatch) {
            variantImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} 
          } else {
            console.log(`⚠️ Resim Yüklenmemiş: ${imageFileName}`);
          }
        }

        if (!variantImageUrl) {
            results.push({ 
              base: productBase, 
              color: variantColor, 
              status: "RESİM EKSİK ❌", 
              error: `"${imageFileName}" sunucuya gelmedi.` 
            });
            continue;
        }

        // 🔍 ADIM 3: VARYANTLARI GÜNCELLE
        // Veritabanındaki "Beyaz", "Fuşya" gibi renkleri buluyoruz.
        const matchingVariants = product.variants.filter(v => 
          v.color.trim().toLowerCase() === variantColor.toLowerCase()
        );

        if (matchingVariants.length === 0) {
            results.push({ 
              base: productBase, 
              color: variantColor, 
              status: "RENK YOK ❌", 
              error: `Üründe "${variantColor}" rengi tanımlı değil.` 
            });
            continue;
        }

        // Bulunan tüm varyantların resmini güncelle
        const variantIds = matchingVariants.map(v => v.id);
        
        await prisma.productVariant.updateMany({
            where: { id: { in: variantIds } },
            data: { vImageUrl: variantImageUrl }
        });

        // Eğer ürünün ana resmi yoksa, bu resmi ana resim yap
        if (!product.imageUrl) {
            await prisma.product.update({ where: { id: product.id }, data: { imageUrl: variantImageUrl } });
        }

        results.push({ 
            base: productBase, 
            color: variantColor, 
            status: "✅ GÜNCELLENDİ", 
            details: `${matchingVariants.length} varyant güncellendi` 
        });
        console.log(`✅ ${productBase} - ${variantColor}: Başarılı`);

      } catch (err) {
        console.error(`Hata (${productBase}):`, err);
        results.push({ base: productBase, color: variantColor, status: "HATA ❌", error: err.message });
      }
    }

    // Kalan dosyaları temizle
    uploadedFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

    res.json({ success: true, results: results });

  } catch (error) {
    console.error("Genel Hata:", error);
    res.status(500).json({ error: "İşlem başarısız." });
  }
};