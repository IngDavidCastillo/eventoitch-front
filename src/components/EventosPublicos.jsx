// Seccion "Proximos eventos" de la pagina de inicio: se ve SIN iniciar sesion.
// Pide los eventos a ms-eventos (de Roberta) y muestra solo los de hoy en adelante, con busqueda
// por nombre y por fecha. Si hay sesion manda el token; si no, pide sin token (para eso ms-eventos
// tiene que dejar GET /api/v1/eventos sin token; si responde 401 se avisa en pantalla).
// Los nombres de los campos se leen con respaldo (titulo o nombre, fechaInicio o fecha...) porque
// el JSON de ms-eventos no es de mi contrato.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENTOS_URL, pedir } from '../api/cliente';
import { urlEnEureka } from '../api/servicios';
import { useAuth } from '../context/AuthContext';
import { ahoraMexico, fechaLarga } from '../utils/fechas';
import Icono from './Icono';
import { Boton, Entrada, Esqueleto, Insignia, Vacio } from './ui';

// Estados de ms-eventos que ya no se muestran al publico
const OCULTOS = ['CANCELADO', 'FINALIZADO'];

const hora = (h) => (typeof h === 'string' ? h.slice(0, 5) : null);
const sinAcentos = (t) => (t ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fechaDe = (v) => (typeof v === 'string' ? v.slice(0, 10) : null); // "2026-11-30" o "2026-11-30T10:00:00"

// Lleva un evento de ms-eventos a lo que necesita la tarjeta
function normalizar(e) {
  const inicio = fechaDe(e.fechaInicio ?? e.fecha ?? e.fechaEvento);
  return {
    id: e.id ?? e.idEvento,
    titulo: e.titulo ?? e.nombre ?? `Evento ${e.id}`,
    descripcion: e.descripcion ?? '',
    inicio,
    fin: fechaDe(e.fechaFin) ?? inicio,
    horaInicio: hora(e.horaInicio ?? (typeof e.fechaInicio === 'string' ? e.fechaInicio.slice(11) : null)),
    horaFin: hora(e.horaFin ?? (typeof e.fechaFin === 'string' ? e.fechaFin.slice(11) : null)),
    lugar: e.espacio?.nombre ?? e.nombreEspacio ?? e.espacioNombre ?? e.lugar ?? null,
    categoria: e.categoria?.nombre ?? e.nombreCategoria ?? e.categoriaNombre ?? null,
    cupo: e.cupoMaximo ?? e.cupo ?? null,
    estado: e.estado ?? null,
  };
}

async function pedirEventos(token) {
  const base = (await urlEnEureka('MS-EVENTOS')) || EVENTOS_URL;
  if (!base) {
    const error = new Error('El servicio de eventos no está conectado en este momento.');
    error.status = 0;
    throw error;
  }
  const datos = await pedir(`${base.replace(/\/$/, '')}/api/v1/eventos`, { token, tiempo: 8000 });
  return Array.isArray(datos) ? datos : (datos?.content ?? []);
}

function Tarjeta({ e, hoy, sesion }) {
  const esHoy = e.inicio <= hoy && hoy <= e.fin;
  const variosDias = e.fin && e.fin !== e.inicio;
  return (
    <article className="aparecer rounded-xl border border-borde bg-superficie p-5 flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        {esHoy ? <Insignia tono="exito" punto>Hoy</Insignia> : <Insignia tono="info">Próximo</Insignia>}
        {e.categoria && <Insignia tono="oro">{e.categoria}</Insignia>}
      </div>
      <h3 className="font-titulo text-lg font-semibold text-texto mt-3 leading-snug">{e.titulo}</h3>
      {e.descripcion && <p className="text-sm text-texto-2 mt-1.5 line-clamp-3">{e.descripcion}</p>}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2 text-texto">
          <Icono nombre="calendar_today" className="text-[18px] text-texto-2" />
          <dd className="first-letter:uppercase">
            {fechaLarga(e.inicio)}
            {variosDias && ` al ${fechaLarga(e.fin)}`}
          </dd>
        </div>
        {e.horaInicio && (
          <div className="flex gap-2 text-texto tabular">
            <Icono nombre="schedule" className="text-[18px] text-texto-2" />
            <dd>
              {e.horaInicio}
              {e.horaFin && ` – ${e.horaFin}`} hrs
            </dd>
          </div>
        )}
        {e.lugar && (
          <div className="flex gap-2 text-texto">
            <Icono nombre="location_on" className="text-[18px] text-texto-2" />
            <dd>{e.lugar}</dd>
          </div>
        )}
        {e.cupo != null && (
          <div className="flex gap-2 text-texto">
            <Icono nombre="groups" className="text-[18px] text-texto-2" />
            <dd>Cupo de {e.cupo} personas</dd>
          </div>
        )}
      </dl>
      <div className="mt-auto pt-5">
        <Link
          to={sesion ? '/panel' : '/login'}
          className="h-10 px-4 rounded-lg border border-borde text-sm font-semibold text-texto inline-flex items-center gap-2 hover:bg-borde-suave"
        >
          <Icono nombre={sesion ? 'arrow_forward' : 'login'} className="text-[18px]" />
          {sesion ? 'Ir a mi panel' : 'Inicia sesión para inscribirte'}
        </Link>
      </div>
    </article>
  );
}

export default function EventosPublicos() {
  const { sesion } = useAuth();
  const [eventos, setEventos] = useState(null); // null = cargando
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState('');

  const cargar = useCallback(async () => {
    setError(null);
    setEventos(null);
    try {
      setEventos((await pedirEventos(sesion?.token)).map(normalizar));
    } catch (e) {
      setError(e);
      setEventos([]);
    }
  }, [sesion?.token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ahora = ahoraMexico(); // "2026-11-23 20:45"
  const hoy = ahora.slice(0, 10);

  // Presentes y futuros: los que todavia no terminan (ultimo dia + hora de fin, hora de Mexico),
  // sin cancelados ni finalizados, ordenados por fecha
  const vigentes = useMemo(
    () =>
      (eventos ?? [])
        .filter((e) => e.inicio && `${e.fin} ${e.horaFin ?? '23:59'}` > ahora && !OCULTOS.includes(e.estado))
        .sort((a, b) => `${a.inicio} ${a.horaInicio ?? ''}`.localeCompare(`${b.inicio} ${b.horaInicio ?? ''}`)),
    [eventos, ahora],
  );

  const lista = useMemo(() => {
    const t = sinAcentos(texto.trim());
    return vigentes.filter(
      (e) =>
        (!t || sinAcentos(`${e.titulo} ${e.descripcion} ${e.categoria ?? ''} ${e.lugar ?? ''}`).includes(t)) &&
        (!fecha || (e.inicio <= fecha && fecha <= e.fin)),
    );
  }, [vigentes, texto, fecha]);

  return (
    <section id="eventos" className="max-w-6xl mx-auto px-4 md:px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta text-oro">Agenda del campus</p>
          <h2 className="font-titulo text-2xl font-semibold text-texto mt-2">Próximos eventos</h2>
          <p className="text-sm text-texto-2 mt-1">
            Eventos de hoy y de los próximos días.{error?.status !== 401 && ' No necesitas iniciar sesión para verlos.'}
          </p>
        </div>
        {eventos && !error && (
          <span className="rounded-full bg-marino-tinte text-marino px-3 py-1 text-xs font-semibold tabular">
            {lista.length} {lista.length === 1 ? 'evento' : 'eventos'}
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <Entrada icono="search" placeholder="Buscar por nombre del evento" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar por nombre" />
        <Entrada icono="event" type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Buscar por fecha" />
        {(texto || fecha) && (
          <Boton variante="secundario" icono="close" onClick={() => { setTexto(''); setFecha(''); }}>
            Limpiar
          </Boton>
        )}
      </div>

      <div className="mt-6">
        {eventos === null ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Esqueleto key={i} className="h-60 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-borde">
            <Vacio icono="cloud_off" titulo={error.status === 401 ? 'Para ver los eventos inicia sesión' : 'No se pudieron cargar los eventos'}>
              {error.status === 401
                ? 'El servicio de eventos todavía pide iniciar sesión para consultarlos.'
                : 'El servicio de eventos no responde en este momento. Intenta de nuevo en un momento.'}
              <div className="mt-4 flex justify-center gap-2">
                <Boton variante="secundario" icono="refresh" onClick={cargar}>
                  Reintentar
                </Boton>
                {error.status === 401 && !sesion && (
                  <Link to="/login" className="h-10 px-4 rounded-lg bg-marino text-white text-sm font-semibold inline-flex items-center hover:bg-marino-osc">
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </Vacio>
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-xl border border-borde">
            <Vacio icono="event_busy" titulo={vigentes.length ? 'Ningún evento coincide con tu búsqueda' : 'Por ahora no hay eventos próximos'}>
              {vigentes.length ? 'Prueba con otro nombre o con otra fecha.' : 'Cuando se publique un evento aparecerá aquí.'}
            </Vacio>
          </div>
        ) : (
          <div className="escalonado grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((e) => (
              <Tarjeta key={e.id} e={e} hoy={hoy} sesion={sesion} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
