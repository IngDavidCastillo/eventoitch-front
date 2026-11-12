// Llamadas a ms-agenda (puerto 8086): reservas de espacios para eventos
import { AGENDA_URL, pedir } from './cliente';

const BASE = `${AGENDA_URL}/api/v1/reservas`;

// POST /reservas -> 201; 409 si se cruza con otra
export function crearReserva(reserva, token) {
  return pedir(BASE, { metodo: 'POST', cuerpo: reserva, token });
}

// POST /reservas/varios-dias -> una reserva por dia; todo o nada (409 con detalles por dia)
export function crearVariosDias(datos, token) {
  return pedir(`${BASE}/varios-dias`, { metodo: 'POST', cuerpo: datos, token });
}

// GET /disponibilidad -> { disponible, conflictos }
export function consultarDisponibilidad({ espacioId, fecha, horaInicio, horaFin }, token) {
  const q = new URLSearchParams({ espacioId, fecha, horaInicio, horaFin });
  return pedir(`${BASE}/disponibilidad?${q}`, { token });
}

// GET /espacio/{id}?fecha= -> reservas RESERVADA de ese dia
export function ocupacionDelDia(espacioId, fecha, token) {
  return pedir(`${BASE}/espacio/${espacioId}?fecha=${fecha}`, { token });
}

// GET /evento/{id} -> todas las reservas del evento (tambien las LIBERADA)
export function reservasDelEvento(eventoId, token) {
  return pedir(`${BASE}/evento/${eventoId}`, { token });
}

// PUT /reservas/{id} -> mover a otro horario o espacio
export function moverReserva(id, reserva, token) {
  return pedir(`${BASE}/${id}`, { metodo: 'PUT', cuerpo: reserva, token });
}

// PATCH /reservas/{id}/liberar -> estado LIBERADA
export function liberarReserva(id, token) {
  return pedir(`${BASE}/${id}/liberar`, { metodo: 'PATCH', token });
}

// PATCH /reservas/evento/{id}/liberar -> libera todas las del evento
export function liberarEvento(eventoId, token) {
  return pedir(`${BASE}/evento/${eventoId}/liberar`, { metodo: 'PATCH', token });
}
