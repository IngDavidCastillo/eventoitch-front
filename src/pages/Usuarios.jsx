// Gestion de usuarios (solo ADMINISTRADOR): lista de ms-usuarios por tipo, busqueda,
// activar o desactivar (PATCH /estado) y dar de alta con cualquier rol (POST /auth/admin/registro).
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useDatos from '../hooks/useDatos';
import { cambiarEstado, listarUsuarios, subirFoto } from '../api/usuarios';
import { correoNoEnviado, enviarEnlaceRestablecer, registroAdmin, restablecerPassword } from '../api/auth';
import Icono from '../components/Icono';
import { Aviso, Avatar, Boton, SelectorFoto, Campo, Entrada, Estado, ErrorServicio, EsqueletoTabla, Modal, Panel, Pestanas, Selector, Tarjeta, TituloPagina, Vacio } from '../components/ui';
import { TIPOS, documento, nombreCompleto, nombreTipo, telefono } from '../utils/formato';

const CON_RFC = ['DOCENTE', 'ADMINISTRADOR', 'ORGANIZADOR'];
const VACIO = { tipoUsuario: 'DOCENTE', nombre: '', apellidos: '', numeroControl: '', rfc: '', email: '', telefono: '' };

function NuevoUsuario({ abierto, onCerrar, onCreado }) {
  const { sesion } = useAuth();
  const [form, setForm] = useState(VACIO);
  // Foto elegida (ya recortada); se sube a ms-usuarios despues de crear la cuenta, cuando ya hay id
  const [foto, setFoto] = useState(null);
  const vista = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => vista && URL.revokeObjectURL(vista), [vista]);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const conRfc = CON_RFC.includes(form.tipoUsuario);

  async function guardar() {
    const x = {};
    if (!form.nombre.trim()) x.nombre = 'Obligatorio';
    if (!form.apellidos.trim()) x.apellidos = 'Obligatorio';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) x.email = 'Correo no válido';
    if (form.tipoUsuario === 'ESTUDIANTE' && !form.numeroControl.trim()) x.numeroControl = 'El estudiante necesita número de control';
    if (conRfc && !form.rfc.trim()) x.rfc = 'Este tipo necesita RFC';
    if (form.telefono && !/^[0-9]{10,15}$/.test(form.telefono)) x.telefono = 'Solo números, de 10 a 15 dígitos';
    setErrores(x);
    if (Object.keys(x).length) return;

    setEnviando(true);
    setError(null);
    try {
      const r = await registroAdmin(
        {
          tipoUsuario: form.tipoUsuario,
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim(),
          numeroControl: form.tipoUsuario === 'ESTUDIANTE' ? form.numeroControl.trim() : null,
          rfc: conRfc ? form.rfc.trim().toUpperCase() : null,
          email: form.email.trim(),
          telefono: form.telefono || null,
          // Sin contrasena: ms-autenticacion genera una temporal y la manda por correo con el usuario
          password: null,
        },
        sesion.token,
      );
      // La cuenta ya existe: si falla la foto no se deshace, solo se avisa
      let avisoFoto = null;
      if (foto && r?.usuarioId) {
        try {
          await subirFoto(r.usuarioId, foto, sesion.token);
        } catch (err) {
          avisoFoto = `La cuenta se creó, pero la foto no se pudo guardar: ${err.message}`;
        }
      }
      setForm(VACIO);
      setFoto(null);
      onCreado(form, r, avisoFoto);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const usuario = form.tipoUsuario === 'ESTUDIANTE' ? form.numeroControl : conRfc ? form.rfc.toUpperCase() : form.email;

  return (
    <Panel
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nuevo usuario"
      subtitulo="El administrador puede crear cualquier tipo de cuenta."
      pie={
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="person_add" cargando={enviando} onClick={guardar}>
            Crear usuario
          </Boton>
        </div>
      }
    >
      {error && (
        <Aviso tipo="error" className="mb-4">
          {error}
        </Aviso>
      )}
      <SelectorFoto
        perfil={{ nombre: form.nombre, apellidos: form.apellidos }}
        foto={vista}
        onElegir={async (archivo) => setFoto(archivo)}
        onQuitar={() => setFoto(null)}
        className="mb-6 pb-6 border-b border-borde"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Tipo de usuario" obligatorio className="sm:col-span-2">
          <Selector name="tipoUsuario" value={form.tipoUsuario} onChange={cambiar} className="h-11">
            {Object.entries(TIPOS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Nombre" obligatorio error={errores.nombre}>
          <Entrada name="nombre" value={form.nombre} onChange={cambiar} error={errores.nombre} />
        </Campo>
        <Campo etiqueta="Apellidos" obligatorio error={errores.apellidos}>
          <Entrada name="apellidos" value={form.apellidos} onChange={cambiar} error={errores.apellidos} />
        </Campo>
        {form.tipoUsuario === 'ESTUDIANTE' && (
          <Campo etiqueta="Número de control" obligatorio error={errores.numeroControl} className="sm:col-span-2">
            <Entrada icono="badge" name="numeroControl" value={form.numeroControl} onChange={cambiar} error={errores.numeroControl} />
          </Campo>
        )}
        {conRfc && (
          <Campo etiqueta="RFC" obligatorio error={errores.rfc} className="sm:col-span-2">
            <Entrada icono="badge" name="rfc" maxLength={13} value={form.rfc} onChange={cambiar} error={errores.rfc} className="uppercase" />
          </Campo>
        )}
        <Campo etiqueta="Correo" obligatorio error={errores.email} className="sm:col-span-2">
          <Entrada icono="mail" name="email" type="email" value={form.email} onChange={cambiar} error={errores.email} />
        </Campo>
        <Campo etiqueta="Teléfono" error={errores.telefono} ayuda="Opcional, 10 dígitos.">
          <Entrada icono="call" name="telefono" inputMode="numeric" value={form.telefono} onChange={cambiar} error={errores.telefono} />
        </Campo>
      </div>
      {usuario && (
        <div className="mt-5 rounded-lg bg-oro-tinte border border-oro-borde px-4 py-3 text-sm">
          <p className="etiqueta text-oro">Usuario para iniciar sesión</p>
          <p className="font-mono text-texto mt-0.5">{usuario}</p>
        </div>
      )}
      <p className="mt-4 flex gap-2 text-sm text-texto-2">
        <Icono nombre="mail_lock" className="text-[18px] text-marino" />
        <span>El sistema genera una contraseña temporal y se la manda por correo junto con su usuario. Al entrar por primera vez tendrá que cambiarla.</span>
      </p>
    </Panel>
  );
}

// ---------- Restablecer contrasena (PUT /auth/admin/usuarios/{id}/password) ----------
// Una contrasena temporal facil de dictar: 4 letras + 4 numeros (8 caracteres, el minimo de la API)
function claveTemporal() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const azar = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let c = '';
  for (let i = 0; i < 4; i++) c += letras[azar(letras.length)];
  for (let i = 0; i < 4; i++) c += azar(10);
  return c;
}

// Primero se intenta mandar un enlace por correo (POST .../password/enlace) para que la persona ponga la suya.
// Si el correo no sale (503) o el administrador lo prefiere, se le pone una contrasena temporal (PUT .../password).
function RestablecerPassword({ usuario, onCerrar, onListo, onEnlace }) {
  const { sesion } = useAuth();
  const [modo, setModo] = useState('enlace'); // 'enlace' | 'temporal'
  const [sinCorreo, setSinCorreo] = useState(null);
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setModo('enlace');
      setSinCorreo(null);
      setClave(claveTemporal());
      setError(null);
    }
  }, [usuario]);

  async function mandarEnlace() {
    setGuardando(true);
    setError(null);
    try {
      await enviarEnlaceRestablecer(usuario.id, sesion.token);
      onEnlace(usuario);
    } catch (err) {
      if (err.status === 503) {
        setSinCorreo(err.message);
        setModo('temporal');
      } else {
        setError(err.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  async function guardar() {
    if (clave.length < 8) {
      setError('Mínimo 8 caracteres');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await restablecerPassword(usuario.id, clave, sesion.token);
      onListo(usuario, clave);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto={!!usuario} onCerrar={() => !guardando && onCerrar()}>
      {usuario && (
        <div className="p-6">
          <span className="size-12 rounded-full grid place-items-center mb-4 bg-aviso-tinte text-aviso-texto">
            <Icono nombre="key" className="text-[24px]" />
          </span>
          <h2 className="font-titulo text-lg font-semibold text-texto">Restablecer la contraseña de {nombreCompleto(usuario)}</h2>
          {modo === 'enlace' ? (
            <>
              <p className="text-sm text-texto-2 mt-1 mb-5">
                Le llegará un correo con un enlace para que ponga una contraseña suya (vence en 15 minutos y sirve una sola vez). Mientras no lo use, su contraseña actual sigue igual.
              </p>
              {error && (
                <Aviso tipo="error" className="mb-4">
                  {error}
                </Aviso>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-6">
                <button type="button" onClick={() => setModo('temporal')} className="text-xs font-medium text-marino hover:underline" disabled={guardando}>
                  Mejor ponerle una contraseña temporal
                </button>
                <div className="flex gap-2">
                  <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
                    Cancelar
                  </Boton>
                  <Boton icono="forward_to_inbox" cargando={guardando} onClick={mandarEnlace}>
                    Enviar enlace
                  </Boton>
                </div>
              </div>
            </>
          ) : (
          <>
          {sinCorreo && (
            <Aviso tipo="aviso" titulo="No se pudo mandar el correo" className="mt-3">
              {sinCorreo}
            </Aviso>
          )}
          <p className="text-sm text-texto-2 mt-1 mb-5">
            Se cerrará la sesión que tenga abierta, se le quitará el bloqueo por intentos fallidos y le llegará un correo de aviso. Es una contraseña temporal: dásela en persona y, al iniciar sesión, el sistema le pedirá poner una suya antes de entrar.
          </p>
          <Campo etiqueta="Contraseña nueva" obligatorio error={error}>
            <Entrada
              icono="lock_reset"
              type={ver ? 'text' : 'password'}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              error={error}
              className="font-mono"
              derecha={
                <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'} className="text-tenue hover:text-texto-2">
                  <Icono nombre={ver ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              }
            />
          </Campo>
          <button type="button" onClick={() => setClave(claveTemporal())} className="mt-2 text-xs font-medium text-marino hover:underline">
            Generar otra
          </button>
          <div className="flex justify-end gap-2 mt-6">
            <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton icono="key" cargando={guardando} onClick={guardar}>
              Restablecer
            </Boton>
          </div>
          </>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Usuarios() {
  const { sesion } = useAuth();
  const datos = useDatos(() => listarUsuarios({}, sesion.token), [sesion.token]);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [texto, setTexto] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [restablecer, setRestablecer] = useState(null);

  const todos = useMemo(() => datos.datos ?? [], [datos.datos]);
  const cuentas = useMemo(() => {
    const c = {};
    todos.forEach((u) => (c[u.tipoUsuario] = (c[u.tipoUsuario] ?? 0) + 1));
    return c;
  }, [todos]);

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return todos.filter(
      (u) =>
        (!tipo || u.tipoUsuario === tipo) &&
        (!estado || u.estado === estado) &&
        (!t || [nombreCompleto(u), u.email, u.numeroControl, u.rfc].some((v) => v?.toLowerCase().includes(t))),
    );
  }, [todos, tipo, estado, texto]);

  async function alternar() {
    const u = confirmar;
    const destino = u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    setTrabajando(true);
    try {
      await cambiarEstado(u.id, destino, sesion.token);
      setMensaje({ tipo: 'exito', texto: `${nombreCompleto(u)} quedó ${destino === 'ACTIVO' ? 'activo' : 'inactivo'}.` });
      datos.recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  }

  const activos = todos.filter((u) => u.estado === 'ACTIVO').length;

  return (
    <>
      <TituloPagina titulo="Usuarios" subtitulo={datos.datos ? `${todos.length} registrados · ${activos} activos` : 'Cuentas del sistema'}>
        <Boton icono="person_add" onClick={() => setNuevo(true)}>
          Nuevo usuario
        </Boton>
      </TituloPagina>

      {mensaje && (
        <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)} className="mb-4">
          {mensaje.texto}
        </Aviso>
      )}

      <div className="mb-4">
        <Pestanas
          valor={tipo}
          onChange={setTipo}
          opciones={[{ valor: '', texto: 'Todos', cuenta: datos.datos ? todos.length : null }, ...Object.entries(TIPOS).map(([v, t]) => ({ valor: v, texto: t, cuenta: datos.datos ? cuentas[v] ?? 0 : null }))]}
        />
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="flex flex-wrap gap-3 p-4 border-b border-borde">
          <Entrada icono="search" placeholder="Buscar por nombre, correo, número de control o RFC" value={texto} onChange={(e) => setTexto(e.target.value)} className="h-10 flex-1 min-w-[220px]" />
          <Selector value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado" className="w-44">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </Selector>
        </div>

        {datos.error && !datos.datos ? (
          <ErrorServicio servicio="El servicio de usuarios" mensaje={datos.error.message} onReintentar={datos.recargar} />
        ) : !datos.datos ? (
          <EsqueletoTabla filas={6} columnas={5} />
        ) : lista.length === 0 ? (
          <Vacio icono="group_off" titulo="No hay usuarios con estos filtros" />
        ) : (
          <div className="overflow-x-auto scroll-fino">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="etiqueta text-texto-2 bg-lienzo">
                  <th className="px-5 py-2.5 font-semibold">Usuario</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 font-semibold">Identificación</th>
                  <th className="px-3 py-2.5 font-semibold">Teléfono</th>
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="escalonado">
                {lista.map((u) => {
                  const doc = documento(u);
                  const yo = u.id === sesion.usuarioId;
                  return (
                    <tr key={u.id} className="border-t border-borde-suave hover:bg-lienzo">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar perfil={u} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-texto truncate">
                              {nombreCompleto(u)} {yo && <span className="text-xs text-texto-2">(tú)</span>}
                            </p>
                            <p className="text-xs text-texto-2 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-texto">{nombreTipo(u.tipoUsuario)}</td>
                      <td className="px-3 py-3">
                        <p className="text-[11px] text-texto-2">{doc.etiqueta}</p>
                        <p className="font-mono text-xs text-texto">{doc.valor}</p>
                      </td>
                      <td className="px-3 py-3 text-sm text-texto-2 tabular whitespace-nowrap">{telefono(u.telefono)}</td>
                      <td className="px-3 py-3">
                        <Estado valor={u.estado} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!yo && (
                          <div className="flex justify-end gap-1">
                            <Boton variante="fantasma" tamano="sm" icono="key" onClick={() => setRestablecer(u)} title="Restablecer contraseña">
                              Contraseña
                            </Boton>
                            <Boton variante={u.estado === 'ACTIVO' ? 'fantasma' : 'secundario'} tamano="sm" icono={u.estado === 'ACTIVO' ? 'person_off' : 'person_check'} onClick={() => setConfirmar(u)}>
                              {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                            </Boton>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <NuevoUsuario
        abierto={nuevo}
        onCerrar={() => setNuevo(false)}
        onCreado={(f, r, avisoFoto) => {
          setNuevo(false);
          const avisoCorreo = r?.avisoCorreo;
          // Correo con usuario y contrasena temporal; si no salio, el administrador se la da en persona
          const credenciales = r?.credencialesEnviadas
            ? 'Le enviamos por correo su usuario y una contraseña temporal.'
            : r?.passwordTemporal
              ? `No se pudo mandar el correo con sus datos: dale en persona su contraseña temporal ${r.passwordTemporal} (al entrar tendrá que cambiarla).`
              : null;
          setMensaje({
            tipo: avisoFoto || correoNoEnviado(avisoCorreo) || r?.credencialesEnviadas === false ? 'aviso' : 'exito',
            texto: [`Se creó la cuenta de ${f.nombre} ${f.apellidos}.`, credenciales, avisoCorreo && `${avisoCorreo}.`, avisoFoto].filter(Boolean).join(' '),
          });
          datos.recargar();
        }}
      />

      <RestablecerPassword
        usuario={restablecer}
        onCerrar={() => setRestablecer(null)}
        onListo={(u, clave) => {
          setRestablecer(null);
          setMensaje({ tipo: 'exito', texto: `Se restableció la contraseña de ${nombreCompleto(u)}. La temporal es ${clave}; dásela en persona. Al entrar tendrá que cambiarla. Su sesión abierta se cerró.` });
        }}
        onEnlace={(u) => {
          setRestablecer(null);
          setMensaje({ tipo: 'exito', texto: `Le enviamos a ${nombreCompleto(u)} un enlace por correo para que ponga su contraseña (vence en 15 minutos).` });
        }}
      />

      <Modal abierto={!!confirmar} onCerrar={() => !trabajando && setConfirmar(null)}>
        {confirmar && (
          <div className="p-6">
            <span className={`size-12 rounded-full grid place-items-center mb-4 ${confirmar.estado === 'ACTIVO' ? 'bg-peligro-tinte text-peligro' : 'bg-exito-tinte text-exito'}`}>
              <Icono nombre={confirmar.estado === 'ACTIVO' ? 'person_off' : 'person_check'} className="text-[24px]" />
            </span>
            <h2 className="font-titulo text-lg font-semibold text-texto">
              {confirmar.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'} a {nombreCompleto(confirmar)}
            </h2>
            <p className="text-sm text-texto-2 mt-1">
              {confirmar.estado === 'ACTIVO' ? 'Ya no podrá iniciar sesión hasta que lo vuelvas a activar.' : 'Podrá volver a iniciar sesión.'}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Boton variante="secundario" onClick={() => setConfirmar(null)} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton variante={confirmar.estado === 'ACTIVO' ? 'peligro' : 'primario'} cargando={trabajando} onClick={alternar}>
                {confirmar.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
