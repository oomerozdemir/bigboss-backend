import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. FAVORİ EKLE / ÇIKAR (Toggle)
export const toggleFavorite = async (req, res) => {
  const userId = req.user.id; // Auth middleware'den gelecek
  const { productId } = req.body;

  try {
    // Önce bu favori zaten var mı bakalım
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: userId,
          productId: parseInt(productId),
        },
      },
    });

    if (existingFavorite) {
      // Varsa SİL (Favoriden çıkar)
      await prisma.favorite.delete({
        where: { id: existingFavorite.id },
      });
      await prisma.product.update({
        where: { id: parseInt(productId) },
        data: { favoriteCount: { decrement: 1 } }
      });
      res.json({ message: "Favorilerden çıkarıldı", isFavorited: false });
    } else {
      // Yoksa EKLE
      await prisma.favorite.create({
        data: {
          userId: userId,
          productId: parseInt(productId),
        },
      });
      await prisma.product.update({
        where: { id: parseInt(productId) },
        data: { favoriteCount: { increment: 1 } }
      });
      res.json({ message: "Favorilere eklendi", isFavorited: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "İşlem başarısız." });
  }
};

// 2. KULLANICININ FAVORİLERİNİ GETİR
export const getFavorites = async (req, res) => {
  const userId = req.user.id;

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: userId },
      include: {
        product: { // Ürün detaylarını da getir
            include: { variants: true, categories: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Sadece ürün listesini döndürelim (daha temiz olur)
    const products = favorites.map(fav => fav.product);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Favoriler getirilemedi." });
  }
};