import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Terminalden girilen emaili al (Örn: node src/makeAdmin.js omer@mail.com)
const targetEmail = process.argv[2];

if (!targetEmail) {
  console.error("❌ Lütfen bir email adresi belirtin!");
  console.log("Kullanım: node src/makeAdmin.js <email_adresi>");
  process.exit(1);
}

async function main() {
  console.log(`🔍 Kullanıcı aranıyor: ${targetEmail}...`);

  // 1. Kullanıcıyı Bul
  const user = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  if (!user) {
    console.error("❌ Hata: Bu e-posta adresine sahip bir kullanıcı bulunamadı.");
    return;
  }

  // 2. Admin Tablosuna Ekle (veya güncelle)
  // Not: Admin tablosundaki 'username' alanına kullanıcının 'email'ini yazıyoruz.
  // Böylece admin girişinde kullanıcı adı yerine mailini yazarak girebilecek.
  try {
    const newAdmin = await prisma.admin.create({
      data: {
        username: user.email,    // Admin kullanıcı adı = User emaili
        password: user.password  
      }
    });

    console.log(`\n🎉 TEBRİKLER!`);
    console.log(`✅ ${user.name} (${user.email}) başarıyla Admin olarak atandı.`);
    console.log(`ℹ️  Artık '/admin' panelinden şu bilgilerle giriş yapabilir:`);
    console.log(`   Kullanıcı Adı: ${user.email}`);
    console.log(`   Şifre: (Mevcut kullanıcı şifresi)`);

  } catch (error) {
    // Eğer zaten admin ise hata verir (Unique constraint)
    if (error.code === 'P2002') {
      console.log("⚠️  Bu kullanıcı zaten bir Admin!");
    } else {
      console.error("Bir hata oluştu:", error);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());