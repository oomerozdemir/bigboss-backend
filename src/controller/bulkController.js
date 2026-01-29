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

// ✅ IMPORT - BEDEN-RENK EŞLEŞTIRME
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
      const productBase = item.productBase;      // Örn: "3360 POZDA POZ"
      const variantSize = item.variantSize?.trim();  // Örn: "36"
      const variantColor = item.variantColor;    // Örn: "Beyaz"
      const imageFileName = item.variantImage || item.mainImageName;

      try {
        if (!productBase || !variantColor) {
            results.push({ 
              base: productBase,
              size: variantSize || "BOŞ",
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
              size: variantSize || "BOŞ",
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
              size: variantSize || "BOŞ",
              color: variantColor,
              status: "RESİM YÜKLENEMEDİ ❌",
              error: "Resim dosyası bulunamadı"
            });
            continue;
        }

        // --- ADIM 4: VARYANT(LAR)I GÜNCELLE ---
        
        if (variantSize && variantSize !== "") {
            // 🎯 SEÇENEK A: Belirli bir BEDEN-RENK kombinasyonunu güncelle
            
            const variant = product.variants.find(v => 
              v.size.toLowerCase() === variantSize.toLowerCase() &&
              v.color.toLowerCase() === variantColor.toLowerCase()
            );

            if (!variant) {
                results.push({ 
                  base: productBase,
                  size: variantSize,
                  color: variantColor,
                  status: "VARYANT BULUNAMADI ❌",
                  error: `${variantSize} - ${variantColor} kombinasyonu bu üründe yok`
                });
                console.log(`⚠️  VARYANT YOK: ${fullProductName} - ${variantSize}/${variantColor}`);
                continue;
            }

            // Sadece bu varyantı güncelle
            await prisma.productVariant.update({
                where: { id: variant.id },
                data: { vImageUrl: variantImageUrl }
            });

            results.push({ 
              base: productBase,
              size: variantSize,
              color: variantColor,
              status: "✅ GÜNCELLENDİ (Tek Varyant)",
              changes: "vImageUrl"
            });

            console.log(`✅ ${fullProductName} - ${variantSize}: Resim güncellendi`);

        } else {
            // 🎯 SEÇENEK B: Bu RENKTEKİ TÜM bedenleri güncelle
            
            const matchingVariants = product.variants.filter(v => 
              v.color.toLowerCase() === variantColor.toLowerCase()
            );

            if (matchingVariants.length === 0) {
                results.push({ 
                  base: productBase,
                  size: "TÜM",
                  color: variantColor,
                  status: "VARYANT YOK ❌",
                  error: `${variantColor} renginde varyant yok`
                });
                continue;
            }

            // Bu renkteki tüm bedenleri güncelle
            const variantIds = matchingVariants.map(v => v.id);
            
            await prisma.productVariant.updateMany({
                where: { 
                  id: { in: variantIds }
                },
                data: { vImageUrl: variantImageUrl }
            });

            const bedenler = matchingVariants.map(v => v.size).join(", ");

            results.push({ 
              base: productBase,
              size: `TÜM (${matchingVariants.length})`,
              color: variantColor,
              bedenler: bedenler,
              status: `✅ GÜNCELLENDİ (${matchingVariants.length} Beden)`,
              changes: "vImageUrl"
            });

            console.log(`✅ ${fullProductName}: ${matchingVariants.length} beden güncellendi (${bedenler})`);
        }

        // Ana ürün resmini de güncelle (eğer yoksa)
        if (!product.imageUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { imageUrl: variantImageUrl }
            });
        }

      } catch (err) {
        console.error(`Hata (${productBase} - ${variantSize || 'TÜM'} - ${variantColor}):`, err.message);
        results.push({ 
          base: productBase,
          size: variantSize || "TÜM",
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