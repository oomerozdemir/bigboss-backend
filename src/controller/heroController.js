import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- HERO SLIDES ---

export const getHeroSlides = async (req, res) => {
  const { isAdmin } = req.query;
  try {
    const slides = await prisma.heroSlide.findMany({
      where: isAdmin === 'true' ? {} : { isActive: true },
      orderBy: { order: 'asc' },
    });
    res.json(slides);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Slaytlar getirilemedi' });
  }
};

export const createHeroSlide = async (req, res) => {
  try {
    const { title, subtitle, buttonText, buttonLink, order } = req.body;

    if (!title) return res.status(400).json({ error: 'Başlık zorunludur' });

    let imageUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'bigboss_hero',
        format: 'webp',
        quality: 'auto',
      });
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      imageUrl = result.secure_url;
    }

    if (!imageUrl) return res.status(400).json({ error: 'Görsel zorunludur' });

    const maxOrder = await prisma.heroSlide.findFirst({ orderBy: { order: 'desc' } });
    const nextOrder = order ? parseInt(order) : (maxOrder ? maxOrder.order + 1 : 0);

    const slide = await prisma.heroSlide.create({
      data: {
        title,
        subtitle: subtitle || null,
        imageUrl,
        buttonText: buttonText || null,
        buttonLink: buttonLink || '/products',
        order: nextOrder,
      },
    });
    res.json(slide);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Slayt oluşturulamadı' });
  }
};

export const updateHeroSlide = async (req, res) => {
  const { id } = req.params;
  try {
    const { title, subtitle, buttonText, buttonLink, order, isActive } = req.body;

    const updateData = {
      title,
      subtitle: subtitle || null,
      buttonText: buttonText || null,
      buttonLink: buttonLink || '/products',
      order: parseInt(order) || 0,
      isActive: isActive === 'true' || isActive === true,
    };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'bigboss_hero',
        format: 'webp',
        quality: 'auto',
      });
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      updateData.imageUrl = result.secure_url;
    }

    const slide = await prisma.heroSlide.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    res.json(slide);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Slayt güncellenemedi' });
  }
};

export const deleteHeroSlide = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.heroSlide.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Slayt silinemedi' });
  }
};

export const toggleHeroSlide = async (req, res) => {
  const { id } = req.params;
  try {
    const slide = await prisma.heroSlide.findUnique({ where: { id: parseInt(id) } });
    if (!slide) return res.status(404).json({ error: 'Bulunamadı' });
    const updated = await prisma.heroSlide.update({
      where: { id: parseInt(id) },
      data: { isActive: !slide.isActive },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Durum değiştirilemedi' });
  }
};

export const reorderSlides = async (req, res) => {
  // Expects: { orderedIds: [3, 1, 2] }  — array of ids in desired order
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array bekleniyor' });
  try {
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.heroSlide.update({ where: { id }, data: { order: index } })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Sıralama kaydedilemedi' });
  }
};

// --- SITE CONTENT ---

export const getSiteContent = async (req, res) => {
  try {
    const rows = await prisma.siteContent.findMany();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: 'İçerik getirilemedi' });
  }
};

export const upsertSiteContent = async (req, res) => {
  const { updates } = req.body; // { key: value, key2: value2 }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates objesi bekleniyor' });
  }
  try {
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.siteContent.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'İçerik güncellenemedi' });
  }
};
