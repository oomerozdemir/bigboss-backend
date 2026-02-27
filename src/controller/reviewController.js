import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/reviews/:productId - Bir ürünün tüm yorumlarını getir
export const getProductReviews = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Ortalama hesapla
    const avg = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Yıldız dağılımı
    const distribution = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length
    }));

    res.json({ reviews, average: parseFloat(avg.toFixed(1)), total: reviews.length, distribution });
  } catch (err) {
    console.error('getProductReviews error:', err);
    res.status(500).json({ error: 'Yorumlar yüklenirken hata oluştu.' });
  }
};

// POST /api/reviews/:productId - Yorum ekle (giriş yapmış + ürünü satın almış kullanıcı)
export const createReview = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const userId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Geçerli bir yıldız puanı giriniz (1-5).' });
    }
    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ error: 'Yorum en az 10 karakter olmalıdır.' });
    }

    // Kullanıcının bu ürünü sipariş verip vermediğini kontrol et (teslim edilmiş veya kargolanan)
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: { in: ['TESLIM_EDILDI', 'KARGOLANDI', 'HAZIRLANIYOR', 'SIPARIS_ALINDI'] }
        }
      }
    });

    if (!hasPurchased) {
      return res.status(403).json({ error: 'Yorum yapabilmek için bu ürünü satın almış olmanız gerekiyor.' });
    }

    // Daha önce yorum yapmış mı?
    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } }
    });
    if (existing) {
      return res.status(409).json({ error: 'Bu ürün için zaten bir değerlendirme yaptınız.' });
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        rating: parseInt(rating),
        comment: comment.trim()
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({ message: 'Değerlendirmeniz eklendi.', review });
  } catch (err) {
    console.error('createReview error:', err);
    res.status(500).json({ error: 'Yorum eklenirken hata oluştu.' });
  }
};

// DELETE /api/reviews/:reviewId - Kendi yorumunu sil
export const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId);
    const userId = req.user.id;

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) return res.status(404).json({ error: 'Yorum bulunamadı.' });
    if (review.userId !== userId) return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });

    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ message: 'Yorum silindi.' });
  } catch (err) {
    console.error('deleteReview error:', err);
    res.status(500).json({ error: 'Yorum silinirken hata oluştu.' });
  }
};

// GET /api/reviews/:productId/can-review - Kullanıcı bu ürüne yorum yapabilir mi?
export const canUserReview = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const userId = req.user.id;

    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: { in: ['TESLIM_EDILDI', 'KARGOLANDI', 'HAZIRLANIYOR', 'SIPARIS_ALINDI'] }
        }
      }
    });

    const alreadyReviewed = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } }
    });

    res.json({
      canReview: !!hasPurchased && !alreadyReviewed,
      hasPurchased: !!hasPurchased,
      alreadyReviewed: !!alreadyReviewed,
      existingReview: alreadyReviewed || null
    });
  } catch (err) {
    console.error('canUserReview error:', err);
    res.status(500).json({ error: 'Kontrol yapılırken hata oluştu.' });
  }
};
