// Llamadas a ms-eventos (puerto 8083). La direccion se toma de Eureka (MS-EVENTOS);
// si no esta registrado, se usa VITE_EVENTOS_URL de .env.local.
import { EVENTOS_URL, pedir } from './cliente';
import { urlEnEureka } from './servicios';
import { busquedaSegura, contieneTexto } from '../utils/validaciones';

async function base() {
  const url = (await urlEnEureka('MS-EVENTOS')) || EVENTOS_URL;
  if (!url) throw new Error('No se encontró el servicio de eventos');
  return `${url.replace(/\/$/, '')}/api/v1/eventos`;
}

// GET /eventos con filtros opcionales: { estado, categoria, espacio, organizador }.
// Cada evento trae fecha, fechaFin, horaInicio y horaFin (null si la agenda no responde)
export async function listarEventos(filtros = {}, token) {
  const q = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v != null && v !== ''));
  return pedir(`${await base()}${q.size ? `?${q}` : ''}`, { token });
}

// GET /eventos/{id} -> el evento con nombres, fechas y horario
export async function obtenerEvento(id, token) {
  return pedir(`${await base()}/${id}`, { token });
}

// GET /eventos/buscar/{nombre} (titulo) o /eventos/lugar/{nombre} (nombre del espacio).
// Con "/", ";", "%" o ".." el servidor rechaza la ruta: el titulo se busca sobre la lista (ver busquedaSegura);
// el lugar necesita a ms-espacios, asi que esos signos se quitan
export async function buscarEventos(texto, enLugar, token) {
  if (enLugar) {
    const limpio = texto.replace(/[/\\;%]|\.\./g, ' ').trim();
    return limpio ? pedir(`${await base()}/lugar/${encodeURIComponent(limpio)}`, { token }) : [];
  }
  if (!busquedaSegura(texto)) return (await listarEventos({}, token)).filter((e) => contieneTexto(e.titulo, texto));
  return pedir(`${await base()}/buscar/${encodeURIComponent(texto)}`, { token });
}

// POST /eventos -> 201; con fechaFin es de varios dias (mismo espacio y horario cada dia)
export async function crearEvento(evento, token) {
  return pedir(await base(), { metodo: 'POST', cuerpo: evento, token });
}

// PUT /eventos/{id} -> titulo, descripcion, categoria, cupo y (solo ADMINISTRADOR) organizador
export async function actualizarEvento(id, evento, token) {
  return pedir(`${await base()}/${id}`, { metodo: 'PUT', cuerpo: evento, token });
}

// PATCH /eventos/{id}/estado -> EN_RIESGO, MANTENIDO, CANCELADO o FINALIZADO
export async function cambiarEstadoEvento(id, estado, token) {
  return pedir(`${await base()}/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado }, token });
}

// PATCH /eventos/{id}/reprogramar -> nueva fecha y horario (solo eventos de un dia)
export async function reprogramarEvento(id, datos, token) {
  return pedir(`${await base()}/${id}/reprogramar`, { metodo: 'PATCH', cuerpo: datos, token });
}

// PATCH /eventos/{id}/ubicacion -> mueve todos sus dias al espacio nuevo
export async function cambiarUbicacionEvento(id, espacio, token) {
  return pedir(`${await base()}/${id}/ubicacion`, { metodo: 'PATCH', cuerpo: { espacio }, token });
}
