// Mi perfil › Seguridad: llaves de acceso (passkeys / WebAuthn, contrato seccion 8).
// Con una llave se entra sin contrasena usando la huella, el rostro o el PIN del dispositivo, y cuenta como
// verificacion en dos pasos. Para crear una se pide la contrasena otra vez.
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { borrarLlave, crearLlave, misLlaves, opcionesNuevaLlave } from '../api/auth';
import useDatos from '../hooks/useDatos';
import { crearEnDispositivo, soportaLlaves } from '../utils/llavesAcceso';
import { haceCuanto } from '../utils/fechas';
import Icono from './Icono';
import { Aviso, Boton, Campo, Confirmar, Entrada, Esqueleto, Modal, Tarjeta } from './ui';

const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

function NuevaLlave({ abierto, onCerrar, onCreada }) {
  const { sesion } = useAuth();
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  function cerrar() {
    if (trabajando) return;
    setPassword('');
    setNombre('');
    setError(null);
    onCerrar();
  }

  async function crear(e) {
    e.preventDefault();
    if (!password) return setError('Escribe tu contraseña');
    setTrabajando(true);
    setError(null);
    try {
      const { solicitud, publicKey } = await opcionesNuevaLlave(password, sesion.token);
      const credencial = await crearEnDispositivo(publicKey);
      const llave = await crearLlave(solicitud, credencial, nombre.trim(), sesion.token);
      setPassword('');
      setNombre('');
      onCreada(llave);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar}>
      <form onSubmit={crear} className="p-6" noValidate>
        <span className="size-12 rounded-full grid place-items-center mb-4 bg-marino-tinte text-marino">
          <Icono nombre="passkey" className="text-[24px]" />
        </span>
        <h2 className="font-titulo text-lg font-semibold text-texto">Crear llave de acceso</h2>
        <p className="text-sm text-texto-2 mt-1 mb-5">
          Confirma tu contraseña. Después tu navegador te pedirá la huella, el rostro o el PIN de este dispositivo (o escanear un QR con tu celular).
        </p>
        {error && (
          <Aviso tipo="error" className="mb-4">
            {error}
          </Aviso>
        )}
        <div className="space-y-4">
          <Campo etiqueta="Contraseña" obligatorio>
            <Entrada icono="lock" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Nombre de la llave" ayuda="Opcional, para reconocerla. Si lo dejas vacío usamos el navegador, por ejemplo «Chrome en Windows».">
            <Entrada icono="label" value={nombre} maxLength={80} placeholder="Mi celular" onChange={(e) => setNombre(e.target.value)} />
          </Campo>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Boton type="button" variante="secundario" onClick={cerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton type="submit" icono="fingerprint" cargando={trabajando}>
            {trabajando ? 'Esperando tu huella...' : 'Crear llave'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

export default function LlavesAcceso() {
  const { sesion } = useAuth();
  const datos = useDatos(() => misLlaves(sesion.token), [sesion.token]);
  const llaves = datos.datos;
  const [nueva, setNueva] = useState(false);
  const [borrar, setBorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  async function confirmarBorrar() {
    setBorrando(true);
    try {
      await borrarLlave(borrar.id, sesion.token);
      setMensaje({ tipo: 'exito', texto: `Se borró la llave «${borrar.nombre}». Te mandamos un correo de aviso.` });
      datos.recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setBorrando(false);
      setBorrar(null);
    }
  }

  return (
    <Tarjeta className="p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="size-10 shrink-0 rounded-full bg-marino-tinte text-marino grid place-items-center">
            <Icono nombre="passkey" className="text-[22px]" />
          </span>
          <div>
            <h2 className="font-titulo text-lg font-semibold text-texto">Llaves de acceso</h2>
            <p className="text-sm text-texto-2 mt-0.5">Entra sin contraseña con tu huella, tu rostro o el PIN de tu dispositivo. Cuenta como verificación en dos pasos.</p>
          </div>
        </div>
        {soportaLlaves() && (
          <Boton icono="add" tamano="sm" onClick={() => setNueva(true)}>
            Crear llave
          </Boton>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {!soportaLlaves() && <Aviso tipo="aviso">Este navegador no admite llaves de acceso. Prueba con Chrome, Edge, Safari o Firefox actualizados.</Aviso>}
        {mensaje && (
          <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)}>
            {mensaje.texto}
          </Aviso>
        )}
        {!llaves && datos.cargando && <Esqueleto className="h-12 w-full rounded-lg" />}
        {!llaves && datos.error && <Aviso tipo="error">No se pudieron cargar tus llaves: {datos.error.message}</Aviso>}
        {llaves?.length === 0 && <p className="text-sm text-texto-2">Todavía no tienes llaves de acceso.</p>}
        {llaves?.length > 0 && (
          <ul className="divide-y divide-borde-suave rounded-lg border border-borde">
            {llaves.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <Icono nombre="key" className="text-[20px] text-texto-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto truncate">{l.nombre}</p>
                  <p className="text-xs text-texto-2">
                    Creada el {fecha.format(new Date(l.fechaCreacion))} · {l.ultimoUso ? `Último uso ${haceCuanto(l.ultimoUso)}` : 'Sin usar todavía'}
                  </p>
                </div>
                <Boton variante="fantasma" tamano="sm" icono="delete" onClick={() => setBorrar(l)} title="Borrar llave">
                  Borrar
                </Boton>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-texto-2">
          Cada llave solo sirve en esta dirección del sitio. Desde la compu también puedes usar la llave de tu celular: el navegador te mostrará un QR.
        </p>
      </div>

      <NuevaLlave
        abierto={nueva}
        onCerrar={() => setNueva(false)}
        onCreada={(llave) => {
          setNueva(false);
          setMensaje({ tipo: 'exito', texto: `Listo: la llave «${llave.nombre}» quedó guardada. La próxima vez dale «Entrar con llave de acceso» en el inicio de sesión.` });
          datos.recargar();
        }}
      />
      <Confirmar
        abierto={!!borrar}
        onCerrar={() => setBorrar(null)}
        onConfirmar={confirmarBorrar}
        cargando={borrando}
        icono="delete"
        titulo={borrar ? `Borrar la llave «${borrar.nombre}»` : ''}
        textoConfirmar="Borrar"
      >
        Ya no podrás entrar con ella. Si la borras de aquí, conviene quitarla también de tu dispositivo (en la configuración de contraseñas o llaves).
      </Confirmar>
    </Tarjeta>
  );
}
