import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 
const CSV_DOSYA_ADI = "beden_renk_eslestirme.csv";

// ✅ BEDEN-RENK BAZLI: Her kombinasyon için ayrı resim
const headers = ["productBase", "variantSize", "variantColor", "variantImage"];
let csvContent = headers.join(",") + "\n";

function parseFileName(fileName) {
    // Dosya adından bilgileri çıkar
    // Örnekler:
    // "3360 POZDA POZ 36 Beyaz.jpg" → { base: "3360 POZDA POZ", size: "36", color: "Beyaz" }
    // "3360 POZDA POZ Beyaz 36.jpg" → { base: "3360 POZDA POZ", color: "Beyaz", size: "36" }
    // "T-SHIRT 38 Kırmızı.jpg" → { base: "T-SHIRT", size: "38", color: "Kırmızı" }
    
    const nameWithoutExt = path.parse(fileName).name;
    const parts = nameWithoutExt.split(' ');
    
    let size = null;
    let color = null;
    let base = [];
    
    // Her kelimeyi kontrol et
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Beden mi? (sadece rakamlar veya S, M, L, XL formatı)
        if (/^\d+$/.test(part)) {
            size = part;
        } else if (/^(XS|S|M|L|XL|XXL|XXXL)$/i.test(part)) {
            size = part.toUpperCase();
        } 
        // Renk olabilir mi? (son kelime veya beden sonrası)
        else {
            if (!size) {
                base.push(part); // Beden bulunamadıysa base'e ekle
            } else if (!color) {
                color = part; // Bedenden sonra gelen ilk kelime renk
            } else {
                color += ` ${part}`; // Renk birden fazla kelimeyse
            }
        }
    }
    
    // Eğer renk bulunamadıysa, son kelimeyi renk olarak al
    if (!color && base.length > 0) {
        color = base.pop();
    }
    
    return {
        base: base.join(' '),
        size: size || "",
        color: color || "Standart"
    };
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else {
            if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                const { base, size, color } = parseFileName(file);
                
                if (!base) {
                    console.log(`⚠️  ATLAND: ${file} - Ürün adı bulunamadı`);
                    return;
                }

                const row = [
                    `"${base}"`,          // productBase
                    `"${size}"`,          // variantSize
                    `"${color}"`,         // variantColor
                    `"${file}"`           // variantImage
                ];
                
                csvContent += row.join(",") + "\n";
                console.log(`📸 ${base} | ${size || 'BOŞ'} | ${color} → ${file}`);
            }
        }
    });
}

try {
    console.log("📂 Resim klasörü taranıyor...\n");
    scanDirectory(RESIM_KLASORU);
    
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log(`📊 ${csvContent.split('\n').length - 2} varyant eklendi\n`);
    
    console.log("💡 NASIL ÇALIŞIR:");
    console.log("   Sistem dosya adından şunları çıkarır:");
    console.log("   1. Ürün tabanı (renk ve beden hariç)");
    console.log("   2. Beden (36, 38, S, M, L...)");
    console.log("   3. Renk (Beyaz, Fuşya, Kırmızı...)");
    console.log("   4. Bu kombinasyonu veritabanında arar ve resmi atar\n");
    
    console.log("📝 ÖRNEK DOSYA ADLARI:");
    console.log("   ✅ '3360 POZDA POZ 36 Beyaz.jpg'");
    console.log("   ✅ '3360 POZDA POZ Beyaz 36.jpg'");
    console.log("   ✅ 'T-SHIRT 38 Kırmızı.jpg'");
    console.log("   ✅ 'POLO M Mavi.jpg'\n");
    
    console.log("⚠️  ÖNEMLİ:");
    console.log("   - Beden CSV'de BOŞ ise, o rengin TÜM bedenlerine atar");
    console.log("   - Beden belirtiliyse, SADECE o beden-renk kombinasyonuna atar\n");
    
} catch (error) {
    console.error("❌ Hata:", error.message);
}