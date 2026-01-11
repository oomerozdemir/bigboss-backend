import express, { json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv'; 
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

app.use(cors({
  origin: [
    "http://localhost:5173",              
    "https://bigboss-frontend.vercel.app", 
    "http://localhost:5000"
  ],
  credentials: true
}));
app.use(json());
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