// Llamadas a ms-autenticacion (puerto 8082)
import { AUTH_URL, pedir } from './cliente';

const BASE = `${AUTH_URL}/api/v1/auth`;

// POST /login -> { token, tipo, expiraEnSegundos, usuarioId, rol }
export function login(username, password) {
  return pedir(`${BASE}/login`, { metodo: 'POST', cuerpo: { username, password } });
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

// El registro avisa si el correo de bienvenida no se pudo mandar (ms-notificaciones no conectado a Eureka)
export const correoNoEnviado = (aviso) => /no fue enviado/i.test(aviso ?? '');
