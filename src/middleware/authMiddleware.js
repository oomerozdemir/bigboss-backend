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
      return next();

    } catch (error) {
      console.error('Token Hatası:', error.message);
      
      // ✅ Token süre dolmuşsa özel mesaj
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: "Oturum süreniz doldu. Lütfen tekrar giriş yapın.",
          code: "TOKEN_EXPIRED"
        });
      }

      // ✅ Token geçersizse
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: "Geçersiz token. Lütfen tekrar giriş yapın.",
          code: "INVALID_TOKEN"
        });
      }

      return res.status(401).json({ error: "Yetkisiz işlem, token geçersiz." });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      error: "Giriş yapmalısınız.",
      code: "NO_TOKEN"
    });
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

      // ✅ Admin kontrolü
      if (decoded.isAdmin !== true && decoded.role !== 'admin') {
        return res.status(403).json({ 
          error: "Bu işlem için admin yetkisi gerekli!",
          code: "ADMIN_REQUIRED"
        });
      }

      req.user = decoded;
      return next();

    } catch (error) {
      console.error('Admin Token Hatası:', error.message);
      
      // ✅ Token süre dolmuşsa
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: "Oturum süreniz doldu. Lütfen tekrar giriş yapın.",
          code: "TOKEN_EXPIRED"
        });
      }

      // ✅ Token geçersizse
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: "Geçersiz token. Lütfen tekrar giriş yapın.",
          code: "INVALID_TOKEN"
        });
      }

      return res.status(401).json({ error: "Geçersiz token." });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      error: "Token bulunamadı.",
      code: "NO_TOKEN"
    });
  }
};