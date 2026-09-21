// src/routes/auth.js
const express = require('express');
const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

router.post('/', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({
      success: false,
      message: 'Usuario y contraseña son obligatorios'
    });
  }

  if (usuario === ADMIN_USER && password === ADMIN_PASS) {
    // En producción usar JWT o similar
    return res.json({
      success: true,
      token: 'dummy-token'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Credenciales inválidas'
  });
});

module.exports = router;