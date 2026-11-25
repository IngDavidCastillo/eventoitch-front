// Eventos (ms-eventos): lista con fechas, busqueda por titulo o por lugar, filtros y detalle para cualquier usuario con sesion.
// El ORGANIZADOR (en sus eventos) y el ADMINISTRADOR ademas registran (solo los datos del evento), editan, cancelan, finalizan y
// deciden ante el clima (EN_RIESGO, MANTENIDO) por ms-eventos. Apartar lugar y fecha, reprogramar y cambiar de espacio llevan a
// la Agenda de David (los dos ultimos, en un panel propio sobre ella: components/MoverEventoEnAgenda.jsx).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNuevaReserva } from '../components/layout/Shell';
import { useLocation, useNavigate } from 'react-router-dom';
import useDatos from '../hooks/useDatos';
import {
  actualizarEvento,
  buscarEventos,
  cambiarEstadoEvento,
  crearEvento,
  listarEventos,
  obtenerEvento,
} from '../api/eventos';
import { listarCategorias } from '../api/categorias';
import { listarEspacios } from '../api/espacios';
import { listarUsuarios } from '../api/usuarios';
import { corto, filtrarCampo, limpiarEspacios, primeraMayuscula, tieneLetra } from '../utils/validaciones';
import { esVariosDias, hhmm, mensajeAmigable, nombreLugar, numeroDias, textoFechas, textoHorario } from '../utils/eventos';
import { ahoraMexico, diasEntre, fechaCorta, fechaLarga, hoyIso, sumarDias } from '../utils/fechas';
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
  Insignia,
  LineaAyuda,
  MenuDesplegable,
  Panel,
  SeccionFormulario,
  Segmentado,
  Selector,
  Tarjeta,
  TituloPagina,
  Vacio,
} from '../components/ui';

const MIN_TITULO = 3;
const MAX_TITULO = 100;
const MAX_DESCRIPCION = 255;
const ROLES_QUE_ORGANIZAN = ['ORGANIZADOR', 'ADMINISTRADOR'];
const TERMINADOS = ['CANCELADO', 'FINALIZADO'];
const RESERVA = ' '; // linea de ayuda vacia del mismo alto (el formulario no "brinca")

const ESTADOS_EVENTO = [
  ['POR_PROGRAMAR', 'Por programar', 'pending_actions'], // solo visual: ver estadoVisible
  ['PROGRAMADO', 'Programado', 'event'],
  ['EN_RIESGO', 'En riesgo', 'warning'],
  ['MANTENIDO', 'Mantenido', 'verified'],
  ['REPROGRAMADO', 'Reprogramado', 'update'],
  ['CAMBIO_UBICACION', 'Cambio de ubicación', 'swap_horiz'],
  ['CANCELADO', 'Cancelado', 'cancel'],
  ['FINALIZADO', 'Finalizado', 'task_alt'],
];
// "Todos" / "Todas" (antes "Todos los estados"): la etiqueta ya dice "Estado:" y asi los filtros caben en un renglon
const FILTRO_ESTADOS = [{ valor: '', texto: 'Todos', icono: 'apps' }, ...ESTADOS_EVENTO.map(([valor, texto, icono]) => ({ valor, texto, icono }))];

// ESTUDIANTE e INVITADO solo consultan presentes y futuros: ms-eventos no les manda cancelados ni finalizados
const FILTRO_ESTADOS_PUBLICO = FILTRO_ESTADOS.filter((o) => !TERMINADOS.includes(o.valor) && o.valor !== 'POR_PROGRAMAR');

// "Proximos": primero los vigentes por fecha; los cancelados y finalizados, y los sin fecha (la agenda no respondio), al final
const terminado = (e) => (TERMINADOS.includes(e.estado) ? 1 : 0);
const ORDENES = [
  {
    valor: 'proximos',
    texto: 'Próximos primero',
    icono: 'event_upcoming',
    fn: (a, b) => terminado(a) - terminado(b) || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.id - b.id,
  },
  { valor: 'recientes', texto: 'Registrados recientemente', icono: 'schedule', fn: (a, b) => b.id - a.id },
  { valor: 'az', texto: 'Título A-Z', icono: 'arrow_downward', fn: (a, b) => a.titulo.localeCompare(b.titulo, 'es') },
  { valor: 'za', texto: 'Título Z-A', icono: 'arrow_upward', fn: (a, b) => b.titulo.localeCompare(a.titulo, 'es') },
];

// ---------- Organizador ----------
// Si ms-usuarios no lo encontro (o no respondio) el nombre llega en null: se dice asi, sin inventar un "Usuario 1"
const ORGANIZADOR_NO_DISPONIBLE = 'El servicio de usuarios no encontró a este organizador o no respondió.';
function NombreOrganizador({ e }) {
  if (e.organizadorNombre) return e.organizadorNombre;
  return (
    // Antes: No disponible (ID {e.organizador}) -> el id es un dato interno, no se le muestra a la persona
    <span className="text-tenue" title={ORGANIZADOR_NO_DISPONIBLE}>
      Organizador no disponible
    </span>
  );
}

// ms-eventos guarda PROGRAMADO desde que se registra (lista de estados de la maestra); mientras no tenga lugar y fecha
// apartados, en pantalla se lee "Por programar". Si reservaLiberada llega en null, la agenda no respondio: no se sabe
const sinRespuestaAgenda = (e) => !e?.fecha && e?.reservaLiberada == null;
const estadoVisible = (e) => (e.estado === 'PROGRAMADO' && !e.fecha && !sinRespuestaAgenda(e) ? 'POR_PROGRAMAR' : e.estado);
function EstadoEvento({ e }) {
  if (estadoVisible(e) !== 'POR_PROGRAMAR') return <Estado valor={e.estado} />;
  return (
    <Insignia tono="neutro" punto>
      Por programar
    </Insignia>
  );
}
// Marca debajo del estado en la lista
function marcaFecha(e) {
  if (e.fecha || TERMINADOS.includes(e.estado)) return null;
  if (sinRespuestaAgenda(e)) return 'Fecha no disponible';
  if (e.reservaLiberada) return 'Sin reserva vigente';
  return estadoVisible(e) === 'POR_PROGRAMAR' ? null : 'Sin fecha';
}

// Ya empezo / ya termino segun su fecha y hora (hora de Mexico, como ms-eventos). Sin fecha no hay con que comparar
const yaEmpezoEvento = (e) => !!e?.fecha && `${e.fecha} ${hhmm(e.horaInicio) ?? '00:00'}` <= ahoraMexico();
const yaTerminoEvento = (e) => !!e?.fecha && `${e.fechaFin ?? e.fecha} ${hhmm(e.horaFin) ?? '23:59'}` <= ahoraMexico();
const MOTIVO_YA_TERMINO = 'El evento ya se realizó: no se cancela, se finaliza.';

// (23 nov 2026) Los paneles Reprogramar y Cambiar de espacio ahora se abren sobre la Agenda de David
// (components/MoverEventoEnAgenda.jsx), para elegir viendo su calendario; la version anterior esta en el commit c52c48c.


// ---------- Registrar o editar (panel lateral) ----------
const VACIO = { titulo: '', descripcion: '', categoria: '', cupo: '', espacio: '', fecha: '', variosDias: false, fechaFin: '', horaInicio: '10:00', horaFin: '12:00', organizador: '' };
const deEvento = (e) => ({
  titulo: e.titulo ?? '',
  descripcion: e.descripcion ?? '',
  categoria: e.categoria != null ? String(e.categoria) : '',
  cupo: e.cupoMaximo != null ? String(e.cupoMaximo) : '',
  espacio: e.espacio != null ? String(e.espacio) : '',
  fecha: e.fecha ?? '',
  variosDias: esVariosDias(e),
  fechaFin: e.fechaFin ?? '',
  horaInicio: hhmm(e.horaInicio) ?? '',
  horaFin: hhmm(e.horaFin) ?? '',
  organizador: e.organizador != null ? String(e.organizador) : '',
});

function FormularioEvento({ abierto, modo, evento, categorias, espacios, catalogosListos, onCerrar, onGuardado }) {
  const { sesion } = useAuth();
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const nueva = modo === 'nueva';
  const [form, setForm] = useState(VACIO);
  const [inicial, setInicial] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [preguntarCerrar, setPreguntarCerrar] = useState(false);
  const hayCambios = inicial !== null && JSON.stringify(form) !== JSON.stringify(inicial);

  // El administrador puede registrar a nombre de un organizador (lista de ms-usuarios, solo ADMINISTRADOR)
  const organizadores = useDatos(
    () => (esAdmin && abierto ? listarUsuarios({ tipo: 'ORGANIZADOR', estado: 'ACTIVO' }, sesion.token) : Promise.resolve(null)),
    [esAdmin, abierto, sesion.token],
  );

  useEffect(() => {
    if (!abierto) return;
    const datos = evento ? deEvento(evento) : VACIO;
    setForm(datos);
    setInicial(datos);
    setErrores({});
    setError(null);
    setPreguntarCerrar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, evento]);

  function intentarCerrar() {
    if (guardando) return;
    if (hayCambios) setPreguntarCerrar(true);
    else onCerrar();
  }

  const cambiar = (clave, valor) => {
    setForm((f) => ({ ...f, [clave]: valor }));
    setErrores((x) => ({ ...x, [clave]: '' }));
  };
  // Al escribir: sin espacios de mas, primera letra en mayuscula y sin caracteres que el servicio no acepta
  function cambiarTexto(campo, valor) {
    const r = filtrarCampo(campo, limpiarEspacios(valor));
    setForm((f) => ({ ...f, [campo]: primeraMayuscula(r.valor) }));
    setErrores((x) => ({ ...x, [campo]: r.error.startsWith('Máximo') ? '' : r.error }));
  }

  // Solo espacios activos y DISPONIBLES (los que ms-eventos acepta); al editar, el del evento aunque ya no este en la lista
  const espacioSel = espacios.find((e) => String(e.id) === form.espacio);
  const capacidad = espacioSel?.capacidad ?? null;
  // (22 nov 2026) El evento se registra sin fecha ni horario: se apartan despues en la Agenda (Nueva reserva de David).
  // Sin fecha todavia (aun no se aparta en Reservas): el formulario solo pide el cupo en la seccion 2
  const editarLugar = nueva || !evento?.fecha;

  // Revisa antes de enviar; devuelve los errores por campo (vacio = todo bien)
  function revisar() {
    const x = {};
    const titulo = form.titulo.trim();
    if (!titulo) x.titulo = 'El título es obligatorio';
    else if (titulo.length < MIN_TITULO) x.titulo = `Escribe al menos ${MIN_TITULO} caracteres`;
    else if (!tieneLetra(titulo)) x.titulo = 'El título debe incluir al menos una letra';
    if (!form.categoria) x.categoria = 'Elige una categoría';
    const cupo = Number(form.cupo);
    if (!form.cupo || cupo <= 0) x.cupo = 'Es obligatorio';
    else if (capacidad != null && cupo > capacidad) x.cupo = `El espacio admite ${capacidad.toLocaleString('es-MX')}`;
    return x;
  }

  const motivoBloqueo = !catalogosListos
    ? 'Cargando categorías y espacios...'
    : !nueva && !hayCambios
      ? 'No hay cambios para guardar.'
      : // Antes: nueva && horario.bloquea ? 'El espacio está ocupado en ese horario.' :
        null;

  async function guardar() {
    if (motivoBloqueo) return;
    const x = revisar();
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    setError(null);
    try {
      const comunes = {
        titulo: primeraMayuscula(form.titulo.trim()),
        descripcion: form.descripcion.trim(),
        categoria: Number(form.categoria),
        cupoMaximo: Number(form.cupo),
      };
      const r = nueva
        ? await crearEvento(
            {
              ...comunes,
              // Sin lugar: el lugar se aparta en Reservas (vista de David) junto con la fecha
              ...(esAdmin && form.organizador ? { organizador: Number(form.organizador) } : {}),
            },
            sesion.token,
          )
        : await actualizarEvento(
            evento.id,
            {
              ...comunes,
              // El lugar no se edita aqui (se aparta en Reservas o con "Cambiar de espacio")
              espacio: evento.espacio,
              esAlAireLibre: evento.esAlAireLibre,
              organizador: esAdmin && form.organizador ? Number(form.organizador) : evento.organizador,
            },
            sesion.token,
          );
      onGuardado(r, nueva ? 'registrado' : 'editado');
    } catch (err) {
      setError(mensajeAmigable(err));
    } finally {
      setGuardando(false);
    }
  }

  const ayudaTitulo = form.titulo.length >= MAX_TITULO ? <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_TITULO} caracteres.</LineaAyuda> : RESERVA;
  const ayudaDescripcion =
    form.descripcion.length >= MAX_DESCRIPCION ? <LineaAyuda tono="aviso">Llegaste al máximo de {MAX_DESCRIPCION} caracteres.</LineaAyuda> : RESERVA;
  const ayudaCupo =
    capacidad != null ? (
      <LineaAyuda tono="info">
        En {espacioSel.nombre} caben hasta {capacidad.toLocaleString('es-MX')} personas.
      </LineaAyuda>
    ) : editarLugar ? (
      <LineaAyuda>Cuántas personas esperan. Al apartar el lugar en Reservas, revisa que quepan.</LineaAyuda>
    ) : (
      RESERVA
    );
  // El error de cupo sale en cuanto pasa de la capacidad (al escribir o al cambiar a un espacio mas chico)
  const excedeCupo = capacidad != null && !!form.cupo && Number(form.cupo) > capacidad;
  const errorCupo = errores.cupo || (excedeCupo ? `El espacio admite ${capacidad.toLocaleString('es-MX')} personas` : '');
  const campoCupo = (
    <Campo etiqueta="Cupo" obligatorio error={errorCupo} ayuda={ayudaCupo}>
      <Entrada
        icono="groups"
        inputMode="numeric"
        placeholder={capacidad != null ? `Hasta ${capacidad.toLocaleString('es-MX')}` : 'Ej. 50'}
        value={form.cupo}
        onChange={(e) => cambiar('cupo', e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5))}
        error={errorCupo}
        derecha={<span className="text-xs text-tenue">personas</span>}
      />
    </Campo>
  );

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
          <Boton icono={nueva ? 'add' : 'save'} cargando={guardando} onClick={guardar} disabled={!!motivoBloqueo}>
            {nueva ? 'Registrar evento' : 'Guardar cambios'}
          </Boton>
        </Globo>
      </div>
    </>
  );

  return (
    <>
      <Panel
        abierto={abierto}
        onCerrar={() => !preguntarCerrar && intentarCerrar()}
        titulo={nueva ? 'Nuevo evento' : 'Editar evento'}
        subtitulo={nueva ? 'El lugar, la fecha y el horario se apartan después en Reservas.' : editarLugar ? 'Aún no tiene lugar ni fecha: se apartan en Reservas.' : 'Para cambiar el lugar o la fecha usa "Cambiar de espacio" o "Reprogramar".'}
        pie={pie}
      >
        <SeccionFormulario numero={1} titulo="Datos del evento">
          <div className="grid gap-3">
            <Campo etiqueta="Título" obligatorio error={errores.titulo} ayuda={ayudaTitulo} extra={<ContadorCaracteres actual={form.titulo.length} maximo={MAX_TITULO} />}>
              <Entrada icono="event" placeholder="Ej. Semana de la ingeniería" value={form.titulo} maxLength={MAX_TITULO} onChange={(e) => cambiarTexto('titulo', e.target.value)} error={errores.titulo} />
            </Campo>
            <Campo etiqueta="Descripción" error={errores.descripcion} ayuda={ayudaDescripcion} extra={<ContadorCaracteres actual={form.descripcion.length} maximo={MAX_DESCRIPCION} />}>
              <AreaTexto rows={3} placeholder="De qué trata y a quién va dirigido" value={form.descripcion} maxLength={MAX_DESCRIPCION} onChange={(e) => cambiarTexto('descripcion', e.target.value)} error={errores.descripcion} />
            </Campo>
            <div className={`grid gap-3 ${esAdmin ? 'sm:grid-cols-2' : ''}`}>
              <Campo etiqueta="Categoría" obligatorio error={errores.categoria} ayuda={RESERVA}>
                <Selector className="h-11" value={form.categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
                  <option value="">Elige la categoría...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              {esAdmin && (
                <Campo etiqueta="Organizador" ayuda={organizadores.error ? <LineaAyuda tono="aviso">No se pudo cargar la lista de organizadores.</LineaAyuda> : RESERVA}>
                  <Selector className="h-11" value={form.organizador === String(sesion.usuarioId) ? '' : form.organizador} onChange={(e) => cambiar('organizador', e.target.value)}>
                    <option value="">{nueva ? 'Yo (administrador)' : 'Sin cambio'}</option>
                    {(organizadores.datos ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.nombre} ${u.apellidos ?? ''}`.trim()}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
            </div>
          </div>
        </SeccionFormulario>

        <SeccionFormulario numero={2} titulo={editarLugar ? 'Cupo' : 'Lugar, fecha y cupo'}>
          {editarLugar ? (
            <div className="grid gap-3">
              {campoCupo}
              <Aviso tipo="info">El lugar, la fecha y el horario se apartan en Reservas: abre el detalle del evento y usa "Apartar lugar y fecha".</Aviso>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-borde bg-lienzo p-4 text-sm">
                <p className="flex items-center gap-2 text-texto">
                  <Icono nombre={evento?.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[18px] text-marino" />
                  {evento?.espacioNombre ?? (evento?.espacio ? `Espacio ${evento.espacio}` : 'Sin lugar definido')}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-texto-2">
                  <Icono nombre="calendar_today" className="text-[18px]" />
                  {textoFechas(evento)} {textoHorario(evento) && `· ${textoHorario(evento)}`}
                </p>
              </div>
              <div className="mt-3">{campoCupo}</div>
            </>
          )}
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

// ---------- Detalle (panel lateral) con las acciones que permite su estado ----------
// onApartar: abre la Nueva reserva de la Agenda (vista de David) con este evento elegido
// espacios: para avisar si el cupo no cabe en el lugar que se aparto en Reservas
function DetalleEvento({ id, version, espacios = [], puedeModificar, colorDe, onCerrar, onEditar, onReprogramar, onUbicacion, onEstado, onApartar }) {
  const { sesion } = useAuth();
  const navegar = useNavigate();
  const datos = useDatos(() => (id ? obtenerEvento(id, sesion.token) : Promise.resolve(null)), [id, version, sesion.token]);
  const e = datos.datos && datos.datos.id === id ? datos.datos : null;
  const terminado = e && TERMINADOS.includes(e.estado);
  const puede = e && puedeModificar(e) && !terminado;
  const hoy = hoyIso();
  const yaEmpezo = yaEmpezoEvento(e);
  const yaTermino = yaTerminoEvento(e);
  // El riesgo por clima lo determina el microservicio de Clima y el organizador solo decide (PDF de la maestra).
  // El administrador conserva un aviso manual (p. ej. alerta de Proteccion Civil o mientras Clima no este listo),
  // solo para eventos al aire libre, con fecha y que no hayan pasado (sin fecha no hay pronostico)
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const motivoRiesgo = !e?.esAlAireLibre
    ? 'Solo un evento al aire libre puede quedar en riesgo por el clima.'
    : !e?.fecha
      ? 'El evento no tiene fecha: no hay pronóstico que revisar.'
      : (e.fechaFin ?? e.fecha) < hoy
        ? 'El evento ya pasó.'
        : null;

  // Las acciones que cambian el estado van juntas en "Cambios del evento"; si esta EN_RIESGO, las cuatro decisiones
  // del PDF (mantener, cambiar de lugar, reprogramar o cancelar) van en el aviso. El pie solo tiene Editar y Cerrar
  const accion = (icono, texto, alPulsar, motivo = null, variante = 'secundario') => (
    <Globo texto={motivo} className="block">
      <Boton variante={variante} icono={icono} className="w-full justify-start" disabled={!!motivo} onClick={alPulsar}>
        {texto}
      </Boton>
    </Globo>
  );
  // Los dos abren su panel sobre la Agenda. Sin fecha no hay reserva que mover: se aparta
  const enRiesgo = e?.estado === 'EN_RIESGO' && !yaTermino;
  const motivoMover = e?.fecha ? null : 'No tiene lugar ni fecha: usa "Apartar lugar y fecha".';
  const botonReprogramar = () => accion('update', 'Reprogramar', () => onReprogramar(e), esVariosDias(e) ? 'Dura varios días: cada día se mueve en Reservas.' : motivoMover);
  const botonUbicacion = () => accion('swap_horiz', 'Cambiar de espacio', () => onUbicacion(e), motivoMover);
  const botonCancelar = () => accion('event_busy', 'Cancelar evento', () => onEstado(e, 'CANCELADO'), yaTermino ? MOTIVO_YA_TERMINO : null, 'peligro');
  const botonFinalizar = () =>
    accion(
      'task_alt',
      'Finalizar',
      () => onEstado(e, 'FINALIZADO'),
      yaEmpezo ? null : e.fecha ? `Se puede finalizar desde el ${fechaCorta(e.fecha)} a las ${hhmm(e.horaInicio)}.` : 'Aún no tiene fecha.',
    );
  const botonApartar = () => (
    <Boton icono="event_available" className="w-full justify-start" onClick={() => onApartar(e)}>
      Apartar lugar y fecha
    </Boton>
  );

  const pie = (
    <div className="flex flex-wrap justify-end gap-2">
      {puede && (
        <Boton variante="secundario" icono="edit" onClick={() => onEditar(e)}>
          Editar
        </Boton>
      )}
      <Boton onClick={onCerrar}>Cerrar</Boton>
    </div>
  );

  return (
    <Panel abierto={!!id} onCerrar={onCerrar} titulo="Detalle del evento" subtitulo="Datos, fechas y lugar del evento." pie={pie}>
      {datos.error && !e ? (
        <ErrorServicio servicio="El servicio de eventos" mensaje={datos.error.message} onReintentar={datos.recargar} />
      ) : !e ? (
        <div className="space-y-3">
          <Esqueleto className="h-24 rounded-xl" />
          <Esqueleto className="h-40 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-xl border border-borde bg-lienzo p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-titulo text-lg font-semibold text-texto break-words">{e.titulo}</p>
                {/* Numero del evento: el que aparece en la Nueva reserva y en Reservas de la Agenda */}
                <p className="mt-0.5 text-xs text-tenue tabular">Evento #{e.id}</p>
              </div>
              <span className="shrink-0">
                <EstadoEvento e={e} />
              </span>
            </div>
            {e.descripcion && <p className="mt-2 text-sm text-texto-2 break-words">{e.descripcion}</p>}
            <dl className="mt-3 grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-3 border-t border-borde pt-3 text-sm">
              <dt className="etiqueta text-texto-2">Categoría</dt>
              <dd className="flex items-center gap-2 text-texto">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorDe(e.categoria) }} />
                {e.categoriaNombre ?? `Categoría ${e.categoria}`}
              </dd>
              <dt className="etiqueta self-start text-texto-2">Fecha</dt>
              <dd className="text-texto">
                {!e.fecha && e.reservaLiberada ? (
                  <span className="text-aviso-texto">Sin reserva vigente: se liberó en la Agenda</span>
                ) : !e.fecha ? (
                  <span className="text-tenue">{sinRespuestaAgenda(e) ? 'No disponible: la Agenda no respondió' : 'Aún no se aparta'}</span>
                ) : esVariosDias(e) ? (
                  <>
                    Del {fechaLarga(e.fecha)} al {fechaLarga(e.fechaFin)}
                    <span className="block text-xs text-texto-2">{numeroDias(e)} días, mismo horario</span>
                  </>
                ) : (
                  fechaLarga(e.fecha)
                )}
              </dd>
              <dt className="etiqueta text-texto-2">Horario</dt>
              <dd className="text-texto tabular">{textoHorario(e) || '—'}</dd>
              <dt className="etiqueta text-texto-2">Lugar</dt>
              <dd className="flex items-center gap-2 text-texto">
                <Icono nombre={e.esAlAireLibre ? 'wb_sunny' : 'roofing'} className="text-[18px] text-marino" />
                <span className="min-w-0 break-words">
                  {nombreLugar(e)}
                  {e.espacio ? ` · ${e.esAlAireLibre ? 'al aire libre' : 'techado'}` : ''}
                </span>
              </dd>
              <dt className="etiqueta text-texto-2">Cupo</dt>
              <dd className="text-texto tabular">{Number(e.cupoMaximo).toLocaleString('es-MX')} personas</dd>
              <dt className="etiqueta text-texto-2">Organizador</dt>
              <dd className="text-texto">
                <NombreOrganizador e={e} />
              </dd>
            </dl>
          </div>

          {/* El lugar se aparta en Reservas (vista de David), que no conoce el cupo: si no cabe, se avisa aqui */}
          {(() => {
            const capacidad = e.espacio ? espacios.find((x) => x.id === e.espacio)?.capacidad : null;
            return capacidad != null && e.cupoMaximo > capacidad && !terminado ? (
              <Aviso tipo="aviso" titulo="El cupo no cabe en el lugar apartado" className="mb-4">
                El cupo es de {Number(e.cupoMaximo).toLocaleString('es-MX')} personas y en {nombreLugar(e)} caben {Number(capacidad).toLocaleString('es-MX')}.{' '}
                {puede ? 'Baja el cupo con "Editar" o cambia a un lugar más grande.' : 'El organizador debe ajustarlo.'}
              </Aviso>
            ) : null;
          })()}
          {/* Registrado sin fecha (lo normal cuando aun no se sabe cuando): la fecha se aparta en Reservas */}
          {sinRespuestaAgenda(e) && !terminado && (
            <Aviso tipo="aviso" titulo="No se pudo consultar la Agenda" className="mb-4">
              <span className="block">No se sabe si este evento ya tiene lugar y fecha.</span>
              <Boton variante="secundario" tamano="sm" icono="refresh" className="mt-2" onClick={datos.recargar}>
                Reintentar
              </Boton>
            </Aviso>
          )}
          {!e.fecha && e.reservaLiberada === false && !terminado && (
            <Aviso tipo="info" titulo="Por programar: falta su lugar y fecha" className="mb-4">
              {puede ? 'Apártalos en la Agenda; al confirmar, el evento quedará programado.' : 'El organizador aún no los aparta.'}
            </Aviso>
          )}
          {e.reservaLiberada && !terminado && (
            <Aviso tipo="aviso" titulo="La reserva de este evento se liberó en la Agenda" className="mb-4">
              <span className="block">
                {!puede
                  ? 'El espacio ya no está apartado. El organizador debe apartarlo de nuevo o cancelarlo.'
                  : 'El espacio ya no está apartado. Aparta otra vez su lugar y fecha, o cancélalo.'}
              </span>
            </Aviso>
          )}
          {e.estado === 'EN_RIESGO' && !yaTermino && (
            <Aviso tipo="aviso" titulo="Evento en riesgo por condiciones meteorológicas" className="mb-4">
              {puede && (
                <>
                  <span className="block">Decide qué hacer:</span>
                  <span className="mt-2 grid gap-2 sm:grid-cols-2">
                    {accion('verified', 'Mantener el evento', () => onEstado(e, 'MANTENIDO'))}
                    {botonUbicacion()}
                    {botonReprogramar()}
                    {botonCancelar()}
                  </span>
                </>
              )}
              {!puede && 'El organizador decidirá si se mantiene, cambia de espacio, se reprograma o se cancela.'}
            </Aviso>
          )}
          {terminado && (
            <Aviso tipo="info" className="mb-4">
              Este evento está {e.estado === 'CANCELADO' ? 'cancelado' : 'finalizado'}: ya no se puede modificar.
            </Aviso>
          )}

          {puede && !(enRiesgo && !yaEmpezo && !esVariosDias(e)) && (
            <>
              <h3 className="etiqueta mb-3 text-texto">Cambios del evento</h3>
              {/* Si el ultimo boton queda solo en su renglon, ocupa todo el ancho */}
              <div className="grid gap-2 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
                {/* Solo lo que se puede hacer segun su momento: por programar, futuro, en curso o ya realizado.
                    En riesgo, las cuatro decisiones estan en el aviso */}
                {!e.fecha && !sinRespuestaAgenda(e) && botonApartar()}
                {!enRiesgo && !!e.fecha && !yaEmpezo && botonReprogramar()}
                {!enRiesgo && !!e.fecha && !yaTermino && botonUbicacion()}
                {/* Cancelar un solo dia de un evento de varios dias es liberar esa reserva: se hace en Reservas (vista de David),
                    sin cambiar el estado del evento. Sus paginas no reciben filtros por direccion: se busca por el numero */}
                {esVariosDias(e) && !yaTermino && (
                  <Globo texto={`En Reservas, busca el evento #${e.id} y libera el día que se cancela.`} className="block">
                    <Boton variante="secundario" icono="event_available" className="w-full justify-start" onClick={() => navegar('/reservas')}>
                      Cancelar un día (en Reservas)
                    </Boton>
                  </Globo>
                )}
                {yaEmpezo && botonFinalizar()}
                {/* Normalmente lo marca Clima; el administrador conserva el aviso manual */}
                {esAdmin && e.estado !== 'EN_RIESGO' && !motivoRiesgo && !yaTermino && accion('warning', 'Marcar en riesgo (clima)', () => onEstado(e, 'EN_RIESGO'))}
                {!enRiesgo && !yaTermino && botonCancelar()}
              </div>
            </>
          )}

        </>
      )}
    </Panel>
  );
}

// Textos de la confirmacion de cada cambio de estado
function textoConfirmacion(tipo, e) {
  if (!e) return { titulo: '', cuerpo: '' };
  const nombre = `"${corto(e.titulo, 50)}"`;
  if (tipo === 'CANCELADO')
    return {
      titulo: `Cancelar ${nombre}`,
      // La agenda conserva los dias pasados o en curso (cuentan para la asistencia)
      cuerpo: `${!e.fecha ? '' : yaEmpezoEvento(e) ? (esVariosDias(e) ? 'El evento ya empezó: en la agenda se liberan solo los días que aún no empiezan. ' : 'El evento ya empezó: su reserva se conserva en la agenda. ') : `Se libera el espacio${esVariosDias(e) ? ` los ${numeroDias(e)} días` : ''} en la agenda. `}Un evento cancelado ya no se puede modificar.`,
      boton: 'Cancelar evento',
      icono: 'event_busy',
      tono: 'peligro',
    };
  if (tipo === 'FINALIZADO') {
    const futuros = esVariosDias(e) ? diasEntre(sumarDias(hoyIso(), 1), e.fechaFin).filter((d) => d >= e.fecha).length : 0;
    return {
      titulo: `Finalizar ${nombre}`,
      cuerpo: futuros > 0 ? `Quedará como historial. ${futuros === 1 ? 'El día que aún no llega se liberará' : `Los ${futuros} días que aún no llegan se liberarán`} en la agenda.` : 'Quedará como historial y ya no se podrá modificar.',
      boton: 'Finalizar',
      icono: 'task_alt',
      tono: 'aviso',
    };
  }
  if (tipo === 'EN_RIESGO')
    return {
      titulo: `Marcar en riesgo ${nombre}`,
      cuerpo: 'Normalmente lo marca el servicio de Clima. Úsalo solo ante un aviso oficial (por ejemplo, de Protección Civil). Después el organizador decide si lo mantiene, lo cambia de espacio, lo reprograma o lo cancela.',
      boton: 'Marcar en riesgo',
      icono: 'warning',
      tono: 'aviso',
    };
  return {
    titulo: `Mantener ${nombre}`,
    cuerpo: 'Se confirma que el evento se realiza en su fecha y lugar pese al aviso del clima.',
    boton: 'Mantener',
    icono: 'verified',
    tono: 'info',
  };
}
const MENSAJE_ESTADO = { CANCELADO: 'Evento cancelado', FINALIZADO: 'Evento finalizado', EN_RIESGO: 'Marcado en riesgo', MANTENIDO: 'Evento mantenido' };

// ---------- Pagina ----------
export default function Eventos() {
  const { sesion } = useAuth();
  const navegar = useNavigate();
  const esAdmin = sesion.rol === 'ADMINISTRADOR';
  const organiza = ROLES_QUE_ORGANIZAN.includes(sesion.rol);
  const esOrganizador = sesion.rol === 'ORGANIZADOR';
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [buscarEn, setBuscarEn] = useState('titulo'); // 'titulo' | 'lugar'
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [fecha, setFecha] = useState(''); // los eventos de ese dia (uno de varios dias cuenta en cualquiera de ellos)
  const [orden, setOrden] = useState('proximos');
  const [alcance, setAlcance] = useState(esOrganizador ? 'mios' : 'todos'); // el organizador ve primero los suyos
  // Al volver de la Agenda (MoverEventoEnAgenda) se abre otra vez el detalle y, si hubo un cambio, se dice
  const { state: regreso, pathname } = useLocation();
  const [detalle, setDetalle] = useState(regreso?.detalleEvento ?? null); // id
  const [formulario, setFormulario] = useState(null); // { modo, evento }
  const [confirmar, setConfirmar] = useState(null); // { tipo, evento }
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(() => (regreso?.mensaje ? { ...regreso.mensaje, id: Date.now() } : null));
  const [resaltado, setResaltado] = useState(null);
  const [version, setVersion] = useState(0); // al cambiar, el detalle se vuelve a pedir
  const enfocar = useRef(null);
  const avisar = (tipo, txt) => setMensaje({ tipo, texto: txt, id: Date.now() });
  const cerrarMensaje = useCallback(() => setMensaje(null), []);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => {
    if (!resaltado) return undefined;
    const t = setTimeout(() => setResaltado(null), 3000);
    return () => clearTimeout(t);
  }, [resaltado]);

  // Nueva reserva de la Agenda (vista de David, se abre desde cualquier pantalla); version sube al crear una reserva
  const { version: versionReservas } = useNuevaReserva();
  // Tambien recarga cuando se aparta una reserva (para ver su fecha)
  const datos = useDatos(() => (busqueda ? buscarEventos(busqueda, buscarEn === 'lugar', sesion.token) : listarEventos({}, sesion.token)), [busqueda, buscarEn, sesion.token, versionReservas]);
  const categorias = useDatos(() => listarCategorias(false, sesion.token), [sesion.token]);
  const espacios = useDatos(() => listarEspacios(false, sesion.token), [sesion.token]);
  const catalogosListos = !!categorias.datos && !!espacios.datos;

  const colores = useMemo(() => new Map((categorias.datos ?? []).map((c) => [c.id, c.colorIdentificador])), [categorias.datos]);
  const colorDe = useCallback((id) => colores.get(id) ?? 'var(--color-borde)', [colores]);
  const puedeModificar = useCallback((e) => esAdmin || (esOrganizador && Number(e.organizador) === Number(sesion.usuarioId)), [esAdmin, esOrganizador, sesion.usuarioId]);

  const ordenar = ORDENES.find((o) => o.valor === orden).fn;
  const lista = useMemo(
    () =>
      [...(datos.datos ?? [])]
        .filter((e) => alcance !== 'mios' || Number(e.organizador) === Number(sesion.usuarioId))
        .filter((e) => !estado || estadoVisible(e) === estado)
        .filter((e) => !categoria || String(e.categoria) === categoria)
        .filter((e) => !fecha || (!!e.fecha && e.fecha <= fecha && fecha <= (e.fechaFin ?? e.fecha)))
        .sort(ordenar),
    [datos.datos, alcance, estado, categoria, fecha, ordenar, sesion.usuarioId],
  );
  const filtroCategorias = useMemo(
    () => [{ valor: '', texto: 'Todas', icono: 'sell' }, ...(categorias.datos ?? []).map((c) => ({ valor: String(c.id), texto: c.nombre, icono: 'label' }))],
    [categorias.datos],
  );

  // Despues de guardar, cuando llega la lista NUEVA, se lleva la vista al evento (tarjeta o fila, la que este visible)
  useEffect(() => {
    const objetivo = enfocar.current;
    if (!objetivo || !datos.datos || datos.datos === objetivo.antes) return;
    enfocar.current = null;
    requestAnimationFrame(() =>
      [...document.querySelectorAll(`[data-evento="${objetivo.id}"]`)].find((x) => x.offsetParent !== null)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }, [datos.datos]);

  function terminar(e, texto) {
    // Al cancelar, reprogramar o cambiar de lugar ms-eventos avisa a los inscritos; si Inscripciones o
    // Notificaciones no respondieron, el cambio si se hizo y la respuesta lo dice en "aviso"
    if (e.aviso) avisar('aviso', `${texto} · No se pudo avisar a los inscritos.`);
    else avisar('exito', texto);
    setResaltado(e.id);
    setVersion((v) => v + 1);
    enfocar.current = { id: e.id, antes: datos.datos };
    datos.recargar();
  }

  async function cambiarEstado() {
    const { tipo, evento } = confirmar;
    setTrabajando(true);
    try {
      const r = await cambiarEstadoEvento(evento.id, tipo, sesion.token);
      terminar(r, `${MENSAJE_ESTADO[tipo]}: ${corto(r.titulo, 40)}`);
    } catch (err) {
      avisar('error', mensajeAmigable(err));
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  }

  // Reprogramar (solo fecha y horario) y Cambiar de espacio (solo el lugar) se eligen viendo la Agenda de David, en un panel
  // propio: son decisiones sobre el evento, asi que las guarda ms-eventos (mueve la reserva, cambia el estado y avisa)
  const decidirEnAgenda = (tipo) => (e) => {
    setDetalle(null);
    navegar('/agenda', { state: { moverEvento: { tipo, evento: e } } });
  };

  // El regreso ya se uso para abrir el detalle: se quita para que no se repita al recargar
  useEffect(() => {
    if (regreso?.detalleEvento) navegar(pathname, { replace: true, state: null });
  }, [regreso, navegar, pathname]);

  // Botones de cada evento (los mismos en la tarjeta y en la fila de la tabla), como en Espacios y Categorias
  const acciones = (e) =>
    puedeModificar(e) && !TERMINADOS.includes(e.estado) ? (
      <>
        <Boton variante="fantasma" tamano="sm" icono="edit" onClick={() => abrirFormulario('editar', e)}>
          Editar
        </Boton>
        <Globo texto={yaTerminoEvento(e) ? MOTIVO_YA_TERMINO : null}>
          <Boton variante="fantasma" tamano="sm" icono="event_busy" className="disabled:opacity-40" disabled={yaTerminoEvento(e)} onClick={() => setConfirmar({ tipo: 'CANCELADO', evento: e })}>
            Cancelar
          </Boton>
        </Globo>
      </>
    ) : null;
  // En la tabla, solo iconos (como Reservas de la Agenda) para que la columna Lugar no se quede sin espacio
  const accionesIconos = (e) =>
    puedeModificar(e) && !TERMINADOS.includes(e.estado) ? (
      <>
        <Globo texto="Editar">
          <button type="button" onClick={() => abrirFormulario('editar', e)} aria-label={`Editar ${e.titulo}`} className="grid size-9 place-items-center rounded-lg text-texto-2 hover:bg-borde-suave hover:text-texto">
            <Icono nombre="edit" className="text-[20px]" />
          </button>
        </Globo>
        <Globo texto={yaTerminoEvento(e) ? MOTIVO_YA_TERMINO : 'Cancelar evento'}>
          <button type="button" disabled={yaTerminoEvento(e)} onClick={() => setConfirmar({ tipo: 'CANCELADO', evento: e })} aria-label={`Cancelar ${e.titulo}`} className="grid size-9 place-items-center rounded-lg text-texto-2 hover:bg-peligro-tinte hover:text-peligro-texto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-texto-2">
            <Icono nombre="event_busy" className="text-[20px]" />
          </button>
        </Globo>
      </>
    ) : null;

  const abrirFormulario = (modo, evento = null) => {
    setDetalle(null);
    setFormulario({ modo, evento });
  };
  const conf = textoConfirmacion(confirmar?.tipo, confirmar?.evento);
  const filtrando = busqueda || estado || categoria || fecha;
  const limpiarFiltros = () => {
    setTexto('');
    setBusqueda('');
    setEstado('');
    setCategoria('');
    setFecha('');
  };

  return (
    <>
      <TituloPagina
        titulo="Eventos"
        subtitulo={
          datos.datos
            ? `${lista.length} ${filtrando ? 'encontrados' : alcance === 'mios' ? (lista.length === 1 ? 'evento tuyo' : 'eventos tuyos') : lista.length === 1 ? 'evento' : 'eventos'}`
            : 'Actividades académicas, culturales, deportivas y tecnológicas del instituto'
        }
      >
        {mensaje && <AvisoTemporal key={mensaje.id} mensaje={mensaje} onCerrar={cerrarMensaje} />}
        {organiza && (
          <Boton icono="add" onClick={() => abrirFormulario('nueva')} cargando={!catalogosListos}>
            Nuevo evento
          </Boton>
        )}
      </TituloPagina>

      <Tarjeta>
        {/* Busqueda en el primer renglon; filtros a la izquierda y orden a la derecha en el segundo */}
        <div className="space-y-3 border-b border-borde p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Entrada
              icono={buscarEn === 'lugar' ? 'location_on' : 'search'}
              placeholder={buscarEn === 'lugar' ? 'Buscar por lugar (nombre del espacio)' : 'Buscar por título'}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="h-10 min-w-[200px] flex-1"
              derecha={
                texto && (
                  <button type="button" onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="text-tenue hover:text-texto-2">
                    <Icono nombre="close" className="text-[18px]" />
                  </button>
                )
              }
            />
            <Segmentado
              valor={buscarEn}
              onChange={setBuscarEn}
              opciones={[
                { valor: 'titulo', texto: 'Título' },
                { valor: 'lugar', texto: 'Lugar' },
              ]}
            />
            {esOrganizador && (
              <Segmentado
                valor={alcance}
                onChange={setAlcance}
                opciones={[
                  { valor: 'mios', texto: 'Mis eventos' },
                  { valor: 'todos', texto: 'Todos' },
                ]}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-texto-2">
              <span className="hidden sm:inline">Fecha:</span>
              <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Buscar por fecha" className="h-10 w-[160px]" />
            </label>
            <MenuDesplegable valor={estado} onChange={setEstado} opciones={organiza ? FILTRO_ESTADOS : FILTRO_ESTADOS_PUBLICO} etiqueta="Estado" icono="filter_list" ancho="w-60" />
            <MenuDesplegable valor={categoria} onChange={setCategoria} opciones={filtroCategorias} etiqueta="Categoría" icono="sell" ancho="w-60" />
            {filtrando && (
              <Boton variante="fantasma" tamano="sm" icono="filter_alt_off" onClick={limpiarFiltros}>
                Limpiar
              </Boton>
            )}
            <div className="sm:ml-auto">
              <MenuDesplegable valor={orden} onChange={setOrden} opciones={ORDENES} etiqueta="Ordenar" ancho="w-60" />
            </div>
          </div>
        </div>

        {datos.error && !datos.datos ? (
          <ErrorServicio servicio="El servicio de eventos" mensaje={datos.error.message} onReintentar={datos.recargar} />
        ) : !datos.datos ? (
          <EsqueletoTabla filas={5} columnas={6} />
        ) : lista.length === 0 ? (
          <Vacio
            icono="event_busy"
            titulo={
              busqueda
                ? `No hay eventos ${buscarEn === 'lugar' ? 'en un lugar que contenga' : 'que contengan'} "${busqueda}"`
                : estado || categoria || fecha
                  ? 'No hay eventos con esos filtros'
                  : alcance === 'mios'
                    ? 'Aún no tienes eventos'
                    : 'Aún no hay eventos'
            }
          >
            {!filtrando && organiza && 'Registra uno con el botón "Nuevo evento".'}
          </Vacio>
        ) : (
          <>
            {/* Celular, tablet y laptop: tarjetas; la tabla no cabe sin deslizar de lado */}
            <ul className="escalonado grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 min-[1400px]:hidden">
              {lista.map((e) => (
                <li
                  key={e.id}
                  data-evento={e.id}
                  className={`scroll-mt-24 flex min-w-0 flex-col overflow-hidden rounded-xl border border-borde transition-colors duration-700 ${resaltado === e.id ? 'bg-marino-tinte' : 'bg-superficie'}`}
                >
                  <span className="h-1.5 w-full" style={{ backgroundColor: colorDe(e.categoria) }} aria-hidden="true" />
                  <button type="button" onClick={() => setDetalle(e.id)} aria-label={`Ver el detalle de ${e.titulo}`} className="group block min-w-0 flex-1 p-4 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-texto group-hover:text-marino group-hover:underline">{e.titulo}</p>
                      <EstadoEvento e={e} />
                    </div>
                    {/* Numero del evento: es el que se elige en la Nueva reserva de la Agenda ("Titulo (#id)") */}
                    <p className="mt-1 truncate text-xs text-texto-2">
                      <span className="tabular text-tenue">#{e.id}</span> · {e.categoriaNombre ?? `Categoría ${e.categoria}`}
                      {marcaFecha(e) && <span className="text-tenue"> · {marcaFecha(e)}</span>}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-texto-2 tabular">
                      <Icono nombre="groups" className="text-[14px]" />
                      Cupo {Number(e.cupoMaximo).toLocaleString('es-MX')}
                      <span className="truncate">
                        · <NombreOrganizador e={e} />
                      </span>
                    </p>
                  </button>
                  {acciones(e) && <div className="flex flex-wrap justify-end gap-1 border-t border-borde-suave px-2 py-1.5">{acciones(e)}</div>}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto scroll-fino min-[1400px]:block">
              {/* table-fixed: un solo renglon por evento; lo que no cabe termina en "..." y se ve completo en el globo */}
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="etiqueta bg-lienzo text-texto-2">
                    <th className="w-16 px-5 py-2.5 font-semibold">N.º</th>
                    <th className="px-3 py-2.5 font-semibold">Evento</th>
                    <th className="w-48 px-3 py-2.5 font-semibold">Categoría</th>
                    {/* Fecha, horario y lugar ya se ven en Reservas y Agenda (vistas de David) y en el detalle del evento:
                    <th className="w-52 px-3 py-2.5 font-semibold">Fecha</th>
                    <th className="w-32 px-3 py-2.5 font-semibold">Horario</th>
                    <th className="px-3 py-2.5 font-semibold">Lugar</th> */}
                    <th className="w-64 px-3 py-2.5 font-semibold">Organizador</th>
                    <th className="w-20 px-3 py-2.5 text-right font-semibold">Cupo</th>
                    <th className="w-44 px-3 py-2.5 font-semibold">Estado</th>
                    {organiza && <th className="w-24 px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="escalonado">
                  {lista.map((e) => (
                    <tr
                      key={e.id}
                      data-evento={e.id}
                      className={`scroll-mt-24 border-t border-borde-suave transition-colors duration-700 ${resaltado === e.id ? 'bg-marino-tinte' : 'hover:bg-lienzo'}`}
                    >
                      <td className="px-5 py-2.5 text-sm text-tenue tabular">#{e.id}</td>
                      <td className="px-3 py-2.5">
                        <Globo texto={`${e.titulo} · Clic para ver el detalle`} className="block">
                          <button type="button" onClick={() => setDetalle(e.id)} aria-label={`Ver el detalle de ${e.titulo}`} className="group flex w-full min-w-0 items-center gap-2 text-left">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorDe(e.categoria) }} aria-hidden="true" />
                            <span className="truncate text-sm font-medium text-texto group-hover:text-marino group-hover:underline">{e.titulo}</span>
                          </button>
                        </Globo>
                      </td>
                      <td className="truncate px-3 py-2.5 text-sm text-texto-2">{e.categoriaNombre ?? `Categoría ${e.categoria}`}</td>
                      <td className="truncate px-3 py-2.5 text-sm text-texto-2">
                        <NombreOrganizador e={e} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-texto tabular">{Number(e.cupoMaximo).toLocaleString('es-MX')}</td>
                      <td className="px-3 py-2.5">
                        <EstadoEvento e={e} />
                        {/* Registrado sin fecha: aun no tiene reserva (se aparta en Reservas) */}
                        {marcaFecha(e) && <span className="mt-0.5 block text-xs text-tenue">{marcaFecha(e)}</span>}
                      </td>
                      {organiza && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">{accionesIconos(e)}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tarjeta>

      <BotonArriba />

      <FormularioEvento
        abierto={!!formulario}
        modo={formulario?.modo ?? 'nueva'}
        evento={formulario?.evento ?? null}
        categorias={categorias.datos ?? []}
        espacios={espacios.datos ?? []}
        catalogosListos={catalogosListos}
        onCerrar={() => setFormulario(null)}
        onGuardado={(e, accion) => {
          setFormulario(null);
          terminar(e, `${accion === 'registrado' ? 'Evento registrado' : 'Cambios guardados'}: ${corto(e.titulo, 40)}`);
        }}
      />

      <DetalleEvento
        id={detalle}
        espacios={espacios.datos ?? []}
        version={version + versionReservas}
        onApartar={(e) => {
          setDetalle(null);
          // Al confirmar, la reserva queda a la vista en su calendario
          navegar('/agenda', { state: { nuevaReserva: { eventoId: e.id, ...(e.espacio ? { espacioId: e.espacio } : {}) } } });
        }}
        puedeModificar={puedeModificar}
        colorDe={colorDe}
        onCerrar={() => setDetalle(null)}
        onEditar={(e) => abrirFormulario('editar', e)}
        onReprogramar={decidirEnAgenda('reprogramar')}
        onUbicacion={decidirEnAgenda('ubicacion')}
        onEstado={(e, tipo) => setConfirmar({ tipo, evento: e })}
      />

      <Confirmar
        abierto={!!confirmar}
        onCerrar={() => !trabajando && setConfirmar(null)}
        onConfirmar={cambiarEstado}
        cargando={trabajando}
        icono={conf.icono}
        tono={conf.tono}
        titulo={conf.titulo}
        textoConfirmar={conf.boton}
        iconoConfirmar={conf.icono}
        varianteConfirmar={confirmar?.tipo === 'CANCELADO' ? 'peligro' : 'primario'}
        textoCancelar="Volver"
      >
        {conf.cuerpo}
      </Confirmar>
    </>
  );
}
