import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 
const CSV_DOSYA_ADI = "beden_renk_eslestirme.csv";

// ✅ YENİ YAPI: Klasör Adı = Ürün, Dosya Adı = Renk
const headers = ["productBase", "variantSize", "variantColor", "variantImage"];
let csvContent = headers.join(",") + "\n";

/**
 * Klasör yapısını tarar.
 * @param {string} dir - Taranacak ana dizin
 */
function scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Eğer bir klasörse, bu klasörün adı "Ürün Adı" (productBase) olur.
            // Şimdi bu ürün klasörünün içindeki resimleri (renkleri) tarayalım.
            processProductFolder(fullPath, item); 
        }
    });
}

/**
 * Ürün klasörünün içindeki resimleri işler.
 * @param {string} folderPath - Ürün klasörünün tam yolu
 * @param {string} productName - Klasör adı (Ürün ismi olarak kullanılacak)
 */
function processProductFolder(folderPath, productName) {
    const files = fs.readdirSync(folderPath);

    files.forEach(file => {
        // Sadece resim dosyalarını al
        if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
            
            // 1. Ürün Adı (productBase) -> Klasör isminden gelir (Parametre: productName)
            const productBase = productName;

            // 2. Beden (variantSize) -> İsteğin üzerine BOŞ bırakılıyor
            const variantSize = ""; 

            // 3. Renk (variantColor) -> Dosya isminden uzantı atılarak alınır (Örn: "Siyah.jpg" -> "Siyah")
            const variantColor = path.parse(file).name;

            // 4. Resim (variantImage) -> Dosyanın tam adı
            const variantImage = file;

            // CSV Satırını oluştur
            const row = [
                `"${productBase}"`,
                `"${variantSize}"`,
                `"${variantColor}"`,
                `"${variantImage}"`
            ];
            
            csvContent += row.join(",") + "\n";
            console.log(`📸 Ürün: ${productBase} | Renk: ${variantColor} -> ${file}`);
        }
    });
}

try {
    console.log(`📂 '${RESIM_KLASORU}' taranıyor...\n`);
    scanDirectory(RESIM_KLASORU);
    
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    
    console.log(`\n✅ '${CSV_DOSYA_ADI}' başarıyla oluşturuldu!`);
    console.log(`📊 Toplam satır sayısı: ${csvContent.split('\n').length - 2}\n`);
    
} catch (error) {
    console.error("❌ Hata:", error.message);
}