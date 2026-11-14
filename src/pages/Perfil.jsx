// Mi perfil: tarjeta de presentacion (foto, nombre, rol, documento) con lo que falta por llenar,
// pestanas "Mi informacion" (PUT /usuarios/{id} con el perfil completo + lo que puede hacer su rol),
// "Preferencias" (lectura, atajos, agenda y reservas; solo en este navegador, ver utils/preferencias.js) y "Seguridad"
// (PUT /auth/password), y "Mis reservas" (GET /reservas/mias) con resumen y descarga al calendario.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { actualizarUsuario, quitarFoto, subirFoto } from '../api/usuarios';
import { cambiarPassword, misAccesos } from '../api/auth';
import { buscarMias, liberarReserva } from '../api/agenda';
import { cargarCatalogos } from '../hooks/useReservas';
import useDatos from '../hooks/useDatos';
import useRecargaAlCrear from '../hooks/useRecargaAlCrear';
import { ATAJOS, useNuevaReserva } from '../components/layout/Shell';
import Icono from '../components/Icono';
import { Aviso, Avatar, Boton, Campo, Entrada, Esqueleto, Estado, Insignia, Interruptor, Modal, Pestanas, Segmentado, Selector, Tarjeta, TituloPagina, Vacio } from '../components/ui';
import Contador from '../components/Contador';
import { hayCambios, restablecerPreferencias, usePreferencias } from '../utils/preferencias';
import { listarEspacios } from '../api/catalogos';
import { descargarIcs } from '../utils/calendario';
import { ROLES_QUE_RESERVAN, documento, folio, nombreCompleto, nombreEspacio, nombreEvento, nombreTipo } from '../utils/formato';
import { fechaCorta, haceCuanto, horas, hoyIso, lunesDe, sumarDias } from '../utils/fechas';
import { TIPOS_FOTO, prepararFoto } from '../utils/imagen';

// ---------- Tarjeta de presentacion ----------
function pendientes(perfil) {
  const falta = [];
  if (!perfil.fotografiaUrl) falta.push('tu foto');
  if (!perfil.telefono) falta.push('tu teléfono');
  if (!perfil.nombre?.trim()) falta.push('tu nombre');
  if (!perfil.apellidos?.trim()) falta.push('tus apellidos');
  const total = 5; // nombre, apellidos, correo, foto, telefono
  return { falta, porcentaje: Math.round(((total - falta.length) / total) * 100) };
}

function Presentacion({ onMensaje }) {
  const { sesion, perfil, setPerfil } = useAuth();
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  if (!perfil?.email) {
    return (
      <Tarjeta className="p-6 flex items-center gap-5 mb-6">
        <Esqueleto className="size-24 rounded-full" />
        <div className="flex-1 space-y-2">
          <Esqueleto className="h-6 w-48" />
          <Esqueleto className="h-4 w-64" />
          <Esqueleto className="h-2 w-full max-w-sm mt-4" />
        </div>
      </Tarjeta>
    );
  }

  const doc = documento(perfil);
  const { falta, porcentaje } = pendientes(perfil);

  async function trabajar(accion, exito) {
    setSubiendo(true);
    onMensaje(null);
    try {
      setPerfil(await accion());
      onMensaje({ tipo: 'exito', texto: exito });
    } catch (err) {
      onMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setSubiendo(false);
    }
  }

  async function elegido(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    let lista;
    try {
      lista = await prepararFoto(archivo);
    } catch (err) {
      onMensaje({ tipo: 'error', texto: err.message });
      return;
    }
    trabajar(() => subirFoto(perfil.id, lista, sesion.token), 'Tu foto de perfil se actualizó.');
  }

  return (
    <Tarjeta className="p-6 mb-6 aparecer">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative self-center sm:self-auto shrink-0">
          <Avatar perfil={perfil} tamano="size-24" className="text-2xl! ring-4 ring-borde-suave" />
          {subiendo && (
            <span className="absolute inset-0 rounded-full bg-black/45 grid place-items-center">
              <span className="size-7 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            </span>
          )}
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={subiendo}
            title={perfil.fotografiaUrl ? 'Cambiar foto' : 'Subir foto'}
            aria-label={perfil.fotografiaUrl ? 'Cambiar foto' : 'Subir foto'}
            className="absolute -bottom-1 -right-1 size-9 rounded-full bg-marino text-white grid place-items-center ring-4 ring-superficie hover:bg-marino-osc transition-colors disabled:opacity-60"
          >
            <Icono nombre="photo_camera" className="text-[18px]" />
          </button>
          <input ref={entrada} type="file" accept={TIPOS_FOTO.join(',')} className="hidden" onChange={elegido} />
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h2 className="font-titulo text-xl font-semibold text-texto truncate">{nombreCompleto(perfil)}</h2>
            <Insignia tono="info">{nombreTipo(perfil.tipoUsuario)}</Insignia>
          </div>
          <p className="mt-1 text-sm text-texto-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Icono nombre="badge" className="text-[16px] text-tenue" />
              {doc.etiqueta === 'Correo' ? 'Sin documento' : `${doc.etiqueta}: ${doc.valor}`}
            </span>
            <span className="inline-flex items-center gap-1 min-w-0">
              <Icono nombre="mail" className="text-[16px] text-tenue" />
              <span className="truncate">{perfil.email}</span>
            </span>
          </p>
          {perfil.fotografiaUrl && (
            <button
              type="button"
              disabled={subiendo}
              onClick={() => trabajar(() => quitarFoto(perfil.id, sesion.token), 'Se quitó tu foto de perfil.')}
              className="mt-2 text-xs text-texto-2 hover:text-peligro-texto underline-offset-2 hover:underline"
            >
              Quitar foto
            </button>
          )}
        </div>

        <div className="sm:w-56 shrink-0 sm:border-l sm:border-borde sm:pl-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-texto">Tu perfil está al</p>
            <p className={`font-titulo text-lg font-semibold tabular ${porcentaje === 100 ? 'text-exito-texto' : 'text-oro-texto'}`}>{porcentaje}%</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-borde-suave overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${porcentaje === 100 ? 'bg-exito' : 'bg-oro'}`} style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="mt-2 text-xs text-texto-2">{falta.length ? `Te falta ${falta.join(' y ')}.` : '¡Completo! No te falta nada.'}</p>
        </div>
      </div>
    </Tarjeta>
  );
}

// ---------- Mi informacion ----------
function MiInformacion({ mensaje, onMensaje }) {
  const { sesion, perfil, setPerfil } = useAuth();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (perfil?.email) setForm({ nombre: perfil.nombre ?? '', apellidos: perfil.apellidos ?? '', telefono: perfil.telefono ?? '' });
  }, [perfil]);

  if (!perfil?.email || !form) {
    return (
      <Tarjeta className="p-6 space-y-4">
        <Esqueleto className="h-11" />
        <Esqueleto className="h-11" />
        <Esqueleto className="h-11" />
      </Tarjeta>
    );
  }

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const doc = documento(perfil);
  const cambio = form.nombre !== (perfil.nombre ?? '') || form.apellidos !== (perfil.apellidos ?? '') || form.telefono !== (perfil.telefono ?? '');

  async function guardar(e) {
    e.preventDefault();
    const x = {};
    if (!form.nombre.trim()) x.nombre = 'Obligatorio';
    if (!form.apellidos.trim()) x.apellidos = 'Obligatorio';
    if (form.telefono && !/^[0-9]{10,15}$/.test(form.telefono)) x.telefono = 'Solo números, de 10 a 15 dígitos';
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    onMensaje(null);
    try {
      // ms-usuarios pide el perfil completo: lo que no se edita aqui se manda igual
      const nuevo = await actualizarUsuario(
        perfil.id,
        {
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim(),
          numeroControl: perfil.numeroControl ?? null,
          rfc: perfil.rfc ?? null,
          email: perfil.email,
          telefono: form.telefono || null,
          fotografiaUrl: perfil.fotografiaUrl ?? null,
          tipoUsuario: perfil.tipoUsuario,
        },
        sesion.token,
      );
      setPerfil(nuevo);
      onMensaje({ tipo: 'exito', texto: 'Tus datos se guardaron.' });
    } catch (err) {
      onMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] items-start">
      <form onSubmit={guardar}>
        <Tarjeta className="p-6">
          <h2 className="font-titulo text-lg font-semibold text-texto">Datos personales</h2>
          <p className="text-sm text-texto-2 mt-0.5 mb-5">Así te ven los demás en EventoITCH.</p>
          {mensaje && (
            <Aviso tipo={mensaje.tipo} onCerrar={() => onMensaje(null)} className="mb-5">
              {mensaje.texto}
            </Aviso>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" obligatorio error={errores.nombre}>
              <Entrada name="nombre" value={form.nombre} onChange={cambiar} error={errores.nombre} />
            </Campo>
            <Campo etiqueta="Apellidos" obligatorio error={errores.apellidos}>
              <Entrada name="apellidos" value={form.apellidos} onChange={cambiar} error={errores.apellidos} />
            </Campo>
            <Campo etiqueta="Teléfono" error={errores.telefono} ayuda="10 dígitos, sin espacios.">
              <Entrada icono="call" name="telefono" inputMode="numeric" value={form.telefono} onChange={cambiar} error={errores.telefono} />
            </Campo>
            <Campo etiqueta={doc.etiqueta} ayuda="Es tu usuario; solo el administrador lo cambia.">
              <Entrada icono="badge" value={doc.valor} disabled className="bg-lienzo" />
            </Campo>
            <Campo etiqueta="Correo" ayuda="Solo el administrador lo cambia." className="sm:col-span-2">
              <Entrada icono="mail" value={perfil.email} disabled className="bg-lienzo" />
            </Campo>
          </div>
          <div className="flex justify-end mt-6">
            <Boton type="submit" icono="save" cargando={guardando} disabled={!cambio}>
              Guardar cambios
            </Boton>
          </div>
        </Tarjeta>
      </form>

      <Permisos rol={perfil.tipoUsuario} />
    </div>
  );
}

// ---------- Lo que puede hacer cada rol (igual que las reglas de los microservicios) ----------
const ACCIONES = [
  { icono: 'calendar_month', texto: 'Ver la agenda de espacios', roles: null },
  { icono: 'event_available', texto: 'Ver las reservas', roles: null },
  { icono: 'person', texto: 'Editar tu perfil y tu foto', roles: null },
  { icono: 'add_circle', texto: 'Reservar espacios para eventos', roles: ROLES_QUE_RESERVAN },
  { icono: 'edit_calendar', texto: 'Mover y liberar reservas', roles: ROLES_QUE_RESERVAN },
  { icono: 'group', texto: 'Dar de alta y administrar usuarios', roles: ['ADMINISTRADOR'] },
];

function Permisos({ rol }) {
  return (
    <Tarjeta className="p-6">
      <h2 className="font-titulo text-lg font-semibold text-texto">Lo que puedes hacer</h2>
      <p className="text-sm text-texto-2 mt-0.5 mb-4">
        Con el rol <b className="text-texto">{nombreTipo(rol)}</b>.
      </p>
      <ul className="space-y-2.5 escalonado">
        {ACCIONES.map((a) => {
          const si = !a.roles || a.roles.includes(rol);
          return (
            <li key={a.texto} className={`flex items-center gap-3 text-sm ${si ? 'text-texto' : 'text-tenue'}`}>
              <span className={`size-8 shrink-0 rounded-lg grid place-items-center ${si ? 'bg-exito-tinte text-exito-texto' : 'bg-borde-suave text-tenue'}`}>
                <Icono nombre={si ? a.icono : 'lock'} className="text-[18px]" />
              </span>
              <span className={si ? '' : 'line-through decoration-tenue/60'}>{a.texto}</span>
            </li>
          );
        })}
      </ul>
      {!ROLES_QUE_RESERVAN.includes(rol) && <p className="mt-4 text-xs text-texto-2">Para reservar espacios pide al administrador el rol de Organizador.</p>}
    </Tarjeta>
  );
}

// ---------- Preferencias (solo en este navegador) ----------
function Fila({ titulo, texto, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-5 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-texto">{titulo}</p>
        <p className="text-sm text-texto-2 mt-0.5">{texto}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const DURACIONES = [
  { valor: 60, texto: '1 h' },
  { valor: 90, texto: '1 h 30' },
  { valor: 120, texto: '2 h' },
  { valor: 180, texto: '3 h' },
];

function Preferencias() {
  const { sesion } = useAuth();
  const [prefs, cambiar] = usePreferencias();
  const reserva = ROLES_QUE_RESERVAN.includes(sesion.rol);
  const espacios = useDatos(() => (reserva ? listarEspacios(sesion.token) : Promise.resolve({ espacios: [] })), [reserva, sesion.token], `espacios|pref`);
  const lista = espacios.datos?.espacios ?? [];
  const pantallas = [
    { valor: '/panel', texto: 'Inicio' },
    { valor: '/agenda', texto: 'Agenda de espacios' },
    { valor: '/reservas', texto: 'Reservas' },
  ];
  const atajos = ATAJOS.filter((x) => !x.roles || x.roles.includes(sesion.rol));

  return (
    <div className="max-w-3xl space-y-6">
      <Tarjeta className="p-6">
        <h2 className="font-titulo text-lg font-semibold text-texto mb-5">Lectura y vista</h2>
        <div className="divide-y divide-borde-suave">
          <Fila titulo="Tamaño de letra" texto="Agranda textos, botones y tablas en todas las pantallas.">
            <Segmentado
              valor={prefs.letra}
              onChange={(v) => cambiar('letra', v)}
              opciones={[
                { valor: 'normal', texto: 'Normal' },
                { valor: 'grande', texto: 'Grande' },
                { valor: 'muy-grande', texto: 'Muy grande' },
              ]}
            />
          </Fila>
          <Fila titulo="Alto contraste" texto="Textos secundarios y bordes más marcados, para leer mejor con mucha luz o con poca vista.">
            <Interruptor etiqueta="Alto contraste" activo={prefs.contraste === 'alto'} onChange={(v) => cambiar('contraste', v ? 'alto' : 'normal')} />
          </Fila>
          <Fila titulo="Resaltar enlaces y foco" texto="Subraya los enlaces y marca con un borde dorado dónde estás al navegar con la tecla Tab.">
            <Interruptor etiqueta="Resaltar enlaces y foco" activo={prefs.foco === 'resaltado'} onChange={(v) => cambiar('foco', v ? 'resaltado' : 'normal')} />
          </Fila>
          <Fila titulo="Reducir animaciones" texto="Quita los efectos de carga y las transiciones; las pantallas aparecen de golpe.">
            <Interruptor etiqueta="Reducir animaciones" activo={prefs.movimiento === 'reducido'} onChange={(v) => cambiar('movimiento', v ? 'reducido' : 'normal')} />
          </Fila>
        </div>
      </Tarjeta>

      <Tarjeta className="p-6">
        <h2 className="font-titulo text-lg font-semibold text-texto mb-5">Al usar EventoITCH</h2>
        <div className="divide-y divide-borde-suave">
          <Fila titulo="Pantalla al entrar" texto="La que se abre después de iniciar sesión.">
            <Selector value={prefs.inicio} onChange={(e) => cambiar('inicio', e.target.value)} className="sm:w-56">
              {pantallas.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.texto}
                </option>
              ))}
            </Selector>
          </Fila>
          <Fila titulo="Atajos de teclado" texto="Muévete sin el ratón. Presiona ? en cualquier pantalla para ver la lista.">
            <Interruptor etiqueta="Atajos de teclado" activo={prefs.atajos} onChange={(v) => cambiar('atajos', v)} />
          </Fila>
        </div>
        {prefs.atajos && (
          <div className="mt-4 flex flex-wrap gap-2">
            {atajos.map((x) => (
              <span key={x.tecla} className="inline-flex items-center gap-2 rounded-lg border border-borde bg-lienzo px-2.5 py-1 text-xs text-texto-2">
                <kbd className="min-w-5 h-5 px-1 grid place-items-center rounded border border-borde bg-superficie font-mono text-[11px] font-semibold text-texto">{x.tecla}</kbd>
                {x.texto}
              </span>
            ))}
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="p-6">
        <h2 className="font-titulo text-lg font-semibold text-texto mb-5">Agenda y reservas</h2>
        <div className="divide-y divide-borde-suave">
          <Fila titulo="Vista de la agenda" texto="Automática: un día en celular y la semana en computadora.">
            <Segmentado
              valor={prefs.vistaAgenda}
              onChange={(v) => cambiar('vistaAgenda', v)}
              opciones={[
                { valor: 'auto', texto: 'Automática' },
                { valor: 'semana', texto: 'Semana' },
                { valor: 'dia', texto: 'Día' },
              ]}
            />
          </Fila>
          <Fila titulo="Mostrar reservas liberadas en la agenda" texto="Si lo apagas, la agenda solo enseña los espacios ocupados.">
            <Interruptor etiqueta="Mostrar reservas liberadas" activo={prefs.liberadasAgenda} onChange={(v) => cambiar('liberadasAgenda', v)} />
          </Fila>
          <Fila titulo="Periodo de la lista de reservas" texto="El que aparece elegido al abrir Reservas.">
            <Selector value={prefs.rangoReservas} onChange={(e) => cambiar('rangoReservas', e.target.value)} className="sm:w-56">
              <option value="semana">Esta semana</option>
              <option value="dos">Próximas 2 semanas</option>
              <option value="mes">Próximos 30 días</option>
              <option value="pasada">Semana pasada</option>
            </Selector>
          </Fila>
          {reserva && (
            <>
              <Fila titulo="Duración de una reserva nueva" texto="La hora de fin se propone sola con esta duración.">
                <Segmentado valor={Number(prefs.duracion)} onChange={(v) => cambiar('duracion', v)} opciones={DURACIONES} />
              </Fila>
              <Fila titulo="Espacio favorito" texto="Queda elegido al abrir Nueva reserva; puedes cambiarlo ahí mismo.">
                <Selector value={prefs.espacioFavorito ?? ''} onChange={(e) => cambiar('espacioFavorito', e.target.value ? Number(e.target.value) : null)} className="sm:w-56">
                  <option value="">Ninguno</option>
                  {lista.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </Selector>
              </Fila>
              <Fila titulo="Recordar el último evento" texto="Nueva reserva empieza con el evento que usaste la vez pasada.">
                <Interruptor
                  etiqueta="Recordar el último evento"
                  activo={prefs.recordarEvento}
                  onChange={(v) => {
                    cambiar('recordarEvento', v);
                    if (!v) cambiar('ultimoEvento', null);
                  }}
                />
              </Fila>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-borde">
          <p className="text-xs text-texto-2">Todo se guarda solo en este navegador.</p>
          <Boton variante="fantasma" tamano="sm" icono="restart_alt" disabled={!hayCambios(prefs)} onClick={restablecerPreferencias}>
            Restablecer todo
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

// ---------- Seguridad ----------
function fuerza(clave) {
  if (!clave) return null;
  let p = 0;
  if (clave.length >= 8) p++;
  if (clave.length >= 12) p++;
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) p++;
  if (/[0-9]/.test(clave)) p++;
  if (/[^A-Za-z0-9]/.test(clave)) p++;
  if (clave.length < 8) p = Math.min(p, 1);
  if (p <= 1) return { nivel: 1, texto: 'Débil', color: 'bg-peligro', tono: 'text-peligro-texto' };
  if (p <= 2) return { nivel: 2, texto: 'Regular', color: 'bg-aviso', tono: 'text-aviso-texto' };
  if (p <= 3) return { nivel: 3, texto: 'Buena', color: 'bg-info', tono: 'text-info-texto' };
  return { nivel: 4, texto: 'Fuerte', color: 'bg-exito', tono: 'text-exito-texto' };
}

function Medidor({ clave }) {
  const f = fuerza(clave);
  const consejos = [
    [clave.length >= 8, '8 caracteres o más'],
    [/[a-z]/.test(clave) && /[A-Z]/.test(clave), 'mayúsculas y minúsculas'],
    [/[0-9]/.test(clave), 'un número'],
    [/[^A-Za-z0-9]/.test(clave), 'un símbolo'],
  ];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${f && n <= f.nivel ? f.color : 'bg-borde-suave'}`} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {f && <span className={`font-semibold ${f.tono}`}>{f.texto}</span>}
        {consejos.map(([ok, t]) => (
          <span key={t} className={`inline-flex items-center gap-0.5 ${ok ? 'text-exito-texto' : 'text-tenue'}`}>
            <Icono nombre={ok ? 'check' : 'remove'} className="text-[14px]" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Seguridad() {
  const { sesion } = useAuth();
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [errores, setErrores] = useState({});
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    const x = {};
    if (!form.actual) x.actual = 'Obligatoria';
    if (form.nueva.length < 8) x.nueva = 'Mínimo 8 caracteres';
    if (form.nueva && form.nueva === form.actual) x.nueva = 'Debe ser distinta a la actual';
    if (form.confirmar !== form.nueva) x.confirmar = 'Las contraseñas no coinciden';
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    setMensaje(null);
    try {
      await cambiarPassword(form.actual, form.nueva, sesion.token);
      setForm({ actual: '', nueva: '', confirmar: '' });
      setMensaje({ tipo: 'exito', texto: 'Tu contraseña se cambió.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.status === 400 ? 'La contraseña actual no coincide.' : err.message });
    } finally {
      setGuardando(false);
    }
  }

  const ojo = (
    <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'} className="text-tenue hover:text-texto-2">
      <Icono nombre={ver ? 'visibility_off' : 'visibility'} className="text-[18px]" />
    </button>
  );

  return (
    <div className="max-w-2xl">
      <form onSubmit={guardar}>
        <Tarjeta className="p-6">
          <h2 className="font-titulo text-lg font-semibold text-texto">Cambiar contraseña</h2>
          <p className="text-sm text-texto-2 mt-0.5 mb-5">Usa al menos 8 caracteres; mientras más variada, mejor.</p>
          {mensaje && (
            <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)} className="mb-5">
              {mensaje.texto}
            </Aviso>
          )}
          <div className="space-y-4">
            <Campo etiqueta="Contraseña actual" obligatorio error={errores.actual}>
              <Entrada icono="lock" name="actual" type={ver ? 'text' : 'password'} autoComplete="current-password" value={form.actual} onChange={cambiar} error={errores.actual} derecha={ojo} />
            </Campo>
            <Campo etiqueta="Nueva contraseña" obligatorio error={errores.nueva}>
              <Entrada icono="key" name="nueva" type={ver ? 'text' : 'password'} autoComplete="new-password" value={form.nueva} onChange={cambiar} error={errores.nueva} />
              {form.nueva && <Medidor clave={form.nueva} />}
            </Campo>
            <Campo etiqueta="Confirmar nueva contraseña" obligatorio error={errores.confirmar}>
              <Entrada icono="lock_reset" name="confirmar" type={ver ? 'text' : 'password'} autoComplete="new-password" value={form.confirmar} onChange={cambiar} error={errores.confirmar} />
            </Campo>
          </div>
          <div className="flex justify-end mt-6">
            <Boton type="submit" icono="key" cargando={guardando}>
              Cambiar contraseña
            </Boton>
          </div>
        </Tarjeta>
      </form>

      <ActividadReciente />
    </div>
  );
}

// ---------- Actividad reciente (GET /auth/accesos) ----------
const RESULTADOS = {
  EXITOSO: { texto: 'Inicio de sesión', tono: 'exito', icono: 'login' },
  PASSWORD_INCORRECTA: { texto: 'Contraseña incorrecta', tono: 'aviso', icono: 'password' },
  CUENTA_BLOQUEADA: { texto: 'Cuenta bloqueada', tono: 'peligro', icono: 'lock' },
  CUENTA_INACTIVA: { texto: 'Cuenta inactiva', tono: 'neutro', icono: 'person_off' },
};

const fechaHora = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

function ActividadReciente() {
  const { sesion } = useAuth();
  const datos = useDatos(() => misAccesos(sesion.token, 15), [sesion.token], `accesos|${sesion.usuarioId}`);
  const accesos = datos.datos;
  const fallidos = accesos?.filter((a) => a.resultado !== 'EXITOSO').length ?? 0;

  return (
    <Tarjeta className="p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-titulo text-lg font-semibold text-texto">Actividad reciente</h2>
          <p className="text-sm text-texto-2 mt-0.5">Los últimos intentos de entrar a tu cuenta. Si ves algo que no fuiste tú, cambia tu contraseña.</p>
        </div>
        <Boton variante="secundario" tamano="sm" icono="refresh" onClick={datos.recargar} cargando={datos.cargando && !!accesos}>
          Actualizar
        </Boton>
      </div>

      {fallidos > 0 && (
        <Aviso tipo="aviso" className="mb-4">
          Hay {fallidos} {fallidos === 1 ? 'intento fallido' : 'intentos fallidos'} en esta lista. Tras 5 seguidos, la cuenta se bloquea 15 minutos y te llega un correo.
        </Aviso>
      )}

      {!accesos && datos.cargando && (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <Esqueleto key={n} className="h-12 w-full rounded-lg" style={{ animationDelay: `${n * 120}ms` }} />
          ))}
        </div>
      )}
      {!accesos && datos.error && (
        <Aviso tipo="error">No se pudo cargar tu actividad: {datos.error.message}</Aviso>
      )}
      {accesos?.length === 0 && (
        <Vacio icono="history" titulo="Sin actividad todavía">
          Aquí aparecerán tus inicios de sesión.
        </Vacio>
      )}
      {accesos?.length > 0 && (
        <ul className="divide-y divide-borde-suave -mx-2">
          {accesos.map((a, i) => {
            const r = RESULTADOS[a.resultado] ?? { texto: a.resultado, tono: 'neutro', icono: 'help' };
            return (
              <li key={`${a.fecha}-${i}`} className="flex items-center gap-3 px-2 py-3">
                <span className="size-9 shrink-0 rounded-full bg-borde-suave text-texto-2 grid place-items-center">
                  <Icono nombre={r.icono} className="text-[18px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto truncate">{a.dispositivo}</p>
                  <p className="text-xs text-texto-2 truncate">
                    {fechaHora.format(new Date(a.fecha))} · {haceCuanto(a.fecha)}
                    {a.ip ? ` · IP ${a.ip}` : ''}
                  </p>
                </div>
                <Insignia tono={r.tono}>{r.texto}</Insignia>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

// ---------- Mis reservas ----------
// Numeros rapidos de las reservas propias que vienen
function Resumen({ reservas, espacios }) {
  const hoy = hoyIso();
  const finSemana = sumarDias(lunesDe(hoy), 6);
  const semana = reservas.filter((r) => r.fecha <= finSemana).length;
  const total = reservas.reduce((t, r) => t + horas(r.horaInicio.slice(0, 5), r.horaFin.slice(0, 5)), 0);
  const cuenta = new Map();
  reservas.forEach((r) => cuenta.set(r.espacioId, (cuenta.get(r.espacioId) ?? 0) + 1));
  const [favorito] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const proxima = reservas[0];
  const datos = [
    { icono: 'event_upcoming', titulo: 'Próximas', valor: <Contador valor={reservas.length} />, nota: 'de hoy en adelante' },
    { icono: 'date_range', titulo: 'Esta semana', valor: <Contador valor={semana} />, nota: `hasta el ${fechaCorta(finSemana)}` },
    { icono: 'schedule', titulo: 'Horas reservadas', valor: <Contador valor={Math.round(total * 10) / 10} />, nota: 'en total' },
    { icono: 'meeting_room', titulo: 'Tu espacio más usado', valor: nombreEspacio(espacios, favorito), nota: `${cuenta.get(favorito)} de ${reservas.length}`, texto: true },
  ];
  return (
    <>
      {proxima && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-oro-borde bg-oro-tinte px-4 py-3 text-sm aparecer">
          <Icono nombre="notifications_active" className="text-[20px] text-oro-texto" />
          <p className="text-texto">
            Tu próxima reserva es <b>{proxima.fecha === hoy ? 'hoy' : fechaCorta(proxima.fecha)}</b> a las <b>{proxima.horaInicio.slice(0, 5)}</b> en{' '}
            <b>{nombreEspacio(espacios, proxima.espacioId)}</b>.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 escalonado">
        {datos.map((x) => (
          <Tarjeta key={x.titulo} className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-texto-2">
              <Icono nombre={x.icono} className="text-[16px] text-tenue" />
              {x.titulo}
            </p>
            <p className={`mt-1 font-titulo font-semibold text-texto truncate ${x.texto ? 'text-base' : 'text-2xl tabular'}`}>{x.valor}</p>
            <p className="text-[11px] text-tenue">{x.nota}</p>
          </Tarjeta>
        ))}
      </div>
    </>
  );
}

function MisReservas() {
  const { sesion } = useAuth();
  const { abrir } = useNuevaReserva();
  const [confirmar, setConfirmar] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const datos = useDatos(
    async () => {
      const [reservas, catalogos] = await Promise.all([buscarMias(hoyIso(), sesion.token), cargarCatalogos(sesion.token)]);
      return { reservas: reservas.filter((r) => r.estado !== 'LIBERADA'), ...catalogos };
    },
    [sesion.token],
    `mias|${sesion.usuarioId}`,
  );
  useRecargaAlCrear(datos.recargar);
  const d = datos.datos;
  const [copiado, setCopiado] = useState(null);

  async function copiarFolio(r) {
    try {
      await navigator.clipboard.writeText(folio(r));
      setCopiado(r.id);
      setTimeout(() => setCopiado((c) => (c === r.id ? null : c)), 1500);
    } catch {
      // sin portapapeles (http sin permiso): no pasa nada
    }
  }

  async function liberar() {
    setTrabajando(true);
    try {
      await liberarReserva(confirmar.id, sesion.token);
      setMensaje({ tipo: 'exito', texto: `Se liberó la reserva ${folio(confirmar)}.` });
      datos.recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-titulo text-lg font-semibold text-texto">Mis reservas</h2>
          <p className="text-sm text-texto-2">Las que tú hiciste, de hoy en adelante.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d?.reservas.length > 0 && (
            <Boton variante="secundario" tamano="sm" icono="download" onClick={() => descargarIcs(d.reservas, d.espacios, d.eventos, 'mis-reservas-eventoitch.ics')}>
              Descargar todas al calendario
            </Boton>
          )}
          <Boton variante="secundario" tamano="sm" icono="add" onClick={() => abrir()}>
            Nueva reserva
          </Boton>
        </div>
      </div>

      {d?.reservas.length > 0 && <Resumen reservas={d.reservas} espacios={d.espacios} />}

      {mensaje && (
        <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)} className="mb-4">
          {mensaje.texto}
        </Aviso>
      )}

      <Tarjeta className="overflow-hidden">
        {!d && datos.cargando && (
          <ul className="divide-y divide-borde-suave">
            {[0, 1, 2].map((n) => (
              <li key={n} className="flex items-center gap-4 px-5 py-4">
                <Esqueleto className="size-12 rounded-lg" style={{ animationDelay: `${n * 120}ms` }} />
                <div className="flex-1 space-y-2">
                  <Esqueleto className="h-4 w-1/2" style={{ animationDelay: `${n * 120}ms` }} />
                  <Esqueleto className="h-3 w-1/3" style={{ animationDelay: `${n * 120}ms` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {!d && datos.error && (
          <div className="p-6">
            <Aviso tipo="error" titulo="No se pudieron cargar tus reservas">
              {datos.error.status === 404 || datos.error.status === 400 ? 'ms-agenda todavía no tiene la consulta de "mis reservas"; reinícialo para que la tome.' : datos.error.message}
            </Aviso>
          </div>
        )}
        {d && d.reservas.length === 0 && (
          <Vacio icono="event_available" titulo="No tienes reservas próximas">
            Cuando reserves un espacio para un evento aparecerá aquí.
          </Vacio>
        )}
        {d && d.reservas.length > 0 && (
          <ul className="divide-y divide-borde-suave escalonado">
            {d.reservas.map((r) => {
              const [anio, mes, dia] = r.fecha.split('-');
              const mesTxt = new Date(+anio, +mes - 1, +dia).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
              return (
                <li key={r.id} className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-5 py-4 hover:bg-borde-suave/60 transition-colors">
                  <div className="size-12 shrink-0 rounded-lg bg-oro-tinte text-oro-texto border border-oro-borde grid place-items-center leading-none text-center">
                    <span>
                      <span className="block font-titulo text-lg font-semibold">{dia}</span>
                      <span className="block text-[10px] uppercase tracking-wide">{mesTxt}</span>
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-texto">{nombreEvento(d.eventos, r.eventoId)}</p>
                    <p className="truncate text-xs text-texto-2">
                      {fechaCorta(r.fecha)} · {r.horaInicio?.slice(0, 5)} a {r.horaFin?.slice(0, 5)} · {nombreEspacio(d.espacios, r.espacioId)}
                    </p>
                    <button type="button" onClick={() => copiarFolio(r)} title="Copiar folio" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-tenue hover:text-texto-2 tabular">
                      {folio(r)}
                      <Icono nombre={copiado === r.id ? 'check' : 'content_copy'} className={`text-[13px] ${copiado === r.id ? 'text-exito-texto' : ''}`} />
                      {copiado === r.id && <span className="text-exito-texto">Copiado</span>}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Estado valor={r.estado} />
                    <button
                      type="button"
                      onClick={() => descargarIcs([r], d.espacios, d.eventos, `${folio(r)}.ics`)}
                      title="Agregar a mi calendario"
                      aria-label="Agregar a mi calendario"
                      className="size-8 rounded-lg border border-borde grid place-items-center text-texto-2 hover:text-texto hover:bg-borde-suave"
                    >
                      <Icono nombre="calendar_add_on" className="text-[18px]" />
                    </button>
                    <Boton variante="secundario" tamano="sm" icono="edit_calendar" onClick={() => abrir(r)}>
                      Mover
                    </Boton>
                    <Boton variante="peligro" tamano="sm" icono="event_busy" onClick={() => setConfirmar(r)}>
                      Liberar
                    </Boton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <Modal abierto={!!confirmar} onCerrar={() => !trabajando && setConfirmar(null)}>
        {confirmar && (
          <div className="p-6">
            <span className="size-12 rounded-full bg-peligro-tinte text-peligro grid place-items-center mb-4">
              <Icono nombre="event_busy" className="text-[24px]" />
            </span>
            <h2 className="font-titulo text-lg font-semibold text-texto">¿Liberar {folio(confirmar)}?</h2>
            <p className="text-sm text-texto-2 mt-1">
              El espacio queda libre el {fechaCorta(confirmar.fecha)} de {confirmar.horaInicio?.slice(0, 5)} a {confirmar.horaFin?.slice(0, 5)}. Esto no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Boton variante="secundario" onClick={() => setConfirmar(null)} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton variante="peligro" cargando={trabajando} onClick={liberar}>
                Liberar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

export default function Perfil() {
  const { sesion } = useAuth();
  const [pestana, setPestana] = useState('info');
  const [mensaje, setMensaje] = useState(null);
  const reserva = ROLES_QUE_RESERVAN.includes(sesion?.rol);
  return (
    <>
      <TituloPagina titulo="Mi perfil" subtitulo={reserva ? 'Tus datos, tus preferencias, tu seguridad y tus reservas.' : 'Tus datos, tus preferencias y tu seguridad.'} />
      <Presentacion onMensaje={setMensaje} />
      <div className="mb-6">
        <Pestanas
          valor={pestana}
          onChange={setPestana}
          opciones={[
            { valor: 'info', texto: 'Mi información' },
            { valor: 'preferencias', texto: 'Preferencias' },
            { valor: 'seguridad', texto: 'Seguridad' },
          ]}
        />
      </div>
      <div key={pestana} className="aparecer">
        {pestana === 'info' && <MiInformacion mensaje={mensaje} onMensaje={setMensaje} />}
        {pestana === 'preferencias' && <Preferencias />}
        {pestana === 'seguridad' && <Seguridad />}
      </div>
      {reserva && <MisReservas />}
    </>
  );
}
