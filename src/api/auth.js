// Llamadas a ms-autenticacion (puerto 8082)
import { AUTH_URL, pedir } from './cliente';

const BASE = `${AUTH_URL}/api/v1/auth`;

// POST /login -> { token, tipo, expiraEnSegundos, usuarioId, rol }
export function login(username, password) {
  return pedir(`${BASE}/login`, { metodo: 'POST', cuerpo: { username, password } });
}

// POST /password/temporal (publico): cambia la contrasena temporal (la puso un ADMINISTRADOR) por una propia.
// Responde igual que el login (token).
export function cambiarPasswordTemporal(username, passwordActual, passwordNueva) {
  return pedir(`${BASE}/password/temporal`, { metodo: 'POST', cuerpo: { username, passwordActual, passwordNueva } });
}

// POST /registro (publico, solo ESTUDIANTE o INVITADO) -> igual que login
export function registro(datos) {
  return pedir(`${BASE}/registro`, { metodo: 'POST', cuerpo: datos });
}

// POST /admin/registro (ADMINISTRADOR, cualquier rol)
export function registroAdmin(datos, token) {
  return pedir(`${BASE}/admin/registro`, { metodo: 'POST', cuerpo: datos, token });
}

// GET /validar -> { valido, usuarioId, username, rol, ultimaActividad, inactivaEn }
export function validar(token) {
  return pedir(`${BASE}/validar`, { token });
}

// POST /logout -> 204
export function logout(token) {
  return pedir(`${BASE}/logout`, { metodo: 'POST', token });
}

// PUT /password -> 204, o 400 si la actual no coincide
export function cambiarPassword(passwordActual, passwordNueva, token) {
  return pedir(`${BASE}/password`, { metodo: 'PUT', cuerpo: { passwordActual, passwordNueva }, token });
}

// PUT /admin/usuarios/{usuarioId}/password (ADMINISTRADOR) -> 204. Cierra la sesion de esa cuenta y le quita el bloqueo.
export function restablecerPassword(usuarioId, passwordNueva, token) {
  return pedir(`${BASE}/admin/usuarios/${usuarioId}/password`, { metodo: 'PUT', cuerpo: { passwordNueva }, token });
}

// GET /accesos -> [{ fecha, resultado, ip, navegador, dispositivo }], mas recientes primero (max. 50)
// resultado: EXITOSO, PASSWORD_INCORRECTA, CUENTA_BLOQUEADA, CUENTA_INACTIVA
export function misAccesos(token, limite = 20) {
  return pedir(`${BASE}/accesos?limite=${limite}`, { token });
}

// El registro avisa si el correo de bienvenida no se pudo mandar (ms-notificaciones no conectado a Eureka)
export const correoNoEnviado = (aviso) => /no fue enviado/i.test(aviso ?? '');

// POST /admin/usuarios/{id}/password/enlace (ADMINISTRADOR): le manda a esa cuenta un enlace por correo para
// poner su contrasena. 202, o 503 si ms-notificaciones no respondio (entonces se le pone una temporal).
export function enviarEnlaceRestablecer(usuarioId, token) {
  return pedir(`${BASE}/admin/usuarios/${usuarioId}/password/enlace`, { metodo: 'POST', token });
}

// POST /password/restablecer (publico, con el token del enlace del correo) -> 204, o 400 si el enlace no sirve
export function restablecerConEnlace(token, passwordNueva) {
  return pedir(`${BASE}/password/restablecer`, { metodo: 'POST', cuerpo: { token, passwordNueva } });
}

// ---------- Verificacion en dos pasos (2FA con app de autenticacion, contrato seccion 8) ----------
// El login responde 202 { requiereDosPasos, desafio, message } si la cuenta la tiene activa.

// POST /login/dos-pasos (publico) -> igual que el login, con dosPasos: true
export function loginDosPasos(desafio, codigo) {
  return pedir(`${BASE}/login/dos-pasos`, { metodo: 'POST', cuerpo: { desafio, codigo } });
}

// GET /dos-pasos -> { activo, obligatorio, codigosRestantes, sesionConDosPasos }
export function estadoDosPasos(token) {
  return pedir(`${BASE}/dos-pasos`, { token });
}

// POST /dos-pasos/iniciar -> { secreto, otpauthUrl } (todavia no queda activo)
export function iniciarDosPasos(token) {
  return pedir(`${BASE}/dos-pasos/iniciar`, { metodo: 'POST', token });
}

// POST /dos-pasos/activar { codigo } -> { codigosRespaldo: [...] } (solo se ven esta vez)
export function activarDosPasos(codigo, token) {
  return pedir(`${BASE}/dos-pasos/activar`, { metodo: 'POST', cuerpo: { codigo }, token });
}

// POST /dos-pasos/codigos { codigo } -> 10 codigos de respaldo nuevos (los anteriores dejan de servir)
export function nuevosCodigosRespaldo(codigo, token) {
  return pedir(`${BASE}/dos-pasos/codigos`, { metodo: 'POST', cuerpo: { codigo }, token });
}

// DELETE /dos-pasos { password, codigo } -> 204 (no se puede si el rol lo tiene obligatorio)
export function desactivarDosPasos(password, codigo, token) {
  return pedir(`${BASE}/dos-pasos`, { metodo: 'DELETE', cuerpo: { password, codigo }, token });
}

// DELETE /admin/usuarios/{id}/dos-pasos (ADMINISTRADOR) -> 204; 409 si esa cuenta no lo tiene activo
export function quitarDosPasos(usuarioId, token) {
  return pedir(`${BASE}/admin/usuarios/${usuarioId}/dos-pasos`, { metodo: 'DELETE', token });
}
