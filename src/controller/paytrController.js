import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { sendOrderConfirmationEmail } from '../utils/emailService.js';

const prisma = new PrismaClient();

// PayTR Konfigürasyonu
const PAYTR_CONFIG = {
  merchant_id: process.env.PAYTR_MERCHANT_ID,
  merchant_key: process.env.PAYTR_MERCHANT_KEY,
  merchant_salt: process.env.PAYTR_MERCHANT_SALT,
  test_mode: process.env.PAYTR_TEST_MODE === 'true' ? '1' : '0',
};

// ✅ DÜZELTME: request library yerine fetch kullan
export const createPaymentToken = async (req, res) => {
  try {
    const { 
      user_basket, user_name, user_address, user_phone, user_email,
      merchant_oid, payment_amount, user_ip 
    } = req.body;

    const BACKEND_URL = process.env.VITE_API_URL || "https://bigboss-backend.onrender.com";

    // Form data hazırla
    const formData = {
      merchant_id: PAYTR_CONFIG.merchant_id,
      user_ip: user_ip || '0.0.0.0',
      merchant_oid: merchant_oid,
      email: user_email,
      payment_amount: payment_amount,
      user_basket: user_basket,
      debug_on: '1',
      no_installment: '0',
      max_installment: '0',
      user_name: user_name,
      user_address: user_address,
      user_phone: user_phone,
      merchant_ok_url: `${BACKEND_URL}/api/paytr/success`,
      merchant_fail_url: `${BACKEND_URL}/api/paytr/fail`,
      timeout_limit: '30',
      currency: 'TL',
      test_mode: PAYTR_CONFIG.test_mode,
      lang: 'tr'
    };

    // Hash hesapla
    const hashSTR = `${PAYTR_CONFIG.merchant_id}${formData.user_ip}${merchant_oid}${user_email}${payment_amount}${user_basket}${formData.no_installment}${formData.max_installment}${formData.currency}${PAYTR_CONFIG.test_mode}`;
    const paytr_token = crypto
      .createHmac('sha256', PAYTR_CONFIG.merchant_key)
      .update(hashSTR + PAYTR_CONFIG.merchant_salt)
      .digest('base64');

    formData.paytr_token = paytr_token;

    console.log('🔵 PayTR İstek:', {
      merchant_oid,
      amount: payment_amount,
      test_mode: PAYTR_CONFIG.test_mode
    });

    // ✅ FETCH ile PayTR'ye istek at
    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(formData).toString()
    });

    const result = await response.json();

    console.log('🔵 PayTR Yanıt:', result);

    if (result.status === 'success') {
      res.json({ 
        success: true, 
        iframe_url: `https://www.paytr.com/odeme/guvenli/${result.token}` 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.reason || 'Ödeme başlatılamadı' 
      });
    }

  } catch (error) {
    console.error("❌ PayTR Token Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Ödeme başlatılamadı",
      error: error.message 
    });
  }
};

// ✅ PayTR Callback
export const paytrCallback = async (req, res) => {
  try {
    const { merchant_oid, status, total_amount, hash, failed_reason_msg } = req.body;

    console.log('🟢 PayTR Callback alındı:', { merchant_oid, status });

    // Hash doğrula
    const hashSTR = merchant_oid + PAYTR_CONFIG.merchant_salt + status + total_amount;
    const calculated_hash = crypto
      .createHmac('sha256', PAYTR_CONFIG.merchant_key)
      .update(hashSTR)
      .digest('base64');

    if (hash !== calculated_hash) {
      console.error('❌ Hash doğrulama hatası!');
      return res.status(400).send('PAYTR notification failed: bad hash');
    }

    console.log('✅ Hash doğrulandı');

    const payment = await prisma.payment.findFirst({
      where: { orderId: parseInt(merchant_oid) },
      orderBy: { createdAt: 'desc' }
    });

    if (status === 'success') {
      // Ödemeyi güncelle
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'SUCCESS', 
            paidAt: new Date(), 
            totalAmount: parseFloat(total_amount) / 100 
          }
        });
      }

      // Siparişi güncelle
      const updatedOrder = await prisma.order.update({
        where: { id: parseInt(merchant_oid) },
        data: { 
          status: 'SIPARIS_ALINDI', 
          paymentStatus: 'SUCCESS' 
        },
        include: { user: true, items: { include: { product: true } } }
      });

      console.log('✅ Sipariş güncellendi:', merchant_oid);

      // Mail gönder (try-catch ile)
      try {
        if (updatedOrder.user && updatedOrder.user.email) {
          console.log(`📧 Mail gönderiliyor: ${updatedOrder.user.email}`);
          await sendOrderConfirmationEmail(updatedOrder, updatedOrder.user);
        }
      } catch (mailError) {
        console.error("⚠️ Mail gönderilemedi:", mailError.message);
      }

      return res.status(200).send('OK');
      
    } else {
      // Başarısız ödeme
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'FAILED', 
            failureReason: failed_reason_msg || 'Hata' 
          }
        });
      }
      
      await prisma.order.update({
        where: { id: parseInt(merchant_oid) },
        data: { paymentStatus: 'FAILED' }
      });

      console.log('❌ Ödeme başarısız:', merchant_oid);

      return res.status(200).send('OK');
    }

  } catch (error) {
    console.error('❌ Callback Critical Error:', error);
    return res.status(500).send('Error');
  }
};

// ✅ Ödeme Başarılı Handler
export const handlePaymentSuccess = (req, res) => {
  const merchant_oid = req.body.merchant_oid || req.query.merchant_oid;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Ödeme Başarılı</title>
      </head>
      <body>
        <h2>Ödeme başarılı! Yönlendiriliyorsunuz...</h2>
        <script>
          console.log('✅ Payment Success - Sending message to parent');
          window.parent.postMessage(JSON.stringify({ 
            status: 'success', 
            merchant_oid: "${merchant_oid}" 
          }), '*');
        </script>
      </body>
    </html>
  `;
  
  res.send(htmlContent);
};

// ✅ Ödeme Başarısız Handler
export const handlePaymentFail = (req, res) => {
  const reason = req.body.failed_reason_msg || req.query.reason || 'Ödeme başarısız';
  const merchant_oid = req.body.merchant_oid || req.query.merchant_oid;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Ödeme Başarısız</title>
      </head>
      <body>
        <h2>Ödeme başarısız: ${reason}</h2>
        <script>
          console.log('❌ Payment Failed - Sending message to parent');
          window.parent.postMessage(JSON.stringify({ 
            status: 'failed', 
            reason: "${reason}",
            merchant_oid: "${merchant_oid}"
          }), '*');
        </script>
      </body>
    </html>
  `;
  
  res.send(htmlContent);
};

// ✅ Ödeme Durumu Sorgulama
export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { orderId: parseInt(orderId) },
      orderBy: { createdAt: 'desc' },
      include: { order: true }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Ödeme bulunamadı'
      });
    }

    return res.status(200).json({
      success: true,
      payment: {
        orderId: payment.orderId,
        status: payment.status,
        amount: payment.amount,
        paidAt: payment.paidAt,
        failureReason: payment.failureReason
      }
    });

  } catch (error) {
    console.error('Payment Status Check Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ödeme durumu sorgulanamadı',
      error: error.message
    });
  }
};

// ✅ Test Ödeme (Development only)
export const testPayment = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      message: 'Test ödeme sadece development modda kullanılabilir' 
    });
  }

  const testData = {
    user_basket: Buffer.from(JSON.stringify([
      ['Test Ürün', '10000', 1]
    ])).toString('base64'),
    user_name: 'Test Kullanıcı',
    user_address: 'Test Adres, İstanbul',
    user_phone: '05551234567',
    user_email: 'test@test.com',
    merchant_oid: 'TEST-' + Date.now(),
    payment_amount: '10000',
    user_ip: req.ip
  };

  req.body = testData;
  return createPaymentToken(req, res);
};