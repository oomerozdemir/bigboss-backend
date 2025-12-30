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
      
      next(); // Devam et

    } catch (error) {
      console.error(error);
      res.status(401).json({ error: "Yetkisiz işlem, token geçersiz." });
    }
  }

  if (!token) {
    res.status(401).json({ error: "Giriş yapmalısınız." });
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
      next();

    } catch (error) {
      console.error(error);
      res.status(401).json({ error: "Geçersiz token." });
    }
  }

  if (!token) {
    res.status(401).json({ error: "Token bulunamadı." });
  }
};