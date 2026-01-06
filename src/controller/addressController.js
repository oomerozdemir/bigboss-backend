const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Kullanıcının adreslerini getir
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.userId; // Auth middleware'den gelen ID
    const addresses = await prisma.address.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: "Adresler çekilemedi." });
  }
};

// Yeni adres ekle
exports.addAddress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, address, city, phone } = req.body;

    if (!address || !city || !phone) {
        return res.status(400).json({ error: "Tüm alanları doldurunuz." });
    }

    const newAddress = await prisma.address.create({
      data: {
        title: title || "Ev", // Başlık girilmezse varsayılan 'Ev' olsun
        address,
        city,
        phone,
        userId: parseInt(userId)
      }
    });

    res.status(201).json(newAddress);
  } catch (error) {
    res.status(500).json({ error: "Adres eklenirken hata oluştu." });
  }
};

// Adres sil
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const addressId = parseInt(req.params.id);

    // Önce adresin bu kullanıcıya ait olup olmadığını kontrol et
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
    res.status(500).json({ error: "Adres silinemedi." });
  }
};