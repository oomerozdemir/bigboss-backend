import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. ADMIN: Yeni Kupon Oluştur
export const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, expirationDate, minOrderAmount, usageLimit } = req.body;

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ error: "Bu kupon kodu zaten var." });

    const newCoupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue,
        minOrderAmount: minOrderAmount || 0,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        usedCount: 0 
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
    const coupons = await prisma.coupon.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true } 
        }
      }
    });
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

// 4. USER: Kupon Doğrula ve Uygula (KULLANIM LİMİTİ KONTROLÜ İLE)
export const validateCoupon = async (req, res) => {
  const { code, cartTotal } = req.body;

  try {
    const coupon = await prisma.coupon.findUnique({ 
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      return res.status(404).json({ error: "Geçersiz kupon kodu." });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ error: "Bu kupon pasif durumda." });
    }
    
    if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
      return res.status(400).json({ error: "Kuponun süresi dolmuş." });
    }

    if (coupon.minOrderAmount && parseFloat(cartTotal) < parseFloat(coupon.minOrderAmount)) {
      return res.status(400).json({ 
        error: `Bu kuponu kullanmak için sepet tutarı en az ${coupon.minOrderAmount} TL olmalı.` 
      });
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ 
        error: "Bu kuponun kullanım hakkı tükenmiştir." 
      });
    }

    res.json({
      ...coupon,
      remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : null // Kalan kullanım hakkı
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kupon doğrulanamadı." });
  }
};

// ✅ 5.Kupon Güncelle (ADMIN)
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountType, discountValue, expirationDate, minOrderAmount, usageLimit, isActive } = req.body;

    const dataToUpdate = {};

    if (code) dataToUpdate.code = code.toUpperCase();
    if (discountType) dataToUpdate.discountType = discountType;
    if (discountValue !== undefined) dataToUpdate.discountValue = discountValue;
    if (expirationDate !== undefined) dataToUpdate.expirationDate = expirationDate ? new Date(expirationDate) : null;
    if (minOrderAmount !== undefined) dataToUpdate.minOrderAmount = minOrderAmount;
    if (usageLimit !== undefined) dataToUpdate.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    const updatedCoupon = await prisma.coupon.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.json(updatedCoupon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kupon güncellenemedi." });
  }
};