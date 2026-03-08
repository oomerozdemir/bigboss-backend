import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const productSelect = {
  id: true,
  name: true,
  price: true,
  discountPrice: true,
  isOnSale: true,
  imageUrl: true,
  isActive: true,
  stock: true,
  variants: { select: { id: true, vImageUrl: true, vImageUrls: true, color: true, size: true, stock: true } },
};

// Bir ürünün tüm kombinlerini getir (çift yönlü)
export const getCombinations = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(parseInt(id))) return res.status(400).json({ error: 'Geçersiz ürün ID' });

  try {
    const [asSource, asTarget] = await Promise.all([
      prisma.productCombination.findMany({
        where: { productId: parseInt(id) },
        include: { combinedProduct: { select: productSelect } },
      }),
      prisma.productCombination.findMany({
        where: { combinedProductId: parseInt(id) },
        include: { product: { select: productSelect } },
      }),
    ]);

    const combinationIds = new Set();
    const combinations = [];

    for (const c of asSource) {
      if (!combinationIds.has(c.combinedProduct.id)) {
        combinationIds.add(c.combinedProduct.id);
        combinations.push({ combinationId: c.id, product: c.combinedProduct });
      }
    }
    for (const c of asTarget) {
      if (!combinationIds.has(c.product.id)) {
        combinationIds.add(c.product.id);
        combinations.push({ combinationId: c.id, product: c.product });
      }
    }

    res.json(combinations);
  } catch (error) {
    console.error('getCombinations Error:', error);
    res.status(500).json({ error: 'Kombinler getirilemedi.' });
  }
};

// Kombinasyon ekle (Admin)
export const addCombination = async (req, res) => {
  const { id } = req.params;
  const { combinedProductId } = req.body;

  const sourceId = parseInt(id);
  const targetId = parseInt(combinedProductId);

  if (!sourceId || !targetId || isNaN(sourceId) || isNaN(targetId)) {
    return res.status(400).json({ error: 'Geçersiz ürün ID' });
  }
  if (sourceId === targetId) {
    return res.status(400).json({ error: 'Bir ürün kendisiyle eşleştirilemez.' });
  }

  try {
    // Zaten var mı kontrol et (çift yönlü)
    const existing = await prisma.productCombination.findFirst({
      where: {
        OR: [
          { productId: sourceId, combinedProductId: targetId },
          { productId: targetId, combinedProductId: sourceId },
        ],
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Bu kombinasyon zaten mevcut.' });
    }

    const combination = await prisma.productCombination.create({
      data: { productId: sourceId, combinedProductId: targetId },
      include: { combinedProduct: { select: productSelect } },
    });

    res.status(201).json({ combinationId: combination.id, product: combination.combinedProduct });
  } catch (error) {
    console.error('addCombination Error:', error);
    res.status(500).json({ error: 'Kombinasyon eklenemedi.' });
  }
};

// Kombinasyon kaldır (Admin)
export const removeCombination = async (req, res) => {
  const { id, combinedId } = req.params;

  const sourceId = parseInt(id);
  const targetId = parseInt(combinedId);

  try {
    // Çift yönlü arama
    const record = await prisma.productCombination.findFirst({
      where: {
        OR: [
          { productId: sourceId, combinedProductId: targetId },
          { productId: targetId, combinedProductId: sourceId },
        ],
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Kombinasyon bulunamadı.' });
    }

    await prisma.productCombination.delete({ where: { id: record.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('removeCombination Error:', error);
    res.status(500).json({ error: 'Kombinasyon kaldırılamadı.' });
  }
};
