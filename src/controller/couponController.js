import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. ADMIN: Yeni Kupon Oluştur
export const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, expirationDate, minOrderAmount } = req.body;

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ error: "Bu kupon kodu zaten var." });

    const newCoupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue,
        minOrderAmount: minOrderAmount || 0,
        expirationDate: expirationDate ? new Date(expirationDate) : null
      }
    });

    res.status(201).json(newCoupon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kupon oluşturulamadı." });
  }
};

// 2. ADMIN: Tüm Kuponları Getir
export const getAllCoupons = async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: "Kuponlar getirilemedi." });
  }
};

// 3. ADMIN: Kupon Sil
export const deleteCoupon = async (req, res) => {
  try {
    await prisma.coupon.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Kupon silindi" });
  } catch (error) {
    res.status(500).json({ error: "Silinemedi" });
  }
};

// 4. USER: Kupon Doğrula ve Uygula
export const validateCoupon = async (req, res) => {
  const { code, cartTotal } = req.body;

  try {
    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

    // Kontroller
    if (!coupon) return res.status(404).json({ error: "Geçersiz kupon kodu." });
    if (!coupon.isActive) return res.status(400).json({ error: "Bu kupon pasif durumda." });
    
    // Tarih Kontrolü
    if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
        return res.status(400).json({ error: "Kuponun süresi dolmuş." });
    }

    // Sepet Alt Limiti Kontrolü
    if (coupon.minOrderAmount && parseFloat(cartTotal) < parseFloat(coupon.minOrderAmount)) {
        return res.status(400).json({ error: `Bu kuponu kullanmak için sepet tutarı en az ${coupon.minOrderAmount} TL olmalı.` });
    }

    res.json(coupon);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kupon doğrulanamadı." });
  }
};