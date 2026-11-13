// Panel lateral "Nueva reserva": uno o varios dias, con revision de choques en tiempo real.
// Tambien sirve para mover una reserva existente (PUT /reservas/{id}) si llega `inicial.id`.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { consultarDisponibilidad, crearReserva, crearVariosDias, moverReserva } from '../api/agenda';
import { cargarCatalogos } from '../hooks/useReservas';
import { useServicios } from '../api/servicios';
import Icono from '../components/Icono';
import { Aviso, Boton, Campo, Entrada, Esqueleto, Estado, Interruptor, Panel, Selector } from '../components/ui';
import { MARGEN_MINUTOS, folio, iconoEspacio, nombreEspacio, tipoEspacio } from '../utils/formato';
import { cambiarPreferencia, preferencia } from '../utils/preferencias';
import { diasEntre, fechaCorta, horas, hoyIso, minutos } from '../utils/fechas';

const RAPIDOS = [
  { texto: '1 h', dur: 60 },
  { texto: '2 h', dur: 120 },
  { texto: 'Mañana (08:00 – 12:00)', ini: '08:00', fin: '12:00' },
  { texto: 'Tarde (14:00 – 18:00)', ini: '14:00', fin: '18:00' },
];

const sumarMin = (h, m) => {
  const t = Math.min(minutos(h) + m, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// Hora actual en formato HH:MM (la del navegador)
function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Si ya pasaron las 10:00, el formulario nuevo empieza en la siguiente hora en punto (para no proponer una hora pasada)
function inicioSugerido() {
  const h = new Date().getHours() + 1;
  return h <= 10 ? '10:00' : `${String(Math.min(h, 22)).padStart(2, '0')}:00`;
}

// Formulario nuevo. Toma de Mi perfil > Preferencias la duracion, el espacio favorito y el ultimo evento usado
function vacio(inicial) {
  const ini = inicioSugerido();
  const evento = inicial?.eventoId ?? (preferencia('recordarEvento') ? preferencia('ultimoEvento') : null);
  return {
    eventoId: evento ? String(evento) : '',
    espacioId: inicial?.espacioId ?? (inicial?.id ? null : preferencia('espacioFavorito')),
    variosDias: false,
    fecha: inicial?.fecha ?? hoyIso(),
    fechaFin: inicial?.fecha ?? hoyIso(),
    horaInicio: inicial?.horaInicio ?? ini,
    horaFin: inicial?.horaFin ?? sumarMin(ini, Number(preferencia('duracion')) || 120),
  };
}

function Seccion({ numero, titulo, extra, children }) {
  return (
    <section className="mb-7">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="etiqueta text-texto">
          {numero}. {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export default function NuevaReserva({ abierta, inicial, onCerrar, onCreada }) {
  const { sesion } = useAuth();
  const moviendo = !!inicial?.id;
  const [form, setForm] = useState(() => vacio(inicial));
  const [cat, setCat] = useState(null);
  const [revision, setRevision] = useState({ cargando: false, dias: [] });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [creadas, setCreadas] = useState(null);
  // Indicador en vivo: si ms-espacios (de Roberta) no esta, ms-agenda no deja reservar (responde 503)
  const { servicios } = useServicios();
  const espaciosCaido = servicios.some((s) => s.id === 'MS-ESPACIOS' && !s.vivo);
  // Hora actual (HH:MM), se renueva cada 30 s mientras el panel esta abierto: no se puede reservar una hora de hoy que ya paso
  const [ahora, setAhora] = useState(horaActual);
  useEffect(() => {
    if (!abierta) return;
    setAhora(horaActual());
    const t = setInterval(() => setAhora(horaActual()), 30000);
    return () => clearInterval(t);
  }, [abierta]);

  // Al abrir: limpiar el formulario y cargar espacios y eventos
  useEffect(() => {
    if (!abierta) return;
    setForm(vacio(inicial));
    setError(null);
    setCreadas(null);
    cargarCatalogos(sesion.token)
      .then((c) => {
        setCat(c);
        // Si el espacio favorito ya no existe, no se deja elegido
        if (!inicial?.espacioId) setForm((f) => (f.espacioId && !c.espacios.some((e) => e.id === f.espacioId) ? { ...f, espacioId: null } : f));
      })
      .catch(() => setCat({ espacios: [], eventos: [] }));
  }, [abierta, inicial, sesion.token]);

  const dias = useMemo(() => {
    if (!form.variosDias) return [form.fecha];
    if (!form.fecha || !form.fechaFin || form.fechaFin < form.fecha) return [];
    return diasEntre(form.fecha, form.fechaFin);
  }, [form.variosDias, form.fecha, form.fechaFin]);

  const horarioOk = form.horaInicio && form.horaFin && minutos(form.horaFin) > minutos(form.horaInicio);
  const horaPasada = form.fecha === hoyIso() && form.horaInicio && minutos(form.horaInicio) <= minutos(ahora);
  const problemaFechas = form.variosDias && form.fechaFin < form.fecha ? 'La fecha final no puede ser antes de la inicial' : dias.length > 31 ? 'Máximo 31 días por solicitud' : null;

  // Revision de disponibilidad por dia (espera medio segundo despues del ultimo cambio)
  useEffect(() => {
    if (!abierta || !form.espacioId || !horarioOk || horaPasada || problemaFechas || dias.length === 0) {
      setRevision({ cargando: false, dias: [] });
      return;
    }
    let vigente = true;
    setRevision((r) => ({ ...r, cargando: true }));
    const t = setTimeout(async () => {
      const resultados = await Promise.all(
        dias.map((fecha) =>
          consultarDisponibilidad({ espacioId: form.espacioId, fecha, horaInicio: form.horaInicio, horaFin: form.horaFin }, sesion.token)
            // al mover, la propia reserva no cuenta como choque
            .then((r) => ({ fecha, margen: r.margenMinutos, conflictos: r.conflictos.filter((c) => c.id !== inicial?.id) }))
            .catch((e) => ({ fecha, error: e.message })),
        ),
      );
      if (vigente) setRevision({ cargando: false, dias: resultados });
    }, 500);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [abierta, form.espacioId, form.horaInicio, form.horaFin, dias, horarioOk, horaPasada, problemaFechas, sesion.token, inicial]);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const choques = revision.dias.filter((d) => d.conflictos?.length).length;
  const fallos = revision.dias.filter((d) => d.error).length;
  const espacio = cat?.espacios.find((e) => e.id === form.espacioId);
  const margen = revision.dias.find((d) => d.margen != null)?.margen ?? MARGEN_MINUTOS;
  // true si de verdad se cruza; false si solo queda sin el tiempo de preparacion
  const seCruza = (c) => minutos(c.horaInicio) < minutos(form.horaFin) && minutos(c.horaFin) > minutos(form.horaInicio);
  const listo = form.eventoId && form.espacioId && horarioOk && !horaPasada && !problemaFechas && dias.length && !revision.cargando && revision.dias.length === dias.length && choques === 0 && fallos === 0;

  async function confirmar() {
    setEnviando(true);
    setError(null);
    const base = { eventoId: Number(form.eventoId), espacioId: form.espacioId, horaInicio: form.horaInicio, horaFin: form.horaFin };
    try {
      let r;
      if (moviendo) r = [await moverReserva(inicial.id, { ...base, fecha: form.fecha }, sesion.token)];
      else if (form.variosDias && dias.length > 1) r = await crearVariosDias({ ...base, fechaInicio: form.fecha, fechaFin: form.fechaFin }, sesion.token);
      else r = [await crearReserva({ ...base, fecha: form.fecha }, sesion.token)];
      setCreadas(r);
      if (!moviendo && preferencia('recordarEvento')) cambiarPreferencia('ultimoEvento', Number(form.eventoId));
      onCreada?.(r);
    } catch (e) {
      const texto =
        e.status === 503 ? 'No se puede reservar ahorita: el servicio de Espacios no está conectado. Intenta cuando vuelva a estar en línea.' : e.message;
      setError({ texto, detalles: e.status === 503 ? [e.message] : e.detalles });
    } finally {
      setEnviando(false);
    }
  }

  const totalHrs = horarioOk ? horas(form.horaInicio, form.horaFin) : 0;

  const pie = creadas ? (
    <Boton tamano="lg" className="w-full" onClick={onCerrar}>
      Listo
    </Boton>
  ) : (
    <>
      {error && (
        <Aviso tipo="error" titulo={error.texto} className="mb-3" onCerrar={() => setError(null)}>
          {error.detalles?.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {error.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Aviso>
      )}
      <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[180px] text-sm">
        <p className="font-semibold text-texto">
          {dias.length} {dias.length === 1 ? 'día' : 'días'} · {totalHrs} h por día
        </p>
        <p className="text-xs text-texto-2">
          ({dias.length * totalHrs} h totales){espacio ? ` · ${espacio.nombre}` : ''}
        </p>
      </div>
      <Boton variante="secundario" onClick={onCerrar}>
        Cancelar
      </Boton>
      <Boton icono={choques ? 'lock' : 'event_available'} disabled={!listo} cargando={enviando} onClick={confirmar}>
        {moviendo ? 'Mover reserva' : dias.length > 1 ? `Confirmar ${dias.length} reservas` : 'Confirmar reserva'}
      </Boton>
    </div>
    </>
  );

  return (
    <Panel
      abierto={abierta}
      onCerrar={onCerrar}
      titulo={moviendo ? `Mover reserva ${folio(inicial)}` : 'Nueva reserva institucional'}
      subtitulo="Solicitud directa de espacios y recintos ITCH · TecNM"
      pie={pie}
    >
      {creadas ? (
        <div className="text-center py-6">
          <span className="mx-auto size-16 rounded-full bg-exito-tinte text-exito grid place-items-center">
            <Icono nombre="check_circle" className="text-[36px]" relleno />
          </span>
          <h3 className="font-titulo text-xl font-semibold text-texto mt-4">{moviendo ? 'Reserva movida' : creadas.length > 1 ? `${creadas.length} reservas confirmadas` : 'Reserva confirmada'}</h3>
          <p className="text-sm text-texto-2 mt-1">{nombreEspacio(cat?.espacios, creadas[0].espacioId)} · {creadas[0].horaInicio} – {creadas[0].horaFin}</p>
          <ul className="mt-6 text-left divide-y divide-borde rounded-xl border border-borde">
            {creadas.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-mono text-xs text-texto-2">{folio(r)}</span>
                <span className="tabular">{fechaCorta(r.fecha)}</span>
                <Estado valor={r.estado} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {espaciosCaido && (
            <Aviso tipo="aviso" titulo="El servicio de Espacios no está conectado" className="mb-6">
              Mientras no vuelva a estar en línea no se pueden confirmar reservas, porque no hay forma de revisar que el espacio exista y no esté en
              mantenimiento. Puedes llenar la solicitud y confirmarla cuando el indicador de Servicios lo marque en verde.
            </Aviso>
          )}

          <Seccion numero={1} titulo="Evento académico o institucional">
            {cat?.eventosEnLinea && cat.eventos.length > 0 ? (
              <Selector value={form.eventoId} onChange={(e) => cambiar('eventoId', e.target.value)} className="h-12" disabled={moviendo}>
                <option value="">Elige el evento...</option>
                {cat.eventos
                  .filter((e) => !['CANCELADO', 'FINALIZADO'].includes(e.estado))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.titulo} (#{e.id})
                    </option>
                  ))}
              </Selector>
            ) : (
              <Campo etiqueta="Número del evento" ayuda="Es el id que da ms-eventos al registrar el evento.">
                <Entrada icono="tag" type="number" min="1" value={form.eventoId} onChange={(e) => cambiar('eventoId', e.target.value)} placeholder="4" disabled={moviendo} />
              </Campo>
            )}
          </Seccion>

          <Seccion numero={2} titulo="Espacio a reservar" extra={cat && <span className="text-xs text-texto-2">Mostrando {cat.espacios.length} espacios</span>}>
            {!cat ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Esqueleto key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {cat.espacios.map((e) => {
                  const mant = e.estado === 'MANTENIMIENTO';
                  const sel = form.espacioId === e.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      disabled={mant}
                      onClick={() => cambiar('espacioId', e.id)}
                      className={`text-left rounded-xl border-2 p-3.5 transition-colors ${
                        mant ? 'border-dashed border-aviso-borde bg-aviso-tinte/40 cursor-not-allowed' : sel ? 'border-marino bg-marino-tinte/40' : 'border-borde hover:border-tenue'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`size-10 rounded-lg grid place-items-center ${mant ? 'bg-aviso-tinte text-aviso-texto' : 'bg-marino-tinte text-marino'}`}>
                          <Icono nombre={iconoEspacio(e.tipo)} className="text-[20px]" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${mant ? 'line-through text-texto-2' : 'text-texto'}`}>{e.nombre}</p>
                          <p className="text-xs text-texto-2">{mant ? 'Mantenimiento en curso' : tipoEspacio(e.tipo) || (e.ubicacionFisica ?? '')}</p>
                        </div>
                        {sel && <Icono nombre="check_circle" relleno className="text-[22px] text-marino" />}
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-texto-2">
                        <span>{e.capacidad ? `Cap. ${e.capacidad} pers.` : ''}</span>
                        <Estado valor={e.estado ?? 'DISPONIBLE'} punto={false} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Seccion>

          <Seccion numero={3} titulo="Fecha y horario">
            <div className="rounded-xl border border-borde bg-lienzo p-4 space-y-4">
              {!moviendo && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-texto flex items-center gap-2">
                    Reservar varios días <span className="rounded bg-marino px-1.5 py-0.5 text-[10px] font-semibold text-white">MULTIDÍA</span>
                  </span>
                  <Interruptor activo={form.variosDias} onChange={(v) => cambiar('variosDias', v)} etiqueta="Reservar varios días" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta={form.variosDias ? 'Del (inicio)' : 'Fecha'} className={form.variosDias ? '' : 'col-span-2'}>
                  <Entrada icono="calendar_today" type="date" value={form.fecha} min={moviendo ? undefined : hoyIso()} onChange={(e) => cambiar('fecha', e.target.value)} />
                </Campo>
                {form.variosDias && (
                  <Campo etiqueta="Al (fin)">
                    <Entrada icono="event" type="date" value={form.fechaFin} min={form.fecha} onChange={(e) => cambiar('fechaFin', e.target.value)} />
                  </Campo>
                )}
              </div>
              {form.variosDias && (
                <p className={`text-xs ${problemaFechas ? 'text-peligro-texto' : 'text-texto-2'}`}>
                  {problemaFechas ?? (
                    <>
                      Se crea una reserva por día, máximo 31 días (<b>{dias.length} días seleccionados</b>). Si un día choca, no se guarda ninguno.
                    </>
                  )}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-borde">
                <Campo etiqueta="Hora de inicio" error={horaPasada ? `Esa hora ya pasó (son las ${ahora})` : null}>
                  <Entrada icono="schedule" type="time" value={form.horaInicio} error={horaPasada} onChange={(e) => cambiar('horaInicio', e.target.value)} />
                </Campo>
                <Campo etiqueta="Hora de fin" error={!horarioOk && form.horaFin ? 'Debe ser después del inicio' : null}>
                  <Entrada icono="schedule" type="time" value={form.horaFin} error={!horarioOk} onChange={(e) => cambiar('horaFin', e.target.value)} />
                </Campo>
              </div>
              <div className="flex flex-wrap gap-2">
                {RAPIDOS.map((r) => {
                  const ini = r.ini ?? form.horaInicio;
                  const fin = r.fin ?? sumarMin(form.horaInicio, r.dur);
                  const activo = form.horaInicio === ini && form.horaFin === fin;
                  return (
                    <button
                      key={r.texto}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, horaInicio: ini, horaFin: fin }))}
                      className={`h-8 px-3 rounded-md border text-xs font-medium ${activo ? 'bg-marino border-marino text-white' : 'bg-superficie border-borde text-texto-2 hover:text-texto'}`}
                    >
                      {r.texto}
                    </button>
                  );
                })}
              </div>
            </div>
          </Seccion>

          <Seccion
            numero={4}
            titulo="Revisión de disponibilidad en tiempo real"
            extra={
              form.espacioId && (
                <span className="flex items-center gap-1.5 rounded-full border border-exito-borde bg-exito-tinte px-2 py-0.5 text-[11px] font-semibold text-exito-texto">
                  <span className="size-1.5 rounded-full bg-exito" /> Revisión en vivo
                </span>
              )
            }
          >
            {!form.espacioId ? (
              <p className="text-sm text-texto-2 rounded-xl border border-dashed border-borde p-4 text-center">Elige un espacio para revisar su disponibilidad.</p>
            ) : revision.cargando || revision.dias.length !== dias.length ? (
              <div className="space-y-2">
                {dias.slice(0, 4).map((d) => (
                  <Esqueleto key={d} className="h-12" />
                ))}
              </div>
            ) : (
              <>
                {choques > 0 && (
                  <Aviso tipo="error" titulo={`El espacio no está libre en ${choques} de ${dias.length} ${dias.length === 1 ? 'día' : 'días'}`} className="mb-3">
                    Cambia el horario, la fecha o el espacio. No se puede confirmar con choques.
                  </Aviso>
                )}
                {margen > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-texto-2 mb-2">
                    <Icono nombre="cleaning_services" className="text-[16px]" />
                    Entre reservas del mismo espacio se dejan {margen} min para preparar la sala.
                  </p>
                )}
                <ul className="space-y-2 max-h-72 overflow-y-auto scroll-fino pr-1">
                  {revision.dias.map((d) => (
                    <li key={d.fecha} className={`rounded-xl border px-4 py-3 ${d.conflictos?.length ? 'border-peligro-borde bg-peligro-tinte' : d.error ? 'border-aviso-borde bg-aviso-tinte' : 'border-borde'}`}>
                      <div className="flex items-center gap-3 text-sm">
                        <Icono
                          nombre={d.conflictos?.length ? 'cancel' : d.error ? 'warning' : 'check_circle'}
                          className={`text-[20px] ${d.conflictos?.length ? 'text-peligro' : d.error ? 'text-aviso' : 'text-exito'}`}
                        />
                        <span className="font-semibold text-texto first-letter:uppercase">{fechaCorta(d.fecha)}</span>
                        <span className="text-texto-2 tabular">
                          · {form.horaInicio} – {form.horaFin}
                        </span>
                        <span className="ml-auto">
                          {d.conflictos?.length ? <Estado valor="CONFLICTO" /> : d.error ? <Estado valor="Sin respuesta" /> : <Estado valor="DISPONIBLE" />}
                        </span>
                      </div>
                      {d.conflictos?.map((c) => (
                        <p key={c.id} className="text-xs text-peligro-texto mt-1.5 pl-8">
                          {seCruza(c)
                            ? `Choca con la reserva ${folio(c)} del evento ${c.eventoId}, de ${c.horaInicio} a ${c.horaFin}.`
                            : `Muy pegada a la reserva ${folio(c)} (de ${c.horaInicio} a ${c.horaFin}): se dejan ${margen} min para preparar la sala.`}
                        </p>
                      ))}
                      {d.error && <p className="text-xs text-aviso-texto mt-1.5 pl-8">{d.error}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Seccion>
        </>
      )}
    </Panel>
  );
}
