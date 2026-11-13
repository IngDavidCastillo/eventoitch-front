// Archivo .ics para agregar reservas a Google Calendar, Outlook o el calendario del celular.
// No usa ningun servicio: el archivo se arma aqui y se descarga.
import { folio, nombreEspacio, nombreEvento } from './formato';

const limpio = (t) => String(t ?? '').replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const fechaHora = (fecha, hora) => `${fecha.replace(/-/g, '')}T${hora.slice(0, 5).replace(':', '')}00`;
const sello = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

export function archivoIcs(reservas, espacios, eventos) {
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EventoITCH//Reservas//ES', 'CALSCALE:GREGORIAN'];
  reservas.forEach((r) => {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:reserva-${r.id}@eventoitch`,
      `DTSTAMP:${sello()}`,
      `DTSTART;TZID=America/Mexico_City:${fechaHora(r.fecha, r.horaInicio)}`,
      `DTEND;TZID=America/Mexico_City:${fechaHora(r.fecha, r.horaFin)}`,
      `SUMMARY:${limpio(nombreEvento(eventos, r.eventoId))}`,
      `LOCATION:${limpio(`${nombreEspacio(espacios, r.espacioId)}, ITChilpancingo`)}`,
      `DESCRIPTION:${limpio(`Reserva ${folio(r)} hecha en EventoITCH.`)}`,
      'END:VEVENT',
    );
  });
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n');
}

export function descargarIcs(reservas, espacios, eventos, nombre) {
  const blob = new Blob([archivoIcs(reservas, espacios, eventos)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
