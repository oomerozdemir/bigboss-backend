const express = require('express');
const router = express.Router();
const addressController = require('../controller/addressController');
const authMiddleware = require('../middleware/authMiddleware'); // Giriş yapmış kullanıcı şart

router.get('/', authMiddleware, addressController.getAddresses);
router.post('/', authMiddleware, addressController.addAddress);
router.delete('/:id', authMiddleware, addressController.deleteAddress);

module.exports = router;