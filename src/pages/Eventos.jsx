// Eventos (ms-eventos): lista con fechas, busqueda por titulo o por lugar, filtros y detalle para cualquier usuario con sesion.
// El ORGANIZADOR (en sus eventos) y el ADMINISTRADOR ademas pueden registrar (de uno o varios dias), editar, reprogramar,
// cambiar de espacio, poner en riesgo, mantener, cancelar y finalizar. Todo pasa por ms-eventos, que mueve las reservas
// en la agenda de David y cambia el estado del evento (flujo del clima del PDF: Clima avisa y el organizador decide).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNuevaReserva } from '../components/layout/Shell';
import { useNavigate } from 'react-router-dom';
import useDatos from '../hooks/useDatos';
import {
  actualizarEvento,
  buscarEventos,
  cambiarEstadoEvento,
  cambiarUbicacionEvento,
  crearEvento,
  listarEventos,
  obtenerEvento,
  reprogramarEvento,
} from '../api/eventos';
import { listarCategorias } from '../api/categorias';
import { listarEspacios } from '../api/espacios';
import { listarUsuarios } from '../api/usuarios';
import { consultarDisponibilidad, ocupacionDelDia } from '../api/agenda';
import { corto, filtrarCampo, limpiarEspacios, primeraMayuscula, tieneLetra } from '../utils/validaciones';
import { diasEntre, fechaCorta, fechaLarga, hoyIso, minutos, sumarDias } from '../utils/fechas';
import { MARGEN_MINUTOS, tipoEspacio } from '../utils/formato';
import Icono from '../components/Icono';
import {
  AreaTexto,
  Aviso,
  AvisoTemporal,
  Boton,
  BotonArriba,
  Campo,
  Confirmar,
  ContadorCaracteres,
  Entrada,
  ErrorServicio,
  Esqueleto,
  EsqueletoTabla,
  Estado,
  Globo,
  // Interruptor, (ya no se usa: el formulario no tiene "Varios dias")
  LineaAyuda,
  MenuDesplegable,
  Panel,
  SeccionFormulario,
  Segmentado,
  Selector,
  Tarjeta,
  TituloPagina,
  Vacio,
} from '../components/ui';

const MIN_TITULO = 3;
const MAX_TITULO = 100;
const MAX_DESCRIPCION = 255;
const DIAS_MAXIMOS = 31; // misma regla que ms-eventos y la agenda
const ROLES_QUE_ORGANIZAN = ['ORGANIZADOR', 'ADMINISTRADOR'];
const TERMINADOS = ['CANCELADO', 'FINALIZADO'];
const RESERVA = ' '; // linea de ayuda vacia del mismo alto (el formulario no "brinca")

const ESTADOS_EVENTO = [
  ['PROGRAMADO', 'Programado', 'event'],
  ['EN_RIESGO', 'En riesgo', 'warning'],
  ['MANTENIDO', 'Mantenido', 'verified'],
  ['REPROGRAMADO', 'Reprogramado', 'update'],
  ['CAMBIO_UBICACION', 'Cambio de ubicación', 'swap_horiz'],
  ['CANCELADO', 'Cancelado', 'cancel'],
  ['FINALIZADO', 'Finalizado', 'task_alt'],
];
// "Todos" / "Todas" (antes "Todos los estados"): la etiqueta ya dice "Estado:" y asi los filtros caben en un renglon
const FILTRO_ESTADOS = [{ valor: '', texto: 'Todos', icono: 'apps' }, ...ESTADOS_EVENTO.map(([valor, texto, icono]) => ({ valor, texto, icono }))];

// "Proximos": primero los vigentes por fecha; los cancelados y finalizados, y los sin fecha (la agenda no respondio), al final
const terminado = (e) => (TERMINADOS.includes(e.estado) ? 1 : 0);
const ORDENES = [
  {
    valor: 'proximos',
    texto: 'Próximos primero',
    icono: 'event_upcoming',
    fn: (a, b) => terminado(a) - terminado(b) || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.id - b.id,
  },
  { valor: 'recientes', texto: 'Registrados recientemente', icono: 'schedule', fn: (a, b) => b.id - a.id },
  { valor: 'az', texto: 'Título A-Z', icono: 'arrow_downward', fn: (a, b) => a.titulo.localeCompare(b.titulo, 'es') },
  { valor: 'za', texto: 'Título Z-A', icono: 'arrow_upward', fn: (a, b) => b.titulo.localeCompare(a.titulo, 'es') },
];

// ---------- Organizador ----------
// Si ms-usuarios no lo encontro (o no respondio) el nombre llega en null: se dice asi, sin inventar un "Usuario 1"
const ORGANIZADOR_NO_DISPONIBLE = 'El servicio de usuarios no encontró a este organizador o no respondió.';
function NombreOrganizador({ e }) {
  if (e.organizadorNombre) return e.organizadorNombre;
  return (
    // Antes: No disponible (ID {e.organizador}) -> el id es un dato interno, no se le muestra a la persona
    <span className="text-tenue" title={ORGANIZADOR_NO_DISPONIBLE}>
      Organizador no disponible
    </span>
  );
}

// Lugar del evento: el previsto o el de su reserva; un evento registrado sin lugar dice "Sin lugar definido"
const nombreLugar = (e) => e?.espacioNombre ?? (e?.espacio ? `Espacio ${e.espacio}` : 'Sin lugar definido');

// ---------- Fechas del evento ----------
const esVariosDias = (e) => !!e?.fecha && !!e?.fechaFin && e.fechaFin !== e.fecha;
const numeroDias = (e) => (esVariosDias(e) ? diasEntre(e.fecha, e.fechaFin).length : 1);
const hhmm = (h) => (h ? h.slice(0, 5) : h);
// Sin reserva vigente: el evento sigue en pie pero su reserva se libero fuera de Eventos (Reservas de la agenda)
const textoFechas = (e) => (!e?.fecha ? (e?.reservaLiberada ? 'Sin reserva vigente' : 'Sin fecha') : esVariosDias(e) ? `${fechaCorta(e.fecha)} – ${fechaCorta(e.fechaFin)}` : fechaCorta(e.fecha));
const textoHorario = (e) => (e?.horaInicio && e?.horaFin ? `${hhmm(e.horaInicio)} – ${hhmm(e.horaFin)}` : '');
function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Los mensajes del servicio vienen sin acentos; para los casos conocidos se muestra uno claro (DISENO.md, "Textos")
function mensajeAmigable(err) {
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
  [/dura varios dias/, 'Dura varios días: para cambiar sus fechas, cancélalo y regístralo de nuevo.'],
  [/horario debe estar entre/, 'El horario debe estar entre 07:00 y 21:00.'],
  [/fecha no puede estar en el pasado/, 'La fecha ya pasó. Elige una fecha de hoy en adelante.'],
  [/no tiene una reserva vigente/, 'El evento no tiene una reserva vigente en la agenda, así que no se puede mover.'],
  [/Solo un evento al aire libre/, 'Solo un evento al aire libre puede quedar en riesgo por el clima.'],
  [/MANTENIDO cuando esta EN_RIESGO/, 'Solo se puede mantener un evento que está en riesgo.'],
  [/ya esta en ese espacio/, 'El evento ya está en ese espacio.'],
];

// ---------- Ocupacion del espacio en la agenda de David: ¿cuando esta libre esos dias? ----------
// La ocupacion se carga una vez por espacio y fechas (GET /reservas/espacio/{id}?fecha=, contrato v3) y se dibuja
// como ayuda visual, con los horarios libres. Quien DECIDE si el horario choca es la agenda de David
// (GET /reservas/disponibilidad, como en su Nueva reserva), y de su respuesta se toman los minutos de preparacion
// (margenMinutos; MARGEN_MINUTOS de David solo es el respaldo). Al registrar, la agenda vuelve a revisar.
// Horario de 07:00 a 21:00: regla de Eventos (tambien en ms-eventos), el mismo rango que dibuja la Agenda de David.
const HORA_ABRE = '07:00';
const HORA_CIERRA = '21:00';
const ABRE = minutos(HORA_ABRE);
const CIERRA = minutos(HORA_CIERRA);
const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
// Hora actual redondeada a la siguiente media hora (para no ofrecer horas que ya pasaron)
const ahoraRedondeada = () => Math.ceil(minutos(horaActual()) / 30) * 30;

// ignorarEvento: al reprogramar, la reserva del mismo evento no cuenta como ocupada
function useOcupacion({ espacioId, dias, ignorarEvento = null, token }) {
  const clave = espacioId && dias.length ? `${espacioId}|${dias.join(',')}|${ignorarEvento ?? ''}` : '';
  const [resultado, setResultado] = useState({ clave: '', estado: 'listo', porDia: [] });
  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    // Pequena espera por si la fecha se esta escribiendo a mano
    const reloj = setTimeout(async () => {
      try {
        const porDia = await Promise.all(
          dias.map((fecha) =>
            ocupacionDelDia(espacioId, fecha, token).then((lista) => ({
              fecha,
              reservas: (lista ?? [])
                .filter((r) => r.estado !== 'LIBERADA' && (ignorarEvento == null || Number(r.eventoId) !== Number(ignorarEvento)))
                .map((r) => ({ id: r.id, eventoId: r.eventoId, horaInicio: hhmm(r.horaInicio), horaFin: hhmm(r.horaFin) })),
            })),
          ),
        );
        if (vigente) setResultado({ clave, estado: 'listo', porDia });
      } catch {
        if (vigente) setResultado({ clave, estado: 'error', porDia: [] });
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, token]);
  if (!clave) return { estado: 'pendiente', porDia: [] };
  return resultado.clave === clave ? resultado : { estado: 'cargando', porDia: [] };
}

// Reservas de todos los dias juntas: las de mismo horario se agrupan ("ocupado 2 de 3 dias")
function agruparReservas(porDia) {
  const grupos = new Map();
  porDia.forEach(({ fecha, reservas }) =>
    reservas.forEach((r) => {
      const k = `${r.horaInicio}-${r.horaFin}`;
      const g = grupos.get(k) ?? { ...r, fechas: [], eventos: new Set() };
      g.fechas.push(fecha);
      g.eventos.add(r.eventoId);
      grupos.set(k, g);
    }),
  );
  return [...grupos.values()].sort((a, b) => minutos(a.horaInicio) - minutos(b.horaInicio));
}

// Horarios libres (de 07:00 a 21:00) que sirven TODOS los dias: sin reservas, sin su preparacion y, si es hoy, sin horas pasadas
function horariosLibres(porDia, hoyIncluido, margen) {
  const tapados = porDia.flatMap(({ reservas }) => reservas.map((r) => [minutos(r.horaInicio) - margen, minutos(r.horaFin) + margen]));
  if (hoyIncluido) tapados.push([ABRE, ahoraRedondeada()]);
  tapados.sort((a, b) => a[0] - b[0]);
  const libres = [];
  let desde = ABRE;
  tapados.forEach(([ini, fin]) => {
    if (ini > desde) libres.push([desde, Math.min(ini, CIERRA)]);
    desde = Math.max(desde, fin);
  });
  if (desde < CIERRA) libres.push([desde, CIERRA]);
  return libres.filter(([a, b]) => b - a >= 30).map(([a, b]) => ({ desde: aHora(a), hasta: aHora(b) }));
}

// Reservas con las que choca el horario elegido; pegada = no se cruza, pero no deja el tiempo de preparacion
function choquesDe(porDia, horaInicio, horaFin, margen) {
  const ini = minutos(horaInicio);
  const fin = minutos(horaFin);
  return porDia.flatMap(({ fecha, reservas }) =>
    reservas
      .filter((r) => ini < minutos(r.horaFin) + margen && fin + margen > minutos(r.horaInicio))
      .map((r) => ({ ...r, fecha, pegada: !(ini < minutos(r.horaFin) && fin > minutos(r.horaInicio)) })),
  );
}

// La agenda de David dice si el horario choca esos dias (una consulta por dia, como en su Nueva reserva).
// Mientras revisa se conserva el resultado anterior (no parpadea ni bloquea el boton); solo bloquea un choque confirmado
function useDisponibilidad({ espacioId, dias, horaInicio, horaFin, ignorarEvento = null, activo, token }) {
  const clave = activo && espacioId && dias.length && horaInicio && horaFin ? `${espacioId}|${dias.join(',')}|${horaInicio}|${horaFin}|${ignorarEvento ?? ''}` : '';
  const [resultado, setResultado] = useState({ clave: '', estado: 'listo', choques: [], margen: null });
  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    const reloj = setTimeout(async () => {
      try {
        const respuestas = await Promise.all(
          dias.map((fecha) => consultarDisponibilidad({ espacioId, fecha, horaInicio, horaFin }, token).then((r) => ({ fecha, r }))),
        );
        const margen = respuestas.find(({ r }) => r?.margenMinutos != null)?.r.margenMinutos ?? null;
        const choques = respuestas.flatMap(({ fecha, r }) =>
          (r?.conflictos ?? [])
            .filter((c) => c.estado !== 'LIBERADA' && (ignorarEvento == null || Number(c.eventoId) !== Number(ignorarEvento)))
            .map((c) => ({ id: c.id, eventoId: c.eventoId, fecha, horaInicio: hhmm(c.horaInicio), horaFin: hhmm(c.horaFin) })),
        );
        if (vigente) setResultado({ clave, estado: 'listo', choques, margen });
      } catch {
        if (vigente) setResultado((x) => ({ ...x, clave, estado: 'error', choques: [] }));
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, token]);
  if (!clave) return { estado: 'pendiente', choques: [], margen: resultado.margen, actual: false };
  // actual = el resultado es del horario que se ve ahora; si no, es el anterior mientras llega el nuevo
  return { ...resultado, estado: resultado.clave === clave ? resultado.estado : 'revisando', actual: resultado.clave === clave };
}

// Todo lo que el formulario necesita saber del horario elegido
function useHorario({ espacioId, dias, horaInicio, horaFin, ignorarEvento, activo = true, token }) {
  const ocupacion = useOcupacion({ espacioId, dias, ignorarEvento, token });
  const revision = useDisponibilidad({ espacioId, dias, horaInicio, horaFin, ignorarEvento, activo, token });
  // Antes: const margen = MARGEN_MINUTOS;
  const margen = revision.margen ?? MARGEN_MINUTOS;
  const hoyIncluido = dias.includes(hoyIso());
  const horarioCompleto = !!horaInicio && !!horaFin && minutos(horaFin) > minutos(horaInicio);
  const listo = ocupacion.estado === 'listo';
  // Sin horario (por ejemplo, el panel de cambiar de espacio cerrado) no se calcula: minutos(undefined) rompia la pagina
  const ini = horarioCompleto ? minutos(horaInicio) : 0;
  const fin = horarioCompleto ? minutos(horaFin) : 0;
  return {
    ...ocupacion,
    margen,
    hoyIncluido,
    grupos: listo ? agruparReservas(ocupacion.porDia) : [],
    libres: listo ? horariosLibres(ocupacion.porDia, hoyIncluido, margen) : [],
    // Estimacion para pintar la barra al instante (con el margen que dio la agenda)
    // Antes tambien decidia el bloqueo: choques: listo && horarioCompleto ? choquesDe(...) : [],
    estimados: listo && horarioCompleto ? choquesDe(ocupacion.porDia, horaInicio, horaFin, margen) : [],
    // Lo que dice la agenda; pegada = no se cruza, pero no deja el tiempo de preparacion (como seCruza de David)
    revision: revision.estado,
    choques: horarioCompleto ? revision.choques.map((c) => ({ ...c, pegada: !(ini < minutos(c.horaFin) && fin > minutos(c.horaInicio)) })) : [],
    // Solo bloquea un choque confirmado para el horario que se ve ahora
    bloquea: revision.actual && revision.estado === 'listo' && revision.choques.length > 0,
  };
}

// Errores de las fechas que se ven al momento (antes solo al pulsar Registrar; una fecha pasada escrita a mano
// dejaba la barra diciendo "elige la fecha" sin explicar por que)
function erroresFechas({ fecha, variosDias, fechaFin }) {
  const x = {};
  if (fecha && fecha < hoyIso()) x.fecha = 'La fecha ya pasó';
  if (variosDias && fecha && fechaFin) {
    if (fechaFin <= fecha) x.fechaFin = 'Debe ser después del primer día';
    else if (diasEntre(fecha, fechaFin).length > DIAS_MAXIMOS) x.fechaFin = `Máximo ${DIAS_MAXIMOS} días`;
  }
  return x;
}

// Errores del horario que se ven al momento (sin esperar a Registrar)
function erroresHorario({ fecha, horaInicio, horaFin }) {
  const x = {};
  if (!horaInicio || !horaFin) return x;
  if (minutos(horaInicio) < ABRE || minutos(horaInicio) >= CIERRA) x.horaInicio = `Elige entre ${HORA_ABRE} y ${HORA_CIERRA}`;
  else if (fecha === hoyIso() && minutos(horaInicio) <= minutos(horaActual())) x.horaInicio = 'Esa hora ya pasó';
  if (minutos(horaFin) <= minutos(horaInicio)) x.horaFin = 'Debe ser después del inicio';
  else if (minutos(horaFin) > CIERRA) x.horaFin = `Como máximo ${HORA_CIERRA}`;
  return x;
}

// Barra del dia (07:00-21:00): ocupado en gris, preparacion rayada, horas pasadas atenuadas y el horario elegido en azul (rojo si choca)
function OcupacionDia({ horario, horaInicio, horaFin, dias, titulos, onElegir, falta = 'Elige el espacio y la fecha para ver cuándo está libre.' }) {
  const total = CIERRA - ABRE;
  const pos = (m) => `${((Math.min(Math.max(m, ABRE), CIERRA) - ABRE) / total) * 100}%`;
  const ancho = (a, b) => `${((Math.min(Math.max(b, ABRE), CIERRA) - Math.min(Math.max(a, ABRE), CIERRA)) / total) * 100}%`;
  const nombre = (id) => titulos.get(Number(id)) ?? `Evento ${id}`;

  if (horario.estado === 'pendiente') {
    return (
      <div className="rounded-lg border border-dashed border-borde p-3 text-center text-xs text-texto-2">{falta}</div>
    );
  }
  if (horario.estado === 'error') {
    return (
      <Aviso tipo="aviso">No se pudo cargar la ocupación del espacio. Puedes registrar igual: la agenda revisa el horario al guardar.</Aviso>
    );
  }

  const ini = horaInicio ? minutos(horaInicio) : 0;
  const fin = horaFin ? minutos(horaFin) : 0;
  const elegido = horaInicio && horaFin && fin > ini;
  // En rojo si choca con otra reserva o cae en horas que ya pasaron
  const choca = horario.estimados.length > 0 || (horario.hoyIncluido && ini <= minutos(horaActual()));
  const varios = dias.length > 1;
  const pasado = horario.hoyIncluido ? Math.min(ahoraRedondeada(), CIERRA) : ABRE;

  return (
    <div className="rounded-lg border border-borde bg-lienzo p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-texto">{varios ? `Ocupación de los ${dias.length} días` : 'Ocupación del día'}</span>
        {horario.estado === 'cargando' && (
          <span className="flex items-center gap-1 text-texto-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-borde border-t-marino" />
            Cargando...
          </span>
        )}
      </div>

      {/* Barra del dia */}
      <div className={`relative h-9 overflow-hidden rounded-md border border-borde bg-superficie ${horario.estado === 'cargando' ? 'opacity-50' : ''}`}>
        {pasado > ABRE && <div title="Horas que ya pasaron" className="rayado absolute inset-y-0 bg-borde-suave" style={{ left: 0, width: ancho(ABRE, pasado) }} />}
        {horario.grupos.map((g) => {
          const a = minutos(g.horaInicio);
          const b = minutos(g.horaFin);
          const quien = [...g.eventos].map(nombre).join(', ');
          const cuando = varios ? ` (${g.fechas.length} de ${dias.length} días)` : '';
          return (
            <div key={`${g.horaInicio}-${g.horaFin}`}>
              {horario.margen > 0 && (
                <div
                  title={`Preparación de la sala (${horario.margen} min)`}
                  className="rayado absolute inset-y-0 border-x border-dashed border-borde"
                  style={{ left: pos(a - horario.margen), width: ancho(a - horario.margen, b + horario.margen) }}
                />
              )}
              <div
                title={`Ocupado ${g.horaInicio} – ${g.horaFin}${cuando}: ${quien}`}
                className="absolute inset-y-1 rounded bg-tenue/50"
                style={{ left: pos(a), width: ancho(a, b) }}
              />
            </div>
          );
        })}
        {elegido && (
          <div
            title={`Tu horario: ${horaInicio} – ${horaFin}`}
            className={`absolute inset-y-0 rounded border-2 ${choca ? 'border-peligro bg-peligro/20' : 'border-marino bg-marino/20'}`}
            style={{ left: pos(ini), width: ancho(ini, fin) }}
          />
        )}
      </div>
      {/* Horas de referencia */}
      <div className="relative mt-1 h-4 text-[10px] text-tenue tabular">
        {[7, 9, 11, 13, 15, 17, 19, 21].map((h) => (
          <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pos(h * 60) }}>
            {h}:00
          </span>
        ))}
      </div>

      {/* Horarios libres: al tocar uno se llenan las horas */}
      {horario.estado === 'listo' && onElegir && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs text-texto-2">
            {horario.libres.length
              ? `Horarios libres${varios ? ' todos los días' : ''} (toca uno para usarlo):`
              : varios
                ? 'No hay un horario libre que sirva todos los días. Prueba otras fechas u otro espacio.'
                : 'No queda horario libre ese día. Prueba otra fecha u otro espacio.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {horario.libres.map((l) => (
              <button
                key={l.desde}
                type="button"
                onClick={() => onElegir(l)}
                className="rounded-full border border-exito-borde bg-exito-tinte px-2.5 py-1 text-xs font-medium text-exito-texto tabular hover:brightness-95"
              >
                {l.desde} – {l.hasta}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Resultado del horario elegido, debajo de las horas
function LineaHorario({ horario, dias, titulos, sinErrores }) {
  // Antes: if (horario.estado !== 'listo' || !sinErrores) return RESERVA;
  if (!sinErrores || horario.revision === 'pendiente') return RESERVA;
  if (horario.revision === 'error') return <LineaAyuda tono="aviso">No se pudo revisar con la agenda; se revisará al registrar.</LineaAyuda>;
  // Mientras la agenda revisa el horario nuevo, el resultado anterior se ve atenuado (no parpadea)
  if (horario.revision === 'revisando') return <span className="opacity-50">{lineaResultado(horario, dias, titulos)}</span>;
  return lineaResultado(horario, dias, titulos);
}

function lineaResultado(horario, dias, titulos) {
  if (!horario.choques.length)
    return <LineaAyuda tono="exito">{dias > 1 ? `El espacio está libre los ${dias} días en ese horario.` : 'El espacio está libre en ese horario.'}</LineaAyuda>;
  const c = horario.choques[0];
  // Con el titulo entre comillas; si no se conoce (evento de otra persona fuera de la lista), "otra reserva"
  const titulo = titulos.get(Number(c.eventoId));
  const quien = titulo ? `"${corto(titulo, 30)}"` : 'otra reserva';
  const enDia = dias > 1 ? ` el ${fechaCorta(c.fecha)}` : '';
  const mas = new Set(horario.choques.map((x) => x.fecha)).size - 1;
  return (
    <LineaAyuda tono="peligro">
      {c.pegada
        ? `Muy pegado a ${quien} (${c.horaInicio} – ${c.horaFin})${enDia}: se dejan ${horario.margen} min para preparar la sala.`
        : `Choca con ${quien} (${c.horaInicio} – ${c.horaFin})${enDia}.`}
      {mas > 0 ? ` También choca ${mas === 1 ? 'otro día' : `otros ${mas} días`}.` : ''}
    </LineaAyuda>
  );
}

// Al tocar un horario libre: empieza al inicio del hueco y conserva la duracion elegida (si cabe)
function horasDesdeLibre(libre, horaInicio, horaFin) {
  const dur = horaInicio && horaFin && minutos(horaFin) > minutos(horaInicio) ? minutos(horaFin) - minutos(horaInicio) : 120;
  const ini = minutos(libre.desde);
  return { horaInicio: libre.desde, horaFin: aHora(Math.min(ini + dur, minutos(libre.hasta))) };
}

// Texto del espacio en los selectores: "Auditorio principal · Auditorio · 60 personas · techado"
const textoEspacio = (e) => `${e.nombre} · ${tipoEspacio(e.tipo)} · ${Number(e.capacidad).toLocaleString('es-MX')} personas · ${e.esAlAireLibre ? 'al aire libre' : 'techado'}`;

// ---------- Registrar o editar (panel lateral) ----------
const VACIO = { titulo: '', descripcion: '', categoria: '', cupo: '', espacio: '', fecha: '', variosDias: false, fechaFin: '', horaInicio: '10:00', horaFin: '12:00', organizador: '' };
const deEvento = (e) => ({
  titulo: e.titulo ?? '',
  descripcion: e.descripcion ?? '',
  categoria: e.categoria != null ? String(e.categoria) : '',
  cupo: e.cupoMaximo != null ? String(e.cupoMaximo) : '',
  espacio: e.espacio != null ? String(e.espacio) : '',
  fecha: e.fecha ?? '',
  variosDias: esVariosDias(e),
  fechaFin: e.fechaFin ?? '',
  horaInicio: hhmm(e.horaInicio) ?? '',
  horaFin: hhmm(e.horaFin) ?? '',
  organizador: e.organizador != null ? String(e.organizador) : '',
});

// Antes (hasta el 22 nov 2026) la seccion 2 del formulario pedia espacio obligatorio, varios dias, fechas,
// la barra de ocupacion y el horario, y ms-eventos apartaba la reserva al registrar:
//         <SeccionFormulario numero={2} titulo="Lugar y fecha">
//           {nueva ? (
//             <div className="grid gap-3">
//               <Campo
//                 etiqueta="Espacio"
//                 obligatorio
//                 error={errores.espacio}
//                 ayuda={
//                   espacioSel ? (
//                     <LineaAyuda tono="info">
//                       {espacioSel.esAlAireLibre ? 'Al aire libre: Clima podrá marcar el evento en riesgo.' : 'Techado: el clima no afecta al evento.'}
//                     </LineaAyuda>
//                   ) : (
//                     RESERVA
//                   )
//                 }
//               >
//                 <Selector className="h-11" value={form.espacio} onChange={(e) => cambiar('espacio', e.target.value)}>
//                   <option value="">Elige el espacio...</option>
//                   {/* El cupo va despues del espacio: ya no se deshabilitan espacios por el cupo escrito */}
//                   {disponibles.map((e) => (
//                     <option key={e.id} value={e.id}>
//                       {textoEspacio(e)}
//                     </option>
//                   ))}
//                 </Selector>
//               </Campo>
//               {campoCupo}
//               {/* Primero si es de varios dias, luego las fechas; asi el formulario no cambia de forma despues */}
//               <div className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-lienzo px-4 py-3">
//                 <span className="flex items-center gap-2 text-sm text-texto">
//                   <Icono nombre="date_range" className="text-[20px] text-marino" />
//                   <span>
//                     <span className="font-medium">Varios días</span>
//                     <span className="block text-xs text-texto-2">Mismo espacio y horario cada día (máximo {DIAS_MAXIMOS}).</span>
//                   </span>
//                 </span>
//                 <Interruptor
//                   activo={form.variosDias}
//                   onChange={(v) => {
//                     setForm((f) => ({ ...f, variosDias: v, fechaFin: v ? f.fechaFin : '' }));
//                     setErrores((x) => ({ ...x, fechaFin: '' }));
//                   }}
//                   etiqueta="Varios días"
//                 />
//               </div>
//               {/* Sin icono propio en fechas y horas: el navegador ya pone el suyo (antes salian dos) */}
//               <div className="grid gap-3 sm:grid-cols-2">
//                 <Campo etiqueta={form.variosDias ? 'Primer día' : 'Fecha'} obligatorio error={errorDe('fecha')} ayuda={RESERVA}>
//                   <Entrada type="date" min={hoyIso()} value={form.fecha} onChange={(e) => cambiar('fecha', e.target.value)} error={errorDe('fecha')} />
//                 </Campo>
//                 {form.variosDias ? (
//                   <Campo etiqueta="Último día" obligatorio error={errorDe('fechaFin')} ayuda={dias.length > 1 && fechasValidas ? <LineaAyuda tono="info">{dias.length} días.</LineaAyuda> : RESERVA}>
//                     <Entrada
//                       type="date"
//                       min={form.fecha ? sumarDias(form.fecha, 1) : hoyIso()}
//                       max={form.fecha ? sumarDias(form.fecha, DIAS_MAXIMOS - 1) : undefined}
//                       value={form.fechaFin}
//                       onChange={(e) => cambiar('fechaFin', e.target.value)}
//                       error={errorDe('fechaFin')}
//                     />
//                   </Campo>
//                 ) : (
//                   <div className="hidden sm:block" />
//                 )}
//               </div>
//               <OcupacionDia
//                 horario={horario}
//                 horaInicio={form.horaInicio}
//                 horaFin={form.horaFin}
//                 falta={
//                   !form.espacio
//                     ? 'Elige el espacio para ver cuándo está libre.'
//                     : !form.fecha
//                       ? 'Elige la fecha para ver cuándo está libre.'
//                       : vivos.fecha || vivos.fechaFin
//                         ? 'Corrige la fecha para ver cuándo está libre.'
//                         : 'Elige el último día para ver cuándo está libre.'
//                 }
//                 dias={fechasValidas ? dias : []}
//                 titulos={titulos}
//                 onElegir={(l) => {
//                   setForm((f) => ({ ...f, ...horasDesdeLibre(l, f.horaInicio, f.horaFin) }));
//                   setErrores((x) => ({ ...x, horaInicio: '', horaFin: '' }));
//                 }}
//               />
//               <div className="grid grid-cols-2 gap-3">
//                 <Campo etiqueta="Hora de inicio" obligatorio error={errorDe('horaInicio')} ayuda={RESERVA}>
//                   <Entrada type="time" min={HORA_ABRE} max={HORA_CIERRA} value={form.horaInicio} onChange={(e) => cambiar('horaInicio', e.target.value)} error={errorDe('horaInicio')} />
//                 </Campo>
//                 <Campo etiqueta="Hora de fin" obligatorio error={errorDe('horaFin')} ayuda={RESERVA}>
//                   <Entrada type="time" min={HORA_ABRE} max={HORA_CIERRA} value={form.horaFin} onChange={(e) => cambiar('horaFin', e.target.value)} error={errorDe('horaFin')} />
//                 </Campo>
//               </div>
//               <p className="-mt-2 min-h-[18px] text-xs">
//                 <LineaHorario horario={horario} dias={dias.length} titulos={titulos} sinErrores={!Object.keys(vivos).length} />
//               </p>
//             </div>
//           ) : (
//             <div className="rounded-lg border border-borde bg-lienzo p-4 text-sm">
//               <p className="flex items-center gap-2 text-texto">
//                 <Icono nombre={evento?.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[18px] text-marino" />
//                 {evento?.espacioNombre ?? `Espacio ${evento?.espacio}`}
//               </p>
//               <p className="mt-1.5 flex items-center gap-2 text-texto-2">
//                 <Icono nombre="calendar_today" className="text-[18px]" />
//                 {textoFechas(evento)} {textoHorario(evento) && `· ${textoHorario(evento)}`}
//               </p>
//             </div>
//           )}
//           {!nueva && <div className="mt-3">{campoCupo}</div>}
//         </SeccionFormulario>

// Antes (22 nov 2026, por la tarde) la seccion 2 tenia el "lugar previsto" opcional; el lugar ahora se aparta en Reservas:
//         <SeccionFormulario numero={2} titulo={editarLugar ? 'Lugar previsto y cupo' : 'Lugar, fecha y cupo'}>
//           {editarLugar ? (
//             <div className="grid gap-3">
//               <Campo
//                 etiqueta="Lugar previsto"
//                 error={errores.espacio}
//                 ayuda={
//                   espacioSel ? (
//                     <LineaAyuda tono="info">
//                       {espacioSel.esAlAireLibre ? 'Al aire libre: Clima podrá marcar el evento en riesgo.' : 'Techado: el clima no afecta al evento.'}
//                     </LineaAyuda>
//                   ) : (
//                     <LineaAyuda>Opcional: si aún no saben dónde, déjalo sin definir.</LineaAyuda>
//                   )
//                 }
//               >
//                 <Selector className="h-11" value={form.espacio} onChange={(e) => cambiar('espacio', e.target.value)}>
//                   {/* Quitar el lugar ya elegido no se puede (ms-eventos lo conserva si no se manda) */}
//                   {(nueva || !evento?.espacio) && <option value="">Sin definir</option>}
//                   {opcionesLugar.map((e) => (
//                     <option key={e.id} value={e.id}>
//                       {textoEspacio(e)}
//                     </option>
//                   ))}
//                 </Selector>
//               </Campo>
//               {campoCupo}
//               <Aviso tipo="info">La fecha y el horario se apartan en Reservas: abre el detalle del evento y usa "Apartar lugar y fecha".</Aviso>
//             </div>

// titulos ya no se usa aqui (era para la barra de ocupacion); la pagina lo sigue mandando
function FormularioEvento({ abierto, modo, evento, categorias, espacios, catalogosListos, onCerrar, onGuardado }) {
  const { sesion } = useAuth();
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const nueva = modo === 'nueva';
  const [form, setForm] = useState(VACIO);
  const [inicial, setInicial] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [preguntarCerrar, setPreguntarCerrar] = useState(false);
  const hayCambios = inicial !== null && JSON.stringify(form) !== JSON.stringify(inicial);

  // El administrador puede registrar a nombre de un organizador (lista de ms-usuarios, solo ADMINISTRADOR)
  const organizadores = useDatos(
    () => (esAdmin && abierto ? listarUsuarios({ tipo: 'ORGANIZADOR', estado: 'ACTIVO' }, sesion.token) : Promise.resolve(null)),
    [esAdmin, abierto, sesion.token],
  );

  useEffect(() => {
    if (!abierto) return;
    const datos = evento ? deEvento(evento) : VACIO;
    setForm(datos);
    setInicial(datos);
    setErrores({});
    setError(null);
    setPreguntarCerrar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, evento]);

  function intentarCerrar() {
    if (guardando) return;
    if (hayCambios) setPreguntarCerrar(true);
    else onCerrar();
  }

  const cambiar = (clave, valor) => {
    setForm((f) => ({ ...f, [clave]: valor }));
    setErrores((x) => ({ ...x, [clave]: '' }));
  };
  // Al escribir: sin espacios de mas, primera letra en mayuscula y sin caracteres que el servicio no acepta
  function cambiarTexto(campo, valor) {
    const r = filtrarCampo(campo, limpiarEspacios(valor));
    setForm((f) => ({ ...f, [campo]: primeraMayuscula(r.valor) }));
    setErrores((x) => ({ ...x, [campo]: r.error.startsWith('Máximo') ? '' : r.error }));
  }

  // Solo espacios activos y DISPONIBLES (los que ms-eventos acepta); al editar, el del evento aunque ya no este en la lista
  // const disponibles = useMemo(() => espacios.filter((e) => e.estatus !== 0 && (e.estado ?? 'DISPONIBLE') === 'DISPONIBLE'), [espacios]);
  const espacioSel = espacios.find((e) => String(e.id) === form.espacio);
  const capacidad = espacioSel?.capacidad ?? null;
  // (22 nov 2026) El evento se registra sin fecha ni horario: se apartan despues en la Agenda (Nueva reserva de David).
  // Antes el formulario revisaba la ocupacion y el horario:
  // const dias = !form.fecha ? [] : form.variosDias && form.fechaFin >= form.fecha ? diasEntre(form.fecha, form.fechaFin) : [form.fecha];
  // const fechasValidas = !!form.fecha && form.fecha >= hoyIso() && (!form.variosDias || (form.fechaFin > form.fecha && dias.length <= DIAS_MAXIMOS));
  // const horario = useHorario({
  // espacioId: nueva && fechasValidas ? form.espacio : null,
  // dias: fechasValidas ? dias : [],
  // horaInicio: form.horaInicio,
  // horaFin: form.horaFin,
  // // Solo se pregunta a la agenda si el horario es valido (dentro de 07:00-21:00, no pasado, fin despues del inicio)
  // activo: !Object.keys(erroresHorario(form)).length,
  // token: sesion.token,
  // });
  // // Errores del horario al momento (hora pasada, fuera de 07:00-21:00, fin antes del inicio)
  // // Antes: const vivos = nueva ? erroresHorario(form) : {};
  // const vivos = nueva ? { ...erroresFechas(form), ...erroresHorario(form) } : {};
  // const vivos = {}; (ya no hay fechas ni horas que revisar al momento)
  // Sin fecha todavia (aun no se aparta en Reservas): el formulario solo pide el cupo en la seccion 2
  const editarLugar = nueva || !evento?.fecha;
  // Ya no se elige lugar aqui (se aparta en Reservas). Antes, las opciones de lugar previsto:
  // const opcionesLugar = espacioSel && !disponibles.some((e) => e.id === espacioSel.id) ? [espacioSel, ...disponibles] : disponibles;
  // const errorDe = (k) => errores[k] || vivos[k] || ''; (era para fechas y horas)

  // Revisa antes de enviar; devuelve los errores por campo (vacio = todo bien)
  function revisar() {
    const x = {};
    const titulo = form.titulo.trim();
    if (!titulo) x.titulo = 'El título es obligatorio';
    else if (titulo.length < MIN_TITULO) x.titulo = `Escribe al menos ${MIN_TITULO} caracteres`;
    else if (!tieneLetra(titulo)) x.titulo = 'El título debe incluir al menos una letra';
    if (!form.categoria) x.categoria = 'Elige una categoría';
    const cupo = Number(form.cupo);
    if (!form.cupo || cupo <= 0) x.cupo = 'Es obligatorio';
    else if (capacidad != null && cupo > capacidad) x.cupo = `El espacio admite ${capacidad.toLocaleString('es-MX')}`;
    // Antes, al registrar tambien eran obligatorios el espacio, la fecha y el horario:
    // if (nueva) {
    // const hoy = hoyIso();
    // if (!form.espacio) x.espacio = 'Elige el espacio';
    // if (!form.fecha) x.fecha = 'Elige la fecha';
    // else if (form.fecha < hoy) x.fecha = 'La fecha ya pasó';
    // if (form.variosDias) {
    // if (!form.fechaFin) x.fechaFin = 'Elige el último día';
    // else if (form.fechaFin <= form.fecha) x.fechaFin = 'Debe ser después del primer día';
    // else if (dias.length > DIAS_MAXIMOS) x.fechaFin = `Máximo ${DIAS_MAXIMOS} días`;
    // }
    // if (!form.horaInicio || !form.horaFin) x.horaFin = 'Indica el horario';
    // // else if (minutos(form.horaFin) <= minutos(form.horaInicio)) x.horaFin = 'Debe ser después del inicio';
    // // else if (form.fecha === hoy && form.horaInicio <= horaActual()) x.horaInicio = 'Esa hora ya pasó';
    // else Object.assign(x, erroresHorario(form));
    // }
    return x;
  }

  const motivoBloqueo = !catalogosListos
    ? 'Cargando categorías y espacios...'
    : !nueva && !hayCambios
      ? 'No hay cambios para guardar.'
      : // Antes: nueva && horario.bloquea ? 'El espacio está ocupado en ese horario.' :
        null;

  async function guardar() {
    if (motivoBloqueo) return;
    const x = revisar();
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    setError(null);
    try {
      const comunes = {
        titulo: primeraMayuscula(form.titulo.trim()),
        descripcion: form.descripcion.trim(),
        categoria: Number(form.categoria),
        cupoMaximo: Number(form.cupo),
      };
      const r = nueva
        ? await crearEvento(
            {
              ...comunes,
              // Sin lugar: el lugar se aparta en Reservas (vista de David) junto con la fecha. Antes (lugar previsto opcional):
              // ...(form.espacio ? { espacio: Number(form.espacio), esAlAireLibre: !!espacioSel?.esAlAireLibre } : {}),
              // Antes tambien: fecha, horaInicio, horaFin y fechaFin (se apartaba la reserva al registrar)
              ...(esAdmin && form.organizador ? { organizador: Number(form.organizador) } : {}),
            },
            sesion.token,
          )
        : await actualizarEvento(
            evento.id,
            {
              ...comunes,
              // El lugar no se edita aqui (se aparta en Reservas o con "Cambiar de espacio"). Antes, sin fecha, el lugar previsto:
              // espacio: editarLugar && form.espacio ? Number(form.espacio) : evento.espacio,
              espacio: evento.espacio,
              esAlAireLibre: evento.esAlAireLibre,
              organizador: esAdmin && form.organizador ? Number(form.organizador) : evento.organizador,
            },
            sesion.token,
          );
      onGuardado(r, nueva ? 'registrado' : 'editado');
    } catch (err) {
      setError(mensajeAmigable(err));
    } finally {
      setGuardando(false);
    }
  }

  const ayudaTitulo = form.titulo.length >= MAX_TITULO ? <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_TITULO} caracteres.</LineaAyuda> : RESERVA;
  const ayudaDescripcion =
    form.descripcion.length >= MAX_DESCRIPCION ? <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_DESCRIPCION} caracteres.</LineaAyuda> : RESERVA;
  const ayudaCupo =
    capacidad != null ? (
      <LineaAyuda tono="info">
        En {espacioSel.nombre} caben hasta {capacidad.toLocaleString('es-MX')} personas.
      </LineaAyuda>
    ) : editarLugar ? (
      // Antes: "Primero elige el espacio para ver cuántas personas caben."
      <LineaAyuda>Cuántas personas esperan. Al apartar el lugar en Reservas, revisa que quepan.</LineaAyuda>
    ) : (
      RESERVA
    );
  // El error de cupo sale en cuanto pasa de la capacidad (al escribir o al cambiar a un espacio mas chico)
  const excedeCupo = capacidad != null && !!form.cupo && Number(form.cupo) > capacidad;
  const errorCupo = errores.cupo || (excedeCupo ? `El espacio admite ${capacidad.toLocaleString('es-MX')} personas` : '');
  const campoCupo = (
    <Campo etiqueta="Cupo" obligatorio error={errorCupo} ayuda={ayudaCupo}>
      <Entrada
        icono="groups"
        inputMode="numeric"
        placeholder={capacidad != null ? `Hasta ${capacidad.toLocaleString('es-MX')}` : 'Ej. 50'}
        value={form.cupo}
        onChange={(e) => cambiar('cupo', e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5))}
        error={errorCupo}
        derecha={<span className="text-xs text-tenue">personas</span>}
      />
    </Campo>
  );

  const pie = (
    <>
      {error && (
        <Aviso tipo="error" className="mb-3" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Boton variante="secundario" onClick={intentarCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Globo texto={motivoBloqueo} className={motivoBloqueo ? '' : 'contents'}>
          <Boton icono={nueva ? 'add' : 'save'} cargando={guardando} onClick={guardar} disabled={!!motivoBloqueo}>
            {nueva ? 'Registrar evento' : 'Guardar cambios'}
          </Boton>
        </Globo>
      </div>
    </>
  );

  return (
    <>
      <Panel
        abierto={abierto}
        onCerrar={() => !preguntarCerrar && intentarCerrar()}
        titulo={nueva ? 'Nuevo evento' : 'Editar evento'}
        // Antes: nueva ? 'Se aparta el espacio en la agenda al registrarlo.' : 'Para cambiar el lugar o la fecha usa ...'
        subtitulo={nueva ? 'El lugar, la fecha y el horario se apartan después en Reservas.' : editarLugar ? 'Aún no tiene lugar ni fecha: se apartan en Reservas.' : 'Para cambiar el lugar o la fecha usa "Cambiar de espacio" o "Reprogramar".'}
        pie={pie}
      >
        <SeccionFormulario numero={1} titulo="Datos del evento">
          <div className="grid gap-3">
            <Campo etiqueta="Título" obligatorio error={errores.titulo} ayuda={ayudaTitulo} extra={<ContadorCaracteres actual={form.titulo.length} maximo={MAX_TITULO} />}>
              <Entrada icono="event" placeholder="Ej. Semana de la ingeniería" value={form.titulo} maxLength={MAX_TITULO} onChange={(e) => cambiarTexto('titulo', e.target.value)} error={errores.titulo} />
            </Campo>
            <Campo etiqueta="Descripción" error={errores.descripcion} ayuda={ayudaDescripcion} extra={<ContadorCaracteres actual={form.descripcion.length} maximo={MAX_DESCRIPCION} />}>
              <AreaTexto rows={3} placeholder="De qué trata y a quién va dirigido" value={form.descripcion} maxLength={MAX_DESCRIPCION} onChange={(e) => cambiarTexto('descripcion', e.target.value)} error={errores.descripcion} />
            </Campo>
            <div className={`grid gap-3 ${esAdmin ? 'sm:grid-cols-2' : ''}`}>
              <Campo etiqueta="Categoría" obligatorio error={errores.categoria} ayuda={RESERVA}>
                <Selector className="h-11" value={form.categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
                  <option value="">Elige la categoría...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              {esAdmin && (
                <Campo etiqueta="Organizador" ayuda={organizadores.error ? <LineaAyuda tono="aviso">No se pudo cargar la lista de organizadores.</LineaAyuda> : RESERVA}>
                  <Selector className="h-11" value={form.organizador === String(sesion.usuarioId) ? '' : form.organizador} onChange={(e) => cambiar('organizador', e.target.value)}>
                    <option value="">{nueva ? 'Yo (administrador)' : 'Sin cambio'}</option>
                    {(organizadores.datos ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.nombre} ${u.apellidos ?? ''}`.trim()}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
            </div>
          </div>
        </SeccionFormulario>

        <SeccionFormulario numero={2} titulo={editarLugar ? 'Cupo' : 'Lugar, fecha y cupo'}>
          {editarLugar ? (
            <div className="grid gap-3">
              {campoCupo}
              <Aviso tipo="info">El lugar, la fecha y el horario se apartan en Reservas: abre el detalle del evento y usa "Apartar lugar y fecha".</Aviso>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-borde bg-lienzo p-4 text-sm">
                <p className="flex items-center gap-2 text-texto">
                  <Icono nombre={evento?.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[18px] text-marino" />
                  {evento?.espacioNombre ?? (evento?.espacio ? `Espacio ${evento.espacio}` : 'Sin lugar definido')}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-texto-2">
                  <Icono nombre="calendar_today" className="text-[18px]" />
                  {textoFechas(evento)} {textoHorario(evento) && `· ${textoHorario(evento)}`}
                </p>
              </div>
              <div className="mt-3">{campoCupo}</div>
            </>
          )}
        </SeccionFormulario>
      </Panel>

      <Confirmar
        abierto={abierto && preguntarCerrar}
        onCerrar={() => setPreguntarCerrar(false)}
        onConfirmar={() => {
          setPreguntarCerrar(false);
          onCerrar();
        }}
        icono="edit_off"
        tono="aviso"
        titulo="¿Descartar los cambios?"
        textoCancelar="Seguir editando"
        textoConfirmar="Descartar"
        iconoConfirmar="delete"
      >
        Lo que escribiste en el formulario no se ha guardado y se perderá.
      </Confirmar>
    </>
  );
}

// ---------- Reprogramar (solo eventos de un dia) ----------
// La pagina le pone key={evento.id}: con cada evento el panel empieza de cero con su fecha y horario actuales
function PanelReprogramar({ evento, titulos, onCerrar, onHecho }) {
  const { sesion } = useAuth();
  const [form, setForm] = useState(() => ({
    fecha: evento?.fecha ?? '',
    horaInicio: hhmm(evento?.horaInicio) ?? '10:00',
    horaFin: hhmm(evento?.horaFin) ?? '12:00',
  }));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const sinCambio = !!evento && form.fecha === evento.fecha && form.horaInicio === hhmm(evento.horaInicio) && form.horaFin === hhmm(evento.horaFin);
  const horario = useHorario({
    espacioId: evento && form.fecha >= hoyIso() ? evento.espacio : null,
    dias: form.fecha ? [form.fecha] : [],
    horaInicio: form.horaInicio,
    horaFin: form.horaFin,
    ignorarEvento: evento?.id,
    activo: !Object.keys(erroresHorario(form)).length,
    token: sesion.token,
  });
  // Errores del horario al momento; los de "Reprogramar" (fecha vacia, etc.) se suman al pulsar
  // Antes: const vivos = erroresHorario(form);
  const vivos = { ...erroresFechas({ fecha: form.fecha }), ...erroresHorario(form) };
  const errorDe = (k) => errores[k] || vivos[k] || '';
  const motivo = sinCambio ? 'Elige una fecha u horario distintos.' : horario.bloquea ? 'El espacio está ocupado en ese horario.' : null;
  const cambiar = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrores((x) => ({ ...x, [k]: '' }));
  };

  async function guardar() {
    if (motivo) return;
    const x = {};
    const hoy = hoyIso();
    if (!form.fecha) x.fecha = 'Elige la fecha';
    else if (form.fecha < hoy) x.fecha = 'La fecha ya pasó';
    // if (minutos(form.horaFin) <= minutos(form.horaInicio)) x.horaFin = 'Debe ser después del inicio';
    // else if (form.fecha === hoy && form.horaInicio <= horaActual()) x.horaInicio = 'Esa hora ya pasó';
    Object.assign(x, erroresHorario(form));
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await reprogramarEvento(evento.id, form, sesion.token);
      onHecho(r, `Evento reprogramado: ${corto(r.titulo, 40)}`);
    } catch (err) {
      setError(mensajeAmigable(err));
    } finally {
      setGuardando(false);
    }
  }

  const pie = (
    <>
      {error && (
        <Aviso tipo="error" className="mb-3" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Globo texto={motivo} className={motivo ? '' : 'contents'}>
          <Boton icono="update" cargando={guardando} onClick={guardar} disabled={!!motivo}>
            Reprogramar
          </Boton>
        </Globo>
      </div>
    </>
  );

  return (
    <Panel abierto={!!evento} onCerrar={() => !guardando && onCerrar()} titulo="Reprogramar evento" subtitulo="Mismo espacio; cambian la fecha o el horario. El evento queda como Reprogramado." pie={pie}>
      {evento && (
        <>
          <p className="mb-4 rounded-lg border border-borde bg-lienzo p-3 text-sm text-texto-2">
            <span className="font-medium text-texto">{evento.titulo}</span>
            <span className="block">
              {/* Antes: Ahora: {textoFechas} · {textoHorario} · {espacio} (sin horario quedaba "· ·") */}
              Ahora: {[textoFechas(evento), textoHorario(evento), nombreLugar(evento)].filter(Boolean).join(' · ')}
            </span>
          </p>
          <div className="grid gap-3">
            {/* Sin icono propio en fecha y horas: el navegador ya pone el suyo (antes salian dos) */}
            <Campo etiqueta="Nueva fecha" obligatorio error={errorDe('fecha')} ayuda={RESERVA}>
              <Entrada type="date" min={hoyIso()} value={form.fecha} onChange={(e) => cambiar('fecha', e.target.value)} error={errorDe('fecha')} />
            </Campo>
            <OcupacionDia
              horario={horario}
              horaInicio={form.horaInicio}
              horaFin={form.horaFin}
              falta={vivos.fecha ? 'Corrige la fecha para ver cuándo está libre.' : 'Elige la fecha para ver cuándo está libre.'}
              dias={form.fecha ? [form.fecha] : []}
              titulos={titulos}
              onElegir={(l) => setForm((f) => ({ ...f, ...horasDesdeLibre(l, f.horaInicio, f.horaFin) }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Hora de inicio" obligatorio error={errorDe('horaInicio')} ayuda={RESERVA}>
                <Entrada type="time" min={HORA_ABRE} max={HORA_CIERRA} value={form.horaInicio} onChange={(e) => cambiar('horaInicio', e.target.value)} error={errorDe('horaInicio')} />
              </Campo>
              <Campo etiqueta="Hora de fin" obligatorio error={errorDe('horaFin')} ayuda={RESERVA}>
                <Entrada type="time" min={HORA_ABRE} max={HORA_CIERRA} value={form.horaFin} onChange={(e) => cambiar('horaFin', e.target.value)} error={errorDe('horaFin')} />
              </Campo>
            </div>
            <p className="-mt-2 min-h-[18px] text-xs">
              {sinCambio ? RESERVA : <LineaHorario horario={horario} dias={1} titulos={titulos} sinErrores={!Object.keys(vivos).length} />}
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------- Cambiar de espacio (todos sus dias, misma fecha y horario) ----------
// Tambien con key={evento.id}: el selector empieza vacio con cada evento
function PanelUbicacion({ evento, espacios, titulos, onCerrar, onHecho }) {
  const { sesion } = useAuth();
  const [espacio, setEspacio] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Activos, DISPONIBLES, distintos del actual y donde cabe el cupo
  const opciones = useMemo(
    () =>
      evento
        ? espacios.filter((e) => e.estatus !== 0 && (e.estado ?? 'DISPONIBLE') === 'DISPONIBLE' && e.id !== evento.espacio && e.capacidad >= evento.cupoMaximo)
        : [],
    [espacios, evento],
  );
  const nuevo = opciones.find((e) => String(e.id) === espacio);
  const dias = evento?.fecha ? diasEntre(evento.fecha, evento.fechaFin ?? evento.fecha) : [];
  const horario = useHorario({
    espacioId: espacio || null,
    dias,
    horaInicio: hhmm(evento?.horaInicio),
    horaFin: hhmm(evento?.horaFin),
    token: sesion.token,
  });
  // Solo se bloquea si ya se sabe que el espacio nuevo esta ocupado (la agenda revisa otra vez al guardar)
  const motivo = !espacio ? 'Elige el espacio nuevo.' : horario.bloquea ? 'El espacio nuevo está ocupado en ese horario.' : null;

  async function guardar() {
    if (motivo) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await cambiarUbicacionEvento(evento.id, Number(espacio), sesion.token);
      onHecho(r, `Cambio de espacio: ${corto(r.titulo, 30)} → ${corto(r.espacioNombre ?? nuevo?.nombre ?? '', 30)}`);
    } catch (err) {
      setError(mensajeAmigable(err));
    } finally {
      setGuardando(false);
    }
  }

  const pie = (
    <>
      {error && (
        <Aviso tipo="error" className="mb-3" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Globo texto={motivo} className={motivo ? '' : 'contents'}>
          <Boton icono="swap_horiz" cargando={guardando} onClick={guardar} disabled={!!motivo}>
            Cambiar de espacio
          </Boton>
        </Globo>
      </div>
    </>
  );

  // Pasar de aire libre a techado (o al reves) cambia lo que Clima revisa
  const cambiaAire = nuevo && !!nuevo.esAlAireLibre !== !!evento?.esAlAireLibre;
  return (
    <Panel abierto={!!evento} onCerrar={() => !guardando && onCerrar()} titulo="Cambiar de espacio" subtitulo="Se mueven todos sus días al espacio nuevo, con la misma fecha y horario." pie={pie}>
      {evento && (
        <>
          <p className="mb-4 rounded-lg border border-borde bg-lienzo p-3 text-sm text-texto-2">
            <span className="font-medium text-texto">{evento.titulo}</span>
            <span className="block">
              {textoFechas(evento)} · {textoHorario(evento)} · cupo {evento.cupoMaximo}
            </span>
            <span className="block">Ahora en: {nombreLugar(evento)}</span>
          </p>
          <Campo
            etiqueta="Espacio nuevo"
            obligatorio
            ayuda={
              opciones.length === 0 ? (
                <LineaAyuda tono="aviso">No hay otro espacio disponible donde quepa el cupo ({evento.cupoMaximo}).</LineaAyuda>
              ) : cambiaAire ? (
                <LineaAyuda tono="aviso">
                  {nuevo.esAlAireLibre ? 'El evento pasará a ser al aire libre: Clima podrá marcarlo en riesgo.' : 'El evento pasará a ser techado: el clima ya no lo afectará.'}
                </LineaAyuda>
              ) : (
                RESERVA
              )
            }
          >
            <Selector className="h-11" value={espacio} onChange={(e) => setEspacio(e.target.value)}>
              <option value="">Elige el espacio...</option>
              {opciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {textoEspacio(e)}
                </option>
              ))}
            </Selector>
          </Campo>
          {espacio && (
            <div className="mt-1 grid gap-2">
              <OcupacionDia horario={horario} horaInicio={hhmm(evento.horaInicio)} horaFin={hhmm(evento.horaFin)} dias={dias} titulos={titulos} />
              <p className="min-h-[18px] text-xs">
                <LineaHorario horario={horario} dias={dias.length} titulos={titulos} sinErrores />
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------- Detalle (panel lateral) con las acciones que permite su estado ----------
// onApartar: abre la Nueva reserva de la Agenda (vista de David) con este evento elegido
// espacios: para avisar si el cupo no cabe en el lugar que se aparto en Reservas
function DetalleEvento({ id, version, espacios = [], puedeModificar, colorDe, onCerrar, onEditar, onReprogramar, onUbicacion, onEstado, onApartar }) {
  const { sesion } = useAuth();
  const navegar = useNavigate();
  const datos = useDatos(() => (id ? obtenerEvento(id, sesion.token) : Promise.resolve(null)), [id, version, sesion.token]);
  const e = datos.datos && datos.datos.id === id ? datos.datos : null;
  const terminado = e && TERMINADOS.includes(e.estado);
  const puede = e && puedeModificar(e) && !terminado;
  const hoy = hoyIso();
  const yaEmpezo = !!e?.fecha && e.fecha <= hoy;
  // El riesgo por clima lo determina el microservicio de Clima y el organizador solo decide (PDF de la maestra).
  // El administrador conserva un aviso manual (p. ej. alerta de Proteccion Civil o mientras Clima no este listo),
  // solo para eventos al aire libre, con fecha y que no hayan pasado (sin fecha no hay pronostico)
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const motivoRiesgo = !e?.esAlAireLibre
    ? 'Solo un evento al aire libre puede quedar en riesgo por el clima.'
    : !e?.fecha
      ? 'El evento no tiene fecha: no hay pronóstico que revisar.'
      : (e.fechaFin ?? e.fecha) < hoy
        ? 'El evento ya pasó.'
        : null;

  const pie = (
    <div className="flex flex-wrap justify-end gap-2">
      {puede && (
        <>
          <Boton variante="peligro" icono="event_busy" onClick={() => onEstado(e, 'CANCELADO')}>
            Cancelar evento
          </Boton>
          <Globo texto={yaEmpezo ? null : `Se puede finalizar desde el ${fechaCorta(e.fecha ?? hoy)}.`} className={yaEmpezo ? 'contents' : ''}>
            <Boton variante="secundario" icono="task_alt" disabled={!yaEmpezo} onClick={() => onEstado(e, 'FINALIZADO')}>
              Finalizar
            </Boton>
          </Globo>
          <Boton variante="secundario" icono="edit" onClick={() => onEditar(e)}>
            Editar
          </Boton>
        </>
      )}
      <Boton onClick={onCerrar}>Cerrar</Boton>
    </div>
  );

  return (
    <Panel abierto={!!id} onCerrar={onCerrar} titulo="Detalle del evento" subtitulo="Datos, fechas y lugar del evento." pie={pie}>
      {datos.error && !e ? (
        <ErrorServicio servicio="El servicio de eventos" mensaje={datos.error.message} onReintentar={datos.recargar} />
      ) : !e ? (
        <div className="space-y-3">
          <Esqueleto className="h-24 rounded-xl" />
          <Esqueleto className="h-40 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-xl border border-borde bg-lienzo p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-titulo text-lg font-semibold text-texto break-words">{e.titulo}</p>
              {/* Numero del evento: el que aparece en la Nueva reserva y en Reservas de la Agenda */}
              <p className="text-xs text-tenue tabular">Evento #{e.id}</p>
              <Estado valor={e.estado} />
            </div>
            {e.descripcion && <p className="mt-2 text-sm text-texto-2 break-words">{e.descripcion}</p>}
            <dl className="mt-3 grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-3 border-t border-borde pt-3 text-sm">
              <dt className="etiqueta text-texto-2">Categoría</dt>
              <dd className="flex items-center gap-2 text-texto">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorDe(e.categoria) }} />
                {e.categoriaNombre ?? `Categoría ${e.categoria}`}
              </dd>
              <dt className="etiqueta self-start text-texto-2">Fecha</dt>
              <dd className="text-texto">
                {!e.fecha && e.reservaLiberada ? (
                  <span className="text-aviso-texto">Sin reserva vigente: se liberó en la Agenda</span>
                ) : !e.fecha ? (
                  // Antes: "Sin fecha: no tiene reserva en la agenda o la agenda no respondió"
                  <span className="text-tenue">Sin fecha: aún no se aparta en Reservas (o la agenda no respondió)</span>
                ) : esVariosDias(e) ? (
                  <>
                    Del {fechaLarga(e.fecha)} al {fechaLarga(e.fechaFin)}
                    <span className="block text-xs text-texto-2">{numeroDias(e)} días, mismo horario</span>
                  </>
                ) : (
                  fechaLarga(e.fecha)
                )}
              </dd>
              <dt className="etiqueta text-texto-2">Horario</dt>
              <dd className="text-texto tabular">{textoHorario(e) || '—'}</dd>
              <dt className="etiqueta text-texto-2">Lugar</dt>
              <dd className="flex items-center gap-2 text-texto">
                <Icono nombre={e.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[18px] text-marino" />
                <span className="min-w-0 break-words">
                  {nombreLugar(e)}
                  {e.espacio ? ` · ${e.esAlAireLibre ? 'al aire libre' : 'techado'}` : ''}
                </span>
              </dd>
              <dt className="etiqueta text-texto-2">Cupo</dt>
              <dd className="text-texto tabular">{Number(e.cupoMaximo).toLocaleString('es-MX')} personas</dd>
              <dt className="etiqueta text-texto-2">Organizador</dt>
              <dd className="text-texto">
                <NombreOrganizador e={e} />
              </dd>
            </dl>
          </div>

          {/* El lugar se aparta en Reservas (vista de David), que no conoce el cupo: si no cabe, se avisa aqui */}
          {(() => {
            const capacidad = e.espacio ? espacios.find((x) => x.id === e.espacio)?.capacidad : null;
            return capacidad != null && e.cupoMaximo > capacidad && !terminado ? (
              <Aviso tipo="aviso" titulo="El cupo no cabe en el lugar apartado" className="mb-4">
                El cupo es de {Number(e.cupoMaximo).toLocaleString('es-MX')} personas y en {nombreLugar(e)} caben {Number(capacidad).toLocaleString('es-MX')}.{' '}
                {puede ? 'Baja el cupo con "Editar" o cambia a un lugar más grande.' : 'El organizador debe ajustarlo.'}
              </Aviso>
            ) : null;
          })()}
          {/* Registrado sin fecha (lo normal cuando aun no se sabe cuando): la fecha se aparta en Reservas */}
          {!e.fecha && !e.reservaLiberada && !terminado && (
            <Aviso tipo="info" titulo="Aún no tiene fecha" className="mb-4">
              <span className="block">El lugar y la fecha se apartan en Reservas.</span>
              {puede && (
                <Boton variante="secundario" tamano="sm" icono="event_available" className="mt-2" onClick={() => onApartar(e)}>
                  Apartar lugar y fecha
                </Boton>
              )}
            </Aviso>
          )}
          {e.reservaLiberada && !terminado && (
            <Aviso tipo="aviso" titulo="La reserva de este evento se liberó en la Agenda" className="mb-4">
              {puede
                ? 'El espacio ya no está apartado. Reprográmalo para apartar una fecha nueva, o cancélalo.'
                : 'El espacio ya no está apartado. El organizador debe reprogramarlo o cancelarlo.'}
            </Aviso>
          )}
          {e.estado === 'EN_RIESGO' && (
            <Aviso tipo="aviso" titulo="Evento en riesgo por condiciones meteorológicas" className="mb-4">
              {puede ? 'Decide qué hacer: mantenerlo, cambiarlo de espacio, reprogramarlo o cancelarlo.' : 'El organizador decidirá si se mantiene, cambia de espacio, se reprograma o se cancela.'}
            </Aviso>
          )}
          {terminado && (
            <Aviso tipo="info" className="mb-4">
              Este evento está {e.estado === 'CANCELADO' ? 'cancelado' : 'finalizado'}: ya no se puede modificar.
            </Aviso>
          )}

          {puede && (
            <>
              <h3 className="etiqueta mb-3 text-texto">Cambios del evento</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {/* Antes tambien se desactivaba sin fecha (disabled={esVariosDias(e) || !e.fecha}); ahora reprogramar
                    a un evento sin reserva vigente le aparta una nueva (ms-eventos, 22 nov) */}
                {/* Un evento que nunca tuvo fecha no se "reprograma": su fecha se aparta en Reservas (Apartar lugar y fecha).
                    Si tuvo reserva y se libero afuera, Reprogramar si le aparta una nueva */}
                <Globo
                  texto={
                    esVariosDias(e)
                      ? 'Dura varios días: para cambiar sus fechas, cancélalo y regístralo de nuevo.'
                      : !e.fecha && !e.reservaLiberada
                        ? 'Aún no tiene fecha: apártala con "Apartar lugar y fecha".'
                        : null
                  }
                  className="block"
                >
                  <Boton variante="secundario" icono="update" className="w-full justify-start" disabled={esVariosDias(e) || (!e.fecha && !e.reservaLiberada)} onClick={() => onReprogramar(e)}>
                    Reprogramar
                  </Boton>
                </Globo>
                <Boton variante="secundario" icono="swap_horiz" className="w-full justify-start" disabled={!e.fecha} onClick={() => onUbicacion(e)}>
                  Cambiar de espacio
                </Boton>
                {/* Cancelar un solo dia de un evento de varios dias es liberar esa reserva: se hace en Reservas (vista de David),
                    sin cambiar el estado del evento. Sus paginas no reciben filtros por direccion: se busca por el numero */}
                {esVariosDias(e) && (
                  <Globo texto={`En Reservas, busca el evento #${e.id} y libera el día que se cancela.`} className="block">
                    <Boton variante="secundario" icono="event_busy" className="w-full justify-start" onClick={() => navegar('/reservas')}>
                      Cancelar un día (en Reservas)
                    </Boton>
                  </Globo>
                )}
                {e.estado === 'EN_RIESGO' ? (
                  <Boton variante="secundario" icono="verified" className="w-full justify-start" onClick={() => onEstado(e, 'MANTENIDO')}>
                    Mantener el evento
                  </Boton>
                ) : (
                  // Antes lo veia tambien el organizador:
                  // <Globo texto={e.esAlAireLibre ? null : 'Solo un evento al aire libre puede quedar en riesgo por el clima.'} className="block">
                  //   <Boton ... disabled={!e.esAlAireLibre} onClick={() => onEstado(e, 'EN_RIESGO')}>Marcar en riesgo (clima)</Boton>
                  // </Globo>
                  esAdmin && (
                    <Globo texto={motivoRiesgo} className="block">
                      <Boton variante="secundario" icono="warning" className="w-full justify-start" disabled={!!motivoRiesgo} onClick={() => onEstado(e, 'EN_RIESGO')}>
                        Marcar en riesgo (clima)
                      </Boton>
                    </Globo>
                  )
                )}
              </div>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

// Textos de la confirmacion de cada cambio de estado
function textoConfirmacion(tipo, e) {
  if (!e) return { titulo: '', cuerpo: '' };
  const nombre = `"${corto(e.titulo, 50)}"`;
  if (tipo === 'CANCELADO')
    return {
      titulo: `Cancelar ${nombre}`,
      cuerpo: `Se libera el espacio${esVariosDias(e) ? ` los ${numeroDias(e)} días` : ''} en la agenda. Un evento cancelado ya no se puede modificar.`,
      boton: 'Cancelar evento',
      icono: 'event_busy',
      tono: 'peligro',
    };
  if (tipo === 'FINALIZADO') {
    const futuros = esVariosDias(e) ? diasEntre(sumarDias(hoyIso(), 1), e.fechaFin).filter((d) => d >= e.fecha).length : 0;
    return {
      titulo: `Finalizar ${nombre}`,
      cuerpo: futuros > 0 ? `Quedará como historial. ${futuros === 1 ? 'El día que aún no llega se liberará' : `Los ${futuros} días que aún no llegan se liberarán`} en la agenda.` : 'Quedará como historial y ya no se podrá modificar.',
      boton: 'Finalizar',
      icono: 'task_alt',
      tono: 'aviso',
    };
  }
  if (tipo === 'EN_RIESGO')
    return {
      titulo: `Marcar en riesgo ${nombre}`,
      // cuerpo: 'Es un evento al aire libre. Después podrás mantenerlo, cambiarlo de espacio, reprogramarlo o cancelarlo.',
      cuerpo: 'Normalmente lo marca el servicio de Clima. Úsalo solo ante un aviso oficial (por ejemplo, de Protección Civil). Después el organizador decide si lo mantiene, lo cambia de espacio, lo reprograma o lo cancela.',
      boton: 'Marcar en riesgo',
      icono: 'warning',
      tono: 'aviso',
    };
  return {
    titulo: `Mantener ${nombre}`,
    cuerpo: 'Se confirma que el evento se realiza en su fecha y lugar pese al aviso del clima.',
    boton: 'Mantener',
    icono: 'verified',
    tono: 'info',
  };
}
const MENSAJE_ESTADO = { CANCELADO: 'Evento cancelado', FINALIZADO: 'Evento finalizado', EN_RIESGO: 'Marcado en riesgo', MANTENIDO: 'Evento mantenido' };

// ---------- Pagina ----------
export default function Eventos() {
  const { sesion } = useAuth();
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const organiza = ROLES_QUE_ORGANIZAN.includes(sesion.rol);
  const esOrganizador = sesion.rol === 'ORGANIZADOR';
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [buscarEn, setBuscarEn] = useState('titulo'); // 'titulo' | 'lugar'
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [orden, setOrden] = useState('proximos');
  const [alcance, setAlcance] = useState(esOrganizador ? 'mios' : 'todos'); // el organizador ve primero los suyos
  const [detalle, setDetalle] = useState(null); // id
  const [formulario, setFormulario] = useState(null); // { modo, evento }
  const [reprogramar, setReprogramar] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { tipo, evento }
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [resaltado, setResaltado] = useState(null);
  const [version, setVersion] = useState(0); // al cambiar, el detalle se vuelve a pedir
  const enfocar = useRef(null);
  const avisar = (tipo, txt) => setMensaje({ tipo, texto: txt, id: Date.now() });
  const cerrarMensaje = useCallback(() => setMensaje(null), []);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => {
    if (!resaltado) return undefined;
    const t = setTimeout(() => setResaltado(null), 3000);
    return () => clearTimeout(t);
  }, [resaltado]);

  // Nueva reserva de la Agenda (vista de David, se abre desde cualquier pantalla); version sube al crear una reserva
  const { abrir: abrirReserva, version: versionReservas } = useNuevaReserva();
  // Antes: [busqueda, buscarEn, sesion.token]; ahora tambien recarga cuando se aparta una reserva (para ver su fecha)
  const datos = useDatos(() => (busqueda ? buscarEventos(busqueda, buscarEn === 'lugar', sesion.token) : listarEventos({}, sesion.token)), [busqueda, buscarEn, sesion.token, versionReservas]);
  const categorias = useDatos(() => listarCategorias(false, sesion.token), [sesion.token]);
  // Titulos de los eventos para decir con quien choca un horario en la barra de ocupacion
  const titulos = useMemo(() => new Map((datos.datos ?? []).map((e) => [Number(e.id), e.titulo])), [datos.datos]);
  const espacios = useDatos(() => listarEspacios(false, sesion.token), [sesion.token]);
  const catalogosListos = !!categorias.datos && !!espacios.datos;

  const colores = useMemo(() => new Map((categorias.datos ?? []).map((c) => [c.id, c.colorIdentificador])), [categorias.datos]);
  const colorDe = useCallback((id) => colores.get(id) ?? 'var(--color-borde)', [colores]);
  const puedeModificar = useCallback((e) => esAdmin || (esOrganizador && Number(e.organizador) === Number(sesion.usuarioId)), [esAdmin, esOrganizador, sesion.usuarioId]);

  const ordenar = ORDENES.find((o) => o.valor === orden).fn;
  const lista = useMemo(
    () =>
      [...(datos.datos ?? [])]
        .filter((e) => alcance !== 'mios' || Number(e.organizador) === Number(sesion.usuarioId))
        .filter((e) => !estado || e.estado === estado)
        .filter((e) => !categoria || String(e.categoria) === categoria)
        .sort(ordenar),
    [datos.datos, alcance, estado, categoria, ordenar, sesion.usuarioId],
  );
  const filtroCategorias = useMemo(
    () => [{ valor: '', texto: 'Todas', icono: 'sell' }, ...(categorias.datos ?? []).map((c) => ({ valor: String(c.id), texto: c.nombre, icono: 'label' }))],
    [categorias.datos],
  );

  // Despues de guardar, cuando llega la lista NUEVA, se lleva la vista al evento (tarjeta o fila, la que este visible)
  useEffect(() => {
    const objetivo = enfocar.current;
    if (!objetivo || !datos.datos || datos.datos === objetivo.antes) return;
    enfocar.current = null;
    requestAnimationFrame(() =>
      [...document.querySelectorAll(`[data-evento="${objetivo.id}"]`)].find((x) => x.offsetParent !== null)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }, [datos.datos]);

  function terminar(e, texto) {
    // avisar('exito', texto);
    // Al cancelar, reprogramar o cambiar de lugar ms-eventos avisa a los inscritos; si Inscripciones o
    // Notificaciones no respondieron, el cambio si se hizo y la respuesta lo dice en "aviso"
    if (e.aviso) avisar('aviso', `${texto} · No se pudo avisar a los inscritos.`);
    else avisar('exito', texto);
    setResaltado(e.id);
    setVersion((v) => v + 1);
    enfocar.current = { id: e.id, antes: datos.datos };
    datos.recargar();
  }

  async function cambiarEstado() {
    const { tipo, evento } = confirmar;
    setTrabajando(true);
    try {
      const r = await cambiarEstadoEvento(evento.id, tipo, sesion.token);
      terminar(r, `${MENSAJE_ESTADO[tipo]}: ${corto(r.titulo, 40)}`);
    } catch (err) {
      avisar('error', mensajeAmigable(err));
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  }

  // Botones de cada evento (los mismos en la tarjeta y en la fila de la tabla), como en Espacios y Categorias
  const acciones = (e) =>
    puedeModificar(e) && !TERMINADOS.includes(e.estado) ? (
      <>
        <Boton variante="fantasma" tamano="sm" icono="edit" onClick={() => abrirFormulario('editar', e)}>
          Editar
        </Boton>
        <Boton variante="fantasma" tamano="sm" icono="event_busy" onClick={() => setConfirmar({ tipo: 'CANCELADO', evento: e })}>
          Cancelar
        </Boton>
      </>
    ) : null;
  // En la tabla, solo iconos (como Reservas de la Agenda) para que la columna Lugar no se quede sin espacio
  const accionesIconos = (e) =>
    puedeModificar(e) && !TERMINADOS.includes(e.estado) ? (
      <>
        <Globo texto="Editar">
          <button type="button" onClick={() => abrirFormulario('editar', e)} aria-label={`Editar ${e.titulo}`} className="grid size-9 place-items-center rounded-lg text-texto-2 hover:bg-borde-suave hover:text-texto">
            <Icono nombre="edit" className="text-[20px]" />
          </button>
        </Globo>
        <Globo texto="Cancelar evento">
          <button type="button" onClick={() => setConfirmar({ tipo: 'CANCELADO', evento: e })} aria-label={`Cancelar ${e.titulo}`} className="grid size-9 place-items-center rounded-lg text-texto-2 hover:bg-peligro-tinte hover:text-peligro-texto">
            <Icono nombre="event_busy" className="text-[20px]" />
          </button>
        </Globo>
      </>
    ) : null;

  const abrirFormulario = (modo, evento = null) => {
    setDetalle(null);
    setFormulario({ modo, evento });
  };
  const conf = textoConfirmacion(confirmar?.tipo, confirmar?.evento);
  const filtrando = busqueda || estado || categoria;

  return (
    <>
      <TituloPagina
        titulo="Eventos"
        subtitulo={
          datos.datos
            ? `${lista.length} ${filtrando ? 'encontrados' : alcance === 'mios' ? (lista.length === 1 ? 'evento tuyo' : 'eventos tuyos') : lista.length === 1 ? 'evento' : 'eventos'}`
            : 'Actividades académicas, culturales, deportivas y tecnológicas del instituto'
        }
      >
        {mensaje && <AvisoTemporal key={mensaje.id} mensaje={mensaje} onCerrar={cerrarMensaje} />}
        {organiza && (
          <Boton icono="add" onClick={() => abrirFormulario('nueva')} cargando={!catalogosListos}>
            Nuevo evento
          </Boton>
        )}
      </TituloPagina>

      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3 border-b border-borde p-4">
          <Entrada
            icono={buscarEn === 'lugar' ? 'location_on' : 'search'}
            placeholder={buscarEn === 'lugar' ? 'Buscar por lugar (nombre del espacio)' : 'Buscar por título'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-10 min-w-[220px] flex-1"
            derecha={
              texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="text-tenue hover:text-texto-2">
                  <Icono nombre="close" className="text-[18px]" />
                </button>
              )
            }
          />
          <Segmentado
            valor={buscarEn}
            onChange={setBuscarEn}
            opciones={[
              { valor: 'titulo', texto: 'Título' },
              { valor: 'lugar', texto: 'Lugar' },
            ]}
          />
          <MenuDesplegable valor={estado} onChange={setEstado} opciones={FILTRO_ESTADOS} etiqueta="Estado" icono="filter_list" ancho="w-60" />
          <MenuDesplegable valor={categoria} onChange={setCategoria} opciones={filtroCategorias} etiqueta="Categoría" icono="sell" ancho="w-60" />
          <MenuDesplegable valor={orden} onChange={setOrden} opciones={ORDENES} etiqueta="Ordenar" ancho="w-60" />
          {esOrganizador && (
            <Segmentado
              valor={alcance}
              onChange={setAlcance}
              opciones={[
                { valor: 'mios', texto: 'Mis eventos' },
                { valor: 'todos', texto: 'Todos' },
              ]}
            />
          )}
        </div>

        {datos.error && !datos.datos ? (
          <ErrorServicio servicio="El servicio de eventos" mensaje={datos.error.message} onReintentar={datos.recargar} />
        ) : !datos.datos ? (
          <EsqueletoTabla filas={5} columnas={6} />
        ) : lista.length === 0 ? (
          <Vacio
            icono="event_busy"
            titulo={
              busqueda
                ? `No hay eventos ${buscarEn === 'lugar' ? 'en un lugar que contenga' : 'que contengan'} "${busqueda}"`
                : estado || categoria
                  ? 'No hay eventos con esos filtros'
                  : alcance === 'mios'
                    ? 'Aún no tienes eventos'
                    : 'Aún no hay eventos'
            }
          >
            {!filtrando && organiza && 'Registra uno con el botón "Nuevo evento".'}
          </Vacio>
        ) : (
          <>
            {/* Celular, tablet y laptop: tarjetas; la tabla no cabe sin deslizar de lado */}
            <ul className="escalonado grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 min-[1400px]:hidden">
              {lista.map((e) => (
                <li
                  key={e.id}
                  data-evento={e.id}
                  className={`scroll-mt-24 flex min-w-0 flex-col overflow-hidden rounded-xl border border-borde transition-colors duration-700 ${resaltado === e.id ? 'bg-marino-tinte' : 'bg-superficie'}`}
                >
                  <span className="h-1.5 w-full" style={{ backgroundColor: colorDe(e.categoria) }} aria-hidden="true" />
                  <button type="button" onClick={() => setDetalle(e.id)} aria-label={`Ver el detalle de ${e.titulo}`} className="group block min-w-0 flex-1 p-4 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-texto group-hover:text-marino group-hover:underline">{e.titulo}</p>
                      <Estado valor={e.estado} />
                    </div>
                    {/* Numero del evento: es el que se elige en la Nueva reserva de la Agenda ("Titulo (#id)") */}
                    <p className="mt-1 truncate text-xs text-texto-2">
                      <span className="tabular text-tenue">#{e.id}</span> · {e.categoriaNombre ?? `Categoría ${e.categoria}`}
                      {!e.fecha && !TERMINADOS.includes(e.estado) && <span className="text-tenue"> · {e.reservaLiberada ? 'Sin reserva vigente' : 'Sin fecha'}</span>}
                    </p>
                    {/* Antes la tarjeta tambien mostraba fecha, horario y lugar (ahora solo en el detalle):
                    <p className="mt-2 flex items-center gap-1 text-xs text-texto tabular">
                      <Icono nombre="calendar_today" className="text-[14px] text-texto-2" />
                      {textoFechas(e)}
                      {esVariosDias(e) && <span className="text-texto-2">· {numeroDias(e)} días</span>}
                      {textoHorario(e) && <span className="text-texto-2">· {textoHorario(e)}</span>}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-texto-2">
                      <Icono nombre={e.esAlAireLibre ? 'wb_sunny' : 'location_on'} className="text-[14px]" />
                      <span className="truncate">{e.espacioNombre ?? `Espacio ${e.espacio}`}</span>
                    </p> */}
                    <p className="mt-2 flex items-center gap-1 text-xs text-texto-2 tabular">
                      <Icono nombre="groups" className="text-[14px]" />
                      Cupo {Number(e.cupoMaximo).toLocaleString('es-MX')}
                      <span className="truncate">
                        · <NombreOrganizador e={e} />
                      </span>
                    </p>
                  </button>
                  {acciones(e) && <div className="flex flex-wrap justify-end gap-1 border-t border-borde-suave px-2 py-1.5">{acciones(e)}</div>}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto scroll-fino min-[1400px]:block">
              {/* table-fixed: un solo renglon por evento; lo que no cabe termina en "..." y se ve completo en el globo */}
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="etiqueta bg-lienzo text-texto-2">
                    <th className="w-16 px-5 py-2.5 font-semibold">N.º</th>
                    <th className="px-3 py-2.5 font-semibold">Evento</th>
                    <th className="w-48 px-3 py-2.5 font-semibold">Categoría</th>
                    {/* Fecha, horario y lugar ya se ven en Reservas y Agenda (vistas de David) y en el detalle del evento:
                    <th className="w-52 px-3 py-2.5 font-semibold">Fecha</th>
                    <th className="w-32 px-3 py-2.5 font-semibold">Horario</th>
                    <th className="px-3 py-2.5 font-semibold">Lugar</th> */}
                    <th className="w-64 px-3 py-2.5 font-semibold">Organizador</th>
                    <th className="w-20 px-3 py-2.5 text-right font-semibold">Cupo</th>
                    <th className="w-44 px-3 py-2.5 font-semibold">Estado</th>
                    {organiza && <th className="w-24 px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="escalonado">
                  {lista.map((e) => (
                    <tr
                      key={e.id}
                      data-evento={e.id}
                      className={`scroll-mt-24 border-t border-borde-suave transition-colors duration-700 ${resaltado === e.id ? 'bg-marino-tinte' : 'hover:bg-lienzo'}`}
                    >
                      <td className="px-5 py-2.5 text-sm text-tenue tabular">#{e.id}</td>
                      <td className="px-3 py-2.5">
                        <Globo texto={`${e.titulo} · Clic para ver el detalle`} className="block">
                          <button type="button" onClick={() => setDetalle(e.id)} aria-label={`Ver el detalle de ${e.titulo}`} className="group flex w-full min-w-0 items-center gap-2 text-left">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorDe(e.categoria) }} aria-hidden="true" />
                            <span className="truncate text-sm font-medium text-texto group-hover:text-marino group-hover:underline">{e.titulo}</span>
                          </button>
                        </Globo>
                      </td>
                      <td className="truncate px-3 py-2.5 text-sm text-texto-2">{e.categoriaNombre ?? `Categoría ${e.categoria}`}</td>
                      {/* Antes: celdas de Fecha, Horario y Lugar (ahora solo en el detalle; Reservas de David ya las muestra)
                      <td className="px-3 py-2.5 text-sm text-texto tabular">
                      <span className={e.fecha ? '' : 'text-tenue'}>{textoFechas(e)}</span>
                      {esVariosDias(e) && <span className="ml-1 text-xs text-texto-2">({numeroDias(e)} días)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-texto-2 tabular">{textoHorario(e) || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-texto-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                      {e.esAlAireLibre && (
                      <Globo texto="Al aire libre">
                      <Icono nombre="wb_sunny" className="text-[16px] text-aviso-texto" />
                      </Globo>
                      )}
                      <span className="truncate">{e.espacioNombre ?? `Espacio ${e.espacio}`}</span>
                      </span>
                      </td>
                      */}
                      <td className="truncate px-3 py-2.5 text-sm text-texto-2">
                        <NombreOrganizador e={e} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-texto tabular">{Number(e.cupoMaximo).toLocaleString('es-MX')}</td>
                      <td className="px-3 py-2.5">
                        <Estado valor={e.estado} />
                        {/* Registrado sin fecha: aun no tiene reserva (se aparta en Reservas) */}
                        {!e.fecha && !TERMINADOS.includes(e.estado) && <span className="mt-0.5 block text-xs text-tenue">{e.reservaLiberada ? 'Sin reserva vigente' : 'Sin fecha'}</span>}
                      </td>
                      {organiza && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">{accionesIconos(e)}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tarjeta>

      <BotonArriba />

      <FormularioEvento
        abierto={!!formulario}
        modo={formulario?.modo ?? 'nueva'}
        evento={formulario?.evento ?? null}
        categorias={categorias.datos ?? []}
        espacios={espacios.datos ?? []}
        titulos={titulos}
        catalogosListos={catalogosListos}
        onCerrar={() => setFormulario(null)}
        onGuardado={(e, accion) => {
          setFormulario(null);
          terminar(e, `${accion === 'registrado' ? 'Evento registrado' : 'Cambios guardados'}: ${corto(e.titulo, 40)}`);
        }}
      />

      <DetalleEvento
        id={detalle}
        espacios={espacios.datos ?? []}
        version={version + versionReservas}
        onApartar={(e) => {
          setDetalle(null);
          abrirReserva({ eventoId: e.id, ...(e.espacio ? { espacioId: e.espacio } : {}) });
        }}
        puedeModificar={puedeModificar}
        colorDe={colorDe}
        onCerrar={() => setDetalle(null)}
        onEditar={(e) => abrirFormulario('editar', e)}
        onReprogramar={(e) => {
          setDetalle(null);
          setReprogramar(e);
        }}
        onUbicacion={(e) => {
          setDetalle(null);
          setUbicacion(e);
        }}
        onEstado={(e, tipo) => setConfirmar({ tipo, evento: e })}
      />

      <PanelReprogramar
        key={`reprogramar-${reprogramar?.id ?? 0}`}
        evento={reprogramar}
        titulos={titulos}
        onCerrar={() => setReprogramar(null)}
        onHecho={(e, txt) => {
          setReprogramar(null);
          terminar(e, txt);
          setDetalle(e.id);
        }}
      />

      <PanelUbicacion
        key={`ubicacion-${ubicacion?.id ?? 0}`}
        evento={ubicacion}
        espacios={espacios.datos ?? []}
        titulos={titulos}
        onCerrar={() => setUbicacion(null)}
        onHecho={(e, txt) => {
          setUbicacion(null);
          terminar(e, txt);
          setDetalle(e.id);
        }}
      />

      <Confirmar
        abierto={!!confirmar}
        onCerrar={() => !trabajando && setConfirmar(null)}
        onConfirmar={cambiarEstado}
        cargando={trabajando}
        icono={conf.icono}
        tono={conf.tono}
        titulo={conf.titulo}
        textoConfirmar={conf.boton}
        iconoConfirmar={conf.icono}
        varianteConfirmar={confirmar?.tipo === 'CANCELADO' ? 'peligro' : 'primario'}
        textoCancelar="Volver"
      >
        {conf.cuerpo}
      </Confirmar>
    </>
  );
}
