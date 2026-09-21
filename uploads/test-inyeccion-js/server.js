const express = require('express');
const app = express();
app.use(express.json());
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (usuario === 'admin' && password === 'admin123') {
    res.json({ token: 'jwt-123', rol: 'admin' });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});
app.listen(3000);
