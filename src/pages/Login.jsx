// Iniciar sesion con ms-autenticacion. Usuario = numero de control, RFC o correo.
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { preferencia } from '../utils/preferencias';
import { useAuth } from '../context/AuthContext';
import Icono from '../components/Icono';
import { Aviso, Boton, Campo, Entrada } from '../components/ui';
import Marca from '../components/layout/Marca';
import BotonTema from '../components/BotonTema';
import LadoInstitucional from './LadoInstitucional';
import VerificarCorreo from '../components/VerificarCorreo';
import { soportaLlaves } from '../utils/llavesAcceso';

// Contrasena temporal (la restablecio un ADMINISTRADOR): hay que poner una propia antes de entrar.
// Se manda la temporal (la que se acaba de escribir) y la nueva a POST /auth/password/temporal, que da el token.
// Verificacion en dos pasos: el login dio un desafio (vence en 5 min); se manda con el codigo de 6 numeros de la
// app de autenticacion o con uno de los codigos de respaldo (ABCDE-FGHJK) a POST /auth/login/dos-pasos.
function PasoDosPasos({ desafio, recordar, onListo, onCancelar }) {
  const { completarDosPasos } = useAuth();
  const [respaldo, setRespaldo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const limpio = respaldo ? codigo.toUpperCase().replace(/[^A-Z0-9-]/g, '') : codigo.replace(/\D/g, '');
  const completo = respaldo ? limpio.replace(/-/g, '').length === 10 : limpio.length === 6;

  async function enviar(e) {
    e.preventDefault();
    if (!completo) return setError(respaldo ? 'El código de respaldo tiene 10 caracteres' : 'Escribe los 6 números de tu app');
    setEnviando(true);
    setError(null);
    try {
      await completarDosPasos(desafio, limpio, recordar);
      onListo();
    } catch (err) {
      // Desafio vencido o anulado (5 codigos malos), o cuenta bloqueada: hay que volver a escribir la contrasena
      if (err.status === 429 || /vuelve a escribir|venci/i.test(err.message)) onCancelar(err.message);
      else {
        setError(err.message);
        setCodigo('');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-5" noValidate>
      <div className="flex items-start gap-3">
        <span className="size-11 shrink-0 rounded-full bg-marino-tinte text-marino grid place-items-center">
          <Icono nombre={respaldo ? 'password' : 'phonelink_lock'} className="text-[24px]" />
        </span>
        <div>
          <h2 className="font-titulo text-lg font-semibold text-texto">Verificación en dos pasos</h2>
          <p className="text-sm text-texto-2 mt-0.5">
            {respaldo
              ? 'Escribe uno de los códigos de respaldo que guardaste al activarla. Cada uno sirve una sola vez.'
              : 'Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator...) y escribe el código de EventoITCH.'}
          </p>
        </div>
      </div>
      <Campo etiqueta={respaldo ? 'Código de respaldo' : 'Código de 6 números'} error={error}>
        <Entrada
          key={respaldo ? 'r' : 'a'}
          icono={respaldo ? 'password' : 'pin'}
          value={limpio}
          onChange={(e) => {
            setCodigo(e.target.value);
            setError(null);
          }}
          inputMode={respaldo ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={respaldo ? 11 : 6}
          placeholder={respaldo ? 'ABCDE-FGHJK' : '123456'}
          className="font-mono tracking-widest"
          error={error}
          autoFocus
        />
      </Campo>
      <Boton type="submit" tamano="lg" cargando={enviando} disabled={!completo} className="w-full">
        {enviando ? 'Verificando...' : 'Verificar y entrar'}
      </Boton>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setRespaldo((v) => !v);
            setCodigo('');
            setError(null);
          }}
          className="font-semibold text-marino hover:underline"
        >
          {respaldo ? 'Usar la app de autenticación' : 'No tengo mi celular'}
        </button>
        <button type="button" onClick={() => onCancelar(null)} className="text-texto-2 hover:text-texto">
          Usar otra cuenta
        </button>
      </div>
      {respaldo && (
        <p className="text-xs text-texto-2">Si perdiste el celular y los códigos, pide a un administrador que te quite la verificación en dos pasos.</p>
      )}
    </form>
  );
}

function PasoCambio({ aviso, username, temporal, recordar, onListo, onCancelar, onCorreo, onDosPasos }) {
  const { cambiarPasswordTemporal } = useAuth();
  const [form, setForm] = useState({ nueva: '', repetir: '' });
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  async function enviar(e) {
    e.preventDefault();
    if (form.nueva.length < 8 || form.nueva.length > 72) return setError('Debe tener de 8 a 72 caracteres');
    if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(form.nueva) || !/\d/.test(form.nueva)) return setError('Usa al menos una letra y un número');
    if (form.nueva === temporal) return setError('Debe ser distinta a la contraseña temporal');
    if (form.nueva !== form.repetir) return setError('Las contraseñas no coinciden');
    setEnviando(true);
    setError(null);
    try {
      const r = await cambiarPasswordTemporal(username, temporal, form.nueva, recordar);
      // La cuenta tiene 2FA: la contrasena nueva ya se guardo, falta el codigo de la app
      if (r?.requiereDosPasos) return onDosPasos(r);
      onListo();
    } catch (err) {
      // La contrasena nueva ya se guardo, pero falta confirmar el correo: se pide el codigo y luego se entra con la nueva
      if (err.codigo === 'EMAIL_NO_VERIFICADO') onCorreo(form.nueva, err.message);
      // 401/429: la temporal ya no sirve o la cuenta se bloqueo; hay que volver a iniciar sesion
      else if (err.status === 401 || err.status === 429) onCancelar(err.message);
      else setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const tipo = ver ? 'text' : 'password';
  return (
    <form onSubmit={enviar} className="mt-8 space-y-5" noValidate>
      <Aviso tipo="aviso" titulo="Cambia tu contraseña temporal">
        {aviso ?? 'Un administrador restableció tu contraseña. Pon una nueva para entrar.'}
      </Aviso>
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      <Campo etiqueta="Contraseña nueva" ayuda="De 8 a 72 caracteres, con letras y números" error={error}>
        <Entrada
          icono="lock"
          name="nueva"
          type={tipo}
          value={form.nueva}
          onChange={cambiar}
          autoComplete="new-password"
          error={error}
          autoFocus
          derecha={
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'} className="text-texto-2 hover:text-texto">
              <Icono nombre={ver ? 'visibility_off' : 'visibility'} className="text-[20px]" />
            </button>
          }
        />
      </Campo>
      <Campo etiqueta="Repite la contraseña nueva">
        <Entrada icono="lock" name="repetir" type={tipo} value={form.repetir} onChange={cambiar} autoComplete="new-password" />
      </Campo>
      <Boton type="submit" tamano="lg" cargando={enviando} className="w-full">
        {enviando ? 'Guardando...' : 'Guardar y entrar'}
      </Boton>
      <button type="button" onClick={() => onCancelar(null)} className="w-full text-sm text-texto-2 hover:text-texto">
        Usar otra cuenta
      </button>
    </form>
  );
}

export default function Login() {
  const { sesion, iniciarSesion, entrarConLlave, cierre, setCierre } = useAuth();
  const [conLlave, setConLlave] = useState(false);
  // Contrasena temporal: el backend pide cambiarla antes de dar el token (respuesta 202)
  const [cambio, setCambio] = useState(null);
  // Correo sin confirmar (403 EMAIL_NO_VERIFICADO): { mensaje, password } para pedir el codigo y luego entrar
  const [correo, setCorreo] = useState(null);
  // Verificacion en dos pasos (202 { requiereDosPasos, desafio }): pide el codigo de la app
  const [dosPasos, setDosPasos] = useState(null);
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ username: '', password: '', recordar: true });
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});

  if (sesion) return <Navigate to={preferencia('inicio')} replace />;

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrores((x) => ({ ...x, [name]: null }));
  };

  async function enviar(e) {
    e.preventDefault();
    const faltan = {};
    if (!form.username.trim()) faltan.username = 'Escribe tu usuario';
    if (!form.password) faltan.password = 'Escribe tu contraseña';
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setEnviando(true);
    setError(null);
    try {
      const pendiente = await iniciarSesion(form.username.trim(), form.password, form.recordar);
      if (pendiente?.requiereDosPasos) return setDosPasos(pendiente);
      if (pendiente) {
        setCambio(pendiente);
        return;
      }
      setCierre(null);
      navigate(preferencia('inicio'), { replace: true });
    } catch (err) {
      if (err.codigo === 'EMAIL_NO_VERIFICADO') {
        setCorreo({ mensaje: err.message, password: form.password });
        return;
      }
      setError(
        err.status === 401
          ? { titulo: 'Usuario o contraseña incorrectos', texto: 'Revisa tus datos. Si tu cuenta está inactiva, contacta al administrador.' }
          : { titulo: 'No pudimos iniciar sesión', texto: err.message },
      );
    } finally {
      setEnviando(false);
    }
  }

  // Llave de acceso: sin usuario ni contrasena. Cuenta como verificacion en dos pasos.
  async function entrarLlave() {
    setConLlave(true);
    setError(null);
    try {
      await entrarConLlave(form.recordar);
      setCierre(null);
      navigate(preferencia('inicio'), { replace: true });
    } catch (err) {
      setError({ titulo: 'No se pudo entrar con la llave', texto: err.message });
    } finally {
      setConLlave(false);
    }
  }

  const aviso = state?.aviso ?? (cierre ? { titulo: 'Tu sesión se cerró', mensaje: cierre } : null);

  return (
    <div className="min-h-screen flex bg-superficie">
      <LadoInstitucional
        chip="Plataforma oficial de espacios y eventos"
        titulo="Gestión de eventos y espacios institucionales sin complicaciones."
        texto="La plataforma de eventos del Instituto Tecnológico de Chilpancingo."
        puntos={[
          { icono: 'verified', titulo: 'Sesión segura', texto: 'Tu sesión se cierra sola si no la usas por un rato.' },
          { icono: 'calendar_month', titulo: 'Agenda unificada', texto: 'Auditorios, laboratorios, aulas y canchas.' },
        ]}
        pie={
          <>
            <p className="flex items-center gap-2 etiqueta text-white">
              <span className="size-2 rounded-full bg-exito" />
              Disponibilidad inmediata
            </p>
            <p className="italic text-white/85 mt-3">"Reserva el auditorio, la cancha o un aula en segundos."</p>
          </>
        }
      />

      <main className="relative flex-1 flex flex-col items-center justify-center px-5 py-10">
        <BotonTema className="absolute top-4 right-4 bg-superficie" />
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-10 flex justify-center">
            <Marca />
          </div>
          <h2 className="font-titulo text-[28px] font-semibold text-texto">Bienvenido de nuevo</h2>
          <p className="text-texto-2 mt-1">Inicia sesión con tu cuenta institucional</p>

          {aviso && (
            <Aviso tipo="aviso" titulo={aviso.titulo} className="mt-6" onCerrar={() => setCierre(null)}>
              {aviso.mensaje}
            </Aviso>
          )}
          {error && (
            <Aviso tipo="error" titulo={error.titulo} className="mt-6">
              {error.texto}
            </Aviso>
          )}

          {dosPasos ? (
            <PasoDosPasos
              desafio={dosPasos.desafio}
              recordar={form.recordar}
              onListo={() => {
                setCierre(null);
                navigate(preferencia('inicio'), { replace: true });
              }}
              onCancelar={(motivo) => {
                setDosPasos(null);
                setForm((f) => ({ ...f, password: '' }));
                if (motivo) setError({ titulo: 'Inicia sesión de nuevo', texto: motivo });
              }}
            />
          ) : correo ? (
            <VerificarCorreo
              usuario={form.username.trim()}
              mensaje={`${correo.mensaje}. Escríbelo aquí; vence en 15 minutos.`}
              onListo={async () => {
                // Correo confirmado: se entra con la misma contrasena (o con la nueva, si venia de cambiar la temporal)
                const pendiente = await iniciarSesion(form.username.trim(), correo.password, form.recordar);
                setCorreo(null);
                if (pendiente?.requiereDosPasos) return setDosPasos(pendiente);
                if (pendiente) return setCambio(pendiente);
                setCierre(null);
                navigate(preferencia('inicio'), { replace: true });
              }}
              onCancelar={() => {
                setCorreo(null);
                setForm((f) => ({ ...f, password: '' }));
              }}
            />
          ) : cambio ? (
            <PasoCambio
              aviso={cambio.message}
              username={form.username.trim()}
              temporal={form.password}
              recordar={form.recordar}
              onListo={() => {
                setCierre(null);
                navigate(preferencia('inicio'), { replace: true });
              }}
              onDosPasos={(r) => {
                setCambio(null);
                setDosPasos(r);
              }}
              onCorreo={(nueva, mensaje) => {
                setCambio(null);
                setCorreo({ mensaje, password: nueva });
              }}
              onCancelar={(motivo) => {
                setCambio(null);
                setForm((f) => ({ ...f, password: '' }));
                if (motivo) setError({ titulo: 'Inicia sesión de nuevo', texto: motivo });
              }}
            />
          ) : (
          <form onSubmit={enviar} className="mt-8 space-y-5" noValidate>
            <Campo etiqueta="Usuario" ayuda="Número de control, RFC o correo" error={errores.username}>
              <Entrada icono="person" name="username" value={form.username} onChange={cambiar} autoComplete="username" placeholder="20520145" error={errores.username} autoFocus />
            </Campo>
            <Campo etiqueta="Contraseña" error={errores.password}>
              <Entrada
                icono="lock"
                name="password"
                type={ver ? 'text' : 'password'}
                value={form.password}
                onChange={cambiar}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                error={errores.password}
                derecha={
                  <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'} className="text-texto-2 hover:text-texto">
                    <Icono nombre={ver ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                  </button>
                }
              />
            </Campo>
            <label className="flex items-center gap-3 text-sm text-texto cursor-pointer">
              <input type="checkbox" name="recordar" checked={form.recordar} onChange={cambiar} className="size-[18px] accent-marino" />
              Mantener sesión iniciada en este equipo
            </label>
            <Boton type="submit" tamano="lg" cargando={enviando} disabled={conLlave} className="w-full">
              {enviando ? 'Verificando...' : 'Iniciar sesión'}
            </Boton>
            {soportaLlaves() && (
              <>
                <div className="flex items-center gap-3 text-xs text-tenue">
                  <span className="h-px flex-1 bg-borde" />o<span className="h-px flex-1 bg-borde" />
                </div>
                <Boton type="button" variante="secundario" tamano="lg" icono="fingerprint" cargando={conLlave} disabled={enviando} onClick={entrarLlave} className="w-full">
                  {conLlave ? 'Esperando tu huella...' : 'Entrar con llave de acceso'}
                </Boton>
              </>
            )}
          </form>
          )}

          <div className="mt-8 pt-6 border-t border-borde text-center text-sm text-texto-2">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-marino hover:underline">
              Crear cuenta
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-info-borde bg-info-tinte px-4 py-3 text-sm text-texto-2">
            <Icono nombre="help" className="text-[18px] text-marino" />
            ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
          </div>
          <p className="mt-10 text-center text-xs text-tenue">
            <Link to="/" className="hover:underline">
              Volver al inicio
            </Link>{' '}
            · EventoITCH · Instituto Tecnológico de Chilpancingo · TecNM
          </p>
        </div>
      </main>
    </div>
  );
}
