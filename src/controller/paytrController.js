// controller/paytrController.js - FIXED TO HANDLE GET AND POST

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { sendOrderConfirmationEmail } from '../utils/emailService.js';

const prisma = new PrismaClient();

const PAYTR_CONFIG = {
  merchant_id: process.env.PAYTR_MERCHANT_ID,
  merchant_key: process.env.PAYTR_MERCHANT_KEY,
  merchant_salt: process.env.PAYTR_MERCHANT_SALT,
  test_mode: process.env.PAYTR_TEST_MODE === 'true' ? '1' : '0',
  iframe_base_url: 'https://www.paytr.com/odeme/guvenli/', 
};

// 1. TOKEN OLUŞTURMA
export const createPaymentToken = async (req, res) => {
  try {
    const { 
      user_basket, user_name, user_address, user_phone, user_email,
      merchant_oid, payment_amount, user_ip 
    } = req.body;

    console.log("📤 PayTR Token İsteği:", merchant_oid);

    const BACKEND_URL = process.env.BACKEND_URL || "https://bigboss-backend.onrender.com";

    const no_installment = 0;
    const max_installment = 0;
    const currency = 'TL';
    
    const hashSTR = `${PAYTR_CONFIG.merchant_id}${user_ip}${merchant_oid}${user_email}${payment_amount}${user_basket}${no_installment}${max_installment}${currency}${PAYTR_CONFIG.test_mode}`;
    const paytr_token = crypto.createHmac('sha256', PAYTR_CONFIG.merchant_key).update(hashSTR + PAYTR_CONFIG.merchant_salt).digest('base64');

    const params = new URLSearchParams();
    params.append('merchant_id', PAYTR_CONFIG.merchant_id);
    params.append('user_ip', user_ip);
    params.append('merchant_oid', merchant_oid);
    params.append('email', user_email);
    params.append('payment_amount', payment_amount);
    params.append('paytr_token', paytr_token);
    params.append('user_basket', user_basket);
    params.append('debug_on', '1');
    params.append('no_installment', no_installment);
    params.append('max_installment', max_installment);
    params.append('user_name', user_name);
    params.append('user_address', user_address);
    params.append('user_phone', user_phone);
    
    // ✅ Callback URL
    params.append('merchant_ok_url', `${BACKEND_URL}/api/paytr/callback`);
    params.append('merchant_fail_url', `${BACKEND_URL}/api/paytr/callback`);
    
    params.append('timeout_limit', '30');
    params.append('currency', currency);
    params.append('test_mode', PAYTR_CONFIG.test_mode);

    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      body: params
    });

    const result = await response.json();

    if (result.status === 'success') {
      console.log('✅ PayTR token alındı');
      res.json({ 
        success: true, 
        iframe_url: `${PAYTR_CONFIG.iframe_base_url}${result.token}` 
      });
    } else {
      console.error("❌ PayTR Token Hatası:", result.reason);
      res.status(400).json({ success: false, message: result.reason });
    }

  } catch (error) {
    console.error("❌ PayTR Sunucu Hatası:", error);
    res.status(500).json({ success: false, message: "Sunucu hatası: " + error.message });
  }
};

// 2. CALLBACK (HEM GET HEM POST DESTEĞİ)
export const paytrCallback = async (req, res) => {
  try {
    // ✅ GET veya POST - her ikisini de destekle
    const params = req.method === 'GET' ? req.query : req.body;
    const { merchant_oid, status, total_amount, hash } = params;
    
    console.log('📨 PayTR Callback alındı:', { 
      method: req.method,
      merchant_oid, 
      status 
    });

    // GET isteği ise basit HTML dön (tarayıcıdan test için)
    if (req.method === 'GET' && !merchant_oid) {
      return res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>✅ PayTR Callback Endpoint</h2>
            <p>Bu endpoint PayTR'den gelen bildirimleri işler.</p>
            <p>Direkt tarayıcıdan erişilemez.</p>
          </body>
        </html>
      `);
    }

    // Hash doğrula
    const hashSTR = merchant_oid + PAYTR_CONFIG.merchant_salt + status + total_amount;
    const calculated_hash = crypto.createHmac('sha256', PAYTR_CONFIG.merchant_key).update(hashSTR).digest('base64');

    if (hash !== calculated_hash) {
      console.error('❌ Hash doğrulanamadı!');
      return res.status(400).send('PAYTR notification failed: bad hash');
    }

    const orderId = parseInt(merchant_oid);

    if (!orderId) {
      return res.status(200).send('OK');
    }

    // ✅ BAŞARILI ÖDEME
    if (status === 'success') {
      console.log('✅ Ödeme başarılı, DB güncelleniyor:', orderId);

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'SIPARIS_ALINDI', 
          paymentStatus: 'SUCCESS'
        },
        include: { 
          user: true,
          items: { include: { product: true } }
        } 
      });

      // Mail gönder
      try {
        if (updatedOrder.user?.email) {
          await sendOrderConfirmationEmail(updatedOrder, updatedOrder.user);
          console.log('📧 Onay maili gönderildi');
        }
      } catch (e) { 
        console.error("Mail hatası:", e); 
      }

      console.log('✅ DB güncellendi - SUCCESS');
    } 
    // ❌ BAŞARISIZ ÖDEME
    else {
      console.log('❌ Ödeme başarısız, DB güncelleniyor:', orderId);

      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'ODEME_BASARISIZ', 
          paymentStatus: 'FAILED' 
        }
      });

      console.log('✅ DB güncellendi - FAILED');
    }

    // ✅ PayTR'ye OK dön
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Callback Error:', error);
    res.status(500).send('Error');
  }
};

export default {
  createPaymentToken,
  paytrCallback
};