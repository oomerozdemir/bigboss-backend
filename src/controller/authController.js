import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// --- KAYIT OL (REGISTER) ---
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // 1. Bu email ile daha önce kayıt olunmuş mu?
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Bu e-posta adresi zaten kullanılıyor." });
    }

    // 2. Şifreyi kriptola (Hash)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Kullanıcıyı oluştur
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: "Kayıt başarılı! Şimdi giriş yapabilirsiniz." });

  } catch (error) {
    console.error("Register Hatası:", error);
    res.status(500).json({ error: "Kayıt olurken bir hata oluştu." });
  }
};

// --- GİRİŞ YAP (LOGIN) ---
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Kullanıcıyı bul
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }

    // 2. Şifreyi kontrol et
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Şifre hatalı!" });
    }

    // 3. Token oluştur (30 gün)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // 4. Cevabı gönder
    res.json({
      message: "Giriş başarılı",
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        isAdmin: user.isAdmin 
      }
    });

  } catch (error) {
    console.error("Login Hatası:", error);
    res.status(500).json({ error: "Giriş yapılırken hata oluştu." });
  }
};

// --- ADMIN GİRİŞİ ---
export const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Admin tablosunda bu kullanıcı adı var mı?
    const admin = await prisma.admin.findUnique({ where: { username } });
    
    if (!admin) {
      return res.status(404).json({ error: "Admin bulunamadı." });
    }

    // 2. Şifre doğru mu?
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Hatalı şifre!" });
    }

    // 3. Token oluştur (30 gün)
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        isAdmin: true,
        role: "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      message: "Admin girişi başarılı",
      token,
      username: admin.username
    });

  } catch (error) {
    console.error("Admin Login Hatası:", error);
    res.status(500).json({ error: "Sunucu hatası." });
  }
};