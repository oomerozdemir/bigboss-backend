
import { PrismaClient } from '@prisma/client';
import {
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail
} from '../utils/emailService.js';

const prisma = new PrismaClient();

export const createOrder = async (req, res) => {
  // Kullanıcı giriş yapmışsa ID'yi al, yoksa null (Misafir alışverişi yoksa bu satır hata verebilir, kontrol edin)
  const userId = req.user ? req.user.id : null; 
  
  const { 
    items, 
    total, 
    address, 
    couponCode, 
    discountAmount, 
    paymentMethod,
    invoiceType,  
    tcNo,         
    companyName, 
    taxOffice,   
    taxNumber,    
    invoiceAddress 
  } = req.body; 
  
  try {
    const result = await prisma.$transaction(async (prisma) => {
      
      // 1. Stok Kontrolü ve Güncelleme
      for (const item of items) {
        // Varyant kontrolü (örn: "38 / Siyah")
        let variantSize = item.variant; 
        if (item.variant && item.variant.includes('/')) {
            variantSize = item.variant.split('/')[0].trim();
        }

        // Eğer varyantlı ürünse varyant stoğuna bak, yoksa ana ürüne bak
        const productVariant = await prisma.productVariant.findFirst({
            where: { 
                productId: item.productId,
                size: variantSize
            }
        });

        // Varyant varsa onun stoğunu düş
        if (productVariant) {
            if (productVariant.stock < item.quantity) {
                throw new Error(`Yetersiz stok (Varyant): ${item.variant}`);
            }
            await prisma.productVariant.update({
                where: { id: productVariant.id },
                data: { stock: productVariant.stock - item.quantity }
            });
        }
        
        // Ayrıca ana ürün stoğunu da düşüyoruz (Genel takip için)
        await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
        });
      }

      // 2. Kupon İşlemleri
      let couponId = null;
      if (couponCode) {
        const coupon = await prisma.coupon.findUnique({
          where: { code: couponCode.toUpperCase() }
        });

        if (coupon) {
          await prisma.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } }
          });
          couponId = coupon.id;
        }
      }

      // 3. Siparişi Oluştur
      const newOrder = await prisma.order.create({
        data: {
          userId: userId, // Zorunlu alan
          total: parseFloat(total), // Decimal'e çevir
          addressSnapshot: address, // 🟢 DÜZELTME: 'address' verisini 'addressSnapshot' alanına eşledik
          status: "SIPARIS_ALINDI",
          
          // Kupon bilgileri
          couponCode: couponCode || null,
          couponId: couponId,
          discountAmount: parseFloat(discountAmount || 0),
          
          // Ödeme bilgileri
          paymentStatus: 'PENDING',
          paymentMethod: paymentMethod || 'PAYTR',

          // Fatura Bilgileri
          invoiceType: invoiceType || 'INDIVIDUAL',
          tcNo: invoiceType === 'INDIVIDUAL' ? tcNo : null,
          companyName: invoiceType === 'CORPORATE' ? companyName : null,
          taxOffice: invoiceType === 'CORPORATE' ? taxOffice : null,
          taxNumber: invoiceType === 'CORPORATE' ? taxNumber : null,
          invoiceAddress: invoiceAddress || null,

          // Sipariş Kalemleri
          items: {
            create: items.map(item => ({
              productId: item.productId,
              price: parseFloat(item.price),
              quantity: item.quantity,
              variant: item.variant
            }))
          }
        },
        include: {
          items: {
            include: { product: true }
          },
          user: true
        }
      });

      return newOrder;
    });
    
    // 4. E-posta gönder (Hata alsa bile sipariş oluşmuş olur)
    if (result.user && result.user.email) {
        sendOrderConfirmationEmail(result, result.user)
        .then(() => console.log(`📧 Sipariş onay e-postası gönderildi: #${result.id}`))
        .catch(err => console.error('E-posta hatası:', err));
    }

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
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error("Admin Sipariş Hatası:", error);
    res.status(500).json({ error: "Siparişler listelenemedi." });
  }
};

// --- SİPARİŞ DURUMUNU GÜNCELLE (Kargo Numarası İle) ---
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, cargoCompany } = req.body; 
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Sipariş bulunamadı" });
    }

    const dataToUpdate = { status };
    
    if (status === 'KARGOLANDI') {
      if (trackingNumber) dataToUpdate.trackingNumber = trackingNumber;
      if (cargoCompany) dataToUpdate.cargoCompany = cargoCompany;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    // E-posta gönder
    switch (status) {
      case 'KARGOLANDI':
        sendOrderShippedEmail(order, order.user, trackingNumber)
          .then(() => console.log(`📧 Kargo e-postası gönderildi: #${order.id}`))
          .catch(err => console.error('Kargo e-postası hatası:', err));
        break;

      case 'TESLIM_EDILDI':
        sendOrderDeliveredEmail(order, order.user)
          .then(() => console.log(`📧 Teslimat e-postası gönderildi: #${order.id}`))
          .catch(err => console.error('Teslimat e-postası hatası:', err));
        break;

      case 'IPTAL_EDILDI':
        sendOrderCancelledEmail(order, order.user, 'Admin tarafından iptal edildi')
          .then(() => console.log(`📧 İptal e-postası gönderildi: #${order.id}`))
          .catch(err => console.error('İptal e-postası hatası:', err));
        break;

      default:
        break;
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error("Güncelleme hatası:", error);
    res.status(500).json({ error: "Durum güncellenemedi." });
  }
};

// --- ÖDEME DURUMUNU GÜNCELLE ---
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

export const getInvoiceDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      select: {
        id: true,
        invoiceType: true,
        tcNo: true,
        companyName: true,
        taxOffice: true,
        taxNumber: true,
        invoiceAddress: true,
        total: true,
        discountAmount: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Sipariş bulunamadı" });
    }

    // Kullanıcı sadece kendi siparişlerini görebilir
    if (!isAdmin && order.userId !== userId) {
      return res.status(403).json({ error: "Bu siparişi görme yetkiniz yok" });
    }

    res.json(order);
  } catch (error) {
    console.error("Fatura bilgileri hatası:", error);
    res.status(500).json({ error: "Fatura bilgileri getirilemedi" });
  }
};