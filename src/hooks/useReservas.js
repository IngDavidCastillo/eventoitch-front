// ms-agenda no tiene "todas las reservas", asi que las juntamos:
// 1) por cada espacio y cada dia del rango, GET /reservas/espacio/{id}?fecha= (solo las RESERVADA)
// 2) por cada evento encontrado, GET /reservas/evento/{id} para tener tambien las LIBERADA.
import { useAuth } from '../context/AuthContext';
import { ocupacionDelDia, reservasDelEvento } from '../api/agenda';
import { listarEspacios, listarEventos } from '../api/catalogos';
import { diasEntre } from '../utils/fechas';
import useDatos from './useDatos';

export async function cargarCatalogos(token) {
  const [{ espacios, enLinea }, { eventos, enLinea: eventosEnLinea }] = await Promise.all([listarEspacios(token), listarEventos(token)]);
  return { espacios, espaciosEnLinea: enLinea, eventos, eventosEnLinea };
}

export async function reservasDelRango(espacios, desde, hasta, token) {
  const dias = diasEntre(desde, hasta);
  const llamadas = espacios.flatMap((e) => dias.map((f) => ocupacionDelDia(e.id, f, token)));
  const listas = await Promise.all(llamadas);
  const vistas = new Map();
  listas.flat().forEach((r) => vistas.set(r.id, r));
  return [...vistas.values()].sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio));
}

// Todas las reservas (RESERVADA y LIBERADA) de los eventos que aparecen en el rango
export async function reservasPorEvento(eventoIds, token) {
  const listas = await Promise.all(eventoIds.map((id) => reservasDelEvento(id, token).catch(() => [])));
  return listas.flat();
}

export default function useReservas(desde, hasta, { conLiberadas = false } = {}) {
  const { sesion } = useAuth();
  return useDatos(async () => {
    const cat = await cargarCatalogos(sesion.token);
    let reservas = await reservasDelRango(cat.espacios, desde, hasta, sesion.token);
    if (conLiberadas) {
      const ids = new Set([...reservas.map((r) => r.eventoId), ...cat.eventos.map((e) => e.id)]);
      const todas = await reservasPorEvento([...ids], sesion.token);
      const m = new Map(reservas.map((r) => [r.id, r]));
      todas.filter((r) => r.fecha >= desde && r.fecha <= hasta).forEach((r) => m.set(r.id, r));
      reservas = [...m.values()].sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio));
    }
    return { ...cat, reservas };
  }, [desde, hasta, conLiberadas, sesion.token]);
}
