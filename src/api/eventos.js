// Llamadas a ms-eventos (puerto 8083). La direccion se toma de Eureka (MS-EVENTOS);
// si no esta registrado, se usa VITE_EVENTOS_URL de .env.local.
import { EVENTOS_URL, pedir } from './cliente';
import { urlEnEureka } from './servicios';

async function base() {
  const url = (await urlEnEureka('MS-EVENTOS')) || EVENTOS_URL;
  if (!url) throw new Error('No se encontró el servicio de eventos');
  return `${url.replace(/\/$/, '')}/api/v1/eventos`;
}

// GET /eventos con filtros opcionales: { estado, categoria, espacio, organizador }
export async function listarEventos(filtros = {}, token) {
  const q = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v != null && v !== ''));
  return pedir(`${await base()}${q.size ? `?${q}` : ''}`, { token });
}
