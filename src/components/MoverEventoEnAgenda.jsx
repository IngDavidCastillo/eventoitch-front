// Reprogramar y Cambiar de espacio de un evento, en un panel propio sobre la Agenda (vista de David): el calendario queda a la
// vista y se puede usar mientras se decide. Reprogramar cambia SOLO fecha y horario; Cambiar de espacio, SOLO el lugar.
// Lo que esta ocupado se consulta a ms-agenda; el cambio lo guarda ms-eventos (mueve la reserva, cambia el estado y avisa).
// Se abre con navigate('/agenda', { state: { moverEvento: { tipo: 'reprogramar' | 'ubicacion', evento } } }).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useDatos from '../hooks/useDatos';
import { consultarDisponibilidad, ocupacionDelDia } from '../api/agenda';
import { listarEspacios } from '../api/espacios';
import { cambiarUbicacionEvento, listarEventos, obtenerEvento, reprogramarEvento } from '../api/eventos';
import { ahoraMexico, diasEntre, fechaCorta, minutos } from '../utils/fechas';
import { MARGEN_MINUTOS, tipoEspacio } from '../utils/formato';
import { hhmm, mensajeAmigable, nombreLugar, textoFechas, textoHorario } from '../utils/eventos';
import { corto } from '../utils/validaciones';
import Icono from './Icono';
import { Aviso, Boton, Campo, Entrada, ErrorServicio, Esqueleto, Globo, LineaAyuda } from './ui';

const RESERVA = ' '; // linea de ayuda vacia del mismo alto
// Hoy y la hora en Mexico (como ms-eventos y la vista de Eventos), no la de la computadora: ahoraMexico() = "AAAA-MM-DD HH:mm"
const hoyIso = () => ahoraMexico().slice(0, 10);
const horaActual = () => ahoraMexico().slice(11, 16);

// ---------- Ocupacion del espacio (agenda de David) ----------
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

// Todo lo que el panel necesita saber del horario elegido
function useHorario({ espacioId, dias, horaInicio, horaFin, ignorarEvento, activo = true, token }) {
  const ocupacion = useOcupacion({ espacioId, dias, ignorarEvento, token });
  const revision = useDisponibilidad({ espacioId, dias, horaInicio, horaFin, ignorarEvento, activo, token });
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
    estimados: listo && horarioCompleto ? choquesDe(ocupacion.porDia, horaInicio, horaFin, margen) : [],
    // Lo que dice la agenda; pegada = no se cruza, pero no deja el tiempo de preparacion (como seCruza de David)
    revision: revision.estado,
    choques: horarioCompleto ? revision.choques.map((c) => ({ ...c, pegada: !(ini < minutos(c.horaFin) && fin > minutos(c.horaInicio)) })) : [],
    // Solo bloquea un choque confirmado para el horario que se ve ahora
    bloquea: revision.actual && revision.estado === 'listo' && revision.choques.length > 0,
  };
}

// Errores de la fecha que se ven al momento
function erroresFechas({ fecha }) {
  return fecha && fecha < hoyIso() ? { fecha: 'La fecha ya pasó' } : {};
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
      <Aviso tipo="aviso">No se pudo cargar la ocupación del espacio. Puedes continuar: la agenda revisa el horario al guardar.</Aviso>
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
  if (!sinErrores || horario.revision === 'pendiente') return RESERVA;
  if (horario.revision === 'error') return <LineaAyuda tono="aviso">No se pudo revisar con la agenda; se revisará al guardar.</LineaAyuda>;
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

// ---------- Reprogramar: mismo lugar, otra fecha u horario ----------
function Reprogramar({ evento, titulos, onHecho, onCerrar }) {
  const { sesion } = useAuth();
  // Si su horario actual ya no es valido (paso o esta fuera de 07:00-21:00) se empieza vacio, sin errores que no causo la persona
  const [form, setForm] = useState(() => {
    const actual = { fecha: evento.fecha, horaInicio: hhmm(evento.horaInicio), horaFin: hhmm(evento.horaFin) };
    const fechaOk = !erroresFechas(actual).fecha;
    const horasOk = !Object.keys(erroresHorario(actual)).length;
    return { fecha: fechaOk ? actual.fecha : '', horaInicio: horasOk ? actual.horaInicio : '', horaFin: horasOk ? actual.horaFin : '' };
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const vivos = { ...erroresFechas(form), ...erroresHorario(form) };
  const horario = useHorario({
    espacioId: form.fecha && !vivos.fecha ? evento.espacio : null,
    dias: form.fecha ? [form.fecha] : [],
    horaInicio: form.horaInicio,
    horaFin: form.horaFin,
    ignorarEvento: evento.id,
    activo: !Object.keys(vivos).length,
    token: sesion.token,
  });
  const errorDe = (k) => errores[k] || vivos[k] || '';
  const sinCambio = form.fecha === evento.fecha && form.horaInicio === hhmm(evento.horaInicio) && form.horaFin === hhmm(evento.horaFin);
  const motivo = sinCambio ? 'Elige una fecha u horario distintos.' : horario.bloquea ? 'El espacio está ocupado en ese horario.' : null;
  const cambiar = (k, v) => {
    setForm((x) => ({ ...x, [k]: v }));
    setErrores((x) => ({ ...x, [k]: '' }));
  };

  async function guardar() {
    if (motivo) return;
    const x = { ...vivos };
    if (!form.fecha) x.fecha = 'Elige la fecha';
    if (!form.horaInicio) x.horaInicio = 'Indica la hora';
    if (!form.horaFin) x.horaFin = 'Indica la hora';
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await reprogramarEvento(evento.id, form, sesion.token);
      onHecho(r, `Evento reprogramado: ${corto(r.titulo, 40)}`);
    } catch (err) {
      setError(mensajeAmigable(err));
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="grid flex-1 content-start gap-3 overflow-y-auto px-5 py-4 scroll-fino">
        <Resumen evento={evento} nota="El lugar no cambia." />
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
          onElegir={(l) => {
            setForm((x) => ({ ...x, ...horasDesdeLibre(l, x.horaInicio, x.horaFin) }));
            setErrores({});
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Hora de inicio" obligatorio error={errorDe('horaInicio')} ayuda={RESERVA}>
            <Entrada type="time" min={HORA_ABRE} max={HORA_CIERRA} value={form.horaInicio} onChange={(e) => cambiar('horaInicio', e.target.value)} error={errorDe('horaInicio')} />
          </Campo>
          <Campo etiqueta="Hora de fin" obligatorio error={errorDe('horaFin')} ayuda={RESERVA}>
            <Entrada type="time" min={HORA_ABRE} max={HORA_CIERRA} value={form.horaFin} onChange={(e) => cambiar('horaFin', e.target.value)} error={errorDe('horaFin')} />
          </Campo>
        </div>
        <div className="-mt-2 min-h-[18px] text-xs">
          {sinCambio ? RESERVA : <LineaHorario horario={horario} dias={1} titulos={titulos} sinErrores={!Object.keys(vivos).length} />}
        </div>
      </div>
      <Pie error={error} setError={setError} motivo={motivo} guardando={guardando} onGuardar={guardar} onCerrar={onCerrar} icono="update" texto="Reprogramar" />
    </>
  );
}

// ---------- Cambiar de espacio: misma fecha y horario, otro lugar ----------
// De cada lugar disponible dice si esta libre en el horario del evento (todos sus dias por venir) y si cabe su cupo
function CambiarEspacio({ evento, espacios, titulos, onHecho, onCerrar }) {
  const { sesion } = useAuth();
  const [elegido, setElegido] = useState(null);
  const [revision, setRevision] = useState({}); // id -> { estado: 'libre' | 'ocupado' | 'error', choque }
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const otros = useMemo(
    () => espacios.filter((x) => x.estatus !== 0 && (x.estado ?? 'DISPONIBLE') === 'DISPONIBLE' && x.id !== evento.espacio),
    [espacios, evento.espacio],
  );
  const dias = useMemo(() => diasEntre(evento.fecha, evento.fechaFin ?? evento.fecha).filter((d) => d >= hoyIso()), [evento.fecha, evento.fechaFin]);

  useEffect(() => {
    let vigente = true;
    otros
      .filter((x) => x.capacidad >= evento.cupoMaximo)
      .forEach(async (x) => {
        let r;
        try {
          const porDia = await Promise.all(
            dias.map((fecha) =>
              consultarDisponibilidad({ espacioId: x.id, fecha, horaInicio: hhmm(evento.horaInicio), horaFin: hhmm(evento.horaFin) }, sesion.token).then((y) =>
                (y?.conflictos ?? []).filter((c) => c.estado !== 'LIBERADA' && Number(c.eventoId) !== Number(evento.id)).map((c) => ({ ...c, fecha })),
              ),
            ),
          );
          const choque = porDia.flat()[0];
          r = choque ? { estado: 'ocupado', choque } : { estado: 'libre' };
        } catch {
          r = { estado: 'error' };
        }
        if (vigente) setRevision((y) => ({ ...y, [x.id]: r }));
      });
    return () => {
      vigente = false;
    };
  }, [otros, dias, evento, sesion.token]);

  const situacion = (x) => (x.capacidad < evento.cupoMaximo ? { estado: 'chico' } : (revision[x.id] ?? { estado: 'revisando' }));
  const PESO = { libre: 0, error: 1, revisando: 2, ocupado: 3, chico: 4 };
  const lista = [...otros].sort((a, b) => PESO[situacion(a).estado] - PESO[situacion(b).estado] || a.nombre.localeCompare(b.nombre, 'es'));
  const nuevo = otros.find((x) => x.id === elegido);
  const motivo = !nuevo ? 'Elige el espacio nuevo.' : null;

  function texto(x, r) {
    if (r.estado === 'chico') return ['close', 'text-texto-2', `No cabe el cupo (${evento.cupoMaximo})`];
    if (r.estado === 'revisando') return ['hourglass_empty', 'text-texto-2', 'Revisando...'];
    if (r.estado === 'error') return ['help', 'text-aviso-texto', 'No se pudo revisar; se revisará al guardar'];
    if (r.estado === 'libre') return ['check_circle', 'text-exito-texto', dias.length > 1 ? `Libre los ${dias.length} días` : 'Libre en ese horario'];
    const t = titulos.get(Number(r.choque.eventoId));
    return ['block', 'text-peligro-texto', `Ocupado${dias.length > 1 ? ` el ${fechaCorta(r.choque.fecha)}` : ''}: ${t ? corto(t, 24) : 'otra reserva'}, ${hhmm(r.choque.horaInicio)} – ${hhmm(r.choque.horaFin)}`];
  }

  async function guardar() {
    if (motivo) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await cambiarUbicacionEvento(evento.id, nuevo.id, sesion.token);
      onHecho(r, `Cambio de espacio: ${corto(r.titulo, 30)} → ${corto(r.espacioNombre ?? nuevo.nombre, 30)}`);
    } catch (err) {
      setError(mensajeAmigable(err));
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="grid flex-1 content-start gap-3 overflow-y-auto px-5 py-4 scroll-fino">
        <Resumen evento={evento} nota={`La fecha y el horario no cambian. Cupo: ${evento.cupoMaximo}.`} />
        <p className="text-sm font-medium text-texto">
          Espacio nuevo <span className="text-peligro">*</span>
        </p>
        {!otros.length && <Aviso tipo="aviso">No hay otro espacio disponible.</Aviso>}
        <div role="radiogroup" aria-label="Espacio nuevo" className="grid gap-2">
          {lista.map((x) => {
            const r = situacion(x);
            const sePuede = r.estado === 'libre' || r.estado === 'error';
            const [icono, color, txt] = texto(x, r);
            return (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={elegido === x.id}
                disabled={!sePuede}
                onClick={() => setElegido(x.id)}
                className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${elegido === x.id ? 'border-marino bg-marino-tinte' : 'border-borde bg-superficie enabled:hover:bg-borde-suave'}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-medium text-texto">{x.nombre}</span>
                  {elegido === x.id && <Icono nombre="check_circle" className="text-[20px] text-marino" />}
                </span>
                <span className="block text-xs text-texto-2">
                  {tipoEspacio(x.tipo)} · {Number(x.capacidad).toLocaleString('es-MX')} personas · {x.esAlAireLibre ? 'al aire libre' : 'techado'}
                </span>
                <span className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${color}`}>
                  <Icono nombre={icono} className="text-[16px]" />
                  {txt}
                </span>
              </button>
            );
          })}
        </div>
        {nuevo && !!nuevo.esAlAireLibre !== !!evento.esAlAireLibre && (
          <LineaAyuda tono="aviso">{nuevo.esAlAireLibre ? 'Pasará a ser al aire libre: Clima podrá marcarlo en riesgo.' : 'Pasará a ser techado: el clima ya no lo afectará.'}</LineaAyuda>
        )}
      </div>
      <Pie error={error} setError={setError} motivo={motivo} guardando={guardando} onGuardar={guardar} onCerrar={onCerrar} icono="swap_horiz" texto="Cambiar de espacio" />
    </>
  );
}

function Resumen({ evento, nota }) {
  return (
    <p className="rounded-lg border border-borde bg-lienzo p-3 text-sm text-texto-2">
      <span className="font-medium text-texto break-words">
        {evento.titulo} <span className="font-normal text-tenue tabular">#{evento.id}</span>
      </span>
      <span className="block">{[textoFechas(evento), textoHorario(evento)].filter(Boolean).join(' · ')}</span>
      <span className="block">{nombreLugar(evento)}</span>
      <span className="mt-1 block text-xs">{nota}</span>
    </p>
  );
}

function Pie({ error, setError, motivo, guardando, onGuardar, onCerrar, icono, texto }) {
  return (
    <footer className="border-t border-borde bg-superficie px-5 py-4">
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
          <Boton icono={icono} cargando={guardando} onClick={onGuardar} disabled={!!motivo}>
            {texto}
          </Boton>
        </Globo>
      </div>
    </footer>
  );
}

// Envuelve la Agenda en App.jsx: sin nada que mover la muestra tal cual; si no, le deja espacio a la derecha para el panel
export default function MoverEventoEnAgenda({ children }) {
  const { state } = useLocation();
  const navegar = useNavigate();
  const { sesion } = useAuth();
  const { tipo, evento: enviado } = state?.moverEvento ?? {};
  // Lo que llega de Eventos puede ser viejo (al recargar o regresar con Atras el panel se abre otra vez): se pide de nuevo
  const actual = useDatos(() => (enviado ? obtenerEvento(enviado.id, sesion.token) : Promise.resolve(null)), [enviado?.id, sesion.token]);
  const evento = actual.datos && actual.datos.id === enviado?.id ? actual.datos : null;
  const espacios = useDatos(() => (enviado ? listarEspacios(false, sesion.token) : Promise.resolve([])), [enviado?.id, sesion.token]);
  // Titulos para decir con que evento choca; si no llegan, se dice "otra reserva"
  const eventos = useDatos(() => (enviado ? listarEventos({}, sesion.token) : Promise.resolve([])), [enviado?.id, sesion.token]);
  const titulos = useMemo(() => new Map((eventos.datos ?? []).map((x) => [Number(x.id), x.titulo])), [eventos.datos]);

  const volver = (mensaje) => navegar('/eventos', { state: { detalleEvento: enviado.id, ...(mensaje ? { mensaje } : {}) } });
  // El cambio se hizo aunque no se pudiera avisar a los inscritos (ms-eventos lo dice en "aviso")
  const hecho = (r, texto) => volver(r.aviso ? { tipo: 'aviso', texto: `${texto} · No se pudo avisar a los inscritos.` } : { tipo: 'exito', texto });

  if (!enviado) return children;
  const reprograma = tipo === 'reprogramar';
  const cargando = (
    <div className="space-y-3 p-5">
      <Esqueleto className="h-20 rounded-xl" />
      <Esqueleto className="h-20 rounded-xl" />
    </div>
  );
  return (
    <>
      {/* Mismo ancho que el panel (420px) para que no tape la orilla de la Agenda */}
      <div className="lg:pr-[420px]">{children}</div>
      {createPortal(
        <aside aria-label={reprograma ? 'Reprogramar evento' : 'Cambiar de espacio'} className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-borde bg-superficie shadow-2xl lg:w-[420px]">
          <header className="flex items-start justify-between gap-4 border-b border-borde px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-titulo text-xl font-semibold text-texto">
                <span className="size-2 rounded-full bg-marino" />
                {reprograma ? 'Reprogramar evento' : 'Cambiar de espacio'}
              </h2>
              <p className="mt-0.5 text-sm text-texto-2">
                <span className="hidden lg:inline">Consulta el calendario mientras eliges.</span>
                <span className="lg:hidden">Elige según lo que está libre.</span>
              </p>
            </div>
            <button type="button" onClick={() => volver()} aria-label="Cerrar y volver al evento" className="grid size-10 place-items-center rounded-lg hover:bg-borde-suave">
              <Icono nombre="close" className="text-[22px] text-texto-2" />
            </button>
          </header>
          {actual.error && !evento ? (
            <ErrorServicio servicio="El servicio de eventos" mensaje={actual.error.message} onReintentar={actual.recargar} />
          ) : !evento ? (
            cargando
          ) : reprograma ? (
            <Reprogramar key={evento.id} evento={evento} titulos={titulos} onHecho={hecho} onCerrar={() => volver()} />
          ) : espacios.error && !espacios.datos ? (
            <ErrorServicio servicio="El servicio de espacios" mensaje={espacios.error.message} onReintentar={espacios.recargar} />
          ) : !espacios.datos ? (
            cargando
          ) : (
            <CambiarEspacio key={evento.id} evento={evento} espacios={espacios.datos} titulos={titulos} onHecho={hecho} onCerrar={() => volver()} />
          )}
        </aside>,
        document.body,
      )}
    </>
  );
}
