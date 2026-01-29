import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 
const CSV_DOSYA_ADI = "beden_renk_eslestirme.csv";

const headers = ["productBase", "variantSize", "variantColor", "variantImage"];
let csvContent = headers.join(",") + "\n";

function scanDirectory(dir) {
    // Ana klasörü tara
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        // Eğer bu bir klasörse, klasör adını "Ürün Adı" olarak kabul et
        if (stat.isDirectory()) {
            const productName = item; // Örn: "3360 POZDA POZ"
            const productFiles = fs.readdirSync(fullPath);

            productFiles.forEach(file => {
                if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                    // Dosya adı renktir (Uzantısız)
                    const color = path.parse(file).name; // Örn: "Beyaz", "Fuşya"
                    
                    const row = [
                        `"${productName}"`,  // productBase
                        `""`,                // variantSize (Boş, çünkü tüm bedenlere basılacak)
                        `"${color}"`,        // variantColor
                        `"${file}"`          // variantImage
                    ];
                    
                    csvContent += row.join(",") + "\n";
                    console.log(`📸 Ürün: ${productName} | Renk: ${color} -> ${file}`);
                }
            });
        }
    });
}

try {
    console.log("📂 Klasör taranıyor...");
    scanDirectory(RESIM_KLASORU);
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    console.log(`✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
} catch (error) {
    console.error("❌ Hata:", error.message);
}