import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
// fetch importu Node.js sürümüne göre gereksiz olabilir ama kalsın
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

    console.log("PayTR Token İsteği Başladı:", merchant_oid);

    const BACKEND_URL = "https://bigboss-backend.onrender.com"; // Canlı URL'niz

    // Zorunlu alanlar
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
    
    // Yönlendirme Ayarları
    params.append('merchant_ok_url', `${BACKEND_URL}/api/paytr/success`);
    params.append('merchant_fail_url', `${BACKEND_URL}/api/paytr/fail`);
    
    params.append('timeout_limit', '30');
    params.append('currency', currency);
    params.append('test_mode', PAYTR_CONFIG.test_mode);

    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      body: params
    });

    const result = await response.json();

    if (result.status === 'success') {
      res.json({ 
        success: true, 
        iframe_url: `${PAYTR_CONFIG.iframe_base_url}${result.token}` 
      });
    } else {
      console.error("PayTR Token Hatası:", result.reason);
      res.status(400).json({ success: false, message: result.reason });
    }

  } catch (error) {
    console.error("PayTR Sunucu Hatası:", error);
    res.status(500).json({ success: false, message: "Sunucu hatası: " + error.message });
  }
};

// 2. CALLBACK (HATA BURADAYDI, DÜZELTİLDİ)
export const paytrCallback = async (req, res) => {
  try {
    const { merchant_oid, status, total_amount, hash } = req.body;
    
    // Hash Doğrulama
    const hashSTR = merchant_oid + PAYTR_CONFIG.merchant_salt + status + total_amount;
    const calculated_hash = crypto.createHmac('sha256', PAYTR_CONFIG.merchant_key).update(hashSTR).digest('base64');

    if (hash !== calculated_hash) {
      return res.status(400).send('PAYTR notification failed: bad hash');
    }

    const orderIdRaw = merchant_oid.replace(/\D/g, '');
    const orderId = orderIdRaw ? parseInt(orderIdRaw) : null;

    if (!orderId) {
       console.error("Geçersiz Sipariş ID:", merchant_oid);
       return res.status(200).send('OK');
    }

    // İlgili Payment kaydını bul (varsa)
    const payment = await prisma.payment.findFirst({
        where: { orderId: orderId }
    });

    if (status === 'success') {
      
      // A. Payment Tablosunu Güncelle (Burada paidAt var ✅)
      if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: { 
                status: 'SUCCESS', 
                paidAt: new Date(), // <-- Burası doğru, Payment modelinde bu alan var
                totalAmount: parseFloat(total_amount) / 100 
            }
        });
      }

      // B. Order Tablosunu Güncelle (🔴 paidAt KALDIRILDI)
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'SIPARIS_ALINDI', 
          paymentStatus: 'SUCCESS',
          // paidAt: new Date()  <-- BU SATIR HATALIYDI VE SİLİNDİ
        },
        include: { user: true } 
      });

      // Mail Gönderimi
      try {
          if (updatedOrder.user?.email) {
            await sendOrderConfirmationEmail(updatedOrder, updatedOrder.user);
          }
      } catch (e) { console.error("Mail hatası:", e); }

    } else {
      // Başarısız Durum
      await prisma.order.update({
        where: { id: orderId },
        data: { 
            status: 'ODEME_BEKLENIYOR', // veya IPTAL_EDILDI
            paymentStatus: 'FAILED' 
        }
      });
      
      if (payment) {
          await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED' }
          });
      }
    }
    
    // PayTR'ye mutlaka OK dönmeliyiz
    res.status(200).send('OK');

  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).send('Error');
  }
};

// 3. YARDIMCI ENDPOINTLER
export const checkPaymentStatus = async (req, res) => res.status(200).json({ message: "OK" });
export const testPayment = async (req, res) => res.status(200).json({ message: "OK" });

// 4. BAŞARILI ÖDEME YÖNLENDİRMESİ
export const handlePaymentSuccess = (req, res) => {
  const body = req.body || {};
  const query = req.query || {};
  const merchant_oid = body.merchant_oid || query.merchant_oid || '';

  const htmlContent = `
    <html>
      <body>
        <script>
          window.parent.postMessage(JSON.stringify({ 
            status: 'success', 
            merchant_oid: "${merchant_oid}" 
          }), '*');
        </script>
        <div style="text-align:center; padding:20px; font-family:sans-serif;">
          <h3>Ödeme Başarılı!</h3>
          <p>Yönlendiriliyorsunuz...</p>
        </div>
      </body>
    </html>
  `;
  res.send(htmlContent);
};

// 5. BAŞARISIZ ÖDEME YÖNLENDİRMESİ
export const handlePaymentFail = (req, res) => {
  const body = req.body || {};
  const query = req.query || {};
  const reason = body.failed_reason_msg || query.failed_reason_msg || 'İşlem başarısız';
  const merchant_oid = body.merchant_oid || query.merchant_oid || '';

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
        <div style="text-align:center; padding:20px; font-family:sans-serif; color:red;">
          <h3>Ödeme Başarısız</h3>
          <p>${reason}</p>
        </div>
      </body>
    </html>
  `;
  res.send(htmlContent);
};