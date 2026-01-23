import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Dosyanın geçici olarak nereye ve hangi isimle kaydedileceğini belirle
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/'; 

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath); 
  },
  filename: function (req, file, cb) {
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
  limits: { fileSize: 15 * 1024 * 1024 }, // ✅ LİMİT ARTIRILDI: Max 15MB (Eskisi 5MB idi)
  fileFilter: fileFilter
});

export default upload;