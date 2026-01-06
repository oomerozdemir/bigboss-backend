import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Kullanıcının adreslerini getir
export const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id; // DÜZELTME: .userId yerine .id
    const addresses = await prisma.address.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(addresses);
  } catch (error) {
    console.error("Adres getirme hatası:", error);
    res.status(500).json({ error: "Adresler çekilemedi." });
  }
};

// Yeni adres ekle
export const addAddress = async (req, res) => {
  try {
    const userId = req.user.id; // DÜZELTME: .userId yerine .id
    const { title, address, city, phone } = req.body;

    if (!address || !city || !phone) {
        return res.status(400).json({ error: "Tüm alanları doldurunuz." });
    }

    const newAddress = await prisma.address.create({
      data: {
        title: title || "Ev",
        address,
        city,
        phone,
        userId: parseInt(userId)
      }
    });

    res.status(201).json(newAddress);
  } catch (error) {
    console.error("Adres ekleme hatası:", error);
    res.status(500).json({ error: "Adres eklenirken hata oluştu." });
  }
};

// Adres sil
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id; // DÜZELTME: .userId yerine .id
    const addressId = parseInt(req.params.id);

    const address = await prisma.address.findFirst({
        where: { id: addressId, userId: parseInt(userId) }
    });

    if (!address) {
        return res.status(404).json({ error: "Adres bulunamadı." });
    }

    await prisma.address.delete({
      where: { id: addressId }
    });

    res.json({ message: "Adres başarıyla silindi." });
  } catch (error) {
    console.error("Adres silme hatası:", error);
    res.status(500).json({ error: "Adres silinemedi." });
  }
};