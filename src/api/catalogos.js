// Catalogos de los servicios de Roberta: espacios (8085), eventos (8083) y categorias (8084).
// No son mis servicios: si no estan configurados o no responden, el front sigue funcionando
// mostrando "Espacio 3" o "Evento 4" con los ids que guarda ms-agenda.
import { CATEGORIAS_URL, ESPACIOS_URL, EVENTOS_URL, pedir } from './cliente';

// Ids de espacios a revisar cuando ms-espacios no responde (VITE_ESPACIOS_RESPALDO=1,2,3,4)
const RESPALDO = (import.meta.env.VITE_ESPACIOS_RESPALDO ?? '1,2,3,4')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);

export async function listarEspacios(token) {
  if (ESPACIOS_URL) {
    try {
      const lista = await pedir(`${ESPACIOS_URL}/api/v1/espacios`, { token, tiempo: 6000 });
      return { espacios: lista.filter((e) => e.estatus !== 0), enLinea: true };
    } catch {
      // se usa el respaldo de abajo
    }
  }
  return {
    espacios: RESPALDO.map((id) => ({ id, nombre: `Espacio ${id}`, tipo: null, capacidad: null, estado: 'DISPONIBLE', estatus: 1 })),
    enLinea: false,
  };
}

export async function listarEventos(token) {
  if (!EVENTOS_URL) return { eventos: [], enLinea: false };
  try {
    return { eventos: await pedir(`${EVENTOS_URL}/api/v1/eventos`, { token, tiempo: 6000 }), enLinea: true };
  } catch {
    return { eventos: [], enLinea: false };
  }
}

export async function listarCategorias(token) {
  if (!CATEGORIAS_URL) return [];
  try {
    return await pedir(`${CATEGORIAS_URL}/api/v1/categorias`, { token, tiempo: 6000 });
  } catch {
    return [];
  }
}
