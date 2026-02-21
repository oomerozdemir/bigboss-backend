import { PrismaClient } from '@prisma/client';
import { sendAbandonedCartEmail } from '../utils/emailService.js';

const prisma = new PrismaClient();

// Sepeti veritabanına kaydet (kullanıcı giriş yaptığında çağrılır)
export const syncCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Geçersiz sepet verisi.' });
    }

    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {
        items,
        // Kullanıcı sepetini güncellediğinde hatırlatmayı sıfırla
        // (bir sonraki terkte yeni hatırlatma gönderilsin)
        reminderSentAt: null,
      },
      create: { userId, items },
    });

    res.json({ success: true, cart });
  } catch (error) {
    console.error('Sepet kaydetme hatası:', error);
    res.status(500).json({ error: 'Sepet kaydedilemedi.' });
  }
};

// Kullanıcının sepetini getir
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await prisma.cart.findUnique({ where: { userId } });
    res.json({ items: cart?.items || [] });
  } catch (error) {
    console.error('Sepet getirme hatası:', error);
    res.status(500).json({ error: 'Sepet getirilemedi.' });
  }
};

// Sepeti temizle (sipariş tamamlandığında)
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.cart.deleteMany({ where: { userId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Sepet temizleme hatası:', error);
    res.status(500).json({ error: 'Sepet temizlenemedi.' });
  }
};

// Terk edilmiş sepetlere hatırlatma gönder (cron job tarafından çağrılır)
export const sendAbandonedCartReminders = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 saat önce

    // 1 saatten önce güncellenen ve henüz hatırlatma gönderilmemiş sepetleri bul
    const abandonedCarts = await prisma.cart.findMany({
      where: {
        updatedAt: { lt: oneHourAgo },
        reminderSentAt: null, // Daha önce hatırlatma gönderilmemiş
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    console.log(`🔍 Terk edilmiş sepet kontrolü: ${abandonedCarts.length} adet bulundu.`);

    let sentCount = 0;

    for (const cart of abandonedCarts) {
      const items = cart.items;

      // Sepet boşsa geç
      if (!Array.isArray(items) || items.length === 0) continue;

      // E-posta gönder
      const result = await sendAbandonedCartEmail(cart.user, items);

      if (result.success) {
        // Hatırlatma tarihini kaydet
        await prisma.cart.update({
          where: { id: cart.id },
          data: { reminderSentAt: new Date() },
        });
        sentCount++;
      }
    }

    console.log(`✅ Terk edilmiş sepet hatırlatması: ${sentCount} e-posta gönderildi.`);
    return { checked: abandonedCarts.length, sent: sentCount };
  } catch (error) {
    console.error('❌ Terk edilmiş sepet hatırlatma hatası:', error);
    return { error: error.message };
  }
};

// Manuel tetikleme için admin endpoint
export const triggerAbandonedCartReminders = async (req, res) => {
  try {
    const result = await sendAbandonedCartReminders();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Hatırlatma gönderilemedi.' });
  }
};
