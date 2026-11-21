// Mi perfil › Mi informacion: verificar el telefono con un SMS (demo con Twilio Verify, contrato seccion 7).
// Twilio manda el codigo y lo revisa; aqui solo se marca "Verificado". No bloquea nada y no es segundo paso.
// Con la cuenta de prueba de Twilio solo llega a numeros verificados en su consola.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { pedirCodigoTelefono, verificarTelefono } from '../api/usuarios';
import Icono from './Icono';
import { Aviso, Boton, Campo, Entrada, Insignia, Modal } from './ui';

const ESPERA = 60; // segundos entre un SMS y otro (lo mismo que pide el backend)

export default function VerificarTelefono() {
  const { sesion, perfil, setPerfil } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  if (!perfil?.telefono) return null;

  if (perfil.telefonoVerificado) {
    return (
      <Insignia tono="exito" className="mt-2">
        <Icono nombre="verified" className="text-[14px]" /> Teléfono verificado
      </Insignia>
    );
  }

  async function pedir() {
    setTrabajando(true);
    setError(null);
    try {
      await pedirCodigoTelefono(perfil.id, sesion.token);
      setEnviado(true);
      setEspera(ESPERA);
      setCodigo('');
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  async function verificar(e) {
    e.preventDefault();
    if (codigo.length < 4) return setError('Escribe el código que te llegó por SMS');
    setTrabajando(true);
    setError(null);
    try {
      setPerfil(await verificarTelefono(perfil.id, codigo, sesion.token));
      setAbierto(false);
    } catch (err) {
      setError(err.message);
      setCodigo('');
    } finally {
      setTrabajando(false);
    }
  }

  function abrir() {
    setAbierto(true);
    setEnviado(false);
    setError(null);
    pedir();
  }

  return (
    <>
      <button type="button" onClick={abrir} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-marino hover:underline">
        <Icono nombre="sms" className="text-[16px]" />
        Verificar con un SMS
      </button>

      <Modal abierto={abierto} onCerrar={() => !trabajando && setAbierto(false)}>
        <form onSubmit={verificar} className="p-6" noValidate>
          <span className="size-12 rounded-full grid place-items-center mb-4 bg-marino-tinte text-marino">
            <Icono nombre="sms" className="text-[24px]" />
          </span>
          <h2 className="font-titulo text-lg font-semibold text-texto">Verifica tu teléfono</h2>
          <p className="text-sm text-texto-2 mt-1 mb-5">
            {enviado ? (
              <>
                Te mandamos un SMS al <b className="text-texto">{perfil.telefono}</b> con un código. Escríbelo aquí.
              </>
            ) : error ? (
              'No se pudo mandar el SMS. Revisa el mensaje de abajo e intenta de nuevo.'
            ) : (
              'Estamos mandando el SMS...'
            )}
          </p>
          {error && (
            <Aviso tipo="error" className="mb-4">
              {error}
            </Aviso>
          )}
          <Campo etiqueta="Código del SMS">
            <Entrada
              icono="pin"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.replace(/\D/g, '').slice(0, 10));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="font-mono tracking-widest"
              disabled={!enviado}
              autoFocus
            />
          </Campo>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-6">
            <button type="button" onClick={pedir} disabled={espera > 0 || trabajando} className="text-sm font-semibold text-marino hover:underline disabled:text-tenue disabled:no-underline disabled:cursor-not-allowed">
              {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar SMS'}
            </button>
            <div className="flex gap-2">
              <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton type="submit" icono="verified" cargando={trabajando && enviado} disabled={!enviado || codigo.length < 4}>
                Verificar
              </Boton>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
