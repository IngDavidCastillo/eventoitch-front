// Llamadas a ms-usuarios (puerto 8081)
import { USUARIOS_URL, pedir } from './cliente';

const BASE = `${USUARIOS_URL}/api/v1/usuarios`;

export function obtenerUsuario(id, token) {
  return pedir(`${BASE}/${id}`, { token });
}

// GET /usuarios?tipo=&estado= (solo ADMINISTRADOR)
export function listarUsuarios({ tipo, estado } = {}, token) {
  const q = new URLSearchParams();
  if (tipo) q.set('tipo', tipo);
  if (estado) q.set('estado', estado);
  return pedir(`${BASE}${q.size ? `?${q}` : ''}`, { token });
}

// GET /usuarios/lote?ids=1,2 -> varios perfiles de una vez
export function usuariosPorIds(ids, token) {
  return pedir(`${BASE}/lote?ids=${ids.join(',')}`, { token });
}

// PUT /usuarios/{id} -> el dueno o un ADMINISTRADOR (manda el perfil completo)
export function actualizarUsuario(id, datos, token) {
  return pedir(`${BASE}/${id}`, { metodo: 'PUT', cuerpo: datos, token });
}

// PATCH /usuarios/{id}/estado { estado: ACTIVO | INACTIVO }
export function cambiarEstado(id, estado, token) {
  return pedir(`${BASE}/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado }, token });
}

// PUT /usuarios/{id}/foto (multipart, campo "foto"): el dueno o un ADMINISTRADOR.
// ms-usuarios guarda el archivo en la carpeta del disco (C:/EventoITCH/fotos) y devuelve el perfil.
export function subirFoto(id, archivo, token) {
  const datos = new FormData();
  datos.append('foto', archivo, archivo.name || 'foto.jpg');
  return pedir(`${BASE}/${id}/foto`, { metodo: 'PUT', cuerpo: datos, token, tiempo: 30000 });
}

// DELETE /usuarios/{id}/foto: borra el archivo y deja al usuario sin foto
export function quitarFoto(id, token) {
  return pedir(`${BASE}/${id}/foto`, { metodo: 'DELETE', token });
}

// ---------- Verificacion del correo (codigo de 6 digitos) ----------
// usuario = con el que inicia sesion (numero de control, RFC o correo). Publicos: todavia no hay sesion.

// POST /verificar-correo -> 204; 400 con cuantos intentos quedan, o si el codigo vencio
export function verificarCorreo(usuario, codigo) {
  return pedir(`${BASE}/verificar-correo`, { metodo: 'POST', cuerpo: { usuario, codigo } });
}

// POST /verificar-correo/reenviar -> 204 siempre (no revela si la cuenta existe)
export function reenviarCodigo(usuario) {
  return pedir(`${BASE}/verificar-correo/reenviar`, { metodo: 'POST', cuerpo: { usuario } });
}

// POST /{id}/verificar-correo/reenviar (el dueno o ADMINISTRADOR) -> 204; 409 si ya esta verificado; 429
export function reenviarCodigoDe(id, token) {
  return pedir(`${BASE}/${id}/verificar-correo/reenviar`, { metodo: 'POST', token });
}

// PATCH /{id}/verificar-correo (ADMINISTRADOR) -> el usuario con emailVerificado true
export function marcarCorreoVerificado(id, token) {
  return pedir(`${BASE}/${id}/verificar-correo`, { metodo: 'PATCH', token });
}
