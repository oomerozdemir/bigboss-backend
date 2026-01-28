import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR: Resim klasörünüzün tam yolu
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 

const CSV_DOSYA_ADI = "varyant_resim_eslestirme.csv";

// Sütun Başlıkları
const headers = ["productCode", "imageName"];
let csvContent = headers.join(",") + "\n";

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath); // Alt klasörlere gir
        } else {
            // Sadece resim dosyaları
            if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                
                // Dosya adından uzantıyı çıkarıp kod olarak alıyoruz
                const productCode = path.parse(file).name;
                
                const row = [
                    `"${productCode}"`,  // Ürün Kodu
                    `"${file}"`          // Dosya Adı
                ];

                csvContent += row.join(",") + "\n";
                console.log(`📸 Bulundu: ${productCode} -> ${file}`);
            }
        }
    });
}

try {
    console.log("📂 Klasör taranıyor...");
    scanDirectory(RESIM_KLASORU);
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log("👉 Admin Panel > Toplu Yükleme sayfasından bu dosyayı seçin.");
} catch (error) {
    console.error("Hata:", error.message);
}