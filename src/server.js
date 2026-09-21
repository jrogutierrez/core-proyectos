// src/server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRouter = require('./routes/auth');

const app = express();

// Middlewares
app.use(helmet());
app.use(express.json());

// Rate limiter for login route
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Demasiados intentos. Inténtalo de nuevo más tarde.'
  }
});
app.use('/api/login', loginLimiter);

// Routes
app.use('/api/login', authRouter);

// Static files (optional)
app.use(express.static('public'));

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en http://localhost:${PORT}`);
});