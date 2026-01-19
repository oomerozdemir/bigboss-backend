
import { PrismaClient } from '@prisma/client';
import {
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail
} from '../utils/emailService.js';

const prisma = new PrismaClient();

// --- SİPARİŞ OLUŞTUR (Fatura Bilgileri + Kupon Tracking) ---
export const createOrder = async (req, res) => {
  const { items, total, address, paymentMethod, couponCode, discountAmount, invoiceType, tcNo, companyName, taxOffice, taxNumber, invoiceAddress, paymentId, status } = req.body;
  const userId = req.user.id;

  try {
    // 1. Stok Kontrolü (Aynı kalıyor)
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ error: `Stok yetersiz: ${product ? product.name : 'Ürün'}` });
      }
    }

    // 2. Transaction ile Sipariş Oluşturma ve Stok Düşme
    const result = await prisma.$transaction(async (prisma) => {
      
      // Stokları düş
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      // Siparişi Oluştur
      const order = await prisma.order.create({
        data: {
          userId,
          totalPrice: parseFloat(total),
          address,
          paymentMethod,
          couponCode,
          discountAmount: parseFloat(discountAmount || 0),
          paymentStatus: 'PENDING', // Ödeme henüz alınmadı
          status: status || 'SIPARIS_ALINDI', // Varsayılan durum
          
          // Fatura Bilgileri
          invoiceType: invoiceType || 'INDIVIDUAL',
          tcNo,
          companyName,
          taxOffice,
          taxNumber,
          invoiceAddress: invoiceAddress || address,

          // İlişkiler
          payment: paymentId ? { connect: { id: paymentId } } : undefined,
          orderItems: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: parseFloat(item.price),
              variant: item.variant
            }))
          }
        },
        include: {
          orderItems: true,
          user: true
        }
      });

      return order;
    });

    
    res.status(201).json(result);

  } catch (error) {
    console.error("Sipariş oluşturma hatası:", error);
    res.status(500).json({ error: "Sipariş oluşturulamadı." });
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