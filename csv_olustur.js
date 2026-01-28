import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR: Resim klasörünüzün tam yolu
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 

const CSV_DOSYA_ADI = "varyant_guncelleme.csv";

// ✅ VARYANT BAZLI: Her resim bir ürünün bir varyantı
const headers = ["productCode", "variantSize", "variantColor", "variantImage", "variantStock"];
let csvContent = headers.join(",") + "\n";

// Resim adından varyant bilgilerini çıkar
function parseFileName(fileName) {
    // Örnek: "3360 POZDA POZ Beyaz.jpg" -> { code: "3360 POZDA POZ", color: "Beyaz" }
    // Örnek: "T-SHIRT S Kırmızı.jpg" -> { code: "T-SHIRT", size: "S", color: "Kırmızı" }
    
    const nameWithoutExt = path.parse(fileName).name;
    
    // Son kelime genelde renk
    const parts = nameWithoutExt.split(' ');
    const color = parts[parts.length - 1]; // Son kelime = renk
    
    // Eğer sondan 2. kelime beden ise (S, M, L, XL, XXL, STD)
    const sizePattern = /^(XS|S|M|L|XL|XXL|XXXL|STD|ONE SIZE|\d+)$/i;
    const potentialSize = parts[parts.length - 2];
    
    let size = "STD";
    let code = nameWithoutExt;
    
    if (potentialSize && sizePattern.test(potentialSize)) {
        size = potentialSize.toUpperCase();
        code = parts.slice(0, -2).join(' '); // Beden ve renk hariç kalan = ürün kodu
    } else {
        code = parts.slice(0, -1).join(' '); // Sadece renk hariç kalan = ürün kodu
    }
    
    return { code, size, color };
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
                
                const { code, size, color } = parseFileName(file);

                const row = [
                    `"${code}"`,              // productCode (Ürünü bulmak için)
                    `"${size}"`,              // variantSize (Hangi varyant?)
                    `"${color}"`,             // variantColor (Hangi renk?)
                    `"${file}"`,              // variantImage (Resim dosyası)
                    `""`                      // variantStock (Boş = değişmesin)
                ];

                csvContent += row.join(",") + "\n";
                console.log(`📸 ${code} | ${size} | ${color} → ${file}`);
            }
        }
    });
}

try {
    console.log("📂 Klasör taranıyor ve varyantlar parse ediliyor...\n");
    scanDirectory(RESIM_KLASORU);
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log(`📊 Toplam ${csvContent.split('\n').length - 2} varyant listelendi\n`);
    console.log("💡 KULLANIM:");
    console.log("   1. Bu CSV dosyasını kontrol edin");
    console.log("   2. productCode doğruysa, Admin Panelinden yükleyin");
    console.log("   3. Sistem her satır için ilgili varyantın resmini güncelleyecek\n");
    console.log("⚠️  ÖNEMLI:");
    console.log("   - Dosya adı formatı: 'ÜRÜN_KODU BEDEN Renk.jpg'");
    console.log("   - Örnek: '3360 POZDA POZ S Beyaz.jpg'");
    console.log("   - Beden yoksa: '3360 POZDA POZ Beyaz.jpg' (STD olarak alınır)\n");
} catch (error) {
    console.error("❌ Hata:", error.message);
}