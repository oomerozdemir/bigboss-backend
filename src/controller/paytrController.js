// src/controller/paytrController.js - MEVCUT YAPIYA UYARLANMIŞ
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { sendOrderConfirmationEmail } from '../utils/emailService';

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
      user_basket, 
      user_name, 
      user_address, 
      user_phone, 
      user_email,
      merchant_oid, // Frontend'den gelen Sipariş ID (örn: 15)
      payment_amount, 
      user_ip 
    } = req.body;

    console.log("PayTR İsteği Geldi:", req.body); // Debug için log

    // 1. Validasyon
    if (!merchant_oid || !payment_amount || !user_email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Eksik ödeme bilgisi (merchant_oid, amount veya email eksik)' 
      });
    }

    // 2. Siparişin veritabanında olup olmadığını kontrol et
    const order = await prisma.order.findUnique({
      where: { id: parseInt(merchant_oid) }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Sipariş bulunamadı (ID: ${merchant_oid})`
      });
    }

    // 3. PayTR Parametreleri
    const merchant_id = PAYTR_CONFIG.merchant_id;
    const merchant_key = PAYTR_CONFIG.merchant_key;
    const merchant_salt = PAYTR_CONFIG.merchant_salt;
    
    const merchant_ok_url = `${process.env.FRONTEND_URL}/payment-success`;
    const merchant_fail_url = `${process.env.FRONTEND_URL}/payment-failed`;
    
    const user_ip_address = user_ip || req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const amountStr = payment_amount.toString(); // String olmalı

    // 4. Hash Oluşturma (Sıralama Çok Önemli!)
    // merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    const hashSTR = 
      merchant_id + 
      user_ip_address + 
      merchant_oid + 
      user_email + 
      amountStr + 
      (user_basket || '') + 
      '0' + // no_installment
      '0' + // max_installment
      'TL' + 
      PAYTR_CONFIG.test_mode;
    
    const paytr_token = hashSTR + merchant_salt;
    const token = crypto.createHmac('sha256', merchant_key).update(paytr_token).digest('base64');

    // 5. PayTR API'ye İstek
    const paytr_data = {
      merchant_id,
      user_ip: user_ip_address,
      merchant_oid,
      email: user_email,
      payment_amount: amountStr,
      paytr_token: token,
      user_basket: user_basket || '',
      debug_on: '1',
      test_mode: PAYTR_CONFIG.test_mode,
      no_installment: '0',
      max_installment: '0',
      user_name,
      user_address,
      user_phone,
      merchant_ok_url,
      merchant_fail_url,
      timeout_limit: '30',
      currency: 'TL',
      lang: 'tr',
      payment_type: 'card'
    };

    const formData = new URLSearchParams(paytr_data);

    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Başarılı ise Payment kaydı oluştur (Opsiyonel, hata verirse burayı try-catch içine alabilirsiniz)
      try {
        await prisma.payment.create({
          data: {
            orderId: parseInt(merchant_oid),
            userId: req.user?.id || order.userId,
            amount: parseFloat(payment_amount) / 100,
            status: 'PENDING',
            paytrToken: result.token,
            paymentMethod: 'PAYTR',
          }
        });
      } catch (dbError) {
        console.error("Payment kayıt hatası:", dbError);
        // Payment kaydı oluşmasa bile token dönsün, akış bozulmasın
      }

      return res.status(200).json({
        success: true,
        token: result.token,
        iframe_url: PAYTR_CONFIG.iframe_url + result.token
      });
    } else {
      console.error("PayTR Token Hatası:", result.reason);
      return res.status(400).json({
        success: false,
        message: result.reason || 'PayTR token oluşturulamadı'
      });
    }

  } catch (error) {
    console.error('PayTR Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    });
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