import fs from 'fs';
import path from 'path';

// ⚙️ AYARLAR: Resim klasörünüzün tam yolu
const RESIM_KLASORU = "C:/Users/oomer/Desktop/Bigboss-Urunler/26-Yaz-Sezonu"; 

const CSV_DOSYA_ADI = "varyant_resim_eslestirme.csv";

// ✅ Sitede olan ürünleri eşleştirmek için productCode kullanacağız
const headers = ["productCode", "mainImageName", "price", "stock", "category"];
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
                
                // Dosya adından uzantıyı çıkar = ürün kodu
                const productCode = path.parse(file).name;
                const category = categoryChain.length > 0 ? categoryChain[categoryChain.length - 1] : "Genel";

                const row = [
                    `"${productCode}"`,              // productCode (Eşleştirme için)
                    `"${file}"`,                     // mainImageName (Resim dosya adı)
                    `""`,                            // price (Boş bırakılırsa mevcut kalır)
                    `""`,                            // stock (Boş bırakılırsa mevcut kalır)
                    `"${category}"`                  // category (İsteğe bağlı)
                ];

                csvContent += row.join(",") + "\n";
                console.log(`📸 Eklendi: ${productCode} → ${file}`);
            }
        }
    });
}

try {
    console.log("📂 Klasör taranıyor...");
    scanDirectory(RESIM_KLASORU);
    fs.writeFileSync(CSV_DOSYA_ADI, csvContent, 'utf8');
    console.log(`\n✅ '${CSV_DOSYA_ADI}' oluşturuldu!`);
    console.log(`📊 Toplam ${csvContent.split('\n').length - 2} ürün kodu listelendi`);
    console.log("\n💡 KULLANIM:");
    console.log("   1. Bu CSV dosyasını Admin Panelinden yükleyin");
    console.log("   2. Aynı klasördeki TÜM resimleri seçin");
    console.log("   3. Sistem, productCode'a göre mevcut ürünleri bulup resimlerini güncelleyecek");
    console.log("   4. Bulunamayan ürünler için UYARI verilecek (yeni ürün oluşturulmayacak)\n");
} catch (error) {
    console.error("❌ Hata:", error.message);
}