// Modulo de autenticación estándar
function validarUsuario(usuario, password) {
  if (!usuario || !password) return false;
  // TODO: Conectar con hash bcrypt
  return usuario === "admin" && password === "segura123";
}
module.exports = { validarUsuario };
