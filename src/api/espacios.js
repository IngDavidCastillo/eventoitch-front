// Llamadas a ms-espacios (puerto 8085). La direccion se toma de Eureka (MS-ESPACIOS);
// si no esta registrado, se usa VITE_ESPACIOS_URL de .env.local.
import { ESPACIOS_URL, pedir } from './cliente';
import { urlEnEureka } from './servicios';
import { busquedaSegura, contieneTexto } from '../utils/validaciones';

// Direccion del servicio (sin la ruta). Tambien se usa para armar la URL de las fotos.
export async function servidorEspacios() {
  const url = (await urlEnEureka('MS-ESPACIOS')) || ESPACIOS_URL;
  if (!url) throw new Error('No se encontró el servicio de espacios');
  return url.replace(/\/$/, '');
}
const base = async () => `${await servidorEspacios()}/api/v1/espacios`;

// GET /espacios -> activos; con todas=true tambien los dados de baja (solo ADMINISTRADOR)
export async function listarEspacios(todas, token) {
  return pedir(`${await base()}${todas ? '?todas=true' : ''}`, { token });
}

// GET /espacios/buscar/{nombre} -> los que contienen el texto en el nombre
export async function buscarEspacios(nombre, todas, token) {
  // Con "/", ";", "%"... el servidor rechaza la ruta: se busca sobre la lista (ver busquedaSegura)
  if (!busquedaSegura(nombre)) return (await listarEspacios(todas, token)).filter((e) => contieneTexto(e.nombre, nombre));
  return pedir(`${await base()}/buscar/${encodeURIComponent(nombre)}${todas ? '?todas=true' : ''}`, { token });
}

// POST /espacios -> 201; si el nombre existe dado de baja, se reactiva (conserva su foto)
export async function crearEspacio(espacio, token) {
  return pedir(await base(), { metodo: 'POST', cuerpo: espacio, token });
}

// PUT /espacios/{id}
export async function actualizarEspacio(id, espacio, token) {
  return pedir(`${await base()}/${id}`, { metodo: 'PUT', cuerpo: espacio, token });
}

// DELETE /espacios/{id} -> baja logica (estatus 0)
export async function eliminarEspacio(id, token) {
  return pedir(`${await base()}/${id}`, { metodo: 'DELETE', token });
}

// POST /espacios/{id}/foto (multipart, campo "foto"): sube o reemplaza la foto. Solo JPG o PNG de hasta 2 MB.
export async function subirFotoEspacio(id, archivo, token) {
  const datos = new FormData();
  datos.append('foto', archivo);
  return pedir(`${await base()}/${id}/foto`, { metodo: 'POST', cuerpo: datos, token, tiempo: 30000 });
}

// DELETE /espacios/{id}/foto
export async function quitarFotoEspacio(id, token) {
  return pedir(`${await base()}/${id}/foto`, { metodo: 'DELETE', token });
}

// GET /espacios/{id}/foto es publico (no necesita token), asi que se puede usar directo en <img>.
// El servicio guarda siempre el mismo nombre de archivo: `version` obliga al navegador a pedir la foto nueva.
export function urlFotoEspacio(servidor, id, version = '') {
  return servidor ? `${servidor}/api/v1/espacios/${id}/foto${version ? `?v=${encodeURIComponent(version)}` : ''}` : null;
}
