// Agenda de espacios: calendario semanal (o por dia) con las reservas de ms-agenda.
// A la izquierda el mes y los espacios que quieres ver; al tocar una reserva se ven sus datos
// y, si eres organizador o administrador, puedes moverla o liberarla.
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNuevaReserva } from '../components/layout/Shell';
import useReservas from '../hooks/useReservas';
import useRecargaAlCrear from '../hooks/useRecargaAlCrear';
import { liberarReserva } from '../api/agenda';
import Icono from '../components/Icono';
import { Aviso, Boton, Estado, ErrorServicio, Esqueleto, Modal, Segmentado, Tarjeta } from '../components/ui';
import { MARGEN_MINUTOS, ROLES_QUE_RESERVAN, folio, nombreEspacio, nombreEvento } from '../utils/formato';
import { preferencia } from '../utils/preferencias';
import { aIso, deIso, diaSemana, diasEntre, fechaCorta, fechaLarga, hoyIso, lunesDe, minutos, nombreMes, rangoSemana, sumarDias } from '../utils/fechas';

const INICIO = 7; // 07:00
const FIN = 21; // 21:00
const ALTO = 56; // px por hora

// Un color por espacio. El fondo suave se mezcla con el color de las tarjetas,
// asi se ve bien en modo claro y en modo oscuro.
const COLORES = ['var(--color-marino)', '#12b76a', '#7a5af8', '#f79009', '#2e90fa', '#b38e5d'].map((borde) => [
  borde,
  `color-mix(in srgb, ${borde} 14%, var(--color-superficie))`,
]);
const colorDe = (espacios, id) => COLORES[Math.max(0, espacios.findIndex((e) => e.id === id)) % COLORES.length];

function MiniMes({ fecha, onElegir, conReservas }) {
  const [mes, setMes] = useState(fecha.slice(0, 7) + '-01');
  const primero = deIso(mes);
  const inicio = lunesDe(mes);
  const celdas = diasEntre(inicio, sumarDias(inicio, 41));
  const mover = (n) => {
    const d = deIso(mes);
    d.setMonth(d.getMonth() + n);
    setMes(aIso(d));
  };
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-titulo font-semibold text-texto first-letter:uppercase">{nombreMes(mes)}</p>
        <div className="flex">
          <button onClick={() => mover(-1)} aria-label="Mes anterior" className="size-8 grid place-items-center rounded-md hover:bg-borde-suave">
            <Icono nombre="chevron_left" className="text-[20px]" />
          </button>
          <button onClick={() => mover(1)} aria-label="Mes siguiente" className="size-8 grid place-items-center rounded-md hover:bg-borde-suave">
            <Icono nombre="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-texto-2 mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-sm tabular">
        {celdas.map((c) => {
          const fuera = deIso(c).getMonth() !== primero.getMonth();
          const sel = c === fecha;
          const hoy = c === hoyIso();
          return (
            <button
              key={c}
              onClick={() => onElegir(c)}
              className={`relative h-8 rounded-full mx-auto w-8 ${sel ? 'bg-marino text-white font-semibold' : hoy ? 'text-marino font-semibold ring-1 ring-marino' : fuera ? 'text-tenue' : 'text-texto hover:bg-borde-suave'}`}
            >
              {Number(c.slice(8))}
              {conReservas.has(c) && !sel && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-marino" />}
            </button>
          );
        })}
      </div>
    </Tarjeta>
  );
}

// Franja de preparacion despues de una reserva: ms-agenda no deja reservar el mismo espacio ahi.
function Preparacion({ r, espacios, compacto }) {
  const [borde] = colorDe(espacios, r.espacioId);
  const fin = Math.min(minutos(r.horaFin) + MARGEN_MINUTOS, FIN * 60);
  const top = ((minutos(r.horaFin) - INICIO * 60) / 60) * ALTO;
  const alto = ((fin - minutos(r.horaFin)) / 60) * ALTO - 3;
  if (MARGEN_MINUTOS <= 0 || alto <= 4) return null;
  return (
    <div
      aria-hidden="true"
      title={`Preparación de ${nombreEspacio(espacios, r.espacioId)} (${MARGEN_MINUTOS} min)`}
      style={{ top, height: alto, borderLeftColor: borde }}
      className="absolute left-1 right-1 rounded-md border border-dashed border-borde border-l-[3px] rayado px-1.5 flex items-center overflow-hidden pointer-events-none opacity-80"
    >
      {!compacto && alto > 14 && <span className="text-[10px] text-texto-2 truncate">Preparación</span>}
    </div>
  );
}

function Bloque({ r, espacios, eventos, onClick, compacto }) {
  const [borde, fondo] = colorDe(espacios, r.espacioId);
  const top = ((minutos(r.horaInicio) - INICIO * 60) / 60) * ALTO;
  const alto = Math.max(((minutos(r.horaFin) - minutos(r.horaInicio)) / 60) * ALTO - 3, 22);
  const liberada = r.estado === 'LIBERADA';
  return (
    <button
      onClick={() => onClick(r)}
      style={{ top, height: alto, borderLeftColor: liberada ? 'var(--color-tenue)' : borde, background: liberada ? 'var(--color-borde-suave)' : fondo }}
      className={`aparecer absolute left-1 right-1 rounded-md border border-borde border-l-[3px] px-1.5 py-1 text-left overflow-hidden hover:shadow-md hover:-translate-y-px transition-[box-shadow,translate] ${liberada ? 'rayado' : ''}`}
    >
      <p className={`text-[11px] font-semibold leading-tight truncate ${liberada ? 'text-texto-2 line-through' : 'text-texto'}`}>{nombreEvento(eventos, r.eventoId)}</p>
      {!compacto && alto > 34 && <p className="text-[10px] text-texto-2 truncate">{nombreEspacio(espacios, r.espacioId)}</p>}
      {alto > 50 && (
        <p className="text-[10px] text-texto-2 tabular">
          {r.horaInicio} – {r.horaFin}
        </p>
      )}
    </button>
  );
}

function Detalle({ r, datos, puede, onCerrar, onMover, onLiberado }) {
  const { sesion } = useAuth();
  const [liberando, setLiberando] = useState(false);
  const [error, setError] = useState(null);
  const espacio = datos.espacios.find((e) => e.id === r.espacioId);

  async function liberar() {
    setLiberando(true);
    setError(null);
    try {
      await liberarReserva(r.id, sesion.token);
      onLiberado();
    } catch (e) {
      setError(e.message);
      setLiberando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="font-mono text-[11px] text-texto-2">{folio(r)}</span>
              <Estado valor={r.estado} />
            </div>
            <h3 className="font-titulo text-xl font-semibold text-texto mt-2">{nombreEvento(datos.eventos, r.eventoId)}</h3>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="size-9 grid place-items-center rounded-md hover:bg-borde-suave">
            <Icono nombre="close" className="text-[20px] text-texto-2" />
          </button>
        </div>
        <dl className="mt-4 pt-4 border-t border-borde space-y-3 text-sm">
          {[
            ['location_city', 'Espacio', `${nombreEspacio(datos.espacios, r.espacioId)}${espacio?.ubicacionFisica ? ` · ${espacio.ubicacionFisica}` : ''}`],
            ['schedule', 'Horario asignado', `${fechaLarga(r.fecha)} · ${r.horaInicio} – ${r.horaFin} hrs`],
            ['tag', 'Evento', `Evento #${r.eventoId}`],
            ...(espacio?.capacidad ? [['groups', 'Capacidad del espacio', `${espacio.capacidad} personas`]] : []),
          ].map(([icono, t, v]) => (
            <div key={t} className="flex gap-3">
              <Icono nombre={icono} className="text-[20px] text-texto-2" />
              <div>
                <dt className="text-xs text-texto-2">{t}</dt>
                <dd className="text-texto font-medium first-letter:uppercase">{v}</dd>
              </div>
            </div>
          ))}
        </dl>
        {error && (
          <Aviso tipo="error" className="mt-4">
            {error}
          </Aviso>
        )}
        {puede && r.estado === 'RESERVADA' && (
          <div className="mt-5 flex gap-2 justify-end">
            <Boton variante="secundario" icono="open_with" onClick={onMover}>
              Mover
            </Boton>
            <Boton variante="peligro" icono="event_busy" cargando={liberando} onClick={liberar}>
              Liberar
            </Boton>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Agenda() {
  const { sesion } = useAuth();
  const { abrir } = useNuevaReserva();
  const puede = ROLES_QUE_RESERVAN.includes(sesion.rol);
  const [fecha, setFecha] = useState(hoyIso());
  // Vista inicial: la de Mi perfil > Preferencias; en "auto", dia en celular y semana en pantalla grande
  const [vista, setVista] = useState(() => (preferencia('vistaAgenda') !== 'auto' ? preferencia('vistaAgenda') : window.innerWidth < 768 ? 'dia' : 'semana'));
  const conLiberadas = preferencia('liberadasAgenda');
  const [ocultos, setOcultos] = useState(new Set());
  const [abierta, setAbierta] = useState(null);

  const lunes = lunesDe(fecha);
  const datos = useReservas(lunes, sumarDias(lunes, 6), { conLiberadas: true });
  useRecargaAlCrear(datos.recargar);
  const d = datos.datos;

  const columnas = vista === 'semana' ? diasEntre(lunes, sumarDias(lunes, 6)) : [fecha];
  const visibles = useMemo(() => (d ? d.reservas.filter((r) => !ocultos.has(r.espacioId) && (conLiberadas || r.estado !== 'LIBERADA')) : []), [d, ocultos, conLiberadas]);
  const conReservas = useMemo(() => new Set(visibles.filter((r) => r.estado === 'RESERVADA').map((r) => r.fecha)), [visibles]);

  const mover = (n) => setFecha((f) => sumarDias(f, vista === 'semana' ? 7 * n : n));
  const alternar = (id) =>
    setOcultos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ahora = new Date();
  const lineaAhora = ((ahora.getHours() * 60 + ahora.getMinutes() - INICIO * 60) / 60) * ALTO;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <h1 className="font-titulo text-2xl md:text-[28px] font-semibold text-texto">Agenda de espacios</h1>
          <span className="hidden sm:inline rounded-full border border-borde bg-superficie px-2.5 py-0.5 text-xs font-semibold text-texto-2 first-letter:uppercase">{nombreMes(fecha)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-borde bg-superficie h-10">
            <button onClick={() => setFecha(hoyIso())} className="px-3 h-full text-sm font-medium border-r border-borde hover:bg-borde-suave rounded-l-lg">
              Hoy
            </button>
            <button onClick={() => mover(-1)} aria-label="Anterior" className="px-2 h-full hover:bg-borde-suave">
              <Icono nombre="chevron_left" className="text-[20px]" />
            </button>
            <span className="px-2 text-sm font-semibold tabular min-w-[150px] text-center first-letter:uppercase">{vista === 'semana' ? rangoSemana(lunes) : fechaCorta(fecha)}</span>
            <button onClick={() => mover(1)} aria-label="Siguiente" className="px-2 h-full hover:bg-borde-suave rounded-r-lg">
              <Icono nombre="chevron_right" className="text-[20px]" />
            </button>
          </div>
          <Segmentado
            valor={vista}
            onChange={setVista}
            opciones={[
              { valor: 'dia', texto: 'Día' },
              { valor: 'semana', texto: 'Semana' },
            ]}
          />
          {puede && (
            <Boton icono="add" onClick={() => abrir({ fecha: fecha < hoyIso() ? hoyIso() : fecha })} className="hidden md:inline-flex">
              Nueva reserva
            </Boton>
          )}
        </div>
      </div>

      {/* Selector de dia en celular */}
      {vista === 'dia' && (
        <div className="md:hidden flex gap-2 overflow-x-auto scroll-fino pb-3 mb-3 -mx-1 px-1">
          {diasEntre(lunes, sumarDias(lunes, 6)).map((c) => (
            <button
              key={c}
              onClick={() => setFecha(c)}
              className={`shrink-0 w-12 rounded-xl py-2 text-center border ${c === fecha ? 'bg-marino border-marino text-white' : 'bg-superficie border-borde text-texto'}`}
            >
              <span className="block text-[10px] uppercase">{diaSemana(c)}</span>
              <span className="block font-titulo font-semibold tabular">{Number(c.slice(8))}</span>
              {conReservas.has(c) && <span className={`block mx-auto mt-0.5 size-1 rounded-full ${c === fecha ? 'bg-oro-claro' : 'bg-marino'}`} />}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4 hidden md:block">
          <MiniMes fecha={fecha} onElegir={setFecha} conReservas={conReservas} />
          <Tarjeta className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="etiqueta text-texto-2">Espacios ({d?.espacios.length ?? 0})</p>
              <button onClick={() => setOcultos(new Set())} className="text-xs font-semibold text-marino hover:underline">
                Seleccionar todo
              </button>
            </div>
            {!d ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Esqueleto key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <ul className="escalonado space-y-2">
                {d.espacios.map((e) => {
                  const [color] = colorDe(d.espacios, e.id);
                  const mant = e.estado === 'MANTENIMIENTO';
                  return (
                    <li key={e.id}>
                      <label className={`flex items-start gap-3 rounded-lg border border-borde p-2.5 cursor-pointer hover:bg-lienzo ${mant ? 'opacity-70' : ''}`}>
                        <input type="checkbox" checked={!ocultos.has(e.id)} onChange={() => alternar(e.id)} className="size-4 mt-0.5 accent-marino" />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium text-texto">
                            <span className="size-2 rounded-full" style={{ background: color }} />
                            <span className={`truncate ${mant ? 'line-through' : ''}`}>{e.nombre}</span>
                          </span>
                          <span className="mt-1 flex items-center justify-between">
                            <Estado valor={e.estado ?? 'DISPONIBLE'} punto={false} />
                            {e.capacidad && <span className="text-[11px] text-texto-2">Cap. {e.capacidad}</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta className="p-4">
            <p className="etiqueta text-texto-2 mb-3">Leyenda de reservas</p>
            <ul className="space-y-2 text-xs text-texto-2">
              <li className="flex items-center gap-2"><span className="size-3 rounded-sm bg-marino" /> Reservada y confirmada</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-sm border border-borde rayado" /> Liberada / cancelada</li>
              <li className="flex items-center gap-2"><span className="h-0.5 w-3 bg-peligro" /> Hora actual</li>
            </ul>
          </Tarjeta>
        </div>

        <Tarjeta className="overflow-hidden">
          {datos.error && !d ? (
            <ErrorServicio servicio="El servicio de agenda" mensaje={datos.error.message} onReintentar={datos.recargar} />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <div style={{ minWidth: vista === 'semana' ? 760 : 0 }}>
                <div className="grid border-b border-borde sticky top-0 bg-superficie z-10" style={{ gridTemplateColumns: `56px repeat(${columnas.length}, 1fr)` }}>
                  <div className="text-[10px] text-texto-2 text-center py-2 leading-tight">
                    GMT-6
                    <br />
                    CDMX
                  </div>
                  {columnas.map((c) => {
                    const hoy = c === hoyIso();
                    return (
                      <div key={c} className={`text-center py-2 border-l border-borde ${hoy ? 'bg-marino-tinte/60' : ''}`}>
                        <p className={`text-[11px] uppercase ${hoy ? 'text-marino font-semibold' : 'text-texto-2'}`}>{diaSemana(c)}</p>
                        <p className={`font-titulo text-lg font-semibold tabular ${hoy ? 'text-marino' : 'text-texto'}`}>{Number(c.slice(8))}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${columnas.length}, 1fr)` }}>
                  <div>
                    {Array.from({ length: FIN - INICIO }, (_, i) => (
                      <div key={i} style={{ height: ALTO }} className="text-[11px] text-texto-2 text-right pr-2 -mt-2 tabular">
                        {String(INICIO + i).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                  {columnas.map((c) => {
                    const delDia = visibles.filter((r) => r.fecha === c);
                    return (
                      <div
                        key={c}
                        className={`relative border-l border-borde ${c === hoyIso() ? 'bg-marino-tinte/20' : ''}`}
                        style={{ height: ALTO * (FIN - INICIO), backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${ALTO - 1}px, var(--color-borde-suave) ${ALTO - 1}px ${ALTO}px)` }}
                      >
                        {!d && datos.cargando && (
                          <>
                            <Esqueleto className="absolute left-1 right-1 h-16" style={{ top: ALTO * (1 + (c.charCodeAt(9) % 3)) }} />
                            <Esqueleto className="absolute left-1 right-1 h-24" style={{ top: ALTO * (5 + (c.charCodeAt(9) % 2)) }} />
                          </>
                        )}
                        {delDia
                          .filter((r) => r.estado === 'RESERVADA')
                          .map((r) => (
                            <Preparacion key={'p' + r.id} r={r} espacios={d.espacios} compacto={vista === 'semana'} />
                          ))}
                        {delDia.map((r) => (
                          <Bloque key={r.id} r={r} espacios={d.espacios} eventos={d.eventos} onClick={setAbierta} compacto={vista === 'semana'} />
                        ))}
                        {c === hoyIso() && lineaAhora > 0 && lineaAhora < ALTO * (FIN - INICIO) && (
                          <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: lineaAhora }}>
                            <div className="h-0.5 bg-peligro relative">
                              <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-peligro" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {d && vista === 'dia' && visibles.filter((r) => r.fecha === fecha).length === 0 && (
            <p className="text-center text-sm text-texto-2 py-4 border-t border-borde">No hay reservas este día.</p>
          )}
        </Tarjeta>
      </div>

      {d && !d.espaciosEnLinea && (
        <p className="mt-4 text-xs text-texto-2 flex items-center gap-1.5">
          <Icono nombre="info" className="text-[16px]" />
          ms-espacios no respondió: los espacios se muestran por su número.
        </p>
      )}

      {abierta && d && (
        <Detalle
          r={abierta}
          datos={d}
          puede={puede}
          onCerrar={() => setAbierta(null)}
          onMover={() => {
            abrir(abierta);
            setAbierta(null);
          }}
          onLiberado={() => {
            setAbierta(null);
            datos.recargar();
          }}
        />
      )}
    </>
  );
}
