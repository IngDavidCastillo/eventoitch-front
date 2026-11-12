// Funcion base para hablar con los microservicios.
// Pone el token en el header Authorization y convierte los errores del backend
// ({ status, error, message, detalles }) en una excepcion con el mensaje listo para mostrar.
// Cada llamada con token que sale bien cuenta como actividad (la sesion se cierra tras 15 min sin uso).

export const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:8082';
export const USUARIOS_URL = import.meta.env.VITE_USUARIOS_URL ?? 'http://localhost:8081';
export const AGENDA_URL = import.meta.env.VITE_AGENDA_URL ?? 'http://localhost:8086';
// Servicios de Roberta (eventos, categorias y espacios). Si no estan, el front sigue funcionando con ids.
export const ESPACIOS_URL = import.meta.env.VITE_ESPACIOS_URL ?? '';
export const EVENTOS_URL = import.meta.env.VITE_EVENTOS_URL ?? '';
export const CATEGORIAS_URL = import.meta.env.VITE_CATEGORIAS_URL ?? '';

// ms-usuarios guarda la foto como ruta (/api/v1/usuarios/5/foto?v=...): aqui se le pone el servidor delante.
// Si es un enlace completo (https://...) se usa tal cual.
export function urlFoto(fotografiaUrl) {
  if (!fotografiaUrl) return null;
  return fotografiaUrl.startsWith('/') ? `${USUARIOS_URL}${fotografiaUrl}` : fotografiaUrl;
}

export class ErrorApi extends Error {
  constructor(status, mensaje, detalles = []) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

// Quien quiera enterarse de la actividad o de un 401 se suscribe aqui (lo usa AuthContext)
const oyentes = { actividad: new Set(), noAutorizado: new Set() };
export function escuchar(evento, fn) {
  oyentes[evento].add(fn);
  return () => oyentes[evento].delete(fn);
}

export async function pedir(url, { metodo = 'GET', cuerpo, token, tiempo = 15000 } = {}) {
  const headers = {};
  // Con FormData (subir foto) el navegador pone solo el Content-Type multipart con su separador
  const esArchivo = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
  if (cuerpo && !esArchivo) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempo);
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers,
      body: esArchivo ? cuerpo : cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: control.signal,
    });
  } catch {
    // fetch solo falla asi cuando el servicio esta apagado, tarda demasiado o CORS lo bloquea
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa que los microservicios estén encendidos.');
  } finally {
    clearTimeout(reloj);
  }

  // 204 No Content (logout, cambiar contrasena, DELETE) no trae cuerpo
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) oyentes.noAutorizado.forEach((fn) => fn(datos?.message));
    throw new ErrorApi(respuesta.status, datos?.message ?? `Error ${respuesta.status}`, datos?.detalles ?? []);
  }
  if (token) oyentes.actividad.forEach((fn) => fn());
  return datos;
}
