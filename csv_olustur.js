import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 
const CSV_DOSYA_ADI = "renk_bazli_yukleme.csv";

// ✅ RENK BAZLI: Bir resim = tüm bedenler
const headers = ["productBase", "variantColor", "variantImage"];
let csvContent = headers.join(",") + "\n";

// Ürün renklerini grupla
const productGroups = new Map();

function parseFileName(fileName) {
    // Örnek: "3360 POZDA POZ Beyaz.jpg" → { base: "3360 POZDA POZ", color: "Beyaz" }
    // Örnek: "T-SHIRT Kırmızı.jpg" → { base: "T-SHIRT", color: "Kırmızı" }
    
    const nameWithoutExt = path.parse(fileName).name;
    const parts = nameWithoutExt.split(' ');
    
    // Son kelime genelde renk
    const color = parts[parts.length - 1];
    const base = parts.slice(0, -1).join(' ');
    
    return { base, color };
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
                const { base, color } = parseFileName(file);
                
                // Gruplama: Aynı baz ürün ve renk için sadece 1 resim
                const key = `${base}|${color}`;
                
                if (!productGroups.has(key)) {
                    productGroups.set(key, {
                        base,
                        color,
                        image: file
                    });
                }
            }
        }
    });
}

try {
    console.log("📂 Resim klasörü taranıyor ve renkler gruplanıyor...\n");
    scanDirectory(RESIM_KLASORU);
    
    // CSV'ye yaz
    productGroups.forEach((item) => {
        const row = [
            `"${item.base}"`,       // Ürün tabanı (renk hariç)
            `"${item.color}"`,      // Renk
            `"${item.image}"`       // Resim
        ];
        
        csvContent += row.join(",") + "\n";
        console.log(`🎨 ${item.base} | Renk: ${item.color} → ${item.image}`);
    });
    
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log(`📊 ${productGroups.size} renk grubu listelendi\n`);
    
    console.log("💡 NASIL ÇALIŞIR:");
    console.log("   1. CSV'deki her satır bir RENK'i temsil eder");
    console.log("   2. Sistem o rengin TÜM bedenlerine aynı resmi atar");
    console.log("   3. Aynı resmi tekrar tekrar yüklemeye gerek yok!\n");
    
    console.log("📝 ÖRNEK:");
    console.log("   CSV: '3360 POZDA POZ', 'Beyaz', 'foto.jpg'");
    console.log("   Sonuç: TÜM beyaz varyantlar (36, 38, 40...) bu resmi alır\n");
    
} catch (error) {
    console.error("❌ Hata:", error.message);
}