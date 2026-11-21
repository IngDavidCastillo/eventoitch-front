// Piezas pequenas que usan todas las pantallas, con el estilo de Stitch.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  MANTENIMIENTO: ['aviso', 'Mantenimiento'],
  PROGRAMADO: ['info', 'Programado'],
  CANCELADO: ['peligro', 'Cancelado'],
  FINALIZADO: ['neutro', 'Finalizado'],
  EN_RIESGO: ['aviso', 'En riesgo'],
  CONFLICTO: ['peligro', 'Conflicto'],
  // Estados de ms-eventos que faltaban (Roberta)
  MANTENIDO: ['info', 'Mantenido'],
  REPROGRAMADO: ['aviso', 'Reprogramado'],
  CAMBIO_UBICACION: ['aviso', 'Cambio de ubicación'],
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
      className={`campo-entrada flex items-center gap-2 h-11 rounded-lg border bg-superficie px-3 transition-colors focus-within:border-marino focus-within:ring-2 focus-within:ring-marino-tinte ${error ? 'border-peligro bg-peligro-tinte/40' : 'border-borde'} ${className}`}
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

export function Esqueleto({ className = '', style }) {
  return <div className={`esqueleto ${className}`} style={style} aria-hidden="true" />;
}

export function EsqueletoTabla({ filas = 5, columnas = 5 }) {
  return (
    <div className="p-5 space-y-4" role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          {Array.from({ length: columnas }, (_, j) => (
            // anchos distintos por fila para que parezca una tabla de verdad
            <div key={j} className={j === 0 ? 'w-24 shrink-0' : 'flex-1'}>
              <Esqueleto className="h-4" style={{ width: j === 0 ? '100%' : `${55 + ((i * 7 + j * 13) % 40)}%`, animationDelay: `${i * 80}ms` }} />
            </div>
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

// Modal y Panel se dibujan directo en <body> (createPortal). Si se quedaran dentro del contenido de la
// pagina, la animacion de entrada de <main> (clase "aparecer" de Shell) los encierra y solo cubren esa zona
// en lugar de toda la pantalla. (Roberta)
export function Modal({ abierto, onCerrar, children, ancho = 'max-w-md' }) {
  useEscape(abierto ? onCerrar : null);
  if (!abierto) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div role="dialog" aria-modal="true" className={`w-full ${ancho} bg-superficie rounded-2xl border border-borde shadow-xl`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Panel lateral (en celular ocupa toda la pantalla)
export function Panel({ abierto, onCerrar, titulo, subtitulo, pie, children }) {
  useEscape(abierto ? onCerrar : null);
  if (!abierto) return null;
  return createPortal(
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
    </div>,
    document.body,
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

// =====================================================================================================
// Piezas agregadas por Roberta (vistas de Categorías, Espacios y Eventos). Usan solo los tokens del
// sistema, así funcionan en modo claro y oscuro. Cualquier vista las puede usar.
// =====================================================================================================

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

// ---------- Globo de ayuda ----------
// Aparece al pasar el mouse (o con el teclado). Se dibuja en <body> para que una tabla con scroll no lo recorte.
// lado: 'arriba' (sobre el elemento; si no cabe, abajo) o 'izquierda' (a un lado, centrado; para botones flotantes).
export function Globo({ texto, children, className = '', lado = 'arriba' }) {
  const [pos, setPos] = useState(null);
  const caja = useRef(null);
  const globo = useRef(null);
  function mostrar() {
    if (!texto) return;
    const r = caja.current.getBoundingClientRect();
    if (lado === 'izquierda') return setPos({ lado, x: r.left - 8, y: r.top + r.height / 2 });
    const x = r.left + r.width / 2;
    setPos(r.top < 120 ? { lado, x, y: r.bottom + 8, abajo: true } : { lado, x, y: r.top - 8, abajo: false });
  }
  const ocultar = () => setPos(null);
  // Si el globo se saldría de la pantalla por un lado, se recorre solo lo necesario (según su ancho real)
  useLayoutEffect(() => {
    if (!pos || pos.lado !== 'arriba' || !globo.current) return;
    const mitad = globo.current.offsetWidth / 2;
    globo.current.style.left = `${limitar(pos.x, mitad + 8, window.innerWidth - mitad - 8)}px`;
  }, [pos]);
  const colocacion =
    pos?.lado === 'izquierda' ? '-translate-x-full -translate-y-1/2' : `-translate-x-1/2 ${pos?.abajo ? '' : '-translate-y-full'}`;
  return (
    <span ref={caja} onMouseEnter={mostrar} onMouseLeave={ocultar} onFocus={mostrar} onBlur={ocultar} className={className}>
      {children}
      {pos &&
        createPortal(
          <span
            ref={globo}
            role="tooltip"
            className={`aparecer pointer-events-none fixed z-[60] w-max max-w-sm rounded-lg border border-borde bg-superficie px-3 py-2 text-xs leading-relaxed text-texto shadow-xl break-words ${colocacion}`}
            style={{ left: pos.x, top: pos.y }}
          >
            {texto}
          </span>,
          document.body,
        )}
    </span>
  );
}

// ---------- Formularios: ayuda, contador, sección y área de texto ----------
// Línea de ayuda con ícono (para el `ayuda` de Campo): tono 'info' o 'aviso'
const TONOS_AYUDA = { info: ['info', 'text-info-texto'], aviso: ['warning', 'text-aviso-texto'] };
export function LineaAyuda({ tono = 'info', children }) {
  const [icono, color] = TONOS_AYUDA[tono];
  return (
    <span className={`flex items-start gap-1 ${color}`}>
      <Icono nombre={icono} className="mt-px text-[14px]" />
      {children}
    </span>
  );
}

// Contador de caracteres (para el `extra` de Campo): cambia a color de aviso al llegar al máximo
export function ContadorCaracteres({ actual, maximo }) {
  return <span className={`text-xs tabular ${actual >= maximo ? 'font-semibold text-aviso-texto' : 'text-texto-2'}`}>{actual}/{maximo}</span>;
}

// Sección numerada de un formulario en Panel ("1. DATOS GENERALES"), como la del panel "Nueva reserva"
export function SeccionFormulario({ numero, titulo, extra, children }) {
  return (
    <section className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="etiqueta text-texto">
          {numero}. {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

// Caja de texto de varios renglones con el mismo estilo que Entrada (tamaño fijo, sin esquina para estirar)
export function AreaTexto({ error, rows = 4, className = '', ...props }) {
  return (
    <textarea
      rows={rows}
      {...props}
      className={`block w-full resize-none rounded-lg border bg-superficie px-3 py-2.5 text-sm text-texto placeholder:text-tenue outline-none transition-colors focus:border-marino focus:ring-2 focus:ring-marino-tinte ${error ? 'border-peligro' : 'border-borde'} ${className}`}
    />
  );
}

// ---------- Aviso temporal de un renglón ----------
// Para ponerlo junto al botón de TituloPagina. Mide lo mismo que un botón (h-10) para que el encabezado no
// cambie de alto; lo que no cabe termina en "..." y se ve completo en el globo. El de éxito se desvanece a los 6 s.
// Cada mensaje nuevo debe llevar su propio `key` (ej. un id) para que empiece otra vez visible.
export function AvisoTemporal({ mensaje, onCerrar }) {
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    if (mensaje.tipo !== 'exito') return;
    const t = setTimeout(() => setSaliendo(true), 6000);
    return () => clearTimeout(t);
  }, [mensaje]);
  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(onCerrar, 500);
    return () => clearTimeout(t);
  }, [saliendo, onCerrar]);
  // Dos capas: la de afuera entra con la animación "aparecer"; la de adentro se desvanece al salir
  return (
    <div className="aparecer min-w-0 w-full sm:w-auto sm:max-w-[600px]" role="region" aria-label="Avisos">
      <div className={`transition-opacity duration-500 ${saliendo ? 'opacity-0' : 'opacity-100'}`}>
        <Aviso tipo={mensaje.tipo} onCerrar={() => setSaliendo(true)} className="h-10 items-center py-0">
          <Globo texto={mensaje.texto} className="block">
            <span className="block truncate">{mensaje.texto}</span>
          </Globo>
        </Aviso>
      </div>
    </div>
  );
}

// ---------- Menú desplegable ----------
// Alternativa a Selector que respeta el modo oscuro (la lista nativa del <select> sale blanca en oscuro).
// opciones: [{ valor, texto, icono? }]
export function MenuDesplegable({ valor, onChange, opciones, etiqueta, icono = 'sort', ancho = 'w-52' }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const actual = opciones.find((o) => o.valor === valor) ?? opciones[0];
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => !caja.current?.contains(e.target) && setAbierto(false);
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);
  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex h-10 items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto hover:bg-borde-suave"
      >
        {icono && <Icono nombre={icono} className="text-[18px] text-texto-2" />}
        {etiqueta && <span className="text-texto-2 hidden sm:inline">{etiqueta}:</span>}
        <span className="font-medium">{actual.texto}</span>
        <Icono nombre="expand_more" className={`text-[18px] text-texto-2 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <ul role="listbox" className={`aparecer absolute right-0 top-12 z-30 ${ancho} rounded-xl border border-borde bg-superficie p-1 shadow-xl`}>
          {opciones.map((o) => (
            <li key={o.valor}>
              <button
                type="button"
                role="option"
                aria-selected={o.valor === valor}
                onClick={() => {
                  onChange(o.valor);
                  setAbierto(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${o.valor === valor ? 'bg-marino-tinte font-semibold text-marino' : 'text-texto hover:bg-borde-suave'}`}
              >
                {o.icono && <Icono nombre={o.icono} className="text-[18px]" />}
                <span className="flex-1">{o.texto}</span>
                {o.valor === valor && <Icono nombre="check" className="text-[18px]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Botón "Volver arriba" ----------
// Aparece al bajar 200 px. Nunca se encima al pie de página: si el pie ya se ve, sube y queda justo arriba.
// En celular va más arriba para no tapar el botón "Nueva reserva" ni la barra de abajo.
export function BotonArriba() {
  const [abajo, setAbajo] = useState(null); // distancia al borde inferior; null = oculto
  useEffect(() => {
    const revisar = () => {
      if (window.scrollY <= 200) return setAbajo(null);
      const base = window.matchMedia('(min-width: 1024px)').matches ? 24 : 144;
      const pie = document.querySelector('main + footer');
      const altoPieVisible = pie ? Math.max(0, window.innerHeight - pie.getBoundingClientRect().top) : 0;
      setAbajo(Math.max(base, altoPieVisible + 16));
    };
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    window.addEventListener('resize', revisar);
    return () => {
      window.removeEventListener('scroll', revisar);
      window.removeEventListener('resize', revisar);
    };
  }, []);
  if (abajo === null) return null;
  return createPortal(
    <div className="aparecer fixed right-4 z-30 lg:right-6" style={{ bottom: abajo }}>
      <Globo texto="Volver arriba" lado="izquierda">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          className="grid size-11 place-items-center rounded-full bg-marino text-white shadow-xl hover:bg-marino-osc"
        >
          <Icono nombre="arrow_upward" className="text-[22px]" />
        </button>
      </Globo>
    </div>,
    document.body,
  );
}

// ---------- Ventana de confirmación ----------
// Para acciones que hay que confirmar (dar de baja, descartar cambios...). tono: 'peligro' | 'aviso' | 'exito' | 'info'
const TONOS_CONFIRMAR = {
  peligro: 'bg-peligro-tinte text-peligro',
  aviso: 'bg-aviso-tinte text-aviso-texto',
  exito: 'bg-exito-tinte text-exito',
  info: 'bg-info-tinte text-info-texto',
};
export function Confirmar({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  children,
  icono = 'help',
  tono = 'peligro',
  textoConfirmar = 'Confirmar',
  iconoConfirmar,
  varianteConfirmar = 'peligro',
  textoCancelar = 'Cancelar',
  cargando = false,
}) {
  return (
    <Modal abierto={abierto} onCerrar={() => !cargando && onCerrar()}>
      <div className="p-6">
        <span className={`size-12 rounded-full grid place-items-center mb-4 ${TONOS_CONFIRMAR[tono]}`}>
          <Icono nombre={icono} className="text-[24px]" />
        </span>
        <h2 className="font-titulo text-lg font-semibold text-texto break-words">{titulo}</h2>
        {children && <div className="text-sm text-texto-2 mt-1">{children}</div>}
        <div className="flex justify-end gap-2 mt-6">
          <Boton variante="secundario" onClick={onCerrar} disabled={cargando}>
            {textoCancelar}
          </Boton>
          <Boton variante={varianteConfirmar} icono={iconoConfirmar} cargando={cargando} onClick={onConfirmar}>
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
