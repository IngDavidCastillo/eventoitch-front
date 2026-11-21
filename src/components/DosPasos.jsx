// Mi perfil › Seguridad: verificacion en dos pasos con una app de autenticacion (contrato, seccion 8).
// Activar: POST /dos-pasos/iniciar da el secreto y la direccion otpauth://, el QR se dibuja aqui en el navegador
// (libreria qrcode, el secreto no sale a ningun otro servidor) y POST /dos-pasos/activar con el primer codigo lo
// enciende y regresa 10 codigos de respaldo que solo se ven esa vez.
// ADMINISTRADOR y ORGANIZADOR la tienen obligatoria: sin ella no pueden crear reservas ni usar lo de administrador.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { activarDosPasos, desactivarDosPasos, estadoDosPasos, iniciarDosPasos, nuevosCodigosRespaldo } from '../api/auth';
import useDatos from '../hooks/useDatos';
import Icono from './Icono';
import { Aviso, Boton, Campo, Entrada, Esqueleto, Insignia, Modal, Tarjeta } from './ui';

const soloNumeros = (v) => v.replace(/\D/g, '').slice(0, 6);

// Los 10 codigos de respaldo: copiar o descargar en .txt
function CodigosRespaldo({ codigos }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `EventoITCH - codigos de respaldo de la verificacion en dos pasos\nCada uno sirve una sola vez.\n\n${codigos.join('\n')}\n`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigos.join('\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  function descargar() {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eventoitch-codigos-respaldo.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border border-borde bg-lienzo p-4">
        {codigos.map((c) => (
          <li key={c} className="font-mono text-sm text-texto text-center tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 mt-3">
        <Boton type="button" variante="secundario" tamano="sm" icono={copiado ? 'check' : 'content_copy'} onClick={copiar}>
          {copiado ? 'Copiados' : 'Copiar'}
        </Boton>
        <Boton type="button" variante="secundario" tamano="sm" icono="download" onClick={descargar}>
          Descargar .txt
        </Boton>
      </div>
    </div>
  );
}

// Activar: QR + codigo de la app -> codigos de respaldo
function Activar({ abierto, onCerrar, onActivado }) {
  const { sesion } = useAuth();
  const [inicio, setInicio] = useState(null);
  const [qr, setQr] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [codigos, setCodigos] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!abierto) return undefined;
    let vigente = true;
    setInicio(null);
    setQr(null);
    setCodigo('');
    setCodigos(null);
    setError(null);
    iniciarDosPasos(sesion.token)
      .then(async (r) => {
        if (!vigente) return;
        setInicio(r);
        setQr(await QRCode.toDataURL(r.otpauthUrl, { width: 220, margin: 1 }));
      })
      .catch((err) => vigente && setError(err.message));
    return () => {
      vigente = false;
    };
  }, [abierto, sesion.token]);

  async function activar(e) {
    e.preventDefault();
    if (codigo.length !== 6) return setError('Escribe los 6 números que muestra la app');
    setTrabajando(true);
    setError(null);
    try {
      const r = await activarDosPasos(codigo, sesion.token);
      setCodigos(r.codigosRespaldo);
    } catch (err) {
      setError(err.message);
      setCodigo('');
    } finally {
      setTrabajando(false);
    }
  }

  // Ya activo: solo se cierra con el boton (para que no se pierdan los codigos por un clic afuera)
  const cerrar = () => !trabajando && !codigos && onCerrar();

  return (
    <Modal abierto={abierto} onCerrar={cerrar} ancho="max-w-lg">
      <div className="p-6">
        {codigos ? (
          <>
            <span className="size-12 rounded-full grid place-items-center mb-4 bg-exito-tinte text-exito">
              <Icono nombre="verified_user" className="text-[24px]" />
            </span>
            <h2 className="font-titulo text-lg font-semibold text-texto">Verificación en dos pasos activada</h2>
            <p className="text-sm text-texto-2 mt-1 mb-4">
              Guarda estos códigos de respaldo en un lugar seguro. Si pierdes el celular, con uno de ellos puedes entrar (cada uno sirve una sola vez). <b className="text-texto">No los volverás a ver.</b>
            </p>
            <CodigosRespaldo codigos={codigos} />
            <div className="flex justify-end mt-6">
              <Boton onClick={onActivado}>Ya los guardé</Boton>
            </div>
          </>
        ) : (
          <form onSubmit={activar} noValidate>
            <h2 className="font-titulo text-lg font-semibold text-texto">Activar la verificación en dos pasos</h2>
            <ol className="text-sm text-texto-2 mt-2 space-y-1 list-decimal pl-5">
              <li>Instala una app de autenticación: Google Authenticator, Microsoft Authenticator o Authy.</li>
              <li>En la app, agrega una cuenta y escanea este código QR.</li>
              <li>Escribe aquí el código de 6 números que te muestra.</li>
            </ol>
            <div className="my-5 flex flex-col items-center gap-3">
              {qr ? (
                <img src={qr} alt="Código QR para la app de autenticación" className="size-[220px] rounded-lg border border-borde bg-white p-1" />
              ) : (
                !error && <Esqueleto className="size-[220px] rounded-lg" />
              )}
              {inicio && (
                <details className="w-full text-xs text-texto-2">
                  <summary className="cursor-pointer text-center font-medium text-marino">¿No puedes escanear? Escribe la clave a mano</summary>
                  <p className="mt-2 break-all rounded-md bg-lienzo border border-borde px-3 py-2 font-mono text-sm text-texto text-center tracking-wider">
                    {inicio.secreto.match(/.{1,4}/g).join(' ')}
                  </p>
                </details>
              )}
            </div>
            <Campo etiqueta="Código de la app" error={error}>
              <Entrada
                icono="pin"
                value={codigo}
                onChange={(e) => {
                  setCodigo(soloNumeros(e.target.value));
                  setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="font-mono tracking-widest"
                error={error}
                disabled={!inicio}
              />
            </Campo>
            <div className="flex justify-end gap-2 mt-6">
              <Boton type="button" variante="secundario" onClick={onCerrar} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton type="submit" icono="verified_user" cargando={trabajando} disabled={!inicio || codigo.length !== 6}>
                Activar
              </Boton>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

// Pide el codigo de la app (y la contrasena para desactivar) antes de una accion delicada
function ConCodigo({ accion, onCerrar, onListo }) {
  const { sesion } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [codigos, setCodigos] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const desactivar = accion === 'desactivar';

  useEffect(() => {
    setCodigo('');
    setPassword('');
    setCodigos(null);
    setError(null);
  }, [accion]);

  async function enviar(e) {
    e.preventDefault();
    if (desactivar && !password) return setError('Escribe tu contraseña');
    if (codigo.length !== 6) return setError('Escribe los 6 números que muestra la app');
    setTrabajando(true);
    setError(null);
    try {
      if (desactivar) {
        await desactivarDosPasos(password, codigo, sesion.token);
        onListo('La verificación en dos pasos quedó desactivada. Te mandamos un correo de aviso.');
      } else {
        setCodigos((await nuevosCodigosRespaldo(codigo, sesion.token)).codigosRespaldo);
      }
    } catch (err) {
      setError(err.message);
      setCodigo('');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Modal abierto={!!accion} onCerrar={() => !trabajando && !codigos && onCerrar()}>
      <div className="p-6">
        {codigos ? (
          <>
            <h2 className="font-titulo text-lg font-semibold text-texto">Códigos de respaldo nuevos</h2>
            <p className="text-sm text-texto-2 mt-1 mb-4">Los anteriores ya no sirven. Guarda estos en un lugar seguro; no los volverás a ver.</p>
            <CodigosRespaldo codigos={codigos} />
            <div className="flex justify-end mt-6">
              <Boton onClick={() => onListo('Generaste 10 códigos de respaldo nuevos.')}>Ya los guardé</Boton>
            </div>
          </>
        ) : (
          <form onSubmit={enviar} noValidate>
            <h2 className="font-titulo text-lg font-semibold text-texto">{desactivar ? 'Desactivar la verificación en dos pasos' : 'Generar códigos de respaldo nuevos'}</h2>
            <p className="text-sm text-texto-2 mt-1 mb-5">
              {desactivar ? 'Tu cuenta quedará protegida solo con la contraseña.' : 'Los 10 códigos que tienes ahora dejarán de servir.'} Confirma con el código de tu app.
            </p>
            <div className="space-y-4">
              {desactivar && (
                <Campo etiqueta="Contraseña">
                  <Entrada icono="lock" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Campo>
              )}
              <Campo etiqueta="Código de la app" error={error}>
                <Entrada
                  icono="pin"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(soloNumeros(e.target.value));
                    setError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="font-mono tracking-widest"
                  error={error}
                  autoFocus={!desactivar}
                />
              </Campo>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Boton type="button" variante="secundario" onClick={onCerrar} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton type="submit" variante={desactivar ? 'peligro' : 'primario'} cargando={trabajando}>
                {desactivar ? 'Desactivar' : 'Generar'}
              </Boton>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default function DosPasos() {
  const { sesion, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const datos = useDatos(() => estadoDosPasos(sesion.token), [sesion.token]);
  const estado = datos.datos;
  const [activando, setActivando] = useState(false);
  const [accion, setAccion] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  // La sesion actual entro sin el codigo: para usar lo de su rol hay que entrar otra vez con el
  async function entrarDeNuevo() {
    await cerrarSesion();
    navigate('/login', { replace: true, state: { aviso: { titulo: 'Entra con tu código', mensaje: 'Inicia sesión otra vez; ahora te pediremos el código de tu app de autenticación.' } } });
  }

  const faltaEnEstaSesion = estado?.activo && !estado.sesionConDosPasos && estado.obligatorio;

  return (
    <Tarjeta className="p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="size-10 shrink-0 rounded-full bg-marino-tinte text-marino grid place-items-center">
            <Icono nombre="phonelink_lock" className="text-[22px]" />
          </span>
          <div>
            <h2 className="font-titulo text-lg font-semibold text-texto flex flex-wrap items-center gap-2">
              Verificación en dos pasos
              {estado && <Insignia tono={estado.activo ? 'exito' : estado.obligatorio ? 'aviso' : 'neutro'}>{estado.activo ? 'Activa' : 'Inactiva'}</Insignia>}
            </h2>
            <p className="text-sm text-texto-2 mt-0.5">Además de la contraseña, al entrar se pide un código que cambia cada 30 segundos en tu celular.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {mensaje && (
          <Aviso tipo="exito" onCerrar={() => setMensaje(null)}>
            {mensaje}
          </Aviso>
        )}
        {!estado && datos.cargando && <Esqueleto className="h-12 w-full rounded-lg" />}
        {!estado && datos.error && <Aviso tipo="error">No se pudo revisar la verificación en dos pasos: {datos.error.message}</Aviso>}

        {estado && !estado.activo && (
          <>
            {estado.obligatorio && (
              <Aviso tipo="aviso" titulo="Tu rol la necesita">
                Como {sesion.rol === 'ADMINISTRADOR' ? 'administrador' : 'organizador'}, actívala para crear y mover reservas{sesion.rol === 'ADMINISTRADOR' ? ' y para usar las secciones de administrador' : ''}.
              </Aviso>
            )}
            <Boton icono="verified_user" onClick={() => setActivando(true)}>
              Activar
            </Boton>
          </>
        )}

        {estado?.activo && (
          <>
            {faltaEnEstaSesion && (
              <Aviso tipo="aviso" titulo="Esta sesión entró sin el código">
                Vuelve a iniciar sesión con el código de tu app para usar todo lo de tu rol.
                <div className="mt-3">
                  <Boton tamano="sm" icono="login" onClick={entrarDeNuevo}>
                    Entrar de nuevo
                  </Boton>
                </div>
              </Aviso>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde px-4 py-3">
              <div className="text-sm">
                <p className="font-medium text-texto">Códigos de respaldo</p>
                <p className={estado.codigosRestantes <= 2 ? 'text-aviso-texto' : 'text-texto-2'}>
                  Te quedan {estado.codigosRestantes} de 10{estado.codigosRestantes <= 2 ? '; genera otros antes de que se acaben' : ''}.
                </p>
              </div>
              <Boton variante="secundario" tamano="sm" icono="autorenew" onClick={() => setAccion('codigos')}>
                Generar nuevos
              </Boton>
            </div>
            {estado.obligatorio ? (
              <p className="text-xs text-texto-2">Tu rol la tiene obligatoria, por eso no se puede desactivar. Si pierdes el celular y los códigos, pide a otro administrador que te la quite.</p>
            ) : (
              <Boton variante="peligro" tamano="sm" icono="remove_moderator" onClick={() => setAccion('desactivar')}>
                Desactivar
              </Boton>
            )}
          </>
        )}
      </div>

      <Activar
        abierto={activando}
        onCerrar={() => setActivando(false)}
        onActivado={() => {
          setActivando(false);
          datos.recargar();
          setMensaje('Listo: la próxima vez que inicies sesión te pediremos el código de tu app.');
        }}
      />
      <ConCodigo
        accion={accion}
        onCerrar={() => setAccion(null)}
        onListo={(texto) => {
          setAccion(null);
          setMensaje(texto);
          datos.recargar();
        }}
      />
    </Tarjeta>
  );
}
