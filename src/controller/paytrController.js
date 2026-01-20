import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { sendOrderConfirmationEmail } from '../utils/emailService.js';

const prisma = new PrismaClient();

// ✅ PayTR Konfigürasyonu
const PAYTR_CONFIG = {
  merchant_id: process.env.PAYTR_MERCHANT_ID,
  merchant_key: process.env.PAYTR_MERCHANT_KEY,
  merchant_salt: process.env.PAYTR_MERCHANT_SALT,
  test_mode: process.env.PAYTR_TEST_MODE === 'true' ? '1' : '0',
  iframe_url: 'https://www.paytr.com/odeme/guvenli/',
};

export const createPaymentToken = async (req, res) => {
  try {
    const { 
      user_basket, user_name, user_address, user_phone, user_email,
      merchant_oid, payment_amount, user_ip 
    } = req.body;

    // Backend URL (Canlı adresiniz)
    const BACKEND_URL = "https://bigboss-backend.onrender.com";

    // Token İsteği Seçenekleri
    const options = {
      method: 'POST',
      uri: PAYTR_CONFIG.iframe_url,
      form: {
        merchant_id: PAYTR_CONFIG.merchant_id,
        user_ip: user_ip || '0.0.0.0',
        merchant_oid: merchant_oid,
        email: user_email,
        payment_amount: payment_amount,
        paytr_token: "", // Hesapla aşağıda
        user_basket: user_basket,
        debug_on: 1,
        no_installment: 0,
        max_installment: 0,
        user_name: user_name,
        user_address: user_address,
        user_phone: user_phone,
        
        // 🔴 İŞTE BURASI: PayTR işlemi bitince Backend'e dönsün
        merchant_ok_url: `${BACKEND_URL}/api/paytr/success`,
        merchant_fail_url: `${BACKEND_URL}/api/paytr/fail`,
        
        timeout_limit: 30,
        currency: 'TL',
        test_mode: PAYTR_CONFIG.test_mode
      }
    };

    // Hash Hesaplama
    const hashSTR = `${PAYTR_CONFIG.merchant_id}${user_ip || '0.0.0.0'}${merchant_oid}${user_email}${payment_amount}${options.form.user_basket}${options.form.no_installment}${options.form.max_installment}${options.form.currency}${PAYTR_CONFIG.test_mode}`;
    const paytr_token = crypto.createHmac('sha256', PAYTR_CONFIG.merchant_key).update(hashSTR + PAYTR_CONFIG.merchant_salt).digest('base64');
    options.form.paytr_token = paytr_token;

    // PayTR'den Token İste
    const result = await request(options);
    const parsedResult = JSON.parse(result);

    if (parsedResult.status === 'success') {
      res.json({ success: true, iframe_url: `https://www.paytr.com/odeme/guvenli/${parsedResult.token}` });
    } else {
      res.status(400).json({ success: false, message: parsedResult.reason });
    }

  } catch (error) {
    console.error("PayTR Token Error:", error);
    res.status(500).json({ success: false, message: "Ödeme başlatılamadı" });
  }
};


// ✅ PayTR Callback (IPN - Instant Payment Notification)
export const paytrCallback = async (req, res) => {
  try {
    const { merchant_oid, status, total_amount, hash, failed_reason_msg } = req.body;

    // Hash Doğrulama
    const hashSTR = merchant_oid + PAYTR_CONFIG.merchant_salt + status + total_amount;
    const calculated_hash = crypto.createHmac('sha256', PAYTR_CONFIG.merchant_key).update(hashSTR).digest('base64');

    if (hash !== calculated_hash) {
      return res.status(400).send('PAYTR notification failed: bad hash');
    }

    // Payment kaydını bul
    const payment = await prisma.payment.findFirst({
      where: { orderId: parseInt(merchant_oid) },
      orderBy: { createdAt: 'desc' }
    });

    if (status === 'success') {
      // 1. Ödemeyi Güncelle
      if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'SUCCESS', paidAt: new Date(), totalAmount: parseFloat(total_amount) / 100 }
        });
      }

      // 2. Siparişi Güncelle
      const updatedOrder = await prisma.order.update({
        where: { id: parseInt(merchant_oid) },
        data: { 
          status: 'SIPARIS_ALINDI', 
          paymentStatus: 'SUCCESS' 
        },
        include: { user: true }
      });

      // 3. 🛡️ GÜVENLİ MAİL GÖNDERİMİ (Try-Catch Eklendi)
      try {
          if (updatedOrder.user && updatedOrder.user.email) {
              console.log(`📧 Ödeme Onaylandı. Mail gönderiliyor: ${updatedOrder.user.email}`);
              await sendOrderConfirmationEmail(updatedOrder, updatedOrder.user);
          }
      } catch (mailError) {
          console.error("⚠️ Mail gönderilemedi (Ödeme başarılı):", mailError);
      }
      return res.status(200).send('OK');
      
    } else {
      // Başarısız Durum
      if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED', failureReason: failed_reason_msg || 'Hata' }
        });
      }
      
      await prisma.order.update({
        where: { id: parseInt(merchant_oid) },
        data: { paymentStatus: 'FAILED' }
      });

      return res.status(200).send('OK');
    }

  } catch (error) {
    // 500 hatasının sebebi buraya düşmesiydi. Artık mail hatası buraya düşürmeyecek.
    console.error('Callback Critical Error:', error);
    return res.status(500).send('Error');
  }
};
// ✅ Ödeme Durumu Sorgulama
export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { orderId: parseInt(orderId) },
      orderBy: { createdAt: 'desc' }, // En son ödeme denemesi
      include: {
        order: true
      }
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

// ✅ Test Ödeme (Sadece development için)
export const testPayment = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Test ödeme sadece development modda kullanılabilir' });
  }

  const testData = {
    user_basket: Buffer.from(JSON.stringify([
      ['Test Ürün', '10000', 1] // 100.00 TL (kuruş cinsinden)
    ])).toString('base64'),
    user_name: 'Test Kullanıcı',
    user_address: 'Test Adres, İstanbul',
    user_phone: '05551234567',
    user_email: 'test@test.com',
    merchant_oid: 'TEST-' + Date.now(),
    payment_amount: '10000', // 100.00 TL (kuruş cinsinden)
    user_ip: req.ip
  };

  req.body = testData;
  return createPaymentToken(req, res);
};

export const handlePaymentSuccess = (req, res) => {
  // PayTR POST body'sinden sipariş numarasını alıyoruz
  const merchant_oid = req.body.merchant_oid; 

  const htmlContent = `
    <html>
      <body>
        <script>
          // Mesaja sipariş numarasını da ekliyoruz
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

export const handlePaymentFail = (req, res) => {
  const reason = req.body.failed_reason_msg || 'Ödeme başarısız';
  // Hata durumunda da ekleyelim (Opsiyonel)
  const merchant_oid = req.body.merchant_oid;

  const htmlContent = `
    <html>
      <body>
        <script>
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