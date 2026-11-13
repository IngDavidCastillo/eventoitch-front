// Catalogos de los servicios de Roberta: espacios (8085), eventos (8083) y categorias (8084).
// La direccion de cada servicio se toma de Eureka (la IP con la que se registro). Solo si no esta en
// Eureka se usa la de .env.local (VITE_ESPACIOS_URL, etc.) como respaldo.
// No son mis servicios: si no responden, el front sigue funcionando
// mostrando "Espacio 3" o "Evento 4" con los ids que guarda ms-agenda.
import { CATEGORIAS_URL, ESPACIOS_URL, EVENTOS_URL, pedir } from './cliente';
import { servicioCaido, urlEnEureka } from './servicios';

// Si un servicio de Roberta no contesta, no se le vuelve a esperar en 30 s (antes cada pantalla
// se quedaba 6 s esperandolo). Tampoco se le pregunta si el indicador de servicios ya lo ve apagado.
const PAUSA_MS = 30000;
const pausados = new Map(); // url -> hasta cuando no se le pregunta

// id: nombre en Eureka (MS-ESPACIOS); respaldo: URL de .env.local; ruta: /api/v1/espacios
async function pedirCatalogo(id, respaldo, ruta, token) {
  const base = (await urlEnEureka(id)) || respaldo;
  if (!base) throw new Error(`${id} no esta en Eureka`);
  const url = `${base.replace(/\/$/, '')}${ruta}`;
  if (servicioCaido(id) || (pausados.get(url) ?? 0) > Date.now()) throw new Error(`${id} no responde`);
  try {
    const datos = await pedir(url, { token, tiempo: 6000 });
    pausados.delete(url);
    return datos;
  } catch (e) {
    pausados.set(url, Date.now() + PAUSA_MS);
    throw e;
  }
}

// Ids de espacios a revisar cuando ms-espacios no responde (VITE_ESPACIOS_RESPALDO=1,2,3,4)
const RESPALDO = (import.meta.env.VITE_ESPACIOS_RESPALDO ?? '1,2,3,4')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);

export async function listarEspacios(token) {
  try {
    const lista = await pedirCatalogo('MS-ESPACIOS', ESPACIOS_URL, '/api/v1/espacios', token);
    return { espacios: lista.filter((e) => e.estatus !== 0), enLinea: true };
  } catch {
    return {
      espacios: RESPALDO.map((id) => ({ id, nombre: `Espacio ${id}`, tipo: null, capacidad: null, estado: 'DISPONIBLE', estatus: 1 })),
      enLinea: false,
    };
  }
}

export async function listarEventos(token) {
  try {
    return { eventos: await pedirCatalogo('MS-EVENTOS', EVENTOS_URL, '/api/v1/eventos', token), enLinea: true };
  } catch {
    return { eventos: [], enLinea: false };
  }
}

export async function listarCategorias(token) {
  try {
    return await pedirCatalogo('MS-CATEGORIAS', CATEGORIAS_URL, '/api/v1/categorias', token);
  } catch {
    return [];
  }
}
