import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. KULLANICI: İade Talebi Oluştur
export const createReturnRequest = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.body;

  try {
    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });

    if (!order || order.userId !== userId) {
      return res.status(403).json({ error: "Yetkisiz işlem." });
    }

    if (order.status !== 'TESLIM_EDILDI') {
      return res.status(400).json({ error: "Sadece teslim edilen siparişler iade edilebilir." });
    }

    // Zaten bir talep var mı?
    const existing = await prisma.returnRequest.findUnique({ where: { orderId: parseInt(orderId) } });
    if (existing) {
      return res.status(400).json({ error: "Bu sipariş için zaten bir talebiniz var." });
    }

    const newReturn = await prisma.returnRequest.create({
      data: { orderId: parseInt(orderId) }
    });

    res.status(201).json(newReturn);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Talep oluşturulamadı." });
  }
};

// 2. ADMIN: Tüm İade Taleplerini Getir
export const getAllReturns = async (req, res) => {
  try {
    const returns = await prisma.returnRequest.findMany({
      include: {
        order: {
          include: {
            user: { select: { name: true, email: true } },
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(returns);
  } catch (error) {
    res.status(500).json({ error: "İadeler çekilemedi." });
  }
};

// 3. ADMIN: İadeyi Onayla veya Reddet
export const processReturn = async (req, res) => {
  const { id } = req.params; // ReturnRequest ID
  const { status } = req.body; // 'ONAYLANDI' veya 'REDDEDILDI'

  try {
    const result = await prisma.$transaction(async (prisma) => {
      // a) İade talebini güncelle
      const updatedReturn = await prisma.returnRequest.update({
        where: { id: parseInt(id) },
        data: { status }
      });

      // b) Eğer ONAYLANDI ise, asıl siparişin durumunu güncelle
      if (status === 'ONAYLANDI') {
        await prisma.order.update({
          where: { id: updatedReturn.orderId },
          data: { status: 'IADE_EDILDI' } // Kullanıcı tarafında "İade Edildi" görünecek
        });
      }

      return updatedReturn;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "İşlem yapılamadı." });
  }
};