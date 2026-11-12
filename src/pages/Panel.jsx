// Panel principal. Administradores y organizadores ven la operacion de la semana;
// estudiantes, docentes e invitados ven su credencial y lo que pasa en el campus.
// Todo sale de ms-agenda (reservas), ms-usuarios (perfil y usuarios) y, si responde, ms-espacios / ms-eventos.
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNuevaReserva } from '../components/layout/Shell';
import useReservas from '../hooks/useReservas';
import useDatos from '../hooks/useDatos';
import useRecargaAlCrear from '../hooks/useRecargaAlCrear';
import { listarUsuarios } from '../api/usuarios';
import Icono from '../components/Icono';
import { Aviso, Boton, Esqueleto, EsqueletoTabla, Estado, ErrorServicio, EncabezadoTarjeta, Tarjeta, Vacio, Avatar } from '../components/ui';
import { ROLES_QUE_RESERVAN, documento, folio, nombreCompleto, nombreEspacio, nombreEvento, nombreTipo, saludo } from '../utils/formato';
import { fechaCorta, fechaLarga, haceCuanto, horas, hoyIso, lunesDe, sumarDias } from '../utils/fechas';

const HORAS_HABILES = 40; // 8 h x 5 dias, como en el diseno

function Kpi({ titulo, valor, detalle, chip, cargando }) {
  return (
    <Tarjeta className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-texto-2">{titulo}</p>
        {chip}
      </div>
      {cargando ? <Esqueleto className="h-8 w-20 mt-3" /> : <p className="font-titulo text-[32px] font-semibold text-texto mt-2 tabular leading-tight">{valor}</p>}
      <p className="text-xs text-texto-2 mt-1">{detalle}</p>
    </Tarjeta>
  );
}

function Ocupacion({ espacios, reservas }) {
  const filas = espacios.map((e) => {
    const hrs = reservas.filter((r) => r.espacioId === e.id && r.estado === 'RESERVADA').reduce((s, r) => s + horas(r.horaInicio, r.horaFin), 0);
    return { e, hrs, pct: Math.min(100, Math.round((hrs / HORAS_HABILES) * 100)) };
  });
  return (
    <div className="px-5 pb-5 space-y-5">
      {filas.map(({ e, hrs, pct }) => {
        const mant = e.estado === 'MANTENIMIENTO';
        return (
          <div key={e.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className={`font-medium ${mant ? 'text-tenue' : 'text-texto'}`}>
                {e.nombre}
                {e.capacidad && <span className="text-xs text-texto-2 font-normal"> · Capacidad {e.capacidad} pers.</span>}
                {mant && <Estado valor="MANTENIMIENTO" punto={false} />}
              </p>
              <p className="text-xs tabular text-texto-2">
                <b className="text-texto">{hrs} hrs</b> / {HORAS_HABILES} hrs · <b className={pct >= 70 ? 'text-marino' : 'text-info-texto'}>{pct}%</b>
              </p>
            </div>
            <div className={`mt-2 h-2.5 rounded-full ${mant ? 'rayado bg-borde-suave' : 'bg-borde-suave'}`}>
              {!mant && <div className={`h-full rounded-full ${pct >= 70 ? 'bg-marino' : 'bg-info'}`} style={{ width: `${pct}%` }} />}
            </div>
          </div>
        );
      })}
      <div className="pt-4 border-t border-borde flex flex-wrap gap-4 text-xs text-texto-2">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-marino" /> Alta demanda (70% o más)</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-info" /> Regular</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-borde" /> En mantenimiento</span>
      </div>
    </div>
  );
}

function Hoy({ reservas, espacios, eventos }) {
  const hoy = reservas.filter((r) => r.fecha === hoyIso() && r.estado === 'RESERVADA');
  return (
    <Tarjeta className="flex flex-col">
      <EncabezadoTarjeta titulo={`Hoy · ${fechaCorta(hoyIso())}`} subtitulo={`${hoy.length} ${hoy.length === 1 ? 'actividad programada' : 'actividades programadas'}`} />
      {hoy.length === 0 ? (
        <Vacio icono="event_busy" titulo="Sin reservas hoy">Los espacios están libres todo el día.</Vacio>
      ) : (
        <ol className="px-5 pb-2 flex-1">
          {hoy.map((r, i) => (
            <li key={r.id} className="relative pl-6 pb-5">
              {i < hoy.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-borde" />}
              <span className="absolute left-0 top-1 size-[11px] rounded-full border-2 border-marino bg-superficie" />
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-marino tabular">
                  {r.horaInicio} – {r.horaFin}
                </p>
                <span className="rounded border border-borde px-1.5 py-0.5 text-[11px] text-texto-2">{nombreEspacio(espacios, r.espacioId)}</span>
              </div>
              <p className="font-medium text-texto mt-1">{nombreEvento(eventos, r.eventoId)}</p>
            </li>
          ))}
        </ol>
      )}
      <Link to="/agenda" className="mt-auto border-t border-borde px-5 py-3 text-sm font-semibold text-marino hover:bg-borde-suave text-center">
        Ver agenda completa →
      </Link>
    </Tarjeta>
  );
}

function UltimasReservas({ reservas, espacios, eventos }) {
  const ultimas = [...reservas].sort((a, b) => (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? '')).slice(0, 6);
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Últimas reservas registradas" subtitulo="Las más recientes de esta semana y la siguiente">
        <Link to="/reservas" className="text-sm font-semibold text-marino hover:underline">
          Ver todas ({reservas.length})
        </Link>
      </EncabezadoTarjeta>
      {ultimas.length === 0 ? (
        <Vacio icono="event_note" titulo="Todavía no hay reservas" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-borde bg-lienzo text-left etiqueta text-[11px] text-texto-2">
                <th className="px-5 py-3">Folio</th>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Horario</th>
                <th className="px-3 py-3">Espacio</th>
                <th className="px-3 py-3">Evento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Creada</th>
              </tr>
            </thead>
            <tbody>
              {ultimas.map((r) => (
                <tr key={r.id} className="border-b border-borde-suave last:border-0 hover:bg-lienzo">
                  <td className="px-5 py-3 font-mono text-xs text-texto-2 whitespace-nowrap">{folio(r)}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular">{fechaCorta(r.fecha)}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular">
                    {r.horaInicio} – {r.horaFin}
                  </td>
                  <td className="px-3 py-3">{nombreEspacio(espacios, r.espacioId)}</td>
                  <td className="px-3 py-3">{nombreEvento(eventos, r.eventoId)}</td>
                  <td className="px-3 py-3">
                    <Estado valor={r.estado} />
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-texto-2 whitespace-nowrap">{haceCuanto(r.fechaCreacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

function Credencial({ perfil, rol }) {
  const doc = documento(perfil);
  return (
    <div className="rounded-2xl bg-marca text-white p-6 relative overflow-hidden">
      <div className="absolute -right-16 -top-16 size-48 rounded-full border border-white/10" />
      <p className="etiqueta text-oro-claro flex items-center gap-2">
        <Icono nombre="verified" className="text-[16px]" /> Credencial digital ITCH
      </p>
      <div className="flex items-center gap-4 mt-5">
        <Avatar perfil={perfil} tamano="size-14" className="ring-2 ring-white/25 text-base" />
        <div>
          <p className="font-titulo text-lg font-semibold">{nombreCompleto(perfil)}</p>
          <p className="text-sm text-white/70">{nombreTipo(rol)}</p>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-white/15 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-white/55 text-xs">{doc.etiqueta}</p>
          <p className="font-mono tabular mt-0.5">{doc.valor}</p>
        </div>
        <div>
          <p className="text-white/55 text-xs">Estado</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-exito" /> {perfil.estado === 'INACTIVO' ? 'Inactivo' : 'Activo'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Panel() {
  const { sesion, perfil } = useAuth();
  const { abrir } = useNuevaReserva();
  const lunes = lunesDe(hoyIso());
  const datos = useReservas(lunes, sumarDias(lunes, 13), { conLiberadas: false });
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const gestiona = ROLES_QUE_RESERVAN.includes(sesion.rol);
  const usuarios = useDatos(() => (esAdmin ? listarUsuarios({ estado: 'ACTIVO' }, sesion.token) : Promise.resolve(null)), [esAdmin, sesion.token]);

  // recargar al crear una reserva desde el panel lateral
  useRecargaAlCrear(datos.recargar);

  const d = datos.datos;
  const semana = d ? d.reservas.filter((r) => r.fecha >= lunes && r.fecha <= sumarDias(lunes, 6)) : [];
  const espaciosOk = d ? d.espacios.filter((e) => e.estado !== 'MANTENIMIENTO') : [];
  const totalHrs = semana.reduce((s, r) => s + horas(r.horaInicio, r.horaFin), 0);
  const ocupacion = espaciosOk.length ? Math.round((totalHrs / (espaciosOk.length * HORAS_HABILES)) * 100) : 0;
  const eventosSemana = new Set(semana.map((r) => r.eventoId)).size;
  const enMantenimiento = d?.espacios.filter((e) => e.estado === 'MANTENIMIENTO') ?? [];
  const proximas = d ? d.reservas.filter((r) => r.fecha >= hoyIso()).slice(0, 5) : [];

  return (
    <>
      {enMantenimiento.length > 0 && (
        <Aviso tipo="aviso" titulo="Alerta de disponibilidad de instalaciones" className="mb-6">
          {enMantenimiento.map((e) => e.nombre).join(', ')} {enMantenimiento.length === 1 ? 'está' : 'están'} en mantenimiento. No se pueden reservar hasta que vuelvan a estar disponibles.
        </Aviso>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-titulo text-2xl md:text-[28px] font-semibold text-texto">
            {saludo()}, {perfil?.nombre ?? ''}
          </h1>
          <p className="text-sm text-texto-2 mt-1 first-letter:uppercase">{fechaLarga(hoyIso())} · Campus Chilpancingo</p>
        </div>
        {gestiona && (
          <Boton icono="add" onClick={() => abrir()}>
            Nueva reserva
          </Boton>
        )}
      </div>

      {datos.error && !d ? (
        <Tarjeta>
          <ErrorServicio servicio="El servicio de agenda" mensaje={datos.error.message} onReintentar={datos.recargar} />
        </Tarjeta>
      ) : gestiona ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {esAdmin ? (
              <Kpi titulo="Usuarios activos" valor={usuarios.datos?.length ?? '—'} detalle="Cuentas con estado ACTIVO" cargando={usuarios.cargando} />
            ) : (
              <Kpi titulo="Espacios disponibles" valor={espaciosOk.length} detalle={`${enMantenimiento.length} en mantenimiento`} cargando={datos.cargando} />
            )}
            <Kpi titulo="Reservas esta semana" valor={semana.length} detalle={`${totalHrs} horas apartadas`} cargando={datos.cargando} />
            <Kpi
              titulo="Ocupación de espacios"
              valor={`${ocupacion}%`}
              detalle={`Promedio sobre ${HORAS_HABILES} hrs hábiles`}
              cargando={datos.cargando}
              chip={ocupacion >= 70 && <span className="rounded-md border border-oro-borde bg-oro-tinte px-2 py-0.5 text-[11px] font-semibold text-oro-texto">Alta</span>}
            />
            <Kpi titulo="Eventos esta semana" valor={eventosSemana} detalle="Con al menos una reserva" cargando={datos.cargando} />
          </div>

          <div className="grid xl:grid-cols-3 gap-6 mt-6">
            <Tarjeta className="xl:col-span-2">
              <EncabezadoTarjeta titulo="Ocupación por espacio esta semana" subtitulo={`Horas reservadas frente a ${HORAS_HABILES} hrs hábiles por espacio`} />
              {d ? <Ocupacion espacios={d.espacios} reservas={semana} /> : <EsqueletoTabla filas={4} columnas={2} />}
            </Tarjeta>
            {d ? <Hoy reservas={d.reservas} espacios={d.espacios} eventos={d.eventos} /> : <Tarjeta><EsqueletoTabla filas={4} columnas={1} /></Tarjeta>}
          </div>

          <div className="mt-6">{d ? <UltimasReservas reservas={d.reservas} espacios={d.espacios} eventos={d.eventos} /> : <Tarjeta><EsqueletoTabla /></Tarjeta>}</div>
        </>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            {perfil && <Credencial perfil={perfil} rol={sesion.rol} />}
            <Tarjeta className="p-5">
              <p className="etiqueta text-texto-2">Resumen de la semana</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-lienzo p-3">
                  <p className="font-titulo text-2xl font-semibold tabular">{d ? semana.length : '—'}</p>
                  <p className="text-xs text-texto-2">Reservas en el campus</p>
                </div>
                <div className="rounded-lg bg-lienzo p-3">
                  <p className="font-titulo text-2xl font-semibold tabular">{d ? eventosSemana : '—'}</p>
                  <p className="text-xs text-texto-2">Eventos programados</p>
                </div>
              </div>
            </Tarjeta>
          </div>
          <Tarjeta className="lg:col-span-2">
            <EncabezadoTarjeta titulo="Próximas actividades en el campus" subtitulo="Espacios reservados para eventos">
              <Link to="/agenda" className="text-sm font-semibold text-marino hover:underline">
                Ver agenda
              </Link>
            </EncabezadoTarjeta>
            {!d ? (
              <EsqueletoTabla filas={4} columnas={3} />
            ) : proximas.length === 0 ? (
              <Vacio icono="event_busy" titulo="No hay actividades próximas">Cuando se reserve un espacio aparecerá aquí.</Vacio>
            ) : (
              <ul className="px-5 pb-5 space-y-3">
                {proximas.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 rounded-xl border border-borde p-4">
                    <div className="w-14 text-center rounded-lg border border-borde py-1.5">
                      <p className="font-titulo text-lg font-semibold leading-none tabular">{Number(r.fecha.slice(8))}</p>
                      <p className="etiqueta text-[10px] text-texto-2 mt-1">{fechaCorta(r.fecha).split(' ').pop()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-texto truncate">{nombreEvento(d.eventos, r.eventoId)}</p>
                      <p className="text-sm text-texto-2 flex flex-wrap gap-x-4">
                        <span className="flex items-center gap-1"><Icono nombre="location_on" className="text-[16px]" />{nombreEspacio(d.espacios, r.espacioId)}</span>
                        <span className="flex items-center gap-1 tabular"><Icono nombre="schedule" className="text-[16px]" />{r.horaInicio} – {r.horaFin}</span>
                      </p>
                    </div>
                    <Estado valor={r.estado} />
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      )}

      {d && !d.espaciosEnLinea && (
        <p className="mt-6 text-xs text-texto-2 flex items-center gap-1.5">
          <Icono nombre="info" className="text-[16px]" />
          ms-espacios no respondió: los espacios se muestran por su número.
        </p>
      )}
    </>
  );
}

