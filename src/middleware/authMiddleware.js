import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next(); // ✅ RETURN EKLENDİ (Fonksiyon burada biter, aşağı inmez)

    } catch (error) {
      console.error(error);
      return res.status(401).json({ error: "Yetkisiz işlem, token geçersiz." }); // ✅ RETURN EKLENDİ
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Giriş yapmalısınız." }); // ✅ RETURN EKLENDİ
  }
};

export const protectAdmin = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.isAdmin !== true) {
        return res.status(403).json({ error: "Bu işlem için yetkiniz yok! (Admin değilsin)" });
      }

      req.user = decoded;
      return next(); // ✅ RETURN EKLENDİ

    } catch (error) {
      console.error(error);
      return res.status(401).json({ error: "Geçersiz token." }); // ✅ RETURN EKLENDİ
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Token bulunamadı." }); // ✅ RETURN EKLENDİ
  }
};