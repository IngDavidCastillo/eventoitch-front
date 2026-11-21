// Categorias de eventos (ms-categorias): lista, busqueda por nombre, orden, detalle con sus eventos y,
// solo para el ADMINISTRADOR, registrar, editar, dar de baja (borrado logico) y reactivar
// (POST con el mismo nombre, como pide el proyecto).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useDatos from '../hooks/useDatos';
import { actualizarCategoria, buscarCategorias, crearCategoria, eliminarCategoria, listarCategorias } from '../api/categorias';
import { listarEventos } from '../api/eventos';
import { corto, filtrarCampo, limpiarEspacios, mismoNombre, primeraMayuscula, tieneLetra } from '../utils/validaciones';
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
  LineaAyuda,
  MenuDesplegable,
  Panel,
  SeccionFormulario,
  Segmentado,
  Tarjeta,
  TituloPagina,
  Vacio,
} from '../components/ui';

// Colores sugeridos (es el dato que se guarda en colorIdentificador, no un estilo de la pagina).
// Se generan tonos cada 15° en 3 luminosidades y se eligen solo los que se distinguen a simple vista
// de los de otras categorias y entre si.
const SUGERIDOS = 12;
const PARECIDO = 28; // diferencia (en Lab) con la que dos colores se distinguen claramente (para sugerir)
const MUY_PARECIDO = 14; // por debajo de esto casi no se distinguen (se avisa al elegir)
const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;
const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 255;
const mismoColor = (a, b) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

const ORDENES = [
  { valor: 'recientes', texto: 'Más recientes', icono: 'schedule', fn: (a, b) => b.id - a.id },
  { valor: 'az', texto: 'Nombre A-Z', icono: 'arrow_downward', fn: (a, b) => a.nombre.localeCompare(b.nombre, 'es') },
  { valor: 'za', texto: 'Nombre Z-A', icono: 'arrow_upward', fn: (a, b) => b.nombre.localeCompare(a.nombre, 'es') },
];

// Punto con el color de la categoria (color del dato)
function PuntoColor({ color, className = 'size-3' }) {
  return <span className={`inline-block shrink-0 rounded-full border border-borde ${className}`} style={{ backgroundColor: color || 'transparent' }} />;
}

// Los mensajes del servicio vienen sin acentos y a veces con palabras tecnicas (POST, ID...).
// Para los casos conocidos se muestra un mensaje claro para la persona (DISENO.md, "Textos").
function mensajeAmigable(err, nombre = '') {
  const m = err?.message ?? '';
  if (err?.status === 409 && /dada de baja/i.test(m))
    return `Ya existe una categoría inactiva llamada "${corto(nombre, 40)}". Búscala en el filtro "Inactivas" y reactívala.`;
  if (err?.status === 409) return `Ya existe una categoría activa llamada "${corto(nombre, 40)}". Usa otro nombre.`;
  if (err?.status === 404) return 'La categoría ya no existe o fue dada de baja. Actualiza la lista e inténtalo de nuevo.';
  if (err?.status === 403) return 'Solo un administrador puede modificar categorías.';
  if (err?.status === 400) return m || 'Revisa los datos del formulario.';
  return m || 'No se pudo guardar. Inténtalo de nuevo.';
}

// ---------- Conversion y comparacion de colores ----------
function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbAHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
function rgbAHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
function hslARgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
// Color en espacio Lab: ahi la distancia se parece a como el ojo percibe la diferencia (se guarda en memoria)
const labs = new Map();
function hexALab(hex) {
  const clave = hex.toLowerCase();
  if (!labs.has(clave)) labs.set(clave, calcularLab(clave));
  return labs.get(clave);
}
function calcularLab(hex) {
  const lin = (v) => {
    v /= 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const [r, g, b] = hexARgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function diferencia(a, b) {
  const [l1, a1, b1] = hexALab(a);
  const [l2, a2, b2] = hexALab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
// La categoria (de la lista) con el color mas parecido a "color", si la diferencia es menor que "umbral"
function masParecida(color, categorias, umbral = MUY_PARECIDO) {
  let mejor = null;
  for (const c of categorias) {
    if (!COLOR_VALIDO.test(c.colorIdentificador ?? '')) continue;
    const d = diferencia(color, c.colorIdentificador);
    if (d < umbral && (!mejor || d < mejor.d)) mejor = { c, d };
  }
  return mejor?.c ?? null;
}
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

// Solo tonos vivos (saturacion alta, luminosidad media): nada oscuro ni apagado. Un tono cada 5°.
const CANDIDATOS = [
  [80, 52],
  [85, 60],
  [75, 45],
  [70, 66],
].flatMap(([s, l]) => Array.from({ length: 72 }, (_, i) => rgbAHex(...hslARgb(i * 5, s, l))));
// Colores que no se parecen a los de "categorias" ni entre si (maximo SUGERIDOS).
// Primero se buscan los muy distintos; si ya hay muchas categorias y no alcanzan,
// se va bajando la exigencia poco a poco para que siempre haya opciones.
function sugerirColores(categorias) {
  const usados = categorias.map((c) => c.colorIdentificador).filter((c) => COLOR_VALIDO.test(c ?? ''));
  const elegidos = [];
  for (const umbral of [PARECIDO, 20, 14, 9]) {
    for (const color of CANDIDATOS) {
      if (elegidos.length === SUGERIDOS) return elegidos;
      if (elegidos.includes(color)) continue;
      if (usados.some((u) => diferencia(color, u) < umbral)) continue;
      if (elegidos.some((e) => diferencia(color, e) < umbral)) continue;
      elegidos.push(color);
    }
  }
  return elegidos;
}
const COLOR_INICIAL = CANDIDATOS[0];

// Arrastrar dentro de una zona: devuelve la posicion como fraccion (0 a 1)
function useArrastre(onMover) {
  return {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = e.currentTarget.getBoundingClientRect();
      onMover(limitar((e.clientX - r.left) / r.width, 0, 1), limitar((e.clientY - r.top) / r.height, 0, 1));
    },
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const r = e.currentTarget.getBoundingClientRect();
      onMover(limitar((e.clientX - r.left) / r.width, 0, 1), limitar((e.clientY - r.top) / r.height, 0, 1));
    },
  };
}

// Selector como el de Paint: espectro (tono a lo ancho, saturacion a lo alto) y barra de luminosidad
function ColorPersonalizado({ valor, onChange }) {
  const [hsl, setHsl] = useState(() => rgbAHsl(...hexARgb(valor)));
  const [ultimo, setUltimo] = useState(valor);
  // Si el color se cambio desde la paleta o el codigo, el selector se mueve a ese color
  if (valor !== ultimo) {
    setUltimo(valor);
    setHsl(rgbAHsl(...hexARgb(valor)));
  }
  const [h, s, l] = hsl;
  const rgb = hslARgb(h, s, l).map(Math.round);

  function poner(nuevo) {
    const hex = rgbAHex(...hslARgb(...nuevo));
    setHsl(nuevo);
    setUltimo(hex);
    onChange(hex);
  }
  // Al elegir en el espectro, si el color estaba casi negro o casi blanco se vuelve a una luminosidad media
  // (como en Paint), si no el tono elegido no se notaria
  const espectro = useArrastre((x, y) => poner([x * 360, (1 - y) * 100, l < 15 || l > 85 ? 50 : l]));
  const luz = useArrastre((_, y) => poner([h, s, (1 - y) * 100]));

  function cambiarCanal(i, texto) {
    const v = limitar(Number(texto.replace(/\D/g, '')) || 0, 0, 255);
    const nuevo = [...rgb];
    nuevo[i] = v;
    poner(rgbAHsl(...nuevo));
  }

  // El espectro siempre se dibuja con luminosidad media para que se vean los tonos aunque el color sea negro o blanco
  const tonos = Array.from({ length: 7 }, (_, i) => `hsl(${i * 60} 100% 50%)`).join(', ');
  return (
    <div className="rounded-xl border border-borde bg-lienzo p-3">
      <div className="flex gap-3">
        <div
          {...espectro}
          role="slider"
          aria-label="Tono y saturación"
          aria-valuenow={Math.round(h)}
          className="relative h-20 flex-1 cursor-crosshair touch-none rounded-lg"
          style={{ background: `linear-gradient(to bottom, transparent, hsl(0 0% 50%)), linear-gradient(to right, ${tonos})` }}
        >
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${(h / 360) * 100}%`, top: `${100 - s}%`, backgroundColor: `hsl(${h} ${s}% 50%)` }}
          />
        </div>
        <div
          {...luz}
          role="slider"
          aria-label="Luminosidad"
          aria-valuenow={Math.round(l)}
          className="relative h-20 w-4 cursor-ns-resize touch-none rounded-full border border-borde"
          style={{ background: `linear-gradient(to bottom, hsl(${h} ${s}% 100%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 0%))` }}
        >
          <span className="pointer-events-none absolute left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm" style={{ top: `${100 - l}%`, backgroundColor: valor }} />
        </div>
      </div>
      {/* Rejilla: arriba las etiquetas, abajo la muestra y los 3 campos, todos del mismo alto y centrados */}
      <div className="mt-2.5 grid grid-cols-[40px_1fr_1fr_1fr] items-center gap-x-2 gap-y-1">
        <span />
        {['Rojo', 'Verde', 'Azul'].map((n) => (
          <span key={n} className="text-center text-[11px] text-texto-2">
            {n}
          </span>
        ))}
        <span className="h-9 rounded-lg border border-borde" style={{ backgroundColor: valor }} aria-hidden="true" />
        {['Rojo', 'Verde', 'Azul'].map((n, i) => (
          <input
            key={n}
            value={rgb[i]}
            onChange={(e) => cambiarCanal(i, e.target.value)}
            inputMode="numeric"
            maxLength={3}
            aria-label={n}
            className="h-9 w-full min-w-0 rounded-lg border border-borde bg-superficie px-2 text-center text-sm text-texto tabular outline-none focus:border-marino focus:ring-2 focus:ring-marino-tinte"
          />
        ))}
      </div>
    </div>
  );
}

// Que tan bien se distingue el color elegido de los de otras categorias
function revisarColor(color, otras) {
  const activas = otras.filter((c) => c.estatus !== 0);
  const igual = activas.find((c) => mismoColor(c.colorIdentificador, color));
  if (igual) return { tipo: 'error', texto: `Ya lo usa "${corto(igual.nombre)}". Elige otro para distinguirlas.` };
  const parecida = masParecida(color, activas);
  if (parecida) return { tipo: 'aviso', texto: `Se parece mucho al de "${corto(parecida.nombre)}". Puedes usarlo, pero costará distinguirlas.` };
  const deBaja = masParecida(color, otras.filter((c) => c.estatus === 0));
  if (deBaja) return { tipo: 'aviso', texto: `Se parece al de "${corto(deBaja.nombre)}" (inactiva). Si la reactivan, costará distinguirlas.` };
  return { tipo: 'exito', texto: 'Se distingue bien de las demás categorías.' };
}

const TONOS_ESTADO = { error: ['error', 'text-peligro-texto'], aviso: ['warning', 'text-aviso-texto'], exito: ['check_circle', 'text-exito-texto'] };
function EstadoColor({ estado }) {
  const [icono, color] = TONOS_ESTADO[estado.tipo];
  return (
    <p role={estado.tipo === 'error' ? 'alert' : 'status'} className={`flex items-start gap-1.5 text-xs leading-snug ${color}`}>
      <Icono nombre={icono} className="mt-px text-[15px]" />
      <span className="break-words">{estado.texto}</span>
    </p>
  );
}

// ---------- Selector de color: sugeridos y codigo (izquierda), personalizado y estado (derecha) ----------
function SelectorColor({ valor, onChange, otras, estado }) {
  // El codigo se muestra siempre en MAYUSCULAS (#E5BD6C)
  const [codigo, setCodigo] = useState(valor.toUpperCase());
  const [anterior, setAnterior] = useState(valor);
  // Si el color cambia desde la paleta o el selector, el codigo escrito se iguala
  if (anterior !== valor) {
    setAnterior(valor);
    setCodigo(valor.toUpperCase());
  }

  // Solo se sugieren colores que no se parecen a los de otras categorias (activas o dadas de baja)
  const sugeridos = useMemo(() => sugerirColores(otras), [otras]);

  function escribir(e) {
    let t = e.target.value.trim().toUpperCase();
    if (t && !t.startsWith('#')) t = `#${t}`;
    t = t.slice(0, 7);
    setCodigo(t);
    if (COLOR_VALIDO.test(t)) onChange(t.toLowerCase());
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <div className="sm:w-[152px]">
        <p className="mb-2 text-xs font-medium text-texto-2">Sugeridos</p>
        <div className="grid grid-cols-4 gap-2">
          {sugeridos.map((color) => {
            const elegido = mismoColor(color, valor);
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                title={color.toUpperCase()}
                aria-label={`Usar el color ${color}`}
                aria-pressed={elegido}
                className={`grid size-8 place-items-center rounded-full transition-transform hover:scale-110 ${elegido ? 'ring-2 ring-marino ring-offset-2 ring-offset-superficie' : ''}`}
                style={{ backgroundColor: color }}
              >
                {elegido && <Icono nombre="check" className="text-[16px] text-white" />}
              </button>
            );
          })}
        </div>
        <p className="mb-1.5 mt-3 text-xs font-medium text-texto-2">Código</p>
        <Entrada
          value={codigo}
          onChange={escribir}
          maxLength={7}
          placeholder="#RRGGBB"
          aria-label="Código de color"
          className="h-9 font-mono uppercase"
          error={codigo && !COLOR_VALIDO.test(codigo)}
          derecha={<PuntoColor color={COLOR_VALIDO.test(codigo) ? codigo : null} className="size-4" />}
        />
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium text-texto-2">Personalizado</p>
        <ColorPersonalizado valor={valor} onChange={onChange} />
        <div className="mt-2.5 min-h-[34px]">
          <EstadoColor estado={estado} />
        </div>
      </div>
    </div>
  );
}

// ---------- Registrar, editar o reactivar (panel lateral) ----------
// modo: 'nueva' | 'editar' | 'reactivar'. Reactivar = POST con el mismo nombre (el nombre no se cambia).
function FormularioCategoria({ abierto, modo, categoria, catalogo, catalogoListo, usos, onCerrar, onGuardada }) {
  const { sesion } = useAuth();
  const [form, setForm] = useState({ nombre: '', descripcion: '', colorIdentificador: COLOR_INICIAL });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [preguntarCerrar, setPreguntarCerrar] = useState(false);
  const [inicial, setInicial] = useState(null); // como estaba el formulario al abrirlo
  const cargada = useRef(null); // categoria dada de baja cuyos datos ya se cargaron
  const editando = modo === 'editar';
  const hayCambios = inicial !== null && JSON.stringify(form) !== JSON.stringify(inicial);

  // Clic fuera, Esc, la X o Cancelar: si ya se escribio algo, primero se pregunta
  function intentarCerrar() {
    if (guardando) return;
    if (hayCambios) setPreguntarCerrar(true);
    else onCerrar();
  }

  const otras = useMemo(() => catalogo.filter((c) => c.id !== categoria?.id), [catalogo, categoria]);
  // Al registrar, si el nombre es el de una dada de baja, se reactiva esa
  const inactivaMismoNombre = modo === 'nueva' ? otras.find((c) => c.estatus === 0 && mismoNombre(c.nombre, form.nombre)) : null;
  const reactivando = modo === 'reactivar' || !!inactivaMismoNombre;
  const laQueSeReactiva = modo === 'reactivar' ? categoria : inactivaMismoNombre;
  // Para revisar el color no cuenta la que se va a reactivar (es la misma categoria)
  const paraComparar = useMemo(() => otras.filter((c) => c !== inactivaMismoNombre), [otras, inactivaMismoNombre]);
  const estadoColor = revisarColor(form.colorIdentificador, paraComparar);

  // Al abrir: datos de la categoria (editar/reactivar), o un formulario limpio con un color que se distinga
  useEffect(() => {
    if (!abierto) return;
    setErrores({});
    setError(null);
    setPreguntarCerrar(false);
    cargada.current = null;
    const nuevo = categoria
      ? { nombre: categoria.nombre ?? '', descripcion: categoria.descripcion ?? '', colorIdentificador: categoria.colorIdentificador || COLOR_INICIAL }
      : { nombre: '', descripcion: '', colorIdentificador: sugerirColores(catalogo)[0] ?? COLOR_INICIAL };
    setForm(nuevo);
    setInicial(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, categoria]);

  // Al escribir: sin espacios de mas, primera letra en mayuscula y sin caracteres que el servicio no acepta.
  // Si el nombre es el de una categoria dada de baja, se cargan su descripcion y color de antes.
  function cambiarTexto(campo, valor) {
    const r = filtrarCampo(campo, limpiarEspacios(valor));
    const texto = primeraMayuscula(r.valor);
    const baja = campo === 'nombre' && modo === 'nueva' ? otras.find((c) => c.estatus === 0 && mismoNombre(c.nombre, texto)) : null;
    // Los datos de antes se cargan una sola vez por categoria (si luego los cambian, se respetan)
    const cargar = baja && cargada.current !== baja.id ? baja : null;
    if (cargar) cargada.current = cargar.id;
    setForm((f) => ({
      ...f,
      [campo]: texto,
      ...(cargar && { descripcion: cargar.descripcion ?? '', colorIdentificador: cargar.colorIdentificador || f.colorIdentificador }),
    }));
    // Llegar al maximo no es un error (el campo ya no deja escribir mas): eso se avisa en la linea de ayuda
    setErrores((x) => ({ ...x, [campo]: r.error.startsWith('Máximo') ? '' : r.error }));
  }

  async function guardar() {
    const nombre = primeraMayuscula(form.nombre.trim());
    if (!nombre) return setErrores((x) => ({ ...x, nombre: 'El nombre es obligatorio' }));
    if (!tieneLetra(nombre)) return setErrores((x) => ({ ...x, nombre: 'El nombre debe incluir al menos una letra' }));
    if (motivoBloqueo) return setError(motivoBloqueo);
    if (estadoColor.tipo === 'error') return setError(`El color ${form.colorIdentificador} ${estadoColor.texto.charAt(0).toLowerCase()}${estadoColor.texto.slice(1)}`);

    setGuardando(true);
    setError(null);
    try {
      const datos = { nombre, descripcion: form.descripcion.trim(), colorIdentificador: form.colorIdentificador };
      const r = editando ? await actualizarCategoria(categoria.id, datos, sesion.token) : await crearCategoria(datos, sesion.token);
      onGuardada(r, editando ? 'editada' : reactivando ? 'reactivada' : 'registrada');
    } catch (err) {
      setError(mensajeAmigable(err, nombre));
    } finally {
      setGuardando(false);
    }
  }

  const usosBaja = laQueSeReactiva ? (usos?.get(laQueSeReactiva.id) ?? 0) : 0;
  const titulo = editando ? 'Editar categoría' : modo === 'reactivar' ? 'Reactivar categoría' : 'Nueva categoría';
  const subtitulo = editando
    ? 'Los eventos que ya la usan verán los cambios.'
    : modo === 'reactivar'
      ? `Volverá a estar disponible para eventos nuevos${usosBaja > 0 ? ` (${usosBaja === 1 ? '1 evento la conserva' : `${usosBaja} eventos la conservan`})` : ''}. Su nombre no cambia.`
      : 'Clasifica los eventos del instituto (Académico, Deportivo...).';

  // Por que no se puede guardar todavia (se explica en un globo sobre el boton)
  // Mientras la lista de categorias se esta cargando o actualizando no se puede revisar bien el color:
  // si se dejara guardar, se podria repetir el color de una categoria recien registrada.
  const motivoBloqueo = !catalogoListo
    ? 'Actualizando la lista de categorías para revisar el color...'
    : estadoColor.tipo === 'error'
      ? 'Elige un color que no use otra categoría activa.'
      : editando && !hayCambios
        ? 'No hay cambios para guardar.'
        : null;

  // Linea de ayuda de cada campo: solo muestra algo cuando hay que avisar; si no, queda un espacio vacio
  // del mismo alto (asi el formulario no "brinca" cuando aparece un mensaje o un error)
  const RESERVA = ' ';
  const enMaximoNombre = form.nombre.length >= MAX_NOMBRE;
  const enMaximoDescripcion = form.descripcion.length >= MAX_DESCRIPCION;
  const ayudaNombre =
    modo === 'reactivar' ? (
      <LineaAyuda tono="info">El nombre no se puede cambiar: el servicio reactiva la categoría por su nombre.</LineaAyuda>
    ) : inactivaMismoNombre ? (
      <LineaAyuda tono="info">Esta categoría está inactiva: se cargaron sus datos y al guardar se reactivará.</LineaAyuda>
    ) : enMaximoNombre ? (
      <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_NOMBRE} caracteres.</LineaAyuda>
    ) : (
      RESERVA
    );
  const ayudaDescripcion = enMaximoDescripcion ? <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_DESCRIPCION} caracteres.</LineaAyuda> : RESERVA;

  // El error al guardar va en el pie, junto a los botones (como en "Nueva reserva"): siempre se ve sin hacer scroll
  const pie = (
    <>
      {error && (
        <Aviso tipo="error" className="mb-3" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-borde px-3 py-1.5 text-sm text-texto">
            <PuntoColor color={form.colorIdentificador} />
            <span className="truncate">{form.nombre.trim() || 'Vista previa'}</span>
          </span>
        </div>
        <Boton variante="secundario" onClick={intentarCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Globo texto={motivoBloqueo} className={motivoBloqueo ? '' : 'contents'}>
          <Boton icono={editando ? 'save' : reactivando ? 'restore' : 'add'} cargando={guardando} onClick={guardar} disabled={!!motivoBloqueo}>
            {editando ? 'Guardar cambios' : reactivando ? 'Reactivar categoría' : 'Registrar categoría'}
          </Boton>
        </Globo>
      </div>
    </>
  );

  return (
    <>
    <Panel abierto={abierto} onCerrar={() => !preguntarCerrar && intentarCerrar()} titulo={titulo} subtitulo={subtitulo} pie={pie}>
      <SeccionFormulario numero={1} titulo="Datos generales">
        <div className="grid gap-3">
          <Campo
            etiqueta="Nombre"
            obligatorio
            error={errores.nombre}
            ayuda={ayudaNombre}
            extra={<ContadorCaracteres actual={form.nombre.length} maximo={MAX_NOMBRE} />}
          >
            <Entrada
              icono={modo === 'reactivar' ? 'lock' : 'sell'}
              placeholder="Ej. Conferencia"
              value={form.nombre}
              maxLength={MAX_NOMBRE}
              onChange={(e) => cambiarTexto('nombre', e.target.value)}
              error={errores.nombre}
              disabled={modo === 'reactivar'}
              className={modo === 'reactivar' ? 'bg-borde-suave cursor-not-allowed' : ''}
            />
          </Campo>
          <Campo etiqueta="Descripción" error={errores.descripcion} ayuda={ayudaDescripcion} extra={<ContadorCaracteres actual={form.descripcion.length} maximo={MAX_DESCRIPCION} />}>
            <AreaTexto
              maxLength={MAX_DESCRIPCION}
              placeholder="Ej. Charlas y ponencias"
              value={form.descripcion}
              onChange={(e) => cambiarTexto('descripcion', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              error={errores.descripcion}
            />
          </Campo>
        </div>
      </SeccionFormulario>

      <SeccionFormulario numero={2} titulo="Color identificador" extra={<span className="font-mono text-xs uppercase text-texto-2">{form.colorIdentificador}</span>}>
        <SelectorColor
          valor={form.colorIdentificador}
          onChange={(c) => setForm((f) => ({ ...f, colorIdentificador: c }))}
          otras={paraComparar}
          estado={estadoColor}
        />
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

// ---------- Detalle de una categoria con sus eventos (panel lateral) ----------
function DetalleCategoria({ categoria, esAdmin, onCerrar, onEditar, onBaja, onReactivar }) {
  const { sesion } = useAuth();
  const eventos = useDatos(() => (categoria ? listarEventos({ categoria: categoria.id }, sesion.token) : Promise.resolve(null)), [categoria?.id, sesion.token]);
  const lista = eventos.datos ?? [];
  const activa = categoria?.estatus !== 0;

  const pie = (
    <div className="flex flex-wrap justify-end gap-2">
      {esAdmin && categoria && activa && (
        <>
          <Boton variante="peligro" icono="delete" onClick={() => onBaja(categoria)}>
            Dar de baja
          </Boton>
          <Boton variante="secundario" icono="edit" onClick={() => onEditar(categoria)}>
            Editar
          </Boton>
        </>
      )}
      {esAdmin && categoria && !activa && (
        <Boton variante="secundario" icono="restore" onClick={() => onReactivar(categoria)}>
          Reactivar
        </Boton>
      )}
      <Boton onClick={onCerrar}>Cerrar</Boton>
    </div>
  );

  return (
    <Panel abierto={!!categoria} onCerrar={onCerrar} titulo="Detalle de la categoría" subtitulo="Información de la categoría y eventos que la usan." pie={pie}>
      {categoria && (
        <>
          <div className="mb-6 rounded-xl border border-borde bg-lienzo p-4">
            <div className="flex items-center gap-3">
              <PuntoColor color={categoria.colorIdentificador} className="size-5" />
              <p className="min-w-0 font-titulo text-lg font-semibold text-texto break-words">{categoria.nombre}</p>
            </div>
            {/* Datos en dos columnas alineadas: etiqueta a la izquierda, valor a la derecha */}
            <dl className="mt-4 grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-3 border-t border-borde pt-4 text-sm">
              <dt className="etiqueta text-texto-2">Estado</dt>
              <dd>
                <Estado valor={activa ? 'ACTIVO' : 'INACTIVO'} />
              </dd>
              <dt className="etiqueta text-texto-2">Color</dt>
              <dd className="flex items-center gap-2">
                <PuntoColor color={categoria.colorIdentificador} />
                <span className="font-mono text-xs text-texto">{categoria.colorIdentificador?.toUpperCase() || 'Sin color'}</span>
              </dd>
              <dt className="etiqueta self-start text-texto-2">Descripción</dt>
              <dd className="text-texto break-words">{categoria.descripcion || <span className="text-tenue">Sin descripción</span>}</dd>
            </dl>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h3 className="etiqueta text-texto">Eventos que la usan</h3>
            {eventos.datos && <span className="text-xs text-texto-2 tabular">{lista.length}</span>}
          </div>
          {eventos.error && !eventos.datos ? (
            <ErrorServicio servicio="El servicio de eventos" mensaje={eventos.error.message} onReintentar={eventos.recargar} />
          ) : !eventos.datos ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Esqueleto key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <Vacio icono="event_busy" titulo="Ningún evento usa esta categoría" />
          ) : (
            <ul className="escalonado divide-y divide-borde rounded-xl border border-borde">
              {[...lista]
                .sort((a, b) => b.id - a.id)
                .map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-texto break-words">{e.titulo}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-texto-2">
                        <span className="flex items-center gap-1">
                          <Icono nombre="location_on" className="text-[14px]" />
                          {e.espacioNombre ?? `Espacio ${e.espacio}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icono nombre="person" className="text-[14px]" />
                          {e.organizadorNombre ?? `Usuario ${e.organizador}`}
                        </span>
                        <span className="flex items-center gap-1 tabular">
                          <Icono nombre="group" className="text-[14px]" />
                          Cupo {e.cupoMaximo}
                        </span>
                      </p>
                    </div>
                    <Estado valor={e.estado} />
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------- Pagina ----------
export default function Categorias() {
  const { sesion } = useAuth();
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const [estado, setEstado] = useState('activas'); // 'activas' | 'inactivas' | 'todas' (las dos ultimas solo ADMIN)
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [formulario, setFormulario] = useState(null); // null = cerrado; { modo, categoria }
  const [detalle, setDetalle] = useState(null);
  const [baja, setBaja] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const enfocar = useRef(null); // categoria recien guardada a la que hay que llevar la vista
  const avisar = (tipo, texto) => setMensaje({ tipo, texto, id: Date.now() });
  const cerrarMensaje = useCallback(() => setMensaje(null), []);

  // Espera a que se deje de escribir para no llamar al servicio en cada letra
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    if (!resaltada) return;
    const t = setTimeout(() => setResaltada(null), 3000);
    return () => clearTimeout(t);
  }, [resaltada]);

  // Para "Inactivas" y "Todas" se piden todas al servicio (?todas=true) y aqui se filtran
  const todas = esAdmin && estado !== 'activas';
  const datos = useDatos(
    () => (busqueda ? buscarCategorias(busqueda, todas, sesion.token) : listarCategorias(todas, sesion.token)),
    [busqueda, todas, sesion.token],
  );
  // Todas las categorias (tambien dadas de baja) para revisar colores y nombres al registrar
  const catalogo = useDatos(() => listarCategorias(esAdmin, sesion.token), [esAdmin, sesion.token]);
  // Lista lista para comparar colores (cargada y sin estar actualizandose)
  const catalogoListo = !!catalogo.datos && !catalogo.cargando;
  // Cuantos eventos usa cada categoria (si ms-eventos no responde, la columna muestra un guion)
  const eventos = useDatos(() => listarEventos({}, sesion.token), [sesion.token]);

  const usos = useMemo(() => {
    if (!eventos.datos) return null;
    const m = new Map();
    eventos.datos.forEach((e) => m.set(e.categoria, (m.get(e.categoria) ?? 0) + 1));
    return m;
  }, [eventos.datos]);
  const usosDe = (c) => usos?.get(c.id) ?? 0;

  const ordenar = ORDENES.find((o) => o.valor === orden).fn;
  const lista = useMemo(
    () => [...(datos.datos ?? [])].filter((c) => estado !== 'inactivas' || c.estatus === 0).sort(ordenar),
    [datos.datos, ordenar, estado],
  );
  // Despues de guardar, cuando llega la lista NUEVA, se lleva la vista a la fila de esa categoria
  // (este donde este segun el orden). Si con el filtro actual no aparece, no se mueve nada.
  useEffect(() => {
    const e = enfocar.current;
    if (!e || !datos.datos || datos.datos === e.antes) return;
    enfocar.current = null;
    requestAnimationFrame(() => document.getElementById(`categoria-${e.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [datos.datos]);

  function recargarTodo() {
    datos.recargar();
    catalogo.recargar();
    eventos.recargar();
  }

  function abrirFormulario(modo, categoria = null) {
    setDetalle(null);
    setFormulario({ modo, categoria });
  }

  function terminar(c, accion) {
    // Mensaje corto: primero que paso y al final el nombre (si es largo, el nombre es lo que se recorta con "...")
    avisar('exito', `${accion === 'editada' ? 'Cambios guardados' : accion === 'reactivada' ? 'Categoría reactivada' : 'Categoría registrada'}: ${c.nombre}`);
    setResaltada(c.id);
    enfocar.current = { id: c.id, antes: datos.datos };
    recargarTodo();
  }

  async function darDeBaja() {
    const c = baja;
    setTrabajando(true);
    try {
      await eliminarCategoria(c.id, sesion.token);
      avisar('exito', `Dada de baja (está en Inactivas): ${c.nombre}`);
      recargarTodo();
    } catch (err) {
      avisar('error', mensajeAmigable(err, c.nombre));
    } finally {
      setTrabajando(false);
      setBaja(null);
    }
  }

  return (
    <>
      <TituloPagina
        titulo="Categorías"
        subtitulo={
          datos.datos
            ? `${lista.length} ${busqueda ? 'encontradas' : estado === 'inactivas' ? 'inactivas' : estado === 'todas' ? 'registradas' : 'activas'}`
            : 'Clasificación de los eventos del instituto'
        }
      >
        {mensaje && <AvisoTemporal key={mensaje.id} mensaje={mensaje} onCerrar={cerrarMensaje} />}
        {esAdmin && (
          <Boton icono="add" onClick={() => abrirFormulario('nueva')} cargando={!catalogoListo}>
            Nueva categoría
          </Boton>
        )}
      </TituloPagina>

      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-borde">
          <Entrada
            icono="search"
            placeholder="Buscar por nombre"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-10 flex-1 min-w-[220px]"
            derecha={
              texto && (
                <button type="button" onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="text-tenue hover:text-texto-2">
                  <Icono nombre="close" className="text-[18px]" />
                </button>
              )
            }
          />
          <MenuDesplegable valor={orden} onChange={setOrden} opciones={ORDENES} etiqueta="Ordenar" />
          {esAdmin && (
            <Segmentado
              valor={estado}
              onChange={setEstado}
              opciones={[
                { valor: 'activas', texto: 'Activas' },
                { valor: 'inactivas', texto: 'Inactivas' },
                { valor: 'todas', texto: 'Todas' },
              ]}
            />
          )}
        </div>

        {datos.error && !datos.datos ? (
          <ErrorServicio servicio="El servicio de categorías" mensaje={datos.error.message} onReintentar={datos.recargar} />
        ) : !datos.datos ? (
          <EsqueletoTabla filas={5} columnas={5} />
        ) : lista.length === 0 ? (
          <Vacio icono="sell" titulo={busqueda ? `No hay categorías que contengan "${busqueda}"` : estado === 'inactivas' ? 'No hay categorías inactivas' : 'Aún no hay categorías'}>
            {!busqueda && esAdmin && estado !== 'inactivas' && 'Registra la primera con el botón "Nueva categoría".'}
          </Vacio>
        ) : (
          <>
            <div className="overflow-x-auto scroll-fino">
              {/* table-fixed: cada registro ocupa un solo renglon; lo que no cabe termina en "..." y se ve completo en el globo */}
              <table className="w-full min-w-[760px] table-fixed text-left">
                <thead>
                  <tr className="etiqueta text-texto-2 bg-lienzo">
                    <th className="w-[30%] px-5 py-2.5 font-semibold">Categoría</th>
                    <th className="px-3 py-2.5 font-semibold">Descripción</th>
                    <th className="w-24 px-3 py-2.5 font-semibold text-center">Eventos</th>
                    <th className="w-28 px-3 py-2.5 font-semibold">Estado</th>
                    {esAdmin && <th className="w-[230px] px-5 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="escalonado">
                  {lista.map((c) => {
                    const activa = c.estatus !== 0;
                    const n = usosDe(c);
                    return (
                      <tr key={c.id} id={`categoria-${c.id}`} className={`scroll-mt-24 border-t border-borde-suave transition-colors duration-700 ${resaltada === c.id ? 'bg-marino-tinte' : 'hover:bg-lienzo'}`}>
                        <td className="px-5 py-2.5">
                          <Globo texto={`${c.nombre} · Clic para ver el detalle`} className="block">
                            <button type="button" onClick={() => setDetalle(c)} aria-label={`Ver el detalle de ${c.nombre}`} className="group flex w-full min-w-0 items-center gap-3 text-left">
                              <PuntoColor color={c.colorIdentificador} />
                              <span className={`truncate text-sm font-medium group-hover:text-marino group-hover:underline ${activa ? 'text-texto' : 'text-texto-2'}`}>{c.nombre}</span>
                            </button>
                          </Globo>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-texto-2">
                          {c.descripcion ? (
                            <Globo texto={c.descripcion} className="block">
                              <span className="block truncate">{c.descripcion}</span>
                            </Globo>
                          ) : (
                            <span className="text-tenue">Sin descripción</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-sm tabular">
                          {usos ? (
                            <span className={n === 0 ? 'text-tenue' : 'font-semibold text-texto'}>{n}</span>
                          ) : (
                            <Globo texto={eventos.error ? 'El servicio de eventos no respondió.' : 'Consultando eventos...'}>
                              <span className="text-tenue">—</span>
                            </Globo>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Estado valor={activa ? 'ACTIVO' : 'INACTIVO'} />
                        </td>
                        {esAdmin && (
                          <td className="px-5 py-2.5 text-right">
                            <div className="flex justify-end gap-1 whitespace-nowrap">
                              {activa ? (
                                <>
                                  <Boton variante="fantasma" tamano="sm" icono="edit" onClick={() => abrirFormulario('editar', c)}>
                                    Editar
                                  </Boton>
                                  <Boton variante="fantasma" tamano="sm" icono="delete" onClick={() => setBaja(c)}>
                                    Dar de baja
                                  </Boton>
                                </>
                              ) : (
                                <Boton variante="secundario" tamano="sm" icono="restore" onClick={() => abrirFormulario('reactivar', c)}>
                                  Reactivar
                                </Boton>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tarjeta>

      <BotonArriba />

      <FormularioCategoria
        abierto={!!formulario}
        modo={formulario?.modo ?? 'nueva'}
        categoria={formulario?.categoria ?? null}
        catalogo={catalogo.datos ?? []}
        catalogoListo={catalogoListo}
        usos={usos}
        onCerrar={() => setFormulario(null)}
        onGuardada={(c, accion) => {
          setFormulario(null);
          terminar(c, accion);
        }}
      />

      <DetalleCategoria
        categoria={detalle}
        esAdmin={esAdmin}
        onCerrar={() => setDetalle(null)}
        onEditar={(c) => abrirFormulario('editar', c)}
        onReactivar={(c) => abrirFormulario('reactivar', c)}
        onBaja={(c) => {
          setDetalle(null);
          setBaja(c);
        }}
      />

      <Confirmar
        abierto={!!baja}
        onCerrar={() => setBaja(null)}
        onConfirmar={darDeBaja}
        cargando={trabajando}
        icono="delete"
        titulo={baja ? `Dar de baja "${corto(baja.nombre, 60)}"` : ''}
        textoConfirmar="Dar de baja"
        iconoConfirmar="delete"
      >
        {baja && (
          <>
            Ya no se podrá elegir para eventos nuevos.
            {usos && usosDe(baja) > 0
              ? ` ${usosDe(baja) === 1 ? 'El evento que la usa la conservará' : `Los ${usosDe(baja)} eventos que la usan la conservarán`} en su historial.`
              : ' Ningún evento la usa.'}{' '}
            Podrás reactivarla desde el filtro &quot;Inactivas&quot;.
          </>
        )}
      </Confirmar>
    </>
  );
}
