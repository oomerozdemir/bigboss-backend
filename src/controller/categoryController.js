import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 1. Tüm Kategorileri (Ana ve Alt) Getir
export const getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.mainCategory.findMany({
      include: {
        subCategories: true // Alt kategorileri de getir
      },
      orderBy: {
        id: 'asc' // Sıralı gelmesi için (İsteğe bağlı)
      }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Kategoriler getirilemedi." });
  }
};

// 2. Yeni Ana Kategori Ekle 
export const createMainCategory = async (req, res) => {
  try {
    const { name, description, isShowOnNavbar } = req.body; 
    let imageUrl = null;

    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, { folder: "bigboss_categories" });
      imageUrl = uploaded.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const category = await prisma.mainCategory.create({
      data: {
        name,
        description,
        imageUrl,
        // String 'true' gelirse boolean true yap
        isShowOnNavbar: isShowOnNavbar === 'true' || isShowOnNavbar === true 
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Kategori oluşturulamadı." });
  }
};

// 3. Yeni Alt Kategori Ekle
export const createSubCategory = async (req, res) => {
  const { name, mainCategoryId } = req.body;
  try {
    const newSub = await prisma.subCategory.create({
      data: {
        name,
        mainCategoryId: parseInt(mainCategoryId) // ID'yi sayıya çevir
      }
    });
    res.status(201).json(newSub);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Alt kategori oluşturulamadı." });
  }
};

// 4. Ana Kategori SİL
export const deleteMainCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.mainCategory.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Ana kategori silindi." });
  } catch (error) {
    res.status(500).json({ error: "Silinemedi. Alt kategorileri olabilir." });
  }
};

// 5. Alt Kategori SİL
export const deleteSubCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.subCategory.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Alt kategori silindi." });
  } catch (error) {
    res.status(500).json({ error: "Silinemedi." });
  }
};

// 6. Ana Kategori GÜNCELLE
export const updateMainCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, isShowOnNavbar } = req.body; 

  try {
    const dataToUpdate = {};

    if (name) dataToUpdate.name = name;
    if (description) dataToUpdate.description = description;
    
    if (isShowOnNavbar !== undefined) {
        dataToUpdate.isShowOnNavbar = isShowOnNavbar === 'true' || isShowOnNavbar === true;
    }

    if (req.file) {
        const uploaded = await cloudinary.uploader.upload(req.file.path, { folder: "bigboss_categories" });
        dataToUpdate.imageUrl = uploaded.secure_url;
        fs.unlinkSync(req.file.path);
    }

    const updatedCategory = await prisma.mainCategory.update({
      where: { id: parseInt(id) },
      data: dataToUpdate 
    });

    res.json(updatedCategory);
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Ana kategori güncellenemedi." });
  }
};

// 7. Alt Kategori GÜNCELLE
export const updateSubCategory = async (req, res) => {
  const { id } = req.params;
  const { name, mainCategoryId } = req.body;

  try {
    const dataToUpdate = {};
    
    if (name) dataToUpdate.name = name; 
    if (mainCategoryId) dataToUpdate.mainCategoryId = parseInt(mainCategoryId);

    const updatedSub = await prisma.subCategory.update({   
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.json(updatedSub); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Güncellenemedi." });
  }
};