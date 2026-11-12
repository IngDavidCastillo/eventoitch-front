// Piezas pequenas que usan todas las pantallas, con el estilo de Stitch.
import { useEffect, useRef, useState } from 'react';
import { urlFoto } from '../api/cliente';
import { TIPOS_FOTO, prepararFoto } from '../utils/imagen';
import Icono from './Icono';

// ---------- Botones ----------
const VARIANTES = {
  primario: 'bg-marino text-white hover:bg-marino-osc disabled:bg-tenue',
  secundario: 'bg-superficie text-texto border border-borde hover:bg-borde-suave disabled:text-tenue',
  oro: 'bg-oro-tinte text-marino border border-oro-borde hover:bg-oro-hover',
  peligro: 'bg-superficie text-peligro-texto border border-peligro-borde hover:bg-peligro-tinte',
  fantasma: 'text-marino hover:bg-marino-tinte',
};

export function Boton({ variante = 'primario', icono, cargando, children, className = '', tamano = 'md', ...props }) {
  const alto = tamano === 'sm' ? 'h-8 px-3 text-xs' : tamano === 'lg' ? 'h-12 px-5 text-[15px]' : 'h-10 px-4 text-sm';
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${alto} ${VARIANTES[variante]} ${className}`}
    >
      {cargando ? <Icono nombre="progress_activity" className="text-[18px] animate-spin" /> : icono && <Icono nombre={icono} className="text-[18px]" />}
      {children}
    </button>
  );
}

// ---------- Insignias de estado ----------
const TONOS = {
  exito: 'bg-exito-tinte text-exito-texto border-exito-borde',
  aviso: 'bg-aviso-tinte text-aviso-texto border-aviso-borde',
  peligro: 'bg-peligro-tinte text-peligro-texto border-peligro-borde',
  info: 'bg-info-tinte text-info-texto border-info-borde',
  neutro: 'bg-borde-suave text-texto-2 border-borde',
  marino: 'bg-marino text-white border-marino',
  oro: 'bg-oro-tinte text-oro-texto border-oro-borde',
};

const ESTADOS = {
  ACTIVO: ['exito', 'Activo'],
  INACTIVO: ['peligro', 'Inactivo'],
  RESERVADA: ['info', 'Reservada'],
  LIBERADA: ['neutro', 'Liberada'],
  DISPONIBLE: ['exito', 'Disponible'],
  MANTENIMIENTO: ['peligro', 'Mantenimiento'],
  PROGRAMADO: ['info', 'Programado'],
  CANCELADO: ['peligro', 'Cancelado'],
  FINALIZADO: ['neutro', 'Finalizado'],
  EN_RIESGO: ['aviso', 'En riesgo'],
  CONFLICTO: ['peligro', 'Conflicto'],
};

export function Insignia({ tono = 'neutro', punto = false, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${TONOS[tono]} ${className}`}>
      {punto && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Estado({ valor, punto = true }) {
  const [tono, texto] = ESTADOS[valor] ?? ['neutro', valor];
  return (
    <Insignia tono={tono} punto={punto}>
      {texto}
    </Insignia>
  );
}

// ---------- Tarjetas y titulos ----------
export function Tarjeta({ children, className = '', ...props }) {
  return (
    <section {...props} className={`bg-superficie border border-borde rounded-xl ${className}`}>
      {children}
    </section>
  );
}

export function EncabezadoTarjeta({ titulo, subtitulo, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div>
        <h2 className="font-titulo text-lg font-semibold text-texto">{titulo}</h2>
        {subtitulo && <p className="text-xs text-texto-2 mt-0.5">{subtitulo}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function TituloPagina({ titulo, chip, subtitulo, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-titulo text-2xl md:text-[28px] font-semibold text-texto">{titulo}</h1>
          {chip}
        </div>
        {subtitulo && <p className="text-sm text-texto-2 mt-1">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// ---------- Formularios ----------
export function Campo({ etiqueta, ayuda, error, obligatorio, extra, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-texto">
          {etiqueta}
          {obligatorio && <span className="text-peligro"> *</span>}
        </span>
        {extra}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs text-peligro-texto">
          <Icono nombre="error" className="text-[14px]" />
          {error}
        </span>
      ) : (
        ayuda && <span className="mt-1.5 block text-xs text-texto-2">{ayuda}</span>
      )}
    </label>
  );
}

export function Entrada({ icono, error, derecha, className = '', ...props }) {
  return (
    <span
      className={`flex items-center gap-2 h-11 rounded-lg border bg-superficie px-3 transition-colors focus-within:border-marino focus-within:ring-2 focus-within:ring-marino-tinte ${error ? 'border-peligro bg-peligro-tinte/40' : 'border-borde'} ${className}`}
    >
      {icono && <Icono nombre={icono} className="text-[18px] text-tenue" />}
      <input {...props} className="flex-1 min-w-0 bg-transparent text-sm text-texto placeholder:text-tenue outline-none tabular" />
      {derecha}
    </span>
  );
}

export function Selector({ children, className = '', ...props }) {
  return (
    <span className={`relative flex items-center h-10 rounded-lg border border-borde bg-superficie ${className}`}>
      <select {...props} className="appearance-none w-full h-full bg-transparent pl-3 pr-8 text-sm text-texto outline-none">
        {children}
      </select>
      <Icono nombre="expand_more" className="text-[18px] text-texto-2 absolute right-2 pointer-events-none" />
    </span>
  );
}

export function Interruptor({ activo, onChange, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onChange(!activo)}
      className={`relative h-6 w-11 rounded-full transition-colors ${activo ? 'bg-marino' : 'bg-borde'}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${activo ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

// ---------- Avisos y estados ----------
const AVISOS = {
  exito: ['check_circle', 'bg-exito-tinte border-exito-borde text-exito-texto'],
  error: ['error', 'bg-peligro-tinte border-peligro-borde text-peligro-texto'],
  aviso: ['warning', 'bg-aviso-tinte border-aviso-borde text-aviso-texto'],
  info: ['info', 'bg-info-tinte border-info-borde text-info-texto'],
};

export function Aviso({ tipo = 'info', titulo, children, onCerrar, className = '' }) {
  const [icono, color] = AVISOS[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${color} ${className}`}>
      <Icono nombre={icono} className="text-[20px] mt-px" />
      <div className="flex-1 min-w-0">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className={titulo ? 'text-texto-2 mt-0.5' : ''}>{children}</div>
      </div>
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Cerrar aviso" className="self-start opacity-70 hover:opacity-100">
          <Icono nombre="close" className="text-[18px]" />
        </button>
      )}
    </div>
  );
}

export function Esqueleto({ className = '' }) {
  return <div className={`esqueleto ${className}`} />;
}

export function EsqueletoTabla({ filas = 5, columnas = 5 }) {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columnas }, (_, j) => (
            <Esqueleto key={j} className={`h-4 ${j === 0 ? 'w-24' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Tarjeta "el servicio no responde" (pantalla de estados de Stitch)
export function ErrorServicio({ servicio = 'El servicio', mensaje, onReintentar }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-6 py-10">
      <span className="size-12 rounded-full bg-peligro-tinte text-peligro grid place-items-center">
        <Icono nombre="cloud_off" className="text-[24px]" />
      </span>
      <div>
        <p className="font-titulo font-semibold text-texto">{servicio} no responde en este momento</p>
        <p className="text-sm text-texto-2 mt-1 max-w-md">{mensaje ?? 'Tus datos están a salvo, intenta de nuevo.'}</p>
      </div>
      {onReintentar && (
        <Boton variante="secundario" icono="refresh" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Vacio({ icono = 'inbox', titulo, children }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 px-6 py-10">
      <span className="size-12 rounded-full bg-borde-suave text-texto-2 grid place-items-center">
        <Icono nombre={icono} className="text-[24px]" />
      </span>
      <p className="font-titulo font-semibold text-texto">{titulo}</p>
      {children && <div className="text-sm text-texto-2 max-w-md">{children}</div>}
    </div>
  );
}

// ---------- Ventanas ----------
function useEscape(onCerrar) {
  useEffect(() => {
    if (!onCerrar) return;
    const f = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
}

export function Modal({ abierto, onCerrar, children, ancho = 'max-w-md' }) {
  useEscape(abierto ? onCerrar : null);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div role="dialog" aria-modal="true" className={`w-full ${ancho} bg-superficie rounded-2xl border border-borde shadow-xl`}>
        {children}
      </div>
    </div>
  );
}

// Panel lateral (en celular ocupa toda la pantalla)
export function Panel({ abierto, onCerrar, titulo, subtitulo, pie, children }) {
  useEscape(abierto ? onCerrar : null);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <aside role="dialog" aria-modal="true" className="w-full sm:max-w-[600px] h-full bg-superficie flex flex-col shadow-2xl">
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-borde">
          <div>
            <h2 className="font-titulo text-xl font-semibold text-texto flex items-center gap-2">
              <span className="size-2 rounded-full bg-marino" />
              {titulo}
            </h2>
            {subtitulo && <p className="text-sm text-texto-2 mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="size-10 grid place-items-center rounded-lg hover:bg-borde-suave">
            <Icono nombre="close" className="text-[22px] text-texto-2" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-fino px-6 py-5">{children}</div>
        {pie && <footer className="border-t border-borde px-6 py-4 bg-superficie">{pie}</footer>}
      </aside>
    </div>
  );
}

export function Pestanas({ opciones, valor, onChange }) {
  return (
    <div className="flex gap-6 border-b border-borde overflow-x-auto scroll-fino">
      {opciones.map((o) => (
        <button
          key={o.valor}
          onClick={() => onChange(o.valor)}
          className={`relative pb-3 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${valor === o.valor ? 'text-texto' : 'text-texto-2 hover:text-texto'}`}
        >
          {o.texto}
          {o.cuenta != null && (
            <span className={`rounded-full px-2 py-px text-[11px] font-semibold tabular ${valor === o.valor ? 'bg-marino text-white' : 'bg-borde-suave text-texto-2'}`}>{o.cuenta}</span>
          )}
          {valor === o.valor && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-marino rounded-full" />}
        </button>
      ))}
    </div>
  );
}

export function Segmentado({ opciones, valor, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-borde bg-borde-suave p-0.5">
      {opciones.map((o) => (
        <button
          key={o.valor}
          onClick={() => onChange(o.valor)}
          className={`h-8 px-3 rounded-md text-sm font-medium ${valor === o.valor ? 'bg-superficie text-texto shadow-sm border border-borde' : 'text-texto-2 hover:text-texto'}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ perfil, texto, foto, tamano = 'size-9', className = '' }) {
  const ini = texto ?? `${perfil?.nombre?.[0] ?? ''}${perfil?.apellidos?.[0] ?? ''}`.toUpperCase();
  // foto: vista previa local (antes de subirla); si no, la que guarda ms-usuarios
  const src = foto ?? urlFoto(perfil?.fotografiaUrl);
  const [rota, setRota] = useState(null);
  if (src && rota !== src) {
    return <img src={src} alt="" onError={() => setRota(src)} className={`${tamano} rounded-full object-cover shrink-0 bg-borde-suave ${className}`} />;
  }
  return <span className={`${tamano} rounded-full bg-marino text-white grid place-items-center text-xs font-semibold shrink-0 ${className}`}>{ini || 'U'}</span>;
}

/**
 * Elegir foto de perfil: muestra el circulo con la foto (o las iniciales), "Subir foto" y "Quitar".
 * onElegir recibe el archivo ya recortado y reducido (ver utils/imagen.js); los errores salen debajo.
 */
export function SelectorFoto({ perfil, foto, onElegir, onQuitar, cargando = false, className = '' }) {
  const entrada = useRef(null);
  const [error, setError] = useState(null);
  const hayFoto = !!(foto ?? perfil?.fotografiaUrl);

  async function elegido(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError(null);
    try {
      await onElegir(await prepararFoto(archivo));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar perfil={perfil} foto={foto} tamano="size-20" className="text-xl ring-4 ring-borde-suave" />
          {cargando && (
            <span className="absolute inset-0 rounded-full bg-black/45 grid place-items-center">
              <span className="size-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-texto">Foto de perfil</p>
          <div className="flex flex-wrap gap-2">
            <Boton type="button" variante="secundario" tamano="sm" icono="photo_camera" disabled={cargando} onClick={() => entrada.current?.click()}>
              {hayFoto ? 'Cambiar foto' : 'Subir foto'}
            </Boton>
            {hayFoto && onQuitar && (
              <Boton type="button" variante="fantasma" tamano="sm" icono="delete" disabled={cargando} onClick={onQuitar}>
                Quitar
              </Boton>
            )}
          </div>
          <p className="text-xs text-texto-2">JPG, PNG o WEBP. Se recorta cuadrada.</p>
        </div>
        <input ref={entrada} type="file" accept={TIPOS_FOTO.join(',')} className="hidden" onChange={elegido} />
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-peligro-texto">
          <Icono nombre="error" className="text-[14px]" />
          {error}
        </p>
      )}
    </div>
  );
}
