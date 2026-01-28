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

// ✅ EXPORT - Renk bazlı
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true },
      orderBy: { id: 'asc' }
    });

    // Renklere göre grupla
    const colorGroups = new Map();
    
    products.forEach(product => {
      // Ürün adından rengi çıkar (son kelime genelde renk)
      const parts = product.name.split(' ');
      const color = parts[parts.length - 1];
      const base = parts.slice(0, -1).join(' ');
      
      const key = `${base}|${color}`;
      
      if (!colorGroups.has(key)) {
        colorGroups.set(key, {
          productBase: base,
          variantColor: color,
          variantImage: "",
          bedenler: product.variants.map(v => v.size).join(", ")
        });
      }
    });

    const rows = Array.from(colorGroups.values());
    const fields = ['productBase', 'variantColor', 'variantImage', 'bedenler'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('renk_bazli_export.csv');
    return res.send(csv);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "CSV oluşturulamadı." });
  }
};

// ✅ IMPORT - RENK BAZLI (Bir resim → Tüm bedenler)
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Veri bulunamadı." });
    }

    const items = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    const results = [];

    console.log(`🎨 ${items.length} renk grubu işleniyor...`);

    for (const item of items) {
      const productBase = item.productBase; // Örn: "3360 POZDA POZ"
      const variantColor = item.variantColor; // Örn: "Beyaz"
      const imageFileName = item.variantImage || item.mainImageName;

      try {
        if (!productBase || !variantColor) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "ATLAND", 
              error: "Ürün tabanı veya renk eksik" 
            });
            continue;
        }

        // --- ADIM 1: TAM ÜRÜN ADINI OLUŞTUR ---
        const fullProductName = `${productBase} ${variantColor}`;

        // --- ADIM 2: ÜRÜNÜ BUL ---
        let product = await prisma.product.findFirst({
            where: {
                OR: [
                    { description: { contains: `Nebim Kod: ${fullProductName}`, mode: 'insensitive' } },
                    { name: { equals: fullProductName, mode: 'insensitive' } }
                ]
            },
            include: { variants: true }
        });

        if (!product) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "ÜRÜN BULUNAMADI ❌",
              error: `"${fullProductName}" adlı ürün sistemde yok`
            });
            console.log(`⚠️  ÜRÜN YOK: ${fullProductName}`);
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

        if (!variantImageUrl) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "RESİM YÜKLENEMEDİ ❌",
              error: "Resim dosyası bulunamadı"
            });
            continue;
        }

        // --- ADIM 4: TÜM VARYANTLARI GÜNCELLE ---
        if (product.variants.length === 0) {
            results.push({ 
              base: productBase,
              color: variantColor,
              status: "VARYANT YOK ❌",
              error: "Bu ürünün hiç varyantı yok"
            });
            continue;
        }

        // 🔥 ÖNEMLİ: Aynı renkteki TÜM bedenlere aynı resmi ata
        const updatedCount = await prisma.productVariant.updateMany({
            where: { productId: product.id },
            data: { vImageUrl: variantImageUrl }
        });

        // Ana ürün resmini de güncelle
        if (!product.imageUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { imageUrl: variantImageUrl }
            });
        }

        const bedenler = product.variants.map(v => v.size).join(", ");

        results.push({ 
          base: productBase,
          color: variantColor,
          status: `✅ GÜNCELLENDİ (${updatedCount.count} Beden)`,
          bedenler: bedenler,
          changes: "vImageUrl"
        });

        console.log(`✅ ${fullProductName}: ${updatedCount.count} varyant güncellendi (${bedenler})`);

      } catch (err) {
        console.error(`Hata (${productBase} - ${variantColor}):`, err.message);
        results.push({ 
          base: productBase,
          color: variantColor,
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
    const errorCount = results.filter(r => r.status.includes("HATA") || r.status.includes("YÜKLENEMEDİ")).length;

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