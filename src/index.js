import express, { json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// --- GÜVENLİK PAKETLERİ ---
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

dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 5000;

// 1. TRUST PROXY (Render/Cloudflare için ZORUNLU)
app.set('trust proxy', 1); 

// 2. HELMET (Güvenlik Başlıkları)
app.use(helmet());

// 3. RATE LIMITING (DDoS Koruması)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına limit
  standardHeaders: true,
  legacyHeaders: false,
  message: "Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin."
});
app.use('/api', limiter);

// 4. CORS
app.use(cors({
  origin: [
    "http://localhost:5173",              
    "https://bigboss-frontend.vercel.app", 
    "http://localhost:5000"
  ],
  credentials: true
}));

app.use(json({ limit: '10kb' })); 

// 5. PARAMETRE KİRLİLİĞİ ÖNLEME
app.use(hpp());

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes); 
app.use('/api/categories', categoryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes); 
app.use('/api/coupons', couponRoutes);

app.get('/', (req, res) => {
  res.send('API Çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});