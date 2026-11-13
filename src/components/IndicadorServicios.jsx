// Indicador de servicios en la barra superior: punto verde, amarillo o rojo, y al darle clic
// la lista de cada microservicio con su estado. Se actualiza solo (ver api/servicios.js).
import { useEffect, useRef, useState } from 'react';
import { SEGUNDOS, revisarAhora, useServicios } from '../api/servicios';
import Icono from './Icono';

const PUNTO = { verde: 'bg-exito', amarillo: 'bg-aviso', rojo: 'bg-peligro', cargando: 'bg-tenue' };
const TEXTO = {
  verde: 'Todo en línea',
  amarillo: 'Algunos servicios del equipo no responden',
  rojo: 'Un servicio tuyo no responde',
  cargando: 'Revisando servicios...',
};

const hora = (d, seg = false) =>
  d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: seg ? '2-digit' : undefined, hour12: false }) : '';
const direccion = (url) => (url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'sin dirección');

function Punto({ color, latido = false }) {
  return (
    <span className="relative flex size-2.5 shrink-0">
      {latido && <span className={`absolute inline-flex size-full rounded-full ${color} opacity-60 animate-ping`} />}
      <span className={`relative inline-flex size-2.5 rounded-full ${color}`} />
    </span>
  );
}

export default function IndicadorServicios() {
  const { servicios, eureka, revisado, general } = useServicios();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // Se cierra al dar clic afuera o con Escape
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => caja.current && !caja.current.contains(e.target) && setAbierto(false);
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const vivos = servicios.filter((s) => s.vivo).length;
  const titulo = `${TEXTO[general]}${servicios.length ? ` (${vivos} de ${servicios.length})` : ''}`;

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label={`Estado de los servicios: ${titulo}`}
        title={titulo}
        className="h-10 inline-flex items-center gap-2 rounded-lg border border-borde px-3 text-sm text-texto-2 hover:text-texto hover:bg-borde-suave transition-colors"
      >
        <Punto color={PUNTO[general]} latido={general !== 'verde' && general !== 'cargando'} />
        <span className="hidden sm:inline font-medium">Servicios</span>
        {servicios.length > 0 && (
          <span className="hidden sm:inline text-xs text-tenue tabular-nums">
            {vivos}/{servicios.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-borde bg-superficie shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3">
            <div>
              <p className="font-titulo font-semibold text-texto">Estado de los servicios</p>
              <p className="text-xs text-texto-2">{TEXTO[general]}</p>
            </div>
            <button
              type="button"
              onClick={revisarAhora}
              title="Revisar ahora"
              aria-label="Revisar ahora"
              className="size-8 shrink-0 rounded-lg grid place-items-center text-texto-2 hover:text-texto hover:bg-borde-suave"
            >
              <Icono nombre="refresh" className="text-[18px]" />
            </button>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-borde-suave">
            {servicios.length === 0 && <li className="px-4 py-3 text-sm text-texto-2">Revisando...</li>}
            {servicios.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-1.5">
                  <Punto color={s.vivo ? 'bg-exito' : s.mio ? 'bg-peligro' : 'bg-aviso'} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-texto">{s.nombre}</p>
                    <p className={`shrink-0 text-xs font-medium ${s.vivo ? 'text-exito-texto' : s.mio ? 'text-peligro-texto' : 'text-aviso-texto'}`}>
                      {s.motivo}
                    </p>
                  </div>
                  <p className="truncate text-xs text-tenue">
                    de {s.de} · {direccion(s.url)} · desde {hora(s.desde)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 border-t border-borde px-4 py-2.5 text-xs text-texto-2">
            <Punto color={eureka === 'ok' ? 'bg-exito' : eureka === 'caido' ? 'bg-peligro' : 'bg-tenue'} />
            <span>{eureka === 'ok' ? 'Eureka en línea' : eureka === 'caido' ? 'Eureka no responde' : 'Revisando Eureka'}</span>
            <span className="ml-auto text-tenue">
              cada {SEGUNDOS} s{revisado ? ` · ${hora(revisado, true)}` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
