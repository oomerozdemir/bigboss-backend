import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// --- SİPARİŞ OLUŞTUR ---
export const createOrder = async (req, res) => {
  const userId = req.user.id;
  const { items, total, address } = req.body; 
  // items: [{ productId, price, quantity, variant }]
  // address: "Mahalle... No:1..." (Metin olarak)

  try {
    const newOrder = await prisma.order.create({
      data: {
        userId,
        total,
        addressSnapshot: address,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            price: item.price,
            quantity: item.quantity,
            variant: item.variant
          }))
        }
      }
    });
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Sipariş hatası:", error);
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
          include: { product: true } // Ürün resmini/adını çekmek için
        } 
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error("Sipariş getirme hatası:", error);
    res.status(500).json({ error: "Siparişler getirilemedi." });
  }
};

// --- [YENİ] TÜM SİPARİŞLERİ GETİR (ADMİN İÇİN) ---
export const getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { name: true, email: true } }, // Kullanıcı adını da getir
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error("Admin Sipariş Hatası:", error);
    res.status(500).json({ error: "Siparişler listelenemedi." });
  }
};