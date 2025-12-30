import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Veri tabanı ve kategoriler sıfırlanıyor...");

  // Temizlik (Sıra önemli: Önce ürünler, sonra alt kat, sonra ana kat)
  await prisma.product.deleteMany();
  await prisma.subCategory.deleteMany();
  await prisma.mainCategory.deleteMany();
  await prisma.user.deleteMany();

  // --- 1. ANA KATEGORİLERİ OLUŞTUR ---
  const kadin = await prisma.mainCategory.create({ data: { name: 'Kadın' } });
  const erkek = await prisma.mainCategory.create({ data: { name: 'Erkek' } });
  const yeniSezon = await prisma.mainCategory.create({ data: { name: 'Yeni Sezon' } });

  // --- 2. ALT KATEGORİLERİ OLUŞTUR ---
  // Kadın Alt Kategorileri
  const kadinGomlek = await prisma.subCategory.create({ data: { name: 'Gömlek', mainCategoryId: kadin.id } });
  const kadinBluz = await prisma.subCategory.create({ data: { name: 'Bluz', mainCategoryId: kadin.id } });
  const kadinElbise = await prisma.subCategory.create({ data: { name: 'Elbise', mainCategoryId: kadin.id } });

  // Erkek Alt Kategorileri
  const erkekGomlek = await prisma.subCategory.create({ data: { name: 'Gömlek', mainCategoryId: erkek.id } });
  const erkekPantolon = await prisma.subCategory.create({ data: { name: 'Pantolon', mainCategoryId: erkek.id } });

  // --- 3. ADMİN OLUŞTUR ---
  const hashedPassword = await bcrypt.hash("123456", 10); 
  await prisma.user.create({
    data: {
      name: "Ömer Özdemir",
      email: "oomerozdemir40@hotmail.com", 
      password: hashedPassword,
      isAdmin: true 
    }
  });
  console.log("👑 Admin Eklendi.");

  // --- 4. ÖRNEK ÜRÜN EKLE (ÇOKLU KATEGORİ) ---
  await prisma.product.create({
    data: {
      name: "İpek Dokulu Gömlek",
      price: 1200,
      imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1888&auto=format&fit=crop",
      description: "Yazlık harika bir gömlek",
      isFeatured: true,
      // Bu ürün hem 'Kadın > Gömlek' hem de 'Yeni Sezon' (Varsayalım ki Yeni Sezon'un da alt kategorisi var) kategorisine ait olabilir.
      // Şimdilik sadece Kadın Gömleğe bağlayalım:
      categories: {
        connect: [
          { id: kadinGomlek.id }, // Kadın > Gömlek
        ]
      }
    }
  });

  console.log("✅ Yeni kategori yapısı başarıyla kuruldu!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });