// Funciones pequenas para mostrar los datos del backend de forma bonita.

export const TIPOS = {
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  ORGANIZADOR: 'Organizador',
  ADMINISTRADOR: 'Administrador',
  INVITADO: 'Invitado',
};

// Minutos que ms-agenda deja libres entre reservas del mismo espacio (agenda.margen-minutos).
// La revision de disponibilidad trae el valor real; este es el de respaldo para dibujar la agenda.
export const MARGEN_MINUTOS = Number(import.meta.env.VITE_AGENDA_MARGEN_MINUTOS ?? 30);

export const ROLES_QUE_RESERVAN = ['ORGANIZADOR', 'ADMINISTRADOR'];

export function nombreTipo(tipo) {
  return TIPOS[tipo] ?? tipo ?? '';
}

// El "documento" con el que se identifica: numero de control, RFC o correo
export function documento(perfil) {
  if (perfil?.numeroControl) return { etiqueta: 'Número de control', valor: perfil.numeroControl };
  if (perfil?.rfc) return { etiqueta: 'RFC', valor: perfil.rfc };
  return { etiqueta: 'Correo', valor: perfil?.email ?? '' };
}

export function nombreCompleto(perfil) {
  return perfil ? `${perfil.nombre} ${perfil.apellidos}`.trim() : '';
}

export function iniciales(perfil) {
  return `${perfil?.nombre?.[0] ?? ''}${perfil?.apellidos?.[0] ?? ''}`.toUpperCase() || 'U';
}

export function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// 7470000000 -> (747) 000-0000
export function telefono(numero) {
  if (!numero) return 'Sin registrar';
  const d = numero.replace(/\D/g, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : numero;
}

export function dispositivo() {
  const ua = navigator.userAgent;
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const sistema = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'otro sistema';
  return `${navegador} en ${sistema}`;
}

// Folio legible para una reserva: ITCH-RES-2026-0031
export function folio(reserva) {
  const anio = (reserva.fecha ?? '').slice(0, 4) || new Date().getFullYear();
  return `ITCH-RES-${anio}-${String(reserva.id).padStart(4, '0')}`;
}

export function nombreEspacio(espacios, id) {
  return espacios?.find((e) => e.id === id)?.nombre ?? `Espacio ${id}`;
}

export function nombreEvento(eventos, id) {
  return eventos?.find((e) => e.id === id)?.titulo ?? `Evento ${id}`;
}

export function tipoEspacio(tipo) {
  return { AULA: 'Aula', AUDITORIO: 'Auditorio', CANCHA: 'Área deportiva', LABORATORIO: 'Laboratorio' }[tipo] ?? '';
}

export function iconoEspacio(tipo) {
  return { AULA: 'meeting_room', AUDITORIO: 'theater_comedy', CANCHA: 'sports_soccer', LABORATORIO: 'computer' }[tipo] ?? 'location_city';
}
