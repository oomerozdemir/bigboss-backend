import nodemailer from 'nodemailer';

// ✅ Email Transporter Oluştur
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // veya 'smtp.gmail.com'
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER, // Gmail adresiniz
      pass: process.env.EMAIL_PASS, // Gmail App Password
    },
  });
};

// ✅ 1. SİPARİŞ ALINDI E-POSTASI
export const sendOrderConfirmationEmail = async (order, user) => {
  try {
    const transporter = createTransporter();

    const orderItemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${item.product.name}</strong><br>
          <small style="color: #666;">${item.variant || ''}</small>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ${parseFloat(item.price).toFixed(2)} TL
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          <strong>${(parseFloat(item.price) * item.quantity).toFixed(2)} TL</strong>
        </td>
      </tr>
    `).join('');

    const mailOptions = {
      from: {
        name: 'Big Boss',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: `✅ Siparişiniz Alındı - Sipariş No: #${order.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Big Boss</h1>
                      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Siparişiniz Alındı! 🎉</p>
                    </td>
                  </tr>

                  <!-- İçerik -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                        Merhaba <strong>${user.name}</strong>,
                      </p>
                      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 30px 0;">
                        Siparişiniz başarıyla alındı ve hazırlanmaya başlandı. 
                        Ürünleriniz en kısa sürede kargoya teslim edilecektir.
                      </p>

                      <!-- Sipariş Bilgileri -->
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📦 Sipariş Detayları</h3>
                        <table width="100%" cellpadding="5" cellspacing="0">
                          <tr>
                            <td style="color: #666; font-size: 14px;">Sipariş No:</td>
                            <td style="color: #333; font-weight: bold; text-align: right; font-size: 14px;">#${order.id}</td>
                          </tr>
                          <tr>
                            <td style="color: #666; font-size: 14px;">Sipariş Tarihi:</td>
                            <td style="color: #333; text-align: right; font-size: 14px;">
                              ${new Date(order.createdAt).toLocaleDateString('tr-TR', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #666; font-size: 14px;">Durum:</td>
                            <td style="color: #28a745; text-align: right; font-weight: bold; font-size: 14px;">✓ Sipariş Alındı</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Ürünler -->
                      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">🛍️ Sipariş İçeriği</h3>
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                        <thead>
                          <tr style="background-color: #f8f9fa;">
                            <th style="padding: 12px 10px; text-align: left; font-size: 12px; color: #666; font-weight: 600;">ÜRÜN</th>
                            <th style="padding: 12px 10px; text-align: center; font-size: 12px; color: #666; font-weight: 600;">ADET</th>
                            <th style="padding: 12px 10px; text-align: right; font-size: 12px; color: #666; font-weight: 600;">FİYAT</th>
                            <th style="padding: 12px 10px; text-align: right; font-size: 12px; color: #666; font-weight: 600;">TOPLAM</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${orderItemsHtml}
                        </tbody>
                      </table>

                      <!-- Toplam -->
                      <table width="100%" cellpadding="5" cellspacing="0" style="margin-bottom: 30px;">
                        ${order.discountAmount && parseFloat(order.discountAmount) > 0 ? `
                          <tr>
                            <td style="text-align: right; padding: 5px; color: #666;">Ara Toplam:</td>
                            <td style="text-align: right; padding: 5px; width: 120px; color: #666;">
                              ${(parseFloat(order.total) + parseFloat(order.discountAmount)).toFixed(2)} TL
                            </td>
                          </tr>
                          <tr>
                            <td style="text-align: right; padding: 5px; color: #28a745;">
                              İndirim ${order.couponCode ? `(${order.couponCode})` : ''}:
                            </td>
                            <td style="text-align: right; padding: 5px; width: 120px; color: #28a745;">
                              -${parseFloat(order.discountAmount).toFixed(2)} TL
                            </td>
                          </tr>
                        ` : ''}
                        <tr style="border-top: 2px solid #333;">
                          <td style="text-align: right; padding: 10px 5px; font-size: 18px; font-weight: bold; color: #333;">
                            Genel Toplam:
                          </td>
                          <td style="text-align: right; padding: 10px 5px; width: 120px; font-size: 18px; font-weight: bold; color: #667eea;">
                            ${parseFloat(order.total).toFixed(2)} TL
                          </td>
                        </tr>
                      </table>

                      <!-- Teslimat Adresi -->
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📍 Teslimat Adresi</h3>
                        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                          ${order.addressSnapshot.replace(/\n/g, '<br>')}
                        </p>
                      </div>

                      <!-- Buton -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <a href="${process.env.FRONTEND_URL}/siparislerim" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                      color: #ffffff; 
                                      padding: 15px 40px; 
                                      text-decoration: none; 
                                      border-radius: 25px; 
                                      font-weight: bold;
                                      display: inline-block;
                                      font-size: 16px;">
                              Siparişimi Takip Et
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                        Sorularınız için bizimle iletişime geçebilirsiniz:
                      </p>
                      <p style="margin: 0 0 5px 0; color: #667eea; font-size: 14px;">
                        <strong>📧 info@bigboss.com.tr</strong>
                      </p>
                      <p style="margin: 0 0 20px 0; color: #667eea; font-size: 14px;">
                        <strong>📞 0850 123 45 67</strong>
                      </p>
                      <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} Big Boss. Tüm hakları saklıdır.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Sipariş Onay E-postası Gönderildi:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ E-posta Gönderme Hatası:', error);
    return { success: false, error: error.message };
  }
};

// ✅ 2. KARGOYA VERİLDİ E-POSTASI
export const sendOrderShippedEmail = async (order, user, trackingNumber = null) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'Big Boss',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: `📦 Siparişiniz Kargoya Verildi - Sipariş No: #${order.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📦 Kargoda!</h1>
                      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Siparişiniz Yolda</p>
                    </td>
                  </tr>

                  <!-- İçerik -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                        Merhaba <strong>${user.name}</strong>,
                      </p>
                      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 30px 0;">
                        Harika haber! Siparişiniz kargoya verildi ve en kısa sürede adresinize teslim edilecek. 🚚
                      </p>

                      <!-- Durum Çubuğu -->
                      <div style="margin-bottom: 40px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                          <div style="text-align: center; flex: 1;">
                            <div style="width: 40px; height: 40px; background-color: #28a745; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">✓</div>
                            <p style="margin: 0; font-size: 12px; color: #28a745; font-weight: bold;">Sipariş Alındı</p>
                          </div>
                          <div style="text-align: center; flex: 1;">
                            <div style="width: 40px; height: 40px; background-color: #28a745; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">✓</div>
                            <p style="margin: 0; font-size: 12px; color: #28a745; font-weight: bold;">Hazırlandı</p>
                          </div>
                          <div style="text-align: center; flex: 1;">
                            <div style="width: 40px; height: 40px; background-color: #ffc107; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">📦</div>
                            <p style="margin: 0; font-size: 12px; color: #ffc107; font-weight: bold;">Kargoda</p>
                          </div>
                          <div style="text-align: center; flex: 1;">
                            <div style="width: 40px; height: 40px; background-color: #ddd; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">🏠</div>
                            <p style="margin: 0; font-size: 12px; color: #999;">Teslim Edilecek</p>
                          </div>
                        </div>
                      </div>

                      <!-- Sipariş Bilgileri -->
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📦 Kargo Bilgileri</h3>
                        <table width="100%" cellpadding="5" cellspacing="0">
                          <tr>
                            <td style="color: #666; font-size: 14px;">Sipariş No:</td>
                            <td style="color: #333; font-weight: bold; text-align: right; font-size: 14px;">#${order.id}</td>
                          </tr>
                          ${trackingNumber ? `
                            <tr>
                              <td style="color: #666; font-size: 14px;">Takip No:</td>
                              <td style="color: #667eea; font-weight: bold; text-align: right; font-size: 14px;">${trackingNumber}</td>
                            </tr>
                          ` : ''}
                          <tr>
                            <td style="color: #666; font-size: 14px;">Kargo Firması:</td>
                            <td style="color: #333; text-align: right; font-size: 14px;">Aras Kargo</td>
                          </tr>
                          <tr>
                            <td style="color: #666; font-size: 14px;">Tahmini Teslimat:</td>
                            <td style="color: #333; text-align: right; font-size: 14px;">2-3 İş Günü</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Teslimat Adresi -->
                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 30px;">
                        <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">📍 Teslimat Adresi</h4>
                        <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                          ${order.addressSnapshot.replace(/\n/g, '<br>')}
                        </p>
                      </div>

                      <!-- Butonlar -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 10px;">
                            ${trackingNumber ? `
                              <a href="https://kargotakip.araskargo.com.tr/mainpage.aspx" 
                                 target="_blank"
                                 style="background-color: #ffc107; 
                                        color: #000; 
                                        padding: 15px 30px; 
                                        text-decoration: none; 
                                        border-radius: 25px; 
                                        font-weight: bold;
                                        display: inline-block;
                                        margin: 5px;
                                        font-size: 14px;">
                                🔍 Kargom Nerede?
                              </a>
                            ` : ''}
                            <a href="${process.env.FRONTEND_URL}/siparislerim" 
                               style="background-color: #667eea; 
                                      color: #ffffff; 
                                      padding: 15px 30px; 
                                      text-decoration: none; 
                                      border-radius: 25px; 
                                      font-weight: bold;
                                      display: inline-block;
                                      margin: 5px;
                                      font-size: 14px;">
                              📋 Siparişlerim
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- İpucu -->
                      <div style="background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin-top: 30px;">
                        <p style="margin: 0; color: #0c5460; font-size: 13px;">
                          <strong>💡 İpucu:</strong> Kargo teslim edilirken adresinizde bulunmanızı rica ederiz. 
                          Aksi takdirde kargo şubeye geri götürülecektir.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                        İyi günlerde kullanın! ❤️
                      </p>
                      <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} Big Boss. Tüm hakları saklıdır.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Kargo E-postası Gönderildi:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Kargo E-postası Hatası:', error);
    return { success: false, error: error.message };
  }
};

// ✅ 3. TESLİM EDİLDİ E-POSTASI
export const sendOrderDeliveredEmail = async (order, user) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'Big Boss',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: `🎉 Siparişiniz Teslim Edildi - Sipariş No: #${order.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center;">
                      <div style="font-size: 60px; margin-bottom: 10px;">🎉</div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Teslim Edildi!</h1>
                      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">İyi Günlerde Kullanın</p>
                    </td>
                  </tr>

                  <!-- İçerik -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                        Merhaba <strong>${user.name}</strong>,
                      </p>
                      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 30px 0;">
                        Harika! Siparişiniz başarıyla teslim edildi. Ürünlerinizin keyfini çıkarın! 🛍️
                      </p>

                      <!-- Başarı İkonu -->
                      <div style="text-align: center; margin: 30px 0;">
                        <div style="width: 100px; height: 100px; background-color: #28a745; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                          <span style="color: white; font-size: 50px;">✓</span>
                        </div>
                        <p style="margin: 20px 0 0 0; color: #28a745; font-size: 18px; font-weight: bold;">
                          Teslimat Tamamlandı
                        </p>
                      </div>

                      <!-- Sipariş Özeti -->
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Sipariş Özeti</h3>
                        <table width="100%" cellpadding="5" cellspacing="0">
                          <tr>
                            <td style="color: #666; font-size: 14px;">Sipariş No:</td>
                            <td style="color: #333; font-weight: bold; text-align: right; font-size: 14px;">#${order.id}</td>
                          </tr>
                          <tr>
                            <td style="color: #666; font-size: 14px;">Sipariş Tarihi:</td>
                            <td style="color: #333; text-align: right; font-size: 14px;">
                              ${new Date(order.createdAt).toLocaleDateString('tr-TR')}
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #666; font-size: 14px;">Teslimat Tarihi:</td>
                            <td style="color: #333; text-align: right; font-size: 14px;">
                              ${new Date().toLocaleDateString('tr-TR')}
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #666; font-size: 14px;">Toplam Tutar:</td>
                            <td style="color: #667eea; font-weight: bold; text-align: right; font-size: 16px;">
                              ${parseFloat(order.total).toFixed(2)} TL
                            </td>
                          </tr>
                        </table>
                      </div>

                      <!-- Değerlendirme Daveti -->
                      <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); border-radius: 8px; padding: 25px; text-align: center; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 10px 0; color: #8b4513; font-size: 20px;">⭐ Deneyiminizi Paylaşın</h3>
                        <p style="margin: 0 0 20px 0; color: #8b4513; font-size: 14px;">
                          Memnuniyetiniz bizim için çok önemli! Ürünlerimiz hakkında görüşlerinizi paylaşır mısınız?
                        </p>
                        <a href="${process.env.FRONTEND_URL}/siparislerim" 
                           style="background-color: #8b4513; 
                                  color: #ffffff; 
                                  padding: 12px 30px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-weight: bold;
                                  display: inline-block;
                                  font-size: 14px;">
                          ⭐ Değerlendir
                        </a>
                      </div>

                      <!-- Öneriler -->
                      <div style="border: 2px dashed #ddd; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px; text-align: center;">
                          🎁 Sizin İçin Seçtiklerimiz
                        </h3>
                        <p style="margin: 0 0 15px 0; color: #666; font-size: 13px; text-align: center;">
                          Beğeneceğinizi düşündüğümüz yeni ürünlere göz atın!
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${process.env.FRONTEND_URL}/products" 
                                 style="background-color: #667eea; 
                                        color: #ffffff; 
                                        padding: 12px 25px; 
                                        text-decoration: none; 
                                        border-radius: 20px; 
                                        font-weight: bold;
                                        display: inline-block;
                                        font-size: 13px;">
                                🛍️ Alışverişe Devam Et
                              </a>
                            </td>
                          </tr>
                        </table>
                      </div>

                      <!-- İletişim -->
                      <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px;">
                        <p style="margin: 0; color: #1565c0; font-size: 13px;">
                          <strong>📞 Yardıma mı ihtiyacınız var?</strong><br>
                          Herhangi bir sorunuz veya sorununuz varsa, müşteri hizmetlerimiz size yardımcı olmaktan mutluluk duyar.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                      <p style="margin: 0 0 15px 0; color: #333; font-size: 16px; font-weight: bold;">
                        Bizi Seçtiğiniz İçin Teşekkürler! ❤️
                      </p>
                      <p style="margin: 0 0 5px 0; color: #667eea; font-size: 14px;">
                        <strong>📧 info@bigboss.com.tr</strong>
                      </p>
                      <p style="margin: 0 0 20px 0; color: #667eea; font-size: 14px;">
                        <strong>📞 0850 123 45 67</strong>
                      </p>
                      
                      <!-- Sosyal Medya -->
                      <div style="margin: 20px 0;">
                        <a href="#" style="display: inline-block; margin: 0 10px;">
                          <img src="https://via.placeholder.com/30/3b5998/fff?text=f" alt="Facebook" style="width: 30px; height: 30px; border-radius: 50%;">
                        </a>
                        <a href="#" style="display: inline-block; margin: 0 10px;">
                          <img src="https://via.placeholder.com/30/E1306C/fff?text=i" alt="Instagram" style="width: 30px; height: 30px; border-radius: 50%;">
                        </a>
                        <a href="#" style="display: inline-block; margin: 0 10px;">
                          <img src="https://via.placeholder.com/30/1DA1F2/fff?text=t" alt="Twitter" style="width: 30px; height: 30px; border-radius: 50%;">
                        </a>
                      </div>

                      <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} Big Boss. Tüm hakları saklıdır.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Teslimat E-postası Gönderildi:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Teslimat E-postası Hatası:', error);
    return { success: false, error: error.message };
  }
};

// ✅ 4. SİPARİŞ İPTAL EDİLDİ E-POSTASI (Bonus)
export const sendOrderCancelledEmail = async (order, user, reason = '') => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'Big Boss',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: `❌ Sipariş İptal Edildi - Sipariş No: #${order.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">
                  <tr>
                    <td style="background-color: #dc3545; padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0;">Sipariş İptal Edildi</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px;">
                      <p>Merhaba <strong>${user.name}</strong>,</p>
                      <p>Siparişiniz (#${order.id}) iptal edilmiştir.</p>
                      ${reason ? `<p><strong>İptal Nedeni:</strong> ${reason}</p>` : ''}
                      <p>Ödeme yaptıysanız, iade işlemi 3-5 iş günü içinde hesabınıza yansıyacaktır.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ İptal E-postası Gönderildi:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ İptal E-postası Hatası:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail
};