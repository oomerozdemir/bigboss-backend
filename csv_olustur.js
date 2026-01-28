import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR: Resim klasörünüzün tam yolu
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 

const CSV_DOSYA_ADI = "varyant_resim_eslestirme.csv";

// ✅ DÜZELTME: Sitenin beklediği tam sütun isimleri eklendi
const headers = ["name", "productCode", "mainImageName", "category", "description"];
let csvContent = headers.join(",") + "\n";

function scanDirectory(dir, categoryChain = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath, [...categoryChain, file]);
        } else {
            if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                
                const productCode = path.parse(file).name;
                const category = categoryChain.length > 0 ? categoryChain[categoryChain.length - 1] : "Genel";

                const row = [
                    `"${productCode}"`,              // name (Listede görünmesi için)
                    `"${productCode}"`,              // productCode (Eşleşme için)
                    `"${file}"`,                     // mainImageName (✅ DÜZELTİLDİ)
                    `"${category}"`,                 // category
                    `"Nebim Kod: ${productCode}"`    // description
                ];

                csvContent += row.join(",") + "\n";
                console.log(`📸 Eklendi: ${productCode}`);
            }
        }
    });
}

try {
    console.log("📂 Klasör taranıyor...");
    scanDirectory(RESIM_KLASORU);
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log("👉 Lütfen Admin Panelinden BU YENİ dosyayı yükleyin.");
} catch (error) {
    console.error("Hata:", error.message);
}