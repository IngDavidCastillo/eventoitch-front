// Mi perfil: datos personales (PUT /usuarios/{id} con el perfil completo),
// cambio de contrasena (PUT /auth/password) y datos de la sesion actual.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { actualizarUsuario, quitarFoto, subirFoto } from '../api/usuarios';
import { cambiarPassword } from '../api/auth';
import Icono from '../components/Icono';
import { SelectorTema } from '../components/BotonTema';
import { Aviso, Boton, SelectorFoto, Campo, Entrada, Esqueleto, Estado, Pestanas, Tarjeta, TituloPagina } from '../components/ui';
import { documento, dispositivo, nombreCompleto, nombreTipo } from '../utils/formato';

function Datos() {
  const { sesion, perfil, setPerfil } = useAuth();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (perfil?.email) setForm({ nombre: perfil.nombre ?? '', apellidos: perfil.apellidos ?? '', telefono: perfil.telefono ?? '' });
  }, [perfil]);

  if (!perfil?.email || !form) {
    return (
      <Tarjeta className="p-6 space-y-4">
        <Esqueleto className="h-16 w-16 rounded-full" />
        <Esqueleto className="h-11" />
        <Esqueleto className="h-11" />
      </Tarjeta>
    );
  }

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const doc = documento(perfil);
  const cambio = form.nombre !== (perfil.nombre ?? '') || form.apellidos !== (perfil.apellidos ?? '') || form.telefono !== (perfil.telefono ?? '');

  // La foto se guarda al momento en ms-usuarios (carpeta C:/EventoITCH/fotos), sin esperar a "Guardar cambios"
  async function cambiarFoto(archivo) {
    setSubiendo(true);
    setMensaje(null);
    try {
      setPerfil(await subirFoto(perfil.id, archivo, sesion.token));
      setMensaje({ tipo: 'exito', texto: 'Tu foto de perfil se actualizó.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setSubiendo(false);
    }
  }

  async function borrarFoto() {
    setSubiendo(true);
    setMensaje(null);
    try {
      setPerfil(await quitarFoto(perfil.id, sesion.token));
      setMensaje({ tipo: 'exito', texto: 'Se quitó tu foto de perfil.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    const x = {};
    if (!form.nombre.trim()) x.nombre = 'Obligatorio';
    if (!form.apellidos.trim()) x.apellidos = 'Obligatorio';
    if (form.telefono && !/^[0-9]{10,15}$/.test(form.telefono)) x.telefono = 'Solo números, de 10 a 15 dígitos';
    setErrores(x);
    if (Object.keys(x).length) return;
    setGuardando(true);
    setMensaje(null);
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
      setMensaje({ tipo: 'exito', texto: 'Tus datos se guardaron.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <Tarjeta className="p-6">
        <div className="flex flex-wrap items-center gap-6 pb-6 mb-6 border-b border-borde">
          <SelectorFoto perfil={perfil} cargando={subiendo} onElegir={cambiarFoto} onQuitar={borrarFoto} />
          <div className="flex-1 min-w-0 sm:border-l sm:border-borde sm:pl-6">
            <p className="font-titulo text-lg font-semibold text-texto">{nombreCompleto(perfil)}</p>
            <p className="text-sm text-texto-2">
              {nombreTipo(perfil.tipoUsuario)} · {perfil.email}
            </p>
          </div>
        </div>
        {mensaje && (
          <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)} className="mb-5">
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
          <Campo etiqueta={doc.etiqueta} ayuda="Es tu usuario; solo el administrador lo cambia.">
            <Entrada icono="badge" value={doc.valor} disabled className="bg-lienzo" />
          </Campo>
          <Campo etiqueta="Correo" ayuda="Solo el administrador lo cambia.">
            <Entrada icono="mail" value={perfil.email} disabled className="bg-lienzo" />
          </Campo>
          <Campo etiqueta="Teléfono" error={errores.telefono} ayuda="10 dígitos, sin espacios.">
            <Entrada icono="call" name="telefono" inputMode="numeric" value={form.telefono} onChange={cambiar} error={errores.telefono} />
          </Campo>
        </div>
        <div className="flex justify-end mt-6">
          <Boton type="submit" icono="save" cargando={guardando} disabled={!cambio}>
            Guardar cambios
          </Boton>
        </div>
      </Tarjeta>
    </form>
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
    <form onSubmit={guardar}>
      <Tarjeta className="p-6 max-w-xl">
        <h2 className="font-titulo text-lg font-semibold text-texto">Cambiar contraseña</h2>
        <p className="text-sm text-texto-2 mt-0.5 mb-5">Usa al menos 8 caracteres.</p>
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
  );
}

function SesionActual() {
  const { sesion, perfil, inactividad, cerrarSesion } = useAuth();
  const [, setAhora] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAhora((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const restante = Math.max(0, Math.round((inactividad.ultima + inactividad.minutos * 60000 - Date.now()) / 60000));
  const filas = [
    ['Dispositivo', dispositivo()],
    ['Rol', nombreTipo(sesion.rol)],
    ['Inicio de sesión', new Date(sesion.iniciadaEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })],
    ['El token vence', new Date(sesion.expiraEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })],
    ['Cierre por inactividad', `${inactividad.minutos} min sin uso (te quedan ${restante} min)`],
    ['Mantener sesión', sesion.recordar ? 'Sí, en este navegador' : 'No, se borra al cerrar la pestaña'],
  ];
  return (
    <Tarjeta className="p-6 max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-titulo text-lg font-semibold text-texto">Sesión actual</h2>
        {perfil?.estado && <Estado valor={perfil.estado} />}
      </div>
      <dl className="divide-y divide-borde-suave">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-texto-2">{k}</dt>
            <dd className="text-texto text-right tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end mt-6">
        <Boton variante="peligro" icono="logout" onClick={cerrarSesion}>
          Cerrar sesión
        </Boton>
      </div>
    </Tarjeta>
  );
}

export default function Perfil() {
  const [pestana, setPestana] = useState('datos');
  return (
    <>
      <TituloPagina titulo="Mi perfil" subtitulo="Tus datos, tu foto, tu contraseña y tu sesión." />
      <div className="mb-6">
        <Pestanas
          valor={pestana}
          onChange={setPestana}
          opciones={[
            { valor: 'datos', texto: 'Datos personales' },
            { valor: 'seguridad', texto: 'Seguridad' },
            { valor: 'sesion', texto: 'Sesión' },
            { valor: 'apariencia', texto: 'Apariencia' },
          ]}
        />
      </div>
      {pestana === 'datos' && <Datos />}
      {pestana === 'seguridad' && <Seguridad />}
      {pestana === 'sesion' && <SesionActual />}
      {pestana === 'apariencia' && (
        <Tarjeta className="p-6 max-w-xl">
          <h2 className="font-titulo text-lg font-semibold text-texto">Apariencia</h2>
          <p className="text-sm text-texto-2 mt-1 mb-5">Elige cómo se ve EventoITCH en este navegador. También puedes cambiarlo con el botón de la luna o el sol, arriba a la derecha.</p>
          <SelectorTema />
        </Tarjeta>
      )}
    </>
  );
}
