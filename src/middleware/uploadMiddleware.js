import multer from 'multer';
import path from 'path';

// Dosyanın geçici olarak nereye ve hangi isimle kaydedileceğini belirle
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Şimdilik proje ana dizininde 'uploads' klasörü oluşturmalısın
  },
  filename: function (req, file, cb) {
    // Benzersiz isim oluştur: dosya-adi-zaman.jpg
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Sadece resim dosyalarına izin ver
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: fileFilter
});

export default upload;