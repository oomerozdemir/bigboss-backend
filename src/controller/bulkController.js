import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { Parser } from 'json2csv';

const prisma = new PrismaClient();

// Yardımcı: Kategori Bul veya Oluştur
const findOrCreateCategory = async (categoryName) => {
    if (!categoryName) return null;
    
    // Önce alt kategori olarak ara
    let subCat = await prisma.subCategory.findFirst({
        where: { name: { equals: categoryName, mode: 'insensitive' } }
    });

    if (subCat) return subCat.id;

    // Yoksa "Genel" adında bir ana kategori bul/oluştur
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

// 1. MEVCUT ÜRÜNLERİ CSV OLARAK İNDİR (Değişiklik Yok)
export const exportProductsCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true, categories: { include: { mainCategory: true } } },
      orderBy: { id: 'asc' }
    });

    const fields = ['id', 'name', 'price', 'stock', 'description', 'category', 'mainImageName'];
    const opts = { fields };

    const csvData = products.map(p => {
      const catName = p.categories[0]?.name || "";
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description || "",
        category: catName,
        mainImageName: "" 
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

// 2. TOPLU YÜKLEME VE GÜNCELLEME (AKILLI MOD)
export const bulkImportProducts = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Ürün verisi bulunamadı." });
    }

    const productsToProcess = JSON.parse(req.body.data);
    const uploadedFiles = req.files || [];
    
    const results = [];

    console.log(`📦 ${productsToProcess.length} satır işleniyor...`);

    for (const item of productsToProcess) {
      // CSV'deki 'productCode' yoksa 'name' alanını kod olarak kabul et
      const productCode = item.productCode || item.name; 
      const imageFileName = item.imageName || item.mainImageName;

      try {
        if (!productCode) {
            results.push({ status: "ATLANDI", error: "Ürün kodu/adı eksik" });
            continue;
        }

        // 1. Veritabanında Ürünü Bul (ID, İsim veya Açıklama içindeki koda göre)
        let product = null;
        
        // Eğer ID varsa önce ona bak
        if (item.id && item.id !== "new" && item.id.trim() !== "") {
            product = await prisma.product.findUnique({ where: { id: parseInt(item.id) } });
        }

        // ID ile bulunamadıysa isme veya açıklamadaki koda bak
        if (!product) {
            product = await prisma.product.findFirst({
                where: {
                    OR: [
                        { name: productCode }, 
                        { description: { contains: productCode } }
                    ]
                }
            });
        }

        // 2. Resim Varsa Yükle
        let mainImageUrl = null;
        if (imageFileName) {
          const fileMatch = uploadedFiles.find(f => f.originalname === imageFileName.trim());
          if (fileMatch) {
            mainImageUrl = await uploadToCloudinary(fileMatch.path);
            try { fs.unlinkSync(fileMatch.path); } catch(e){} // Temp dosyayı sil
          }
        }

        if (product) {
            // ====================================================
            // ✅ DURUM 1: ÜRÜN VAR -> MEVCUT VERİYİ KORUYARAK GÜNCELLE
            // ====================================================
            
            const updateData = {}; // Boş obje ile başla

            // Sadece CSV'de dolu olan alanları ekle (Mevcut veriyi bozma)
            if (item.name && item.name !== product.name) updateData.name = item.name;
            if (item.description) updateData.description = item.description;
            if (item.price && parseFloat(item.price) > 0) updateData.price = parseFloat(item.price);
            if (item.stock && parseInt(item.stock) > 0) updateData.stock = parseInt(item.stock);
            
            // Eğer resim yüklendiyse, ana ürün resmini güncelle
            if (mainImageUrl) {
                updateData.imageUrl = mainImageUrl;
            }

            // Ana ürünü güncelle (Sadece değişen alanlar)
            if (Object.keys(updateData).length > 0) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: updateData
                });
            }

            // 🌟 KRİTİK: VARYANTLARI SİLMEDEN GÜNCELLE
            // Eğer yeni bir resim yüklendiyse, bu ürünün TÜM varyantlarına bu resmi ata.
            if (mainImageUrl) {
                await prisma.productVariant.updateMany({
                    where: { productId: product.id }, // Bu ürüne ait olanlar
                    data: { vImageUrl: mainImageUrl } // Resim alanını güncelle
                });
            }

            results.push({ code: productCode, status: "GÜNCELLENDİ", image: mainImageUrl ? "Eklendi" : "Yok" });

        } else {
            // ====================================================
            // ✅ DURUM 2: ÜRÜN YOK -> YENİ OLUŞTUR
            // ====================================================
            
            const catId = await findOrCreateCategory(item.category || "Diğer");

            const newProduct = await prisma.product.create({
                data: {
                    name: productCode, 
                    description: item.description || `Nebim Kod: ${productCode}`,
                    price: parseFloat(item.price || 0),
                    stock: parseInt(item.stock || 0),
                    imageUrl: mainImageUrl, // Resim varsa ekle, yoksa null
                    isFeatured: true,
                    categories: {
                        connect: [{ id: catId }]
                    },
                    // Yeni ürün olduğu için varsayılan bir varyant oluşturuyoruz
                    variants: {
                        create: [{
                            size: "STD",
                            color: "Standart",
                            stock: parseInt(item.stock || 0),
                            vImageUrl: mainImageUrl // Varyanta da resmi ekle
                        }]
                    }
                }
            });
            results.push({ code: newProduct.name, status: "YENİ EKLENDİ" });
        }

      } catch (err) {
        console.error(`Satır Hatası (${item.name}):`, err.message);
        results.push({ name: item.name, status: "HATA", error: err.message });
      }
    }

    // Kullanılmayan dosyaları temizle
    uploadedFiles.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });

    res.json({ success: true, processed: results.length, details: results });

  } catch (error) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: "Toplu işlem başarısız." });
  }
};