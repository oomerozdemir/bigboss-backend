import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- YARDIMCI FONKSİYON: Cloudinary Yükleme ---
const uploadToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "bigboss_products"
    });
    // Yükleme başarılıysa sunucudan sil
    fs.unlinkSync(filePath);
    return result.secure_url;
  } catch (error) {
    // Hata olursa da silmeye çalış
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw error;
  }
};

// --- TÜM ÜRÜNLERİ GETİR ---
export const getAllProducts = async (req, res) => {
  try {
    // 1. Query Parametrelerini Al
    const { isAdmin, page = 1, limit = 20, search = "" } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 2. Filtreleri Oluştur
    const whereClause = {
        AND: [
            isAdmin === 'true' ? {} : { isActive: true }, // Admin değilse sadece aktifleri göster
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            } : {}
        ]
    };

    // 3. Toplam Kayıt Sayısını Bul (Sayfalama hesaplaması için)
    const totalCount = await prisma.product.count({ where: whereClause });

    // 4. Sadece İlgili Sayfanın Verilerini Çek
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        categories: { include: { mainCategory: true } },
        variants: true
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,      // Kaç tane atla
      take: limitNum   // Kaç tane al
    });

    // 5. Veriyi ve Meta Bilgileri Döndür
    res.json({
        products,
        meta: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum
        }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ürünler getirilemedi." });
  }
};

// --- TEK BİR ÜRÜNÜ GETİR ---
export const getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        categories: {
          include: {
            mainCategory: true
          }
        },
        variants: true
      }
    });
    if (!product) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Ürün detayı getirilemedi." });
  }
};

// --- YENİ ÜRÜN EKLE (Admin) ---
export const createProduct = async (req, res) => {
  try {
    // 1. Ana Resmi Bul ve Yükle ('image' alan adıyla gelen dosya)
    let mainImageUrl = "";
    // req.files bir array olarak gelir (upload.any() sayesinde)
    const mainFile = req.files?.find(f => f.fieldname === 'image');
    
    if (mainFile) {
      mainImageUrl = await uploadToCloudinary(mainFile.path);
    }

    const { name, description, price, isFeatured, categoryIds, variants } = req.body;
    
    let catIds = categoryIds ? (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds)) : [];

    let parsedVariants = variants ? (Array.isArray(variants) ? variants : JSON.parse(variants)) : [];

    const variantsWithImages = await Promise.all(parsedVariants.map(async (variant, index) => {
      const variantFile = req.files?.find(f => f.fieldname === `variantImage_${index}`);
      
      let vUrl = null;
      if (variantFile) {
        vUrl = await uploadToCloudinary(variantFile.path);
      }

      return {
        size: variant.size,
        color: variant.color || "Standart", // Renk yoksa standart yazsın
       stock: parseInt(variant.stock) || 0,
        vImageUrl: vUrl // Cloudinary linki (yoksa null)
      };
    }));

    const totalStock = variantsWithImages.reduce((acc, item) => acc + item.stock, 0);

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: totalStock,
        imageUrl: mainImageUrl,
        isFeatured: isFeatured === 'true',
        categories: {
          connect: catIds.map((id) => ({ id: parseInt(id) }))
        },
        variants: {
          create: variantsWithImages 
        }
      },
      include: { variants: true, categories: true }
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Create Error:", error);
    if (req.files) {
        req.files.forEach(file => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
    }
    res.status(500).json({ error: "Ürün eklenirken hata oluştu." });
  }
};

// --- ÜRÜN SİL (Admin) ---
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Ürün başarıyla silindi." });
  } catch (error) {
    res.status(500).json({ error: "Ürün silinemedi." });
  }
};

// --- ÜRÜN GÜNCELLE (Admin) ---
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, isFeatured, categoryIds, imageUrl, variants } = req.body;

  try {
    let finalImageUrl = imageUrl; 
    const mainFile = req.files?.find(f => f.fieldname === 'image');

    if (mainFile) {
      finalImageUrl = await uploadToCloudinary(mainFile.path);
    }

    let catIds = categoryIds ? (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds)) : [];
    
    let parsedVariants = variants ? (Array.isArray(variants) ? variants : JSON.parse(variants)) : [];

    const variantsWithImages = await Promise.all(parsedVariants.map(async (variant, index) => {
        const variantFile = req.files?.find(f => f.fieldname === `variantImage_${index}`);
        
        let vUrl = variant.vImageUrl || null;
        
        if (variantFile) {
          vUrl = await uploadToCloudinary(variantFile.path);
        }
  
        return {
          size: variant.size,
          color: variant.color || "Standart",
          stock: parseInt(variant.stock),
          vImageUrl: vUrl
        };
      }));

    const totalStock = variantsWithImages.reduce((acc, item) => acc + item.stock, 0);

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: totalStock,
        imageUrl: finalImageUrl,
        isFeatured: isFeatured === 'true',
        categories: catIds.length > 0 ? { set: catIds.map(id => ({ id: parseInt(id) })) } : undefined,
        
        variants: {
          deleteMany: {}, 
          create: variantsWithImages
        }
      },
      include: { variants: true }
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error("Update Error:", error);
    if (req.files) {
        req.files.forEach(file => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
    }
    res.status(500).json({ error: "Güncellenemedi." });
  }
};


// --- YENİ: TOPLU SİLME ---
export const deleteProductsBulk = async (req, res) => {
    const { ids } = req.body; // [1, 5, 8] gibi ID dizisi
    try {
        await prisma.product.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) }
            }
        });
        res.json({ message: "Seçili ürünler silindi." });
    } catch (error) {
        res.status(500).json({ error: "Toplu silme başarısız." });
    }
};

// --- YENİ: TOPLU KATEGORİ EKLEME ---
export const addProductsToCategoryBulk = async (req, res) => {
    const { productIds, categoryId } = req.body;
    try {
        // Prisma'da updateMany ile relation güncellemek zor olduğu için transaction kullanıyoruz
        await prisma.$transaction(
            productIds.map(id => 
                prisma.product.update({
                    where: { id: parseInt(id) },
                    data: {
                        categories: {
                            connect: { id: parseInt(categoryId) }
                        }
                    }
                })
            )
        );
        res.json({ message: "Ürünler kategoriye eklendi." });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Kategori güncellemesi başarısız." });
    }
};

// --- YENİ: DURUM GÜNCELLEME (GİZLE/GÖSTER) ---
export const updateProductStatus = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    
    try {
        const product = await prisma.product.update({
            where: { id: parseInt(id) },
            data: { isActive }
        });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: "Durum güncellenemedi." });
    }
};