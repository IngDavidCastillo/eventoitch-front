// Espacios del instituto (ms-espacios): lista con foto, busqueda por nombre, orden, filtro por tipo, detalle con
// los eventos que los usan y, solo para el ADMINISTRADOR, registrar, editar, dar de baja (borrado logico),
// reactivar (POST con el mismo nombre, como pide el proyecto) y subir, cambiar o quitar la foto.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useDatos from '../hooks/useDatos';
import {
  actualizarEspacio,
  buscarEspacios,
  crearEspacio,
  eliminarEspacio,
  listarEspacios,
  quitarFotoEspacio,
  servidorEspacios,
  subirFotoEspacio,
  urlFotoEspacio,
} from '../api/espacios';
import { listarEventos } from '../api/eventos';
import {
  CAPACIDAD_MAXIMA,
  CAPACIDAD_MINIMA,
  corto,
  filtrarCampo,
  filtrarCapacidad,
  limpiarEspacios,
  mismoNombre,
  primeraMayuscula,
  tieneLetra,
} from '../utils/validaciones';
import { prepararFotoEspacio } from '../utils/fotoEspacio';
import { iconoEspacio, tipoEspacio } from '../utils/formato';
import Icono from '../components/Icono';
import {
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
  Insignia,
  Interruptor,
  LineaAyuda,
  MenuDesplegable,
  Panel,
  SeccionFormulario,
  Segmentado,
  Tarjeta,
  TituloPagina,
  Vacio,
} from '../components/ui';

const MAX_NOMBRE = 100;
const MAX_UBICACION = 150;
const MIN_TEXTO = 3; // minimo para nombre y ubicacion (regla del formulario; el servicio no pone minimo)
const TIPOS = ['AULA', 'AUDITORIO', 'CANCHA', 'LABORATORIO'];
// Estados de un evento que ya no ocupan el espacio
const EVENTO_TERMINADO = ['CANCELADO', 'FINALIZADO'];

const ORDENES = [
  { valor: 'recientes', texto: 'Más recientes', icono: 'schedule', fn: (a, b) => b.id - a.id },
  { valor: 'az', texto: 'Nombre A-Z', icono: 'arrow_downward', fn: (a, b) => a.nombre.localeCompare(b.nombre, 'es') },
  { valor: 'za', texto: 'Nombre Z-A', icono: 'arrow_upward', fn: (a, b) => b.nombre.localeCompare(a.nombre, 'es') },
  { valor: 'mayor', texto: 'Mayor capacidad', icono: 'groups', fn: (a, b) => (b.capacidad ?? 0) - (a.capacidad ?? 0) },
  { valor: 'menor', texto: 'Menor capacidad', icono: 'person', fn: (a, b) => (a.capacidad ?? 0) - (b.capacidad ?? 0) },
];
const FILTRO_TIPOS = [{ valor: '', texto: 'Todos los tipos', icono: 'apps' }, ...TIPOS.map((t) => ({ valor: t, texto: tipoEspacio(t), icono: iconoEspacio(t) }))];

// Estado que se muestra: inactivo (dado de baja) o, si esta activo, su disponibilidad
const estadoDe = (e) => (e.estatus === 0 ? 'INACTIVO' : e.estado ?? 'DISPONIBLE');
const capacidadTexto = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-MX')} ${Number(n) === 1 ? 'persona' : 'personas'}`);

// Los mensajes del servicio vienen sin acentos y a veces con palabras tecnicas (POST, ID...).
// Para los casos conocidos se muestra un mensaje claro para la persona (DISENO.md, "Textos").
function mensajeAmigable(err, nombre = '') {
  const m = err?.message ?? '';
  if (err?.status === 409 && /dado de baja/i.test(m))
    return `Ya existe un espacio inactivo llamado "${corto(nombre, 40)}". Búscalo en el filtro "Inactivos" y reactívalo.`;
  if (err?.status === 409) return `Ya existe un espacio activo llamado "${corto(nombre, 40)}". Usa otro nombre.`;
  if (err?.status === 404) return 'El espacio ya no existe o fue dado de baja. Actualiza la lista e inténtalo de nuevo.';
  if (err?.status === 403) return 'Solo un administrador puede modificar espacios.';
  if (err?.status === 413) return 'La foto pesa demasiado (máximo 2 MB).';
  if (err?.status === 400) return m || 'Revisa los datos del formulario.';
  return m || 'No se pudo guardar. Inténtalo de nuevo.';
}

// ---------- Foto del espacio (o el icono de su tipo si no tiene) ----------
// La imagen la sirve ms-espacios; si no carga, se muestra el icono del tipo.
// completa = la foto entera (detalle); si no, se recorta para llenar el cuadro (miniaturas)
function FotoEspacio({ servidor, espacio, version, className = '', icono = 'text-[20px]', completa = false }) {
  // Se recuerda QUE direccion fallo: si despues se sube otra foto (direccion nueva), se vuelve a intentar
  const [fallida, setFallida] = useState(null);
  const pedida = espacio?.fotoLugar ? urlFotoEspacio(servidor, espacio.id, `${espacio.fotoLugar}-${version}`) : null;
  const url = pedida !== fallida ? pedida : null;
  return url ? (
    <img src={url} alt={`Foto de ${espacio.nombre}`} onError={() => setFallida(url)} className={`shrink-0 ${completa ? 'object-contain bg-lienzo' : 'object-cover bg-borde-suave'} ${className}`} />
  ) : (
    <span className={`grid shrink-0 place-items-center bg-marino-tinte text-marino ${className}`} aria-hidden="true">
      <Icono nombre={iconoEspacio(espacio?.tipo)} className={icono} />
    </span>
  );
}

// ---------- Tipo de espacio: 4 botones con su icono ----------
function SelectorTipo({ valor, onChange, error }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tipo de espacio">
      {TIPOS.map((t) => {
        const elegido = valor === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={elegido}
            onClick={() => onChange(t)}
            className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
              elegido ? 'border-marino bg-marino-tinte text-marino' : `${error ? 'border-peligro' : 'border-borde'} bg-superficie text-texto-2 hover:bg-borde-suave`
            }`}
          >
            <Icono nombre={iconoEspacio(t)} className="text-[22px]" />
            {tipoEspacio(t)}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Foto en el formulario: vista previa, elegir o arrastrar, cambiar y quitar ----------
function FotoFormulario({ servidor, espacio, version, foto, onChange }) {
  const entrada = useRef(null);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState(null);
  const [encima, setEncima] = useState(false);
  const vista = useMemo(() => (foto.nueva ? URL.createObjectURL(foto.nueva) : null), [foto.nueva]);
  useEffect(() => () => vista && URL.revokeObjectURL(vista), [vista]);
  const tieneGuardada = !!espacio?.fotoLugar && !foto.quitar;
  const urlGuardada = tieneGuardada ? urlFotoEspacio(servidor, espacio.id, `${espacio.fotoLugar}-${version}`) : null;
  const mostrar = vista ?? urlGuardada;

  // Se reduce (sin recortar) y se convierte a JPG antes de guardarla en el formulario
  async function elegir(archivo) {
    if (!archivo) return;
    setError(null);
    setPreparando(true);
    try {
      onChange({ nueva: await prepararFotoEspacio(archivo), quitar: false });
    } catch (e) {
      setError(e.message);
    } finally {
      setPreparando(false);
    }
  }

  function soltar(e) {
    e.preventDefault();
    setEncima(false);
    elegir(e.dataTransfer.files?.[0]);
  }

  const elegirArchivo = () => entrada.current?.click();
  // Que se explica a la derecha de la vista previa, segun lo que pasara al guardar
  const quitando = foto.quitar && !foto.nueva && !!espacio?.fotoLugar;
  const titulo = preparando ? 'Preparando la foto...' : foto.nueva ? 'Foto nueva' : mostrar ? 'Foto actual' : quitando ? 'Se quitará la foto' : 'Sin foto';
  const detalle = foto.nueva
    ? `JPG · ${Math.max(1, Math.round(foto.nueva.size / 1024)).toLocaleString('es-MX')} KB. Se guarda al presionar el botón de abajo.`
    : mostrar
      ? 'Es la que se ve en la lista y en el detalle del espacio.'
      : quitando
        ? 'Al guardar, el espacio se mostrará con el ícono de su tipo.'
        : 'Arrastra una imagen aquí o elígela. JPG, PNG o WEBP; se ajusta sola para que pese poco.';

  return (
    <div>
      {/* Todo el recuadro acepta una foto arrastrada */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        className={`flex flex-col gap-4 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
          encima ? 'border-marino bg-marino-tinte' : error ? 'border-peligro' : 'border-borde bg-lienzo'
        }`}
      >
        {/* Vista previa con la misma proporcion que el detalle (horizontal) */}
        {mostrar ? (
          <img src={mostrar} alt="Vista previa de la foto" className="aspect-video w-full shrink-0 rounded-lg border border-borde bg-superficie object-contain sm:w-44" />
        ) : (
          <button
            type="button"
            onClick={elegirArchivo}
            aria-label="Elegir foto"
            className={`grid aspect-video w-full shrink-0 place-items-center rounded-lg border-2 border-dashed transition-colors sm:w-44 ${
              encima ? 'border-marino text-marino' : 'border-borde bg-superficie text-tenue hover:border-marino hover:text-marino'
            }`}
          >
            <Icono nombre={preparando ? 'progress_activity' : 'add_photo_alternate'} className={`text-[28px] ${preparando ? 'animate-spin' : ''}`} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-texto">
            {titulo}
            {foto.nueva && <Insignia tono="info">Sin guardar</Insignia>}
          </p>
          <p className="mt-0.5 text-xs text-texto-2">{detalle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="secundario" tamano="sm" icono={mostrar ? 'photo_camera' : 'upload'} cargando={preparando} onClick={elegirArchivo}>
              {mostrar ? 'Cambiar' : 'Elegir foto'}
            </Boton>
            {mostrar && (
              <Boton
                variante="fantasma"
                tamano="sm"
                icono="delete"
                onClick={() => onChange(foto.nueva ? { nueva: null, quitar: foto.quitar } : { nueva: null, quitar: true })}
              >
                {foto.nueva && tieneGuardada ? 'Descartar' : 'Quitar'}
              </Boton>
            )}
            {quitando && (
              <Boton variante="fantasma" tamano="sm" icono="undo" onClick={() => onChange({ nueva: null, quitar: false })}>
                Conservar la actual
              </Boton>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1.5 min-h-[18px] text-xs">
        {error && (
          <span className="flex items-center gap-1 text-peligro-texto">
            <Icono nombre="error" className="text-[14px]" />
            {error}
          </span>
        )}
      </p>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          elegir(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ---------- Registrar, editar o reactivar (panel lateral) ----------
// modo: 'nueva' | 'editar' | 'reactivar'. Reactivar = POST con el mismo nombre (el nombre no se cambia; la foto se conserva).
const VACIO = { nombre: '', tipo: '', capacidad: '', ubicacion: '', aireLibre: false, estado: 'DISPONIBLE' };
const SIN_CAMBIO_FOTO = { nueva: null, quitar: false };
// "Al aire libre" segun el tipo (regla solo del formulario; ms-espacios y el contrato no cambian).
// Aulas y laboratorios siempre son techados. Canchas y auditorios pueden ser de las dos formas:
// al registrar se propone lo mas comun (cancha descubierta, auditorio techado) y se puede cambiar.
const SIEMPRE_TECHADO = { AULA: 'las aulas', LABORATORIO: 'los laboratorios' };
const AIRE_LIBRE_COMUN = { CANCHA: true, AUDITORIO: false };
// Capacidad a partir de la cual se avisa que es poco comun para el tipo (solo aviso; un area deportiva puede ser un estadio)
const CAPACIDAD_COMUN = { AULA: 100, LABORATORIO: 80, AUDITORIO: 3000 };
const ARTICULO_TIPO = { AULA: 'Un aula', LABORATORIO: 'Un laboratorio', AUDITORIO: 'Un auditorio' };
// Corrige un espacio guardado antes con una combinacion que no existe (ej. un aula al aire libre)
const corregirAire = (f) => (SIEMPRE_TECHADO[f.tipo] && f.aireLibre ? { ...f, aireLibre: false } : f);
const deEspacio = (e) => ({
  nombre: e.nombre ?? '',
  tipo: e.tipo ?? '',
  capacidad: e.capacidad != null ? String(e.capacidad) : '',
  ubicacion: e.ubicacionFisica ?? '',
  aireLibre: !!e.esAlAireLibre,
  estado: e.estado ?? 'DISPONIBLE',
});

function FormularioEspacio({ abierto, modo, espacio, catalogo, catalogoListo, vigentes, servidor, version, onCerrar, onGuardado }) {
  const { sesion } = useAuth();
  const [form, setForm] = useState(VACIO);
  const [foto, setFoto] = useState(SIN_CAMBIO_FOTO);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [preguntarCerrar, setPreguntarCerrar] = useState(false);
  const [inicial, setInicial] = useState(null); // como estaba el formulario al abrirlo
  const cargado = useRef(null); // espacio dado de baja cuyos datos ya se cargaron
  const [aireElegido, setAireElegido] = useState(false); // true = la persona ya decidio "al aire libre" (no se le cambia)
  const [notaAire, setNotaAire] = useState(null); // aviso cuando el formulario cambio "al aire libre" por el tipo
  const editando = modo === 'editar';
  const bloqueadoAire = !!SIEMPRE_TECHADO[form.tipo]; // aulas y laboratorios: siempre techados
  const hayCambios = inicial !== null && (JSON.stringify(form) !== JSON.stringify(inicial) || !!foto.nueva || foto.quitar);

  // Clic fuera, Esc, la X o Cancelar: si ya se escribio algo, primero se pregunta
  function intentarCerrar() {
    if (guardando) return;
    if (hayCambios) setPreguntarCerrar(true);
    else onCerrar();
  }

  const otros = useMemo(() => catalogo.filter((c) => c.id !== espacio?.id), [catalogo, espacio]);
  // Al registrar, si el nombre es el de uno dado de baja, se reactiva ese (y conserva su foto)
  const inactivoMismoNombre = modo === 'nueva' ? otros.find((c) => c.estatus === 0 && mismoNombre(c.nombre, form.nombre)) : null;
  const reactivando = modo === 'reactivar' || !!inactivoMismoNombre;
  const elQueSeReactiva = modo === 'reactivar' ? espacio : inactivoMismoNombre;
  // Espacio cuya foto se muestra en el formulario: el que se edita o el que se va a reactivar
  const conFoto = espacio ?? inactivoMismoNombre;

  // Al abrir: datos del espacio (editar/reactivar) o un formulario limpio
  useEffect(() => {
    if (!abierto) return;
    setErrores({});
    setError(null);
    setPreguntarCerrar(false);
    setFoto(SIN_CAMBIO_FOTO);
    cargado.current = null;
    const nuevo = espacio ? deEspacio(espacio) : VACIO;
    const corregido = corregirAire(nuevo);
    setForm(corregido);
    setInicial(nuevo);
    // Un espacio ya registrado conserva su valor; si era una combinacion imposible se corrige y se avisa
    setAireElegido(!!espacio);
    setNotaAire(corregido !== nuevo ? `Se cambió a techado: ${SIEMPRE_TECHADO[nuevo.tipo]} no pueden estar al aire libre. Guarda para corregirlo.` : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, espacio]);

  // Al escribir: sin espacios de mas, primera letra en mayuscula y sin caracteres que el servicio no acepta.
  // Si el nombre es el de un espacio dado de baja, se cargan sus datos de antes.
  function cambiarTexto(campo, clave, valor) {
    const r = filtrarCampo(campo, limpiarEspacios(valor));
    const texto = primeraMayuscula(r.valor);
    const baja = clave === 'nombre' && modo === 'nueva' ? otros.find((c) => c.estatus === 0 && mismoNombre(c.nombre, texto)) : null;
    const cargar = baja && cargado.current !== baja.id ? baja : null;
    if (cargar) {
      cargado.current = cargar.id;
      setAireElegido(true); // se respetan los datos que ya tenia
      setNotaAire(null);
    }
    setForm((f) => corregirAire({ ...f, ...(cargar && deEspacio(cargar)), [clave]: texto }));
    // Llegar al maximo no es un error (el campo ya no deja escribir mas): eso se avisa en la linea de ayuda
    setErrores((x) => ({ ...x, [clave]: r.error.startsWith('Máximo') ? '' : r.error }));
  }

  function cambiarCapacidad(valor) {
    const r = filtrarCapacidad(valor);
    setForm((f) => ({ ...f, capacidad: r.valor }));
    setErrores((x) => ({ ...x, capacidad: r.error }));
  }

  // Revisa antes de enviar; devuelve los errores por campo (vacio = todo bien)
  function revisar() {
    const x = {};
    const nombre = form.nombre.trim();
    // Nombre: el servicio pide al menos una letra; aqui ademas un minimo de 3 caracteres ("A" no identifica un lugar)
    // y se revisa contra la lista para avisar en el campo, antes de enviar, si ya lo usa otro espacio activo
    const ocupado = modo !== 'reactivar' && otros.find((c) => c.estatus !== 0 && mismoNombre(c.nombre, nombre));
    if (!nombre) x.nombre = 'El nombre es obligatorio';
    else if (!tieneLetra(nombre)) x.nombre = 'El nombre debe incluir al menos una letra';
    else if (nombre.length < MIN_TEXTO) x.nombre = `Escribe al menos ${MIN_TEXTO} caracteres`;
    else if (ocupado) x.nombre = 'Ya hay un espacio activo con ese nombre';
    else if (editando && otros.find((c) => c.estatus === 0 && mismoNombre(c.nombre, nombre)))
      x.nombre = 'Ese nombre es de un espacio inactivo: reactívalo desde "Inactivos" o usa otro';
    if (!form.tipo) x.tipo = 'Elige el tipo de espacio';
    const cap = Number(form.capacidad);
    if (!form.capacidad) x.capacidad = 'Es obligatoria';
    else if (cap < CAPACIDAD_MINIMA) x.capacidad = `Mínimo ${CAPACIDAD_MINIMA} personas`;
    // El servicio la acepta vacia, pero un espacio sin ubicacion no le sirve al organizador ni a los asistentes
    const ubicacion = form.ubicacion.trim();
    if (!ubicacion) x.ubicacion = 'Indica dónde está el espacio';
    else if (!tieneLetra(ubicacion) || ubicacion.length < MIN_TEXTO) x.ubicacion = 'Escribe una ubicación clara (ej. Edificio P, planta baja)';
    return x;
  }

  async function guardar() {
    if (motivoBloqueo) return setError(motivoBloqueo);
    const x = revisar();
    setErrores(x);
    if (Object.keys(x).length) return;

    const nombre = primeraMayuscula(form.nombre.trim());
    setGuardando(true);
    setError(null);
    try {
      const datos = {
        nombre,
        tipo: form.tipo,
        capacidad: Number(form.capacidad),
        ubicacionFisica: form.ubicacion.trim(),
        esAlAireLibre: form.aireLibre,
        estado: form.estado,
      };
      let r = editando ? await actualizarEspacio(espacio.id, datos, sesion.token) : await crearEspacio(datos, sesion.token);
      // La foto va aparte (el espacio ya existe): si falla, el espacio queda guardado y solo se avisa
      let avisoFoto = null;
      try {
        if (foto.nueva) r = await subirFotoEspacio(r.id, foto.nueva, sesion.token);
        else if (foto.quitar && r.fotoLugar) {
          await quitarFotoEspacio(r.id, sesion.token);
          r = { ...r, fotoLugar: null };
        }
      } catch (err) {
        avisoFoto = mensajeAmigable(err, nombre);
      }
      onGuardado(r, editando ? 'editado' : reactivando ? 'reactivado' : 'registrado', avisoFoto);
    } catch (err) {
      setError(mensajeAmigable(err, nombre));
    } finally {
      setGuardando(false);
    }
  }

  // Eventos proximos (no cancelados ni finalizados) del espacio que se edita o se reactiva
  const proximos = (espacio ?? elQueSeReactiva) ? (vigentes?.get((espacio ?? elQueSeReactiva).id) ?? []) : [];
  const titulo = editando ? 'Editar espacio' : modo === 'reactivar' ? 'Reactivar espacio' : 'Nuevo espacio';
  const subtitulo = editando
    ? 'Si un cambio afecta a los eventos que ya lo usan, aquí mismo se te avisa.'
    : modo === 'reactivar'
      ? 'Volverá a estar disponible para eventos nuevos. Su nombre y su foto se conservan.'
      : 'Aulas, auditorios, canchas y laboratorios del instituto.';

  // Por que no se puede guardar todavia (se explica en un globo sobre el boton)
  const motivoBloqueo = !catalogoListo
    ? 'Actualizando la lista de espacios...'
    : editando && !hayCambios
      ? 'No hay cambios para guardar.'
      : null;

  // Linea de ayuda de cada campo: solo muestra algo cuando hay que avisar; si no, queda un espacio vacio
  // del mismo alto (asi el formulario no "brinca" cuando aparece un mensaje o un error)
  const RESERVA = ' ';
  const ayudaNombre =
    modo === 'reactivar' ? (
      <LineaAyuda tono="info">El nombre no se puede cambiar: el servicio reactiva el espacio por su nombre.</LineaAyuda>
    ) : inactivoMismoNombre ? (
      <LineaAyuda tono="info">Este espacio está inactivo: se cargaron sus datos y al guardar se reactivará.</LineaAyuda>
    ) : form.nombre.length >= MAX_NOMBRE ? (
      <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_NOMBRE} caracteres.</LineaAyuda>
    ) : (
      RESERVA
    );
  const ayudaUbicacion = form.ubicacion.length >= MAX_UBICACION ? <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_UBICACION} caracteres.</LineaAyuda> : RESERVA;
  const ayudaCapacidad = form.capacidad === String(CAPACIDAD_MAXIMA) ? <LineaAyuda tono="aviso">Es la capacidad máxima.</LineaAyuda> : RESERVA;

  // Avisos de capacidad (no bloquean; el servicio acepta de 5 a 10,000):
  // 1) eventos proximos con un cupo mayor a la capacidad nueva  2) capacidad poco comun para el tipo
  const capacidad = Number(form.capacidad);
  const avisosCapacidad = [];
  if (form.capacidad && capacidad >= CAPACIDAD_MINIMA) {
    const noCaben = proximos.filter((e) => Number(e.cupoMaximo) > capacidad);
    if (noCaben.length === 1)
      avisosCapacidad.push(`"${corto(noCaben[0].titulo, 40)}" tiene cupo de ${noCaben[0].cupoMaximo} personas: con esta capacidad no caben todos.`);
    else if (noCaben.length > 1)
      avisosCapacidad.push(`${noCaben.length} eventos próximos tienen un cupo mayor a esta capacidad (hasta ${Math.max(...noCaben.map((e) => Number(e.cupoMaximo)))} personas).`);
    const comun = CAPACIDAD_COMUN[form.tipo];
    if (comun && capacidad > comun)
      avisosCapacidad.push(`${ARTICULO_TIPO[form.tipo]} de ${capacidad.toLocaleString('es-MX')} personas es poco común; revisa el número.`);
  }

  // Cambiar "al aire libre" no cambia a los eventos ya registrados: cada evento guarda su propia copia
  const distintos = inicial && form.aireLibre !== inicial.aireLibre ? proximos.filter((e) => !!e.esAlAireLibre !== form.aireLibre).length : 0;
  const avisoAire =
    notaAire ??
    (distintos > 0
      ? `${distintos === 1 ? '1 evento próximo seguirá registrado' : `${distintos} eventos próximos seguirán registrados`} como ${form.aireLibre ? 'techado' : 'al aire libre'}; avisa a su organizador.`
      : null);

  // Pasar a mantenimiento un espacio con eventos programados: se avisa (no se bloquea)
  const enUso = proximos.length;
  const ayudaDisponibilidad =
    form.estado === 'MANTENIMIENTO' ? (
      <LineaAyuda tono="aviso">
        {enUso > 0
          ? `${enUso === 1 ? '1 evento programado usa' : `${enUso} eventos programados usan`} este espacio. Mientras esté en mantenimiento no se podrán crear eventos nuevos aquí; revisa esos eventos.`
          : 'Mientras esté en mantenimiento no se podrán crear eventos nuevos en este espacio.'}
      </LineaAyuda>
    ) : (
      RESERVA
    );

  // El error al guardar va en el pie, junto a los botones (como en "Nueva reserva"): siempre se ve sin hacer scroll
  const pie = (
    <>
      {error && (
        <Aviso tipo="error" className="mb-3" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Boton variante="secundario" onClick={intentarCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Globo texto={motivoBloqueo} className={motivoBloqueo ? '' : 'contents'}>
          <Boton icono={editando ? 'save' : reactivando ? 'restore' : 'add'} cargando={guardando} onClick={guardar} disabled={!!motivoBloqueo}>
            {editando ? 'Guardar cambios' : reactivando ? 'Reactivar espacio' : 'Registrar espacio'}
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
            <Campo etiqueta="Nombre" obligatorio error={errores.nombre} ayuda={ayudaNombre} extra={<ContadorCaracteres actual={form.nombre.length} maximo={MAX_NOMBRE} />}>
              <Entrada
                icono={modo === 'reactivar' ? 'lock' : iconoEspacio(form.tipo)}
                placeholder="Ej. Auditorio principal"
                value={form.nombre}
                maxLength={MAX_NOMBRE}
                onChange={(e) => cambiarTexto('nombre', 'nombre', e.target.value)}
                error={errores.nombre}
                disabled={modo === 'reactivar'}
                className={modo === 'reactivar' ? 'bg-borde-suave cursor-not-allowed' : ''}
              />
            </Campo>
            {/* Sin <Campo>: Campo es un <label> y el navegador toma el primer boton (Aula) como "su" control;
                al pasar el mouse o dar clic en otro tipo, Aula tambien se marcaba */}
            <div role="group" aria-labelledby="etiqueta-tipo">
              <span id="etiqueta-tipo" className="mb-1.5 block text-sm font-medium text-texto">
                Tipo<span className="text-peligro"> *</span>
              </span>
              <SelectorTipo
                valor={form.tipo}
                error={errores.tipo}
                onChange={(t) => {
                  // Aula o laboratorio: se pasa a techado (y se avisa si estaba al aire libre).
                  // Cancha o auditorio: se propone lo comun solo si la persona aun no lo ha decidido.
                  let aire = form.aireLibre;
                  let nota = null;
                  if (SIEMPRE_TECHADO[t]) {
                    if (aire) nota = `Se cambió a techado porque elegiste ${tipoEspacio(t).toLowerCase()}.`;
                    aire = false;
                  } else if (!aireElegido) aire = AIRE_LIBRE_COMUN[t];
                  setForm((f) => ({ ...f, tipo: t, aireLibre: aire }));
                  setNotaAire(nota);
                  setErrores((x) => ({ ...x, tipo: '' }));
                }}
              />
              <span className="mt-1.5 block text-xs">
                {errores.tipo ? (
                  <span className="flex items-center gap-1 text-peligro-texto">
                    <Icono nombre="error" className="text-[14px]" />
                    {errores.tipo}
                  </span>
                ) : (
                  RESERVA
                )}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
              <Campo etiqueta="Capacidad" obligatorio error={errores.capacidad} ayuda={ayudaCapacidad}>
                <Entrada
                  icono="groups"
                  inputMode="numeric"
                  placeholder={`${CAPACIDAD_MINIMA} a ${CAPACIDAD_MAXIMA.toLocaleString('es-MX')}`}
                  value={form.capacidad}
                  onChange={(e) => cambiarCapacidad(e.target.value)}
                  error={errores.capacidad}
                  derecha={<span className="text-xs text-tenue">personas</span>}
                />
              </Campo>
              <Campo etiqueta="Ubicación física" obligatorio error={errores.ubicacion} ayuda={ayudaUbicacion} extra={<ContadorCaracteres actual={form.ubicacion.length} maximo={MAX_UBICACION} />}>
                <Entrada
                  icono="location_on"
                  placeholder="Ej. Edificio P, planta baja"
                  value={form.ubicacion}
                  maxLength={MAX_UBICACION}
                  onChange={(e) => cambiarTexto('ubicacion', 'ubicacion', e.target.value)}
                  error={errores.ubicacion}
                />
              </Campo>
            </div>
            {/* Avisos de capacidad a todo lo ancho (en la columna de capacidad no caben); no impiden guardar */}
            {avisosCapacidad.length > 0 && (
              <div className="-mt-1 space-y-1 rounded-lg border border-aviso-borde bg-aviso-tinte px-3 py-2 text-xs">
                {avisosCapacidad.map((a) => (
                  <LineaAyuda key={a} tono="aviso">
                    {a}
                  </LineaAyuda>
                ))}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-lienzo px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-texto">
                  <Icono nombre={form.aireLibre ? 'wb_sunny' : 'roofing'} className="text-[20px] text-marino" />
                  <span>
                    <span className="font-medium">Al aire libre</span>
                    {/* La explicacion va aqui mismo (sin globo): por que esta bloqueado o que implica */}
                    <span className="block text-xs text-texto-2">
                      {!form.tipo
                        ? 'Se habilita al elegir el tipo de espacio.'
                        : bloqueadoAire
                          ? `No aplica: ${SIEMPRE_TECHADO[form.tipo]} son espacios techados.`
                          : form.aireLibre
                            ? 'El clima puede afectar sus eventos.'
                            : 'Espacio techado: el clima no afecta sus eventos.'}
                    </span>
                  </span>
                </span>
                {/* Bloqueado si aun no hay tipo o si el tipo siempre es techado */}
                {!form.tipo || bloqueadoAire ? (
                  <span inert className="block shrink-0 cursor-not-allowed opacity-40">
                    <Interruptor activo={false} onChange={() => {}} etiqueta="Al aire libre (no disponible)" />
                  </span>
                ) : (
                  <Interruptor
                    activo={form.aireLibre}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, aireLibre: v }));
                      setAireElegido(true);
                      setNotaAire(null);
                    }}
                    etiqueta="Al aire libre"
                  />
                )}
              </div>
              <p className="mt-1.5 min-h-[18px] text-xs">{avisoAire ? <LineaAyuda tono="aviso">{avisoAire}</LineaAyuda> : RESERVA}</p>
            </div>
          </div>
        </SeccionFormulario>

        <SeccionFormulario numero={2} titulo="Disponibilidad">
          <Segmentado
            valor={form.estado}
            onChange={(v) => setForm((f) => ({ ...f, estado: v }))}
            opciones={[
              { valor: 'DISPONIBLE', texto: 'Disponible' },
              { valor: 'MANTENIMIENTO', texto: 'En mantenimiento' },
            ]}
          />
          <p className="mt-1.5 min-h-[18px] text-xs">{ayudaDisponibilidad}</p>
        </SeccionFormulario>

        <SeccionFormulario numero={3} titulo="Foto" extra={<span className="text-xs text-texto-2">Opcional</span>}>
          <FotoFormulario servidor={servidor} espacio={conFoto} version={version} foto={foto} onChange={setFoto} />
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

// ---------- Detalle de un espacio con sus eventos (panel lateral) ----------
function DetalleEspacio({ espacio, esAdmin, servidor, version, onCerrar, onEditar, onBaja, onReactivar }) {
  const { sesion } = useAuth();
  const eventos = useDatos(() => (espacio ? listarEventos({ espacio: espacio.id }, sesion.token) : Promise.resolve(null)), [espacio?.id, sesion.token]);
  const lista = eventos.datos ?? [];
  const activo = espacio?.estatus !== 0;

  const pie = (
    <div className="flex flex-wrap justify-end gap-2">
      {esAdmin && espacio && activo && (
        <>
          <Boton variante="peligro" icono="delete" onClick={() => onBaja(espacio)}>
            Dar de baja
          </Boton>
          <Boton variante="secundario" icono="edit" onClick={() => onEditar(espacio)}>
            Editar
          </Boton>
        </>
      )}
      {esAdmin && espacio && !activo && (
        <Boton variante="secundario" icono="restore" onClick={() => onReactivar(espacio)}>
          Reactivar
        </Boton>
      )}
      <Boton onClick={onCerrar}>Cerrar</Boton>
    </div>
  );

  return (
    <Panel abierto={!!espacio} onCerrar={onCerrar} titulo="Detalle del espacio" subtitulo="Información del espacio y eventos que lo usan." pie={pie}>
      {espacio && (
        <>
          <div className="mb-6 overflow-hidden rounded-xl border border-borde bg-lienzo">
            <FotoEspacio servidor={servidor} espacio={espacio} version={version} className="aspect-video w-full" icono="text-[48px]" completa />
            <div className="p-4">
              <p className="font-titulo text-lg font-semibold text-texto break-words">{espacio.nombre}</p>
              {/* Datos en dos columnas alineadas: etiqueta a la izquierda, valor a la derecha */}
              <dl className="mt-3 grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-3 border-t border-borde pt-3 text-sm">
                <dt className="etiqueta text-texto-2">Estado</dt>
                <dd>
                  <Estado valor={estadoDe(espacio)} />
                </dd>
                <dt className="etiqueta text-texto-2">Tipo</dt>
                <dd className="flex items-center gap-2 text-texto">
                  <Icono nombre={iconoEspacio(espacio.tipo)} className="text-[18px] text-marino" />
                  {tipoEspacio(espacio.tipo) || '—'}
                </dd>
                <dt className="etiqueta text-texto-2">Capacidad</dt>
                <dd className="text-texto tabular">{capacidadTexto(espacio.capacidad)}</dd>
                <dt className="etiqueta text-texto-2">Lugar</dt>
                <dd className="flex items-center gap-2 text-texto">
                  <Icono nombre={espacio.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[18px] text-marino" />
                  {espacio.esAlAireLibre ? 'Al aire libre' : 'Techado'}
                </dd>
                <dt className="etiqueta self-start text-texto-2">Ubicación</dt>
                <dd className="text-texto break-words">{espacio.ubicacionFisica || <span className="text-tenue">Sin ubicación</span>}</dd>
              </dl>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h3 className="etiqueta text-texto">Eventos que lo usan</h3>
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
            <Vacio icono="event_busy" titulo="Ningún evento usa este espacio" />
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
                          <Icono nombre="sell" className="text-[14px]" />
                          {e.categoriaNombre ?? `Categoría ${e.categoria}`}
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
export default function Espacios() {
  const { sesion } = useAuth();
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const [estado, setEstado] = useState('activos'); // 'activos' | 'inactivos' | 'todos' (los dos ultimos solo ADMIN)
  const [tipo, setTipo] = useState('');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [formulario, setFormulario] = useState(null); // null = cerrado; { modo, espacio }
  const [detalle, setDetalle] = useState(null);
  const [baja, setBaja] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [resaltado, setResaltado] = useState(null);
  const [version, setVersion] = useState(() => Date.now()); // cambia al guardar para que las fotos se vuelvan a pedir
  const enfocar = useRef(null); // espacio recien guardado al que hay que llevar la vista
  const avisar = (tipoAviso, textoAviso) => setMensaje({ tipo: tipoAviso, texto: textoAviso, id: Date.now() });
  const cerrarMensaje = useCallback(() => setMensaje(null), []);

  // Espera a que se deje de escribir para no llamar al servicio en cada letra
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    if (!resaltado) return;
    const t = setTimeout(() => setResaltado(null), 3000);
    return () => clearTimeout(t);
  }, [resaltado]);

  // Direccion de ms-espacios para armar la URL de las fotos (la foto es publica)
  const servidor = useDatos(() => servidorEspacios(), []).datos;
  // Para "Inactivos" y "Todos" se piden todos al servicio (?todas=true) y aqui se filtran
  const todas = esAdmin && estado !== 'activos';
  const datos = useDatos(() => (busqueda ? buscarEspacios(busqueda, todas, sesion.token) : listarEspacios(todas, sesion.token)), [busqueda, todas, sesion.token]);
  // Todos los espacios (tambien dados de baja) para reconocer nombres de espacios inactivos al registrar
  const catalogo = useDatos(() => listarEspacios(esAdmin, sesion.token), [esAdmin, sesion.token]);
  const catalogoListo = !!catalogo.datos && !catalogo.cargando;
  // Eventos de cada espacio (si ms-eventos no responde, la columna muestra un guion)
  const eventos = useDatos(() => listarEventos({}, sesion.token), [sesion.token]);

  // usos = cuantos eventos tiene cada espacio; vigentes = la lista de los que aun no se cancelan ni terminan
  // (el formulario la usa para comparar su cupo y si son al aire libre)
  const { usos, vigentes } = useMemo(() => {
    if (!eventos.datos) return { usos: null, vigentes: null };
    const u = new Map();
    const v = new Map();
    eventos.datos.forEach((e) => {
      u.set(e.espacio, (u.get(e.espacio) ?? 0) + 1);
      if (!EVENTO_TERMINADO.includes(e.estado)) v.set(e.espacio, [...(v.get(e.espacio) ?? []), e]);
    });
    return { usos: u, vigentes: v };
  }, [eventos.datos]);
  const usosDe = (e) => usos?.get(e.id) ?? 0;
  const proximosDe = (e) => vigentes?.get(e.id)?.length ?? 0;
  // "2 próximos · 5 en total": proximos = los que aun no se cancelan ni terminan
  const textoEventos = (e) => {
    const p = proximosDe(e);
    return `${p} ${p === 1 ? 'evento próximo' : 'eventos próximos'} · ${usosDe(e)} en total`;
  };

  const ordenar = ORDENES.find((o) => o.valor === orden).fn;
  const lista = useMemo(
    () =>
      [...(datos.datos ?? [])]
        .filter((e) => estado !== 'inactivos' || e.estatus === 0)
        .filter((e) => !tipo || e.tipo === tipo)
        .sort(ordenar),
    [datos.datos, ordenar, estado, tipo],
  );

  // Despues de guardar, cuando llega la lista NUEVA, se lleva la vista a la fila de ese espacio
  useEffect(() => {
    const e = enfocar.current;
    if (!e || !datos.datos || datos.datos === e.antes) return;
    enfocar.current = null;
    // Hay una tarjeta (pantallas chicas) y una fila (pantallas grandes) por espacio: se usa la que esta visible
    requestAnimationFrame(() =>
      [...document.querySelectorAll(`[data-espacio="${e.id}"]`)].find((x) => x.offsetParent !== null)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }, [datos.datos]);

  function recargarTodo() {
    datos.recargar();
    catalogo.recargar();
    eventos.recargar();
  }

  // Botones del ADMINISTRADOR (los mismos en la tarjeta y en la fila de la tabla)
  const acciones = (e) =>
    e.estatus !== 0 ? (
      <>
        <Boton variante="fantasma" tamano="sm" icono="edit" onClick={() => abrirFormulario('editar', e)}>
          Editar
        </Boton>
        <Boton variante="fantasma" tamano="sm" icono="delete" onClick={() => setBaja(e)}>
          Dar de baja
        </Boton>
      </>
    ) : (
      <Boton variante="secundario" tamano="sm" icono="restore" onClick={() => abrirFormulario('reactivar', e)}>
        Reactivar
      </Boton>
    );

  function abrirFormulario(modo, espacio = null) {
    setDetalle(null);
    setFormulario({ modo, espacio });
  }

  function terminar(e, accion, avisoFoto) {
    const que = accion === 'editado' ? 'Cambios guardados' : accion === 'reactivado' ? 'Espacio reactivado' : 'Espacio registrado';
    // Si la foto no se pudo guardar, el espacio si quedo guardado: aviso amarillo con el motivo
    if (avisoFoto) avisar('aviso', `${que}, pero la foto no se guardó: ${avisoFoto}`);
    else avisar('exito', `${que}: ${e.nombre}`);
    setResaltado(e.id);
    setVersion(Date.now());
    enfocar.current = { id: e.id, antes: datos.datos };
    recargarTodo();
  }

  async function darDeBaja() {
    const e = baja;
    setTrabajando(true);
    try {
      await eliminarEspacio(e.id, sesion.token);
      avisar('exito', `Dado de baja (está en Inactivos): ${e.nombre}`);
      recargarTodo();
    } catch (err) {
      avisar('error', mensajeAmigable(err, e.nombre));
    } finally {
      setTrabajando(false);
      setBaja(null);
    }
  }

  const vigentesBaja = baja ? (vigentes?.get(baja.id)?.length ?? 0) : 0;
  const nombreFiltro = tipo ? `de tipo ${tipoEspacio(tipo).toLowerCase()}` : '';

  return (
    <>
      <TituloPagina
        titulo="Espacios"
        subtitulo={
          datos.datos
            ? `${lista.length} ${busqueda || tipo ? 'encontrados' : estado === 'inactivos' ? 'inactivos' : estado === 'todos' ? 'registrados' : 'activos'}`
            : 'Aulas, auditorios, canchas y laboratorios del instituto'
        }
      >
        {mensaje && <AvisoTemporal key={mensaje.id} mensaje={mensaje} onCerrar={cerrarMensaje} />}
        {esAdmin && (
          <Boton icono="add" onClick={() => abrirFormulario('nueva')} cargando={!catalogoListo}>
            Nuevo espacio
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
          <MenuDesplegable valor={tipo} onChange={setTipo} opciones={FILTRO_TIPOS} etiqueta="Tipo" icono="filter_list" />
          <MenuDesplegable valor={orden} onChange={setOrden} opciones={ORDENES} etiqueta="Ordenar" />
          {esAdmin && (
            <Segmentado
              valor={estado}
              onChange={setEstado}
              opciones={[
                { valor: 'activos', texto: 'Activos' },
                { valor: 'inactivos', texto: 'Inactivos' },
                { valor: 'todos', texto: 'Todos' },
              ]}
            />
          )}
        </div>

        {datos.error && !datos.datos ? (
          <ErrorServicio servicio="El servicio de espacios" mensaje={datos.error.message} onReintentar={datos.recargar} />
        ) : !datos.datos ? (
          <EsqueletoTabla filas={5} columnas={6} />
        ) : lista.length === 0 ? (
          <Vacio
            icono="location_city"
            titulo={
              busqueda
                ? `No hay espacios ${nombreFiltro} que contengan "${busqueda}"`
                : tipo
                  ? `No hay espacios ${nombreFiltro}`
                  : estado === 'inactivos'
                    ? 'No hay espacios inactivos'
                    : 'Aún no hay espacios'
            }
          >
            {!busqueda && !tipo && esAdmin && estado !== 'inactivos' && 'Registra el primero con el botón "Nuevo espacio".'}
          </Vacio>
        ) : (
          <>
            {/* Pantallas chicas y medianas (celular, tablet, laptop): tarjetas con la foto; la tabla no cabe sin deslizar de lado */}
            <ul className="escalonado grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 min-[1400px]:hidden">
              {lista.map((e) => {
                const activo = e.estatus !== 0;
                return (
                  <li
                    key={e.id}
                    data-espacio={e.id}
                    className={`scroll-mt-24 flex min-w-0 flex-col overflow-hidden rounded-xl border border-borde transition-colors duration-700 ${resaltado === e.id ? 'bg-marino-tinte' : 'bg-superficie'}`}
                  >
                    <button type="button" onClick={() => setDetalle(e)} aria-label={`Ver el detalle de ${e.nombre}`} className="group block min-w-0 flex-1 text-left">
                      <FotoEspacio servidor={servidor} espacio={e} version={version} className="h-36 w-full" icono="text-[40px]" />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`min-w-0 truncate font-medium group-hover:text-marino group-hover:underline ${activo ? 'text-texto' : 'text-texto-2'}`}>{e.nombre}</p>
                          <Estado valor={estadoDe(e)} />
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-2">
                          <span className="flex items-center gap-1">
                            <Icono nombre={iconoEspacio(e.tipo)} className="text-[14px]" />
                            {tipoEspacio(e.tipo) || '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icono nombre={e.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[14px]" />
                            {e.esAlAireLibre ? 'Al aire libre' : 'Techado'}
                          </span>
                          <span className="flex items-center gap-1 tabular">
                            <Icono nombre="groups" className="text-[14px]" />
                            {capacidadTexto(e.capacidad)}
                          </span>
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-texto-2">
                          <Icono nombre="location_on" className="text-[14px]" />
                          <span className="truncate">{e.ubicacionFisica || 'Sin ubicación'}</span>
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-texto-2 tabular">
                          <Icono nombre="event" className="text-[14px]" />
                          {usos ? textoEventos(e) : eventos.error ? 'Eventos no disponibles' : 'Consultando eventos...'}
                        </p>
                      </div>
                    </button>
                    {esAdmin && <div className="flex justify-end gap-1 border-t border-borde px-3 py-2">{acciones(e)}</div>}
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto scroll-fino min-[1400px]:block">
              {/* table-fixed: cada registro ocupa un solo renglon; lo que no cabe termina en "..." y se ve completo en el globo */}
              <table className="w-full min-w-[1060px] table-fixed text-left">
                <thead>
                  <tr className="etiqueta text-texto-2 bg-lienzo">
                    <th className="w-[23%] px-5 py-2.5 font-semibold">Espacio</th>
                    <th className="w-44 px-3 py-2.5 font-semibold">Tipo</th>
                    <th className="w-24 px-3 py-2.5 font-semibold text-right">Capacidad</th>
                    <th className="px-3 py-2.5 font-semibold">Ubicación</th>
                    <th className="w-24 px-3 py-2.5 font-semibold text-center">
                      <Globo texto="Eventos por realizarse (sin contar los cancelados ni los finalizados)">Próximos</Globo>
                    </th>
                    <th className="w-36 px-3 py-2.5 font-semibold">Estado</th>
                    {esAdmin && <th className="w-[200px] px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="escalonado">
                  {lista.map((e) => {
                    const activo = e.estatus !== 0;
                    const n = proximosDe(e);
                    return (
                      <tr key={e.id} data-espacio={e.id} className={`scroll-mt-24 border-t border-borde-suave transition-colors duration-700 ${resaltado === e.id ? 'bg-marino-tinte' : 'hover:bg-lienzo'}`}>
                        <td className="px-5 py-2">
                          <Globo texto={`${e.nombre} · Clic para ver el detalle`} className="block">
                            <button type="button" onClick={() => setDetalle(e)} aria-label={`Ver el detalle de ${e.nombre}`} className="group flex w-full min-w-0 items-center gap-3 text-left">
                              <FotoEspacio servidor={servidor} espacio={e} version={version} className="size-9 rounded-lg" icono="text-[18px]" />
                              <span className={`truncate text-sm font-medium group-hover:text-marino group-hover:underline ${activo ? 'text-texto' : 'text-texto-2'}`}>{e.nombre}</span>
                            </button>
                          </Globo>
                        </td>
                        <td className="px-3 py-2 text-sm text-texto">
                          <span className="flex min-w-0 items-center gap-2">
                            <Icono nombre={iconoEspacio(e.tipo)} className="text-[18px] text-texto-2" />
                            <span className="truncate">{tipoEspacio(e.tipo) || '—'}</span>
                            {e.esAlAireLibre && (
                              <Globo texto="Al aire libre">
                                <Icono nombre="wb_sunny" className="text-[16px] text-aviso-texto" />
                              </Globo>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-texto tabular">{e.capacidad != null ? Number(e.capacidad).toLocaleString('es-MX') : '—'}</td>
                        <td className="px-3 py-2 text-sm text-texto-2">
                          {e.ubicacionFisica ? (
                            <Globo texto={e.ubicacionFisica} className="block">
                              <span className="block truncate">{e.ubicacionFisica}</span>
                            </Globo>
                          ) : (
                            <span className="text-tenue">Sin ubicación</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-sm tabular">
                          {usos ? (
                            <Globo texto={textoEventos(e)}>
                              <span className={n === 0 ? 'text-tenue' : 'font-semibold text-texto'}>{n}</span>
                            </Globo>
                          ) : (
                            <Globo texto={eventos.error ? 'El servicio de eventos no respondió.' : 'Consultando eventos...'}>
                              <span className="text-tenue">—</span>
                            </Globo>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Estado valor={estadoDe(e)} />
                        </td>
                        {esAdmin && (
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1 whitespace-nowrap">{acciones(e)}</div>
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

      <FormularioEspacio
        abierto={!!formulario}
        modo={formulario?.modo ?? 'nueva'}
        espacio={formulario?.espacio ?? null}
        catalogo={catalogo.datos ?? []}
        catalogoListo={catalogoListo}
        vigentes={vigentes}
        servidor={servidor}
        version={version}
        onCerrar={() => setFormulario(null)}
        onGuardado={(e, accion, avisoFoto) => {
          setFormulario(null);
          terminar(e, accion, avisoFoto);
        }}
      />

      <DetalleEspacio
        espacio={detalle}
        esAdmin={esAdmin}
        servidor={servidor}
        version={version}
        onCerrar={() => setDetalle(null)}
        onEditar={(e) => abrirFormulario('editar', e)}
        onReactivar={(e) => abrirFormulario('reactivar', e)}
        onBaja={(e) => {
          setDetalle(null);
          setBaja(e);
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
            {!usos
              ? ' No se pudo revisar si hay eventos en este espacio.'
              : vigentesBaja > 0
                ? ` ${vigentesBaja === 1 ? 'Hay 1 evento programado' : `Hay ${vigentesBaja} eventos programados`} en este espacio: conviene reubicarlos antes.`
                : usosDe(baja) > 0
                  ? ' Los eventos que ya lo usaron lo conservarán en su historial.'
                  : ' Ningún evento lo usa.'}{' '}
            Podrás reactivarlo desde el filtro &quot;Inactivos&quot;.
          </>
        )}
      </Confirmar>
    </>
  );
}
