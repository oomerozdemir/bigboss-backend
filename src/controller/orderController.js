import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createOrder = async (req, res) => {
  const userId = req.user.id;
  const { items, total, address, couponCode, discountAmount, paymentMethod } = req.body; 
  
  try {
    const result = await prisma.$transaction(async (prisma) => {
      
      // 1. Stok Kontrolü ve Düşümü
      for (const item of items) {
        const productVariant = await prisma.productVariant.findFirst({
            where: { 
                productId: item.productId,
                size: item.variant.split('/')[0].trim()
            }
        });

        if (!productVariant) {
            throw new Error(`Ürün varyantı bulunamadı: ${item.variant}`);
        }

        if (productVariant.stock < item.quantity) {
            throw new Error(`Yetersiz stok: ${item.variant}`);
        }

        // Stoğu düşür
        await prisma.productVariant.update({
            where: { id: productVariant.id },
            data: { stock: productVariant.stock - item.quantity }
        });
        
        await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
        });
      }

      // 2. Siparişi Oluştur
      const newOrder = await prisma.order.create({
        data: {
          userId,
          total,
          addressSnapshot: address,
          status: "SIPARIS_ALINDI",
          
          // Kupon bilgileri
          couponCode: couponCode || null,
          discountAmount: discountAmount || 0,

          // ✅ YENİ: PayTR için eklenen alanlar
          paymentStatus: 'PENDING', // Ödeme bekliyor
          paymentMethod: paymentMethod || 'PAYTR', // Ödeme yöntemi

          items: {
            create: items.map(item => ({
              productId: item.productId,
              price: item.price,
              quantity: item.quantity,
              variant: item.variant
            }))
          }
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      return newOrder;
    });
    
    // ✅ Sipariş başarıyla oluşturuldu
    res.status(201).json(result);

  } catch (error) {
    console.error("Sipariş hatası:", error.message);
    res.status(400).json({ error: error.message || "Sipariş oluşturulamadı." });
  }
};

// --- SİPARİŞLERİMİ GETİR ---
export const getMyOrders = async (req, res) => {
  const userId = req.user.id;
  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: { 
        items: {
          include: { product: true } 
        },
        returnRequest: true,
        payments: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error("Sipariş getirme hatası:", error);
    res.status(500).json({ error: "Siparişler getirilemedi." });
  }
};

// --- TÜM SİPARİŞLERİ GETİR (ADMİN) ---
export const getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { name: true, email: true } }, 
        items: {
          include: { product: true }
        },
        payments: true // 
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error("Admin Sipariş Hatası:", error);
    res.status(500).json({ error: "Siparişler listelenemedi." });
  }
};

// --- SİPARİŞ DURUMUNU GÜNCELLE (ADMİN) ---
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Güncelleme hatası:", error);
    res.status(500).json({ error: "Durum güncellenemedi." });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { paymentStatus }
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Ödeme durumu güncelleme hatası:", error);
    res.status(500).json({ error: "Ödeme durumu güncellenemedi." });
  }
};