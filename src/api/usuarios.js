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
