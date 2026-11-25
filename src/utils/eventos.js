// Textos y fechas de los eventos de ms-eventos: los usan la vista de Eventos y el panel que se abre sobre la Agenda.
import { diasEntre, fechaCorta } from './fechas';

// Lugar del evento: el previsto o el de su reserva; un evento registrado sin lugar dice "Sin lugar definido"
export const nombreLugar = (e) => e?.espacioNombre ?? (e?.espacio ? `Espacio ${e.espacio}` : 'Sin lugar definido');

// ---------- Fechas del evento ----------
export const esVariosDias = (e) => !!e?.fecha && !!e?.fechaFin && e.fechaFin !== e.fecha;
export const numeroDias = (e) => (esVariosDias(e) ? diasEntre(e.fecha, e.fechaFin).length : 1);
export const hhmm = (h) => (h ? h.slice(0, 5) : h);
// Sin reserva vigente: el evento sigue en pie pero su reserva se libero fuera de Eventos (Reservas de la agenda)
export const textoFechas = (e) => (!e?.fecha ? (e?.reservaLiberada ? 'Sin reserva vigente' : 'Sin fecha') : esVariosDias(e) ? `${fechaCorta(e.fecha)} – ${fechaCorta(e.fechaFin)}` : fechaCorta(e.fecha));
export const textoHorario = (e) => (e?.horaInicio && e?.horaFin ? `${hhmm(e.horaInicio)} – ${hhmm(e.horaFin)}` : '');
// Los mensajes del servicio vienen sin acentos; para los casos conocidos se muestra uno claro (DISENO.md, "Textos")
export function mensajeAmigable(err) {
  const m = err?.message ?? '';
  // La agenda de David pide la verificacion en dos pasos (2FA) para apartar, mover o liberar espacios (403 DOS_PASOS_REQUERIDO)
  if (err?.status === 403 && (err?.codigo === 'DOS_PASOS_REQUERIDO' || /dos pasos|DOS_PASOS/i.test(m)))
    return 'Para apartar o mover espacios necesitas la verificación en dos pasos. Actívala en Mi perfil > Seguridad y vuelve a iniciar sesión con tu código o tu llave de acceso.';
  if (err?.status === 403) return 'Solo el organizador del evento o un administrador puede modificarlo.';
  if (err?.status === 503) return 'Un servicio no respondió (agenda, espacios o usuarios). Inténtalo de nuevo en unos segundos.';
  if (err?.status === 409 && /reservado/i.test(m)) return `El espacio ya está ocupado en ese horario. ${m.replace(/^.*reservado/i, 'Reservado')}`;
  // Casos que el formulario ya evita, pero que pueden pasar si otra persona cambia algo mientras está abierto
  for (const [patron, texto] of TRADUCCIONES) {
    const x = m.match(patron);
    if (x) return typeof texto === 'function' ? texto(x) : texto;
  }
  return m || 'No se pudo completar. Inténtalo de nuevo.';
}

// Mensajes de ms-eventos (sin acentos y con datos tecnicos, como en las practicas) -> texto claro para la persona.
// El servicio no cambia: sus mensajes siguen igual para Postman y para los demas servicios
const TRADUCCIONES = [
  [/esta (CANCELADO|FINALIZADO) y ya no se puede modificar/, (x) => `Este evento ya está ${x[1] === 'CANCELADO' ? 'cancelado' : 'finalizado'} (quizá lo cambió otra persona). Cierra y vuelve a abrirlo para ver su estado actual.`],
  [/espacio no esta disponible \(estado: MANTENIMIENTO\)/, 'El espacio entró en mantenimiento. Elige otro espacio.'],
  [/espacio no existe/, 'El espacio ya no está disponible (pudo darse de baja). Elige otro.'],
  [/categoria no existe/, 'La categoría ya no está disponible (pudo darse de baja). Elige otra.'],
  [/organizador no (existe|esta activo)|no es organizador/, 'El organizador elegido ya no está activo o ya no es organizador. Elige otro.'],
  [/excede la capacidad del espacio \((\d+)\)/, (x) => `El cupo supera la capacidad del espacio (${Number(x[1]).toLocaleString('es-MX')} personas). Baja el cupo o elige otro espacio.`],
  [/aun no empieza \(inicia el (\d{4}-\d{2}-\d{2}) a las (\d{2}:\d{2})/, (x) => `Aún no empieza: se puede finalizar desde el ${fechaCorta(x[1])} a las ${x[2]}.`],
  [/ya termino \(el/, 'Ya se realizó: solo se puede finalizar.'],
  [/aun no tiene lugar ni fecha/, 'El evento no tiene lugar apartado. Usa "Apartar lugar y fecha".'],
  [/dura varios dias/, 'Dura varios días: para cambiar sus fechas, cancélalo y regístralo de nuevo.'],
  [/horario debe estar entre/, 'El horario debe estar entre 07:00 y 21:00.'],
  [/fecha no puede estar en el pasado/, 'La fecha ya pasó. Elige una fecha de hoy en adelante.'],
  [/no tiene una reserva vigente/, 'El evento no tiene una reserva vigente en la agenda, así que no se puede mover.'],
  [/Solo un evento al aire libre/, 'Solo un evento al aire libre puede quedar en riesgo por el clima.'],
  [/MANTENIDO cuando esta EN_RIESGO/, 'Solo se puede mantener un evento que está en riesgo.'],
  [/ya esta en ese espacio/, 'El evento ya está en ese espacio.'],
];
