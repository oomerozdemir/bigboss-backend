import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 
const CSV_DOSYA_ADI = "varyant_guncelleme_v2.csv";

// ✅ YENİ FORMAT: Renk artık productCode'un parçası
const headers = ["productCode", "variantSize", "variantImage"];
let csvContent = headers.join(",") + "\n";

// Resim adından bilgileri çıkar
function parseFileName(fileName) {
    // Örnek: "3360 POZDA POZ Beyaz.jpg" 
    // Örnek: "T-SHIRT 36 Kırmızı.jpg"
    
    const nameWithoutExt = path.parse(fileName).name;
    const parts = nameWithoutExt.split(' ');
    
    // SENARYO 1: Dosya adında BEDEN varsa (sayısal)
    // Örnek: "3360 POZDA POZ 36 Beyaz.jpg"
    const bedenIndex = parts.findIndex(p => /^\d+$/.test(p)); // Sadece rakamlardan oluşan
    
    if (bedenIndex !== -1) {
        const beden = parts[bedenIndex];
        const productCode = parts.slice(0, bedenIndex).join(' '); // Bedenden önceki kısım
        const renk = parts.slice(bedenIndex + 1).join(' '); // Bedenden sonraki kısım
        
        // productCode'a renk de eklenir (çünkü Beyaz ve Fuşya ayrı ürünler)
        const fullProductCode = renk ? `${productCode} ${renk}` : productCode;
        
        return { 
            productCode: fullProductCode, 
            size: beden 
        };
    }
    
    // SENARYO 2: Dosya adında BEDEN yoksa
    // Örnek: "3360 POZDA POZ Beyaz.jpg"
    // Tüm dosya adı = productCode, beden = "STD" veya boş
    return { 
        productCode: nameWithoutExt, 
        size: "" // Beden bilgisi yok, CSV'de boş bırakılacak
    };
}

function scanDirectory(dir, categoryChain = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath, [...categoryChain, file]);
        } else {
            if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                
                const { productCode, size } = parseFileName(file);

                const row = [
                    `"${productCode}"`,       // Tam ürün adı (renk dahil)
                    `"${size}"`,              // Sadece beden (36, 38, 40...)
                    `"${file}"`               // Resim dosyası
                ];

                csvContent += row.join(",") + "\n";
                console.log(`📸 Ürün: "${productCode}" | Beden: ${size || 'YOK'} | Dosya: ${file}`);
            }
        }
    });
}

try {
    console.log("📂 Resim klasörü taranıyor...\n");
    scanDirectory(RESIM_KLASORU);
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log(`📊 Toplam ${csvContent.split('\n').length - 2} satır eklendi\n`);
    
    console.log("💡 ÖRNEKLER:");
    console.log("   Dosya: '3360 POZDA POZ 36 Beyaz.jpg'");
    console.log("   → productCode: '3360 POZDA POZ Beyaz'");
    console.log("   → variantSize: '36'\n");
    
    console.log("   Dosya: '3360 POZDA POZ Beyaz.jpg'");
    console.log("   → productCode: '3360 POZDA POZ Beyaz'");
    console.log("   → variantSize: '' (boş - tüm bedenlere uygulanır)\n");
    
    console.log("⚠️  ÖNEMLİ:");
    console.log("   - Eğer BEDEN bilgisi CSV'de BOŞ ise, o ürünün TÜM varyantlarına resim uygulanır");
    console.log("   - Eğer BEDEN belirtilmişse, sadece o bedene resim uygulanır\n");
    
} catch (error) {
    console.error("❌ Hata:", error.message);
}