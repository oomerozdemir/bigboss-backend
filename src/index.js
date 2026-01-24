import express, { json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

import productRoutes from './routes/productRoutes.js'; 
import authRoutes from "./routes/authRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js"
import addressRoutes from "./routes/addressRoutes.js"
import orderRoutes from './routes/orderRoutes.js';
import returnRoutes from './routes/returnRoutes.js'; 
import couponRoutes from './routes/couponRoutes.js';
import paytrRoutes from "./routes/paytrRoutes.js";

dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ 0. ADIM: TRUST PROXY AYARI (Render, Vercel vb. için ZORUNLU)
app.set('trust proxy', 1); // veya true

// 🟢 1. ADIM: CORS AYARLARI EN ÜSTTE OLMALI
app.use(cors({
  origin: [
    "http://localhost:5173",              
    "https://bigboss-frontend.vercel.app", 
    "http://localhost:5000",
    "https://bigbosstextil.com",
    "https://www.bigbosstextil.com"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
  allowedHeaders: ["Content-Type", "Authorization"] 
}));

// 🟢 2. ADIM: DİĞER TEMEL AYARLAR
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.paytr.com"],
      frameSrc: ["'self'", "https://www.paytr.com"],
      connectSrc: ["'self'", "https://www.paytr.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.urlencoded({ extended: true })); 
app.use(json({ limit: '10mb' }));
app.use(hpp());

// 🟢 3. ADIM: PAYTR ROTASI (Rate Limit'e takılmaması için önce tanımlıyoruz)
app.use('/api/paytr', paytrRoutes);

// 🟢 4. ADIM: RATE LIMITER (Geliştirilmiş - Proxy desteği ile)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına max 100 istek
  standardHeaders: true,
  legacyHeaders: false,
  
  // ✅ Proxy arkasındaysa IP'yi doğru al
  validate: {
    trustProxy: true, // trust proxy ayarına güven
    xForwardedForHeader: false // X-Forwarded-For header'ını otomatik kullan
  },
  
  // ✅ Kullanıcıyı IP + User-Agent ile tanımla (daha güvenli)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  
  // ✅ Rate limit aşıldığında özel mesaj
  handler: (req, res) => {
    res.status(429).json({
      error: 'Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  },
  
  // ✅ Başarılı istekler için skip (opsiyonel)
  skip: (req) => {
    // Health check endpoint'lerini rate limit'ten muaf tut
    return req.path === '/' || req.path === '/health';
  }
});

app.use('/api', limiter);

// 🟢 5. ADIM: DİĞER ROTALAR
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); 
app.use('/api/categories', categoryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes); 
app.use('/api/coupons', couponRoutes);

// Ana Dizin Testi
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Big Boss API Çalışıyor!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ✅ Health Check Endpoint (Monitoring için)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint bulunamadı',
    path: req.path,
    method: req.method
  });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Sunucu hatası',
    code: err.code || 'INTERNAL_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor...`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Trust Proxy: Aktif`);
});