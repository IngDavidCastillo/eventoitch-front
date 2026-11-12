// Lista de reservas de ms-agenda en un rango de fechas.
// Pestanas: todas en tabla, agrupadas por evento (con "Liberar todas") o agrupadas por espacio.
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNuevaReserva } from '../components/layout/Shell';
import useReservas from '../hooks/useReservas';
import useRecargaAlCrear from '../hooks/useRecargaAlCrear';
import { liberarEvento, liberarReserva } from '../api/agenda';
import Icono from '../components/Icono';
import { Aviso, Boton, Entrada, Estado, ErrorServicio, EsqueletoTabla, Modal, Pestanas, Selector, Tarjeta, TituloPagina, Vacio } from '../components/ui';
import { ROLES_QUE_RESERVAN, folio, nombreEspacio, nombreEvento } from '../utils/formato';
import { diasEntre, fechaCorta, hoyIso, lunesDe, sumarDias } from '../utils/fechas';

const RANGOS = [
  { valor: 'semana', texto: 'Esta semana', calc: () => [lunesDe(hoyIso()), sumarDias(lunesDe(hoyIso()), 6)] },
  { valor: 'dos', texto: 'Próximas 2 semanas', calc: () => [hoyIso(), sumarDias(hoyIso(), 13)] },
  { valor: 'mes', texto: 'Próximos 30 días', calc: () => [hoyIso(), sumarDias(hoyIso(), 29)] },
  { valor: 'pasada', texto: 'Semana pasada', calc: () => [sumarDias(lunesDe(hoyIso()), -7), sumarDias(lunesDe(hoyIso()), -1)] },
];

function Fila({ r, d, puede, onMover, onLiberar }) {
  return (
    <tr className="border-t border-borde-suave hover:bg-lienzo">
      <td className="px-5 py-3 font-mono text-xs text-texto-2 whitespace-nowrap">{folio(r)}</td>
      <td className="px-3 py-3 text-sm font-medium text-texto">{nombreEvento(d.eventos, r.eventoId)}</td>
      <td className="px-3 py-3 text-sm text-texto-2">{nombreEspacio(d.espacios, r.espacioId)}</td>
      <td className="px-3 py-3 text-sm text-texto tabular whitespace-nowrap first-letter:uppercase">{fechaCorta(r.fecha)}</td>
      <td className="px-3 py-3 text-sm text-texto tabular whitespace-nowrap">
        {r.horaInicio} – {r.horaFin}
      </td>
      <td className="px-3 py-3">
        <Estado valor={r.estado} />
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {puede && r.estado === 'RESERVADA' && (
          <div className="inline-flex gap-1">
            <button onClick={() => onMover(r)} title="Mover" className="size-8 grid place-items-center rounded-md text-texto-2 hover:bg-borde-suave hover:text-marino">
              <Icono nombre="edit_calendar" className="text-[18px]" />
            </button>
            <button onClick={() => onLiberar(r)} title="Liberar" className="size-8 grid place-items-center rounded-md text-texto-2 hover:bg-peligro-tinte hover:text-peligro">
              <Icono nombre="event_busy" className="text-[18px]" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function Tabla({ lista, ...resto }) {
  return (
    <div className="overflow-x-auto scroll-fino">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="etiqueta text-texto-2 bg-lienzo">
            <th className="px-5 py-2.5 font-semibold">Folio</th>
            <th className="px-3 py-2.5 font-semibold">Evento</th>
            <th className="px-3 py-2.5 font-semibold">Espacio</th>
            <th className="px-3 py-2.5 font-semibold">Fecha</th>
            <th className="px-3 py-2.5 font-semibold">Horario</th>
            <th className="px-3 py-2.5 font-semibold">Estado</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {lista.map((r) => (
            <Fila key={r.id} r={r} {...resto} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Grupo({ titulo, subtitulo, icono, accion, lista, ...resto }) {
  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-lg bg-marino-tinte text-marino grid place-items-center">
            <Icono nombre={icono} className="text-[20px]" />
          </span>
          <div>
            <p className="font-titulo font-semibold text-texto">{titulo}</p>
            <p className="text-xs text-texto-2">{subtitulo}</p>
          </div>
        </div>
        {accion}
      </div>
      <Tabla lista={lista} {...resto} />
    </Tarjeta>
  );
}

export default function Reservas() {
  const { sesion } = useAuth();
  const { abrir } = useNuevaReserva();
  const puede = ROLES_QUE_RESERVAN.includes(sesion.rol);

  const [rango, setRango] = useState('dos');
  const [desde, hasta] = useMemo(() => RANGOS.find((r) => r.valor === rango).calc(), [rango]);
  const [pestana, setPestana] = useState('todas');
  const [espacio, setEspacio] = useState('');
  const [estado, setEstado] = useState('');
  const [texto, setTexto] = useState('');
  const [confirmar, setConfirmar] = useState(null); // { tipo: 'reserva'|'evento', r | eventoId, cuantas }
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const datos = useReservas(desde, hasta, { conLiberadas: true });
  useRecargaAlCrear(datos.recargar);
  const d = datos.datos;

  const lista = useMemo(() => {
    if (!d) return [];
    const t = texto.trim().toLowerCase();
    return d.reservas.filter(
      (r) =>
        (!espacio || String(r.espacioId) === espacio) &&
        (!estado || r.estado === estado) &&
        (!t || folio(r).toLowerCase().includes(t) || nombreEvento(d.eventos, r.eventoId).toLowerCase().includes(t)),
    );
  }, [d, espacio, estado, texto]);

  const agrupar = (clave) => {
    const m = new Map();
    lista.forEach((r) => m.set(r[clave], [...(m.get(r[clave]) ?? []), r]));
    return [...m.entries()];
  };

  async function ejecutar() {
    setTrabajando(true);
    try {
      if (confirmar.tipo === 'reserva') {
        await liberarReserva(confirmar.r.id, sesion.token);
        setMensaje({ tipo: 'exito', texto: `Se liberó la reserva ${folio(confirmar.r)}.` });
      } else {
        await liberarEvento(confirmar.eventoId, sesion.token);
        setMensaje({ tipo: 'exito', texto: `Se liberaron las reservas de ${nombreEvento(d.eventos, confirmar.eventoId)}.` });
      }
      datos.recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  }

  const comunes = { d, puede, onMover: (r) => abrir(r), onLiberar: (r) => setConfirmar({ tipo: 'reserva', r }) };
  const activas = d ? d.reservas.filter((r) => r.estado === 'RESERVADA').length : 0;

  return (
    <>
      <TituloPagina
        titulo="Reservas"
        chip={d && <span className="rounded-full bg-marino-tinte text-marino px-2.5 py-0.5 text-xs font-semibold tabular">{activas} activas</span>}
        subtitulo={`Del ${fechaCorta(desde)} al ${fechaCorta(hasta)} · ${diasEntre(desde, hasta).length} días`}
      >
        {puede && (
          <Boton icono="add" onClick={() => abrir()}>
            Nueva reserva
          </Boton>
        )}
      </TituloPagina>

      {mensaje && (
        <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)} className="mb-4">
          {mensaje.texto}
        </Aviso>
      )}

      <Tarjeta className="p-4 mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <Entrada icono="search" placeholder="Buscar por folio o evento" value={texto} onChange={(e) => setTexto(e.target.value)} className="h-10" />
          <Selector value={rango} onChange={(e) => setRango(e.target.value)} aria-label="Rango de fechas">
            {RANGOS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.texto}
              </option>
            ))}
          </Selector>
          <Selector value={espacio} onChange={(e) => setEspacio(e.target.value)} aria-label="Espacio">
            <option value="">Todos los espacios</option>
            {d?.espacios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Selector>
          <Selector value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="RESERVADA">Reservada</option>
            <option value="LIBERADA">Liberada</option>
          </Selector>
        </div>
      </Tarjeta>

      <div className="mb-4">
        <Pestanas
          valor={pestana}
          onChange={setPestana}
          opciones={[
            { valor: 'todas', texto: 'Todas', cuenta: d ? lista.length : null },
            { valor: 'evento', texto: 'Por evento' },
            { valor: 'espacio', texto: 'Por espacio' },
          ]}
        />
      </div>

      {datos.error && !d ? (
        <Tarjeta>
          <ErrorServicio servicio="El servicio de agenda" mensaje={datos.error.message} onReintentar={datos.recargar} />
        </Tarjeta>
      ) : !d ? (
        <Tarjeta>
          <EsqueletoTabla filas={6} columnas={6} />
        </Tarjeta>
      ) : lista.length === 0 ? (
        <Tarjeta>
          <Vacio icono="event_available" titulo="No hay reservas con estos filtros">
            Prueba con otro rango de fechas{puede ? ' o crea una nueva reserva.' : '.'}
          </Vacio>
        </Tarjeta>
      ) : pestana === 'todas' ? (
        <Tarjeta className="overflow-hidden">
          <Tabla lista={lista} {...comunes} />
        </Tarjeta>
      ) : pestana === 'evento' ? (
        <div className="space-y-4">
          {agrupar('eventoId').map(([id, rs]) => {
            const vivas = rs.filter((r) => r.estado === 'RESERVADA').length;
            return (
              <Grupo
                key={id}
                icono="event"
                titulo={nombreEvento(d.eventos, id)}
                subtitulo={`${rs.length} reservas · ${vivas} activas`}
                lista={rs}
                {...comunes}
                accion={
                  puede &&
                  vivas > 0 && (
                    <Boton variante="peligro" tamano="sm" icono="event_busy" onClick={() => setConfirmar({ tipo: 'evento', eventoId: id, cuantas: vivas })}>
                      Liberar todas
                    </Boton>
                  )
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {agrupar('espacioId').map(([id, rs]) => {
            const e = d.espacios.find((x) => x.id === id);
            return (
              <Grupo
                key={id}
                icono="location_city"
                titulo={nombreEspacio(d.espacios, id)}
                subtitulo={`${rs.length} reservas${e?.capacidad ? ` · capacidad ${e.capacidad}` : ''}`}
                lista={rs}
                {...comunes}
                accion={e?.estado && <Estado valor={e.estado} />}
              />
            );
          })}
        </div>
      )}

      {d && !d.espaciosEnLinea && (
        <p className="mt-4 text-xs text-texto-2 flex items-center gap-1.5">
          <Icono nombre="info" className="text-[16px]" />
          ms-espacios no respondió: solo se revisan los espacios configurados en el respaldo.
        </p>
      )}

      <Modal abierto={!!confirmar} onCerrar={() => !trabajando && setConfirmar(null)}>
        {confirmar && (
          <div className="p-6">
            <span className="size-12 rounded-full bg-peligro-tinte text-peligro grid place-items-center mb-4">
              <Icono nombre="event_busy" className="text-[24px]" />
            </span>
            <h2 className="font-titulo text-lg font-semibold text-texto">
              {confirmar.tipo === 'reserva' ? `¿Liberar ${folio(confirmar.r)}?` : `¿Liberar ${confirmar.cuantas} reservas?`}
            </h2>
            <p className="text-sm text-texto-2 mt-1">
              {confirmar.tipo === 'reserva'
                ? `El espacio queda libre el ${fechaCorta(confirmar.r.fecha)} de ${confirmar.r.horaInicio} a ${confirmar.r.horaFin}.`
                : `Se liberan todas las reservas de ${nombreEvento(d.eventos, confirmar.eventoId)}.`}{' '}
              Esto no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Boton variante="secundario" onClick={() => setConfirmar(null)} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton variante="peligro" cargando={trabajando} onClick={ejecutar}>
                Liberar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
