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
      frameSrc: ["'self'", "https://www.paytr.com"],  // ✅ iframe için
      connectSrc: ["'self'", "https://www.paytr.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,  // ✅ iframe için gerekli
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.urlencoded({ extended: true })); 
app.use(json({ limit: '10mb' }));
app.use(hpp());

// 🟢 3. ADIM: PAYTR ROTASI (Rate Limit'e takılmaması için önce tanımlıyoruz)
app.use('/api/paytr', paytrRoutes);

// 🟢 4. ADIM: RATE LIMITER (Diğer rotalar için)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
  message: "Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin."
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
  res.send('API Çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});