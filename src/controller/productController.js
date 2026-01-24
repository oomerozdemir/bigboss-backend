// src/controller/productController.js - REQ.FILES HATASI DÜZELTİLDİ

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ YARDIMCI FONKSİYON: req.files'ı array'e çevir
const getFilesArray = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files;
  // upload.fields() kullanıldığında obje gelir
  return Object.values(files).flat();
};

// ✅ YARDIMCI FONKSİYON: Dosya temizliği
const cleanupFiles = (files) => {
  const filesArray = getFilesArray(files);
  filesArray.forEach(file => {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Dosya silinemedi:', file.path, err);
      }
    }
  });
};

// --- YARDIMCI FONKSİYON: Cloudinary Yükleme ---
const uploadToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "bigboss_products",
      format: 'webp',      
      quality: 'auto'      
    });
    fs.unlinkSync(filePath);
    return result.secure_url;
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw error;
  }
};

// --- TÜM ÜRÜNLERİ GETİR---
export const getAllProducts = async (req, res) => {
  try {
    const { isAdmin, page = 1, limit = 20, search = "", isFeatured } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const whereClause = {
        AND: [
            isAdmin === 'true' ? {} : { isActive: true },
            isFeatured === 'true' ? { isFeatured: true } : {}, 
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            } : {}
        ]
    };

    const totalCount = await prisma.product.count({ where: whereClause });

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        categories: { include: { mainCategory: true } },
        variants: true,
        productDetails: true
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: limitNum
    });

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

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: "Geçersiz Ürün ID" });
  }
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        categories: {
          include: {
            mainCategory: true
          }
        },
        variants: true,
        productDetails: {
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!product) return res.status(404).json({ error: "Ürün bulunamadı." });
    res.json(product);
  } catch (error) {
    console.error("getProductById Error:", error);
    res.status(500).json({ error: "Ürün detayı getirilemedi." });
  }
};

// --- YENİ ÜRÜN EKLE ---
export const createProduct = async (req, res) => {
  try {
    const { 
      name, description, price, 
      discountPrice, isOnSale,
      isFeatured, categoryIds, variants,
      productDetails
    } = req.body;
    
    let catIds = categoryIds ? (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds)) : [];
    let parsedVariants = variants ? (Array.isArray(variants) ? variants : JSON.parse(variants)) : [];
    let parsedDetails = productDetails ? (Array.isArray(productDetails) ? productDetails : JSON.parse(productDetails)) : [];

    // ✅ req.files'ı array'e çevir
    const filesArray = getFilesArray(req.files);

    // Ana resim
    const mainFile = filesArray.find(f => f.fieldname === 'image');
    const mainImagePromise = mainFile 
      ? uploadToCloudinary(mainFile.path) 
      : Promise.resolve("");

    // Varyant resimleri
    const variantPromises = parsedVariants.map(async (variant, index) => {
      const variantFile = filesArray.find(f => f.fieldname === `variantImage_${index}`);
      const vUrl = variantFile ? await uploadToCloudinary(variantFile.path) : null;

      return {
        size: variant.size,
        color: variant.color || "Standart",
        stock: parseInt(variant.stock) || 0,
        vImageUrl: vUrl
      };
    });

    const [mainImageUrl, ...variantsWithImages] = await Promise.all([
      mainImagePromise, 
      ...variantPromises
    ]);

    const totalStock = variantsWithImages.reduce((acc, item) => acc + item.stock, 0);

    const finalDiscountPrice = isOnSale === 'true' && discountPrice ? parseFloat(discountPrice) : null;
    const finalIsOnSale = isOnSale === 'true';

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        discountPrice: finalDiscountPrice,
        isOnSale: finalIsOnSale,
        stock: totalStock,
        imageUrl: mainImageUrl,
        isFeatured: isFeatured === 'true',
        categories: {
          connect: catIds.map((id) => ({ id: parseInt(id) }))
        },
        variants: {
          create: variantsWithImages 
        },
        productDetails: {
          create: parsedDetails.map(detail => ({
            sectionType: detail.sectionType,
            title: detail.title || null,
            content: detail.content,
            order: detail.order || 0
          }))
        }
      },
      include: { variants: true, categories: true, productDetails: true }
    });

    res.status(201).json(newProduct);

  } catch (error) {
    console.error("createProduct Error:", error);
    cleanupFiles(req.files);
    res.status(500).json({ error: "Ürün eklenirken hata oluştu: " + error.message });
  }
};

// --- ÜRÜN SİL ---
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Ürün başarıyla silindi." });
  } catch (error) {
    console.error("deleteProduct Error:", error);
    res.status(500).json({ error: "Ürün silinemedi." });
  }
};

// --- ÜRÜN GÜNCELLE ---
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { 
    name, description, price, 
    discountPrice, isOnSale,
    isFeatured, categoryIds, imageUrl, variants,
    productDetails
  } = req.body;

  try {
    // ✅ req.files'ı array'e çevir
    const filesArray = getFilesArray(req.files);

    let finalImageUrl = imageUrl; 
    const mainFile = filesArray.find(f => f.fieldname === 'image');

    if (mainFile) {
      finalImageUrl = await uploadToCloudinary(mainFile.path);
    }

    let catIds = categoryIds ? (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds)) : [];
    let parsedVariants = variants ? (Array.isArray(variants) ? variants : JSON.parse(variants)) : [];
    let parsedDetails = productDetails ? (Array.isArray(productDetails) ? productDetails : JSON.parse(productDetails)) : [];

    const variantsWithImages = await Promise.all(parsedVariants.map(async (variant, index) => {
        const variantFile = filesArray.find(f => f.fieldname === `variantImage_${index}`);
        
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

    const finalDiscountPrice = isOnSale === 'true' && discountPrice ? parseFloat(discountPrice) : null;
    const finalIsOnSale = isOnSale === 'true';

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        price: parseFloat(price),
        discountPrice: finalDiscountPrice,
        isOnSale: finalIsOnSale,
        stock: totalStock,
        imageUrl: finalImageUrl,
        isFeatured: isFeatured === 'true',
        categories: catIds.length > 0 ? { set: catIds.map(id => ({ id: parseInt(id) })) } : undefined,
        
        variants: {
          deleteMany: {}, 
          create: variantsWithImages
        },
        
        productDetails: {
          deleteMany: {},
          create: parsedDetails.map(detail => ({
            sectionType: detail.sectionType,
            title: detail.title || null,
            content: detail.content,
            order: detail.order || 0
          }))
        }
      },
      include: { variants: true, productDetails: true }
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error("updateProduct Error:", error);
    cleanupFiles(req.files);
    res.status(500).json({ error: "Güncellenemedi: " + error.message });
  }
};

// --- TOPLU SİLME ---
export const deleteProductsBulk = async (req, res) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Geçersiz ID listesi" });
    }
    
    try {
        const result = await prisma.product.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) }
            }
        });
        
        res.json({ 
            message: "Seçili ürünler silindi.",
            deletedCount: result.count
        });
    } catch (error) {
        console.error("deleteProductsBulk Error:", error);
        res.status(500).json({ error: "Toplu silme başarısız." });
    }
};

// --- TOPLU KATEGORİ EKLEME ---
export const addProductsToCategoryBulk = async (req, res) => {
    const { productIds, categoryId } = req.body;
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "Ürün listesi geçersiz" });
    }
    
    if (!categoryId) {
        return res.status(400).json({ error: "Kategori ID gerekli" });
    }
    
    try {
        const results = await prisma.$transaction(
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
        
        res.json({ 
            message: "Ürünler kategoriye eklendi.",
            updatedCount: results.length
        });
    } catch (error) {
        console.error("addProductsToCategoryBulk Error:", error);
        res.status(500).json({ error: "Kategori güncellemesi başarısız." });
    }
};

// --- DURUM GÜNCELLEME ---
export const updateProductStatus = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: "isActive boolean olmalı" });
    }
    
    try {
        const product = await prisma.product.update({
            where: { id: parseInt(id) },
            data: { isActive }
        });
        res.json(product);
    } catch (error) {
        console.error("updateProductStatus Error:", error);
        res.status(500).json({ error: "Durum güncellenemedi." });
    }
};

export const bulkUpdateProducts = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: "Güncellenecek veri bulunamadı." });
    }

    console.log(`🔄 ${updates.length} adet ürün için toplu güncelleme başlatılıyor...`);

    const results = await prisma.$transaction(
      updates.map((product) => {
        const { id, ...data } = product;
        return prisma.product.update({
          where: { id: parseInt(id) },
          data: data
        });
      })
    );

    console.log("✅ Toplu güncelleme başarılı.");
    res.json({ success: true, message: `${results.length} ürün başarıyla güncellendi.` });

  } catch (error) {
    console.error("❌ Toplu güncelleme hatası:", error);
    res.status(500).json({ success: false, message: "Sunucu hatası: " + error.message });
  }
};

export const getBulkProducts = async (req, res) => {
  try {
    const { page = 1, limit = 500, search = "" } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    console.log(`Admin toplu liste: Sayfa ${pageNum}, Limit ${limitNum}, Arama: ${search}`);

    const whereClause = search ? {
        OR: [
            { name: { contains: search, mode: 'insensitive' } },
            ...((!isNaN(search) && search.trim() !== "") ? [{ id: parseInt(search) }] : [])
        ]
    } : {};

    const totalCount = await prisma.product.count({ where: whereClause });

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { id: 'desc' },
      skip: skip,
      take: limitNum
    });
    
    res.json({ 
        success: true, 
        products,
        meta: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum
        }
    });
  } catch (error) {
    console.error("❌ Bulk Get Error:", error);
    res.status(500).json({ success: false, message: "Ürünler alınamadı: " + error.message });
  }
};