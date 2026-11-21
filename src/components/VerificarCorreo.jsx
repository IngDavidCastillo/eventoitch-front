// "Confirma tu correo": 6 casillas para el codigo que manda ms-usuarios (contrato, seccion 7).
// Se usa despues de crear la cuenta y cuando el login responde 403 EMAIL_NO_VERIFICADO.
// usuario = con el que inicia sesion (numero de control, RFC o correo); el codigo vence en 15 min y aguanta 5 intentos.
import { useEffect, useRef, useState } from 'react';
import { reenviarCodigo, verificarCorreo } from '../api/usuarios';
import Icono from './Icono';
import { Aviso, Boton } from './ui';

const LARGO = 6;
const ESPERA = 60; // segundos entre un codigo y otro (lo mismo que pide el backend)

export default function VerificarCorreo({ usuario, emailEnmascarado, mensaje, onListo, onCancelar, textoListo = 'Confirmar y entrar' }) {
  const [digitos, setDigitos] = useState(Array(LARGO).fill(''));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Al llegar aqui ya se acaba de mandar un codigo: hay que esperar para pedir otro
  const [espera, setEspera] = useState(ESPERA);
  const casillas = useRef([]);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const codigo = digitos.join('');

  function poner(i, valor) {
    const solo = valor.replace(/\D/g, '');
    setError(null);
    if (solo.length > 1) {
      // Pegaron el codigo completo (o varios digitos): se reparte desde esta casilla
      const nuevos = [...digitos];
      solo.slice(0, LARGO - i).split('').forEach((d, k) => (nuevos[i + k] = d));
      setDigitos(nuevos);
      casillas.current[Math.min(i + solo.length, LARGO - 1)]?.focus();
      return;
    }
    const nuevos = [...digitos];
    nuevos[i] = solo;
    setDigitos(nuevos);
    if (solo && i < LARGO - 1) casillas.current[i + 1]?.focus();
  }

  function tecla(i, e) {
    if (e.key === 'Backspace' && !digitos[i] && i > 0) casillas.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) casillas.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LARGO - 1) casillas.current[i + 1]?.focus();
  }

  async function confirmar(e) {
    e.preventDefault();
    if (codigo.length < LARGO) return setError('Escribe los 6 números del código');
    setEnviando(true);
    setError(null);
    try {
      await verificarCorreo(usuario, codigo);
      await onListo();
    } catch (err) {
      setError(err.message);
      if (err.status === 400) {
        setDigitos(Array(LARGO).fill(''));
        casillas.current[0]?.focus();
      }
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setError(null);
    setAviso(null);
    try {
      await reenviarCodigo(usuario);
      setEspera(ESPERA);
      setDigitos(Array(LARGO).fill(''));
      setAviso('Te mandamos un código nuevo; el anterior ya no sirve. Revisa también la carpeta de spam.');
      casillas.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={confirmar} className="mt-8 space-y-5" noValidate>
      <div className="flex items-start gap-3">
        <span className="size-11 shrink-0 rounded-full bg-marino-tinte text-marino grid place-items-center">
          <Icono nombre="mark_email_unread" className="text-[24px]" />
        </span>
        <div>
          <h2 className="font-titulo text-lg font-semibold text-texto">Confirma tu correo</h2>
          <p className="text-sm text-texto-2 mt-0.5">
            {mensaje ?? (
              <>
                Escribe el código de 6 números que mandamos a <b className="text-texto">{emailEnmascarado ?? 'tu correo'}</b>. Vence en 15 minutos.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-2" role="group" aria-label="Código de 6 números">
        {digitos.map((d, i) => (
          <input
            key={i}
            ref={(el) => (casillas.current[i] = el)}
            value={d}
            onChange={(e) => poner(i, e.target.value)}
            onKeyDown={(e) => tecla(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={LARGO}
            aria-label={`Número ${i + 1} de 6`}
            autoFocus={i === 0}
            className={`h-14 w-full min-w-0 rounded-lg border bg-superficie text-center font-mono text-2xl text-texto outline-none transition-colors focus:border-marino focus:ring-2 focus:ring-marino-tinte ${error ? 'border-peligro' : 'border-borde'}`}
          />
        ))}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && !error && <Aviso tipo="info">{aviso}</Aviso>}

      <Boton type="submit" tamano="lg" cargando={enviando} className="w-full" disabled={codigo.length < LARGO}>
        {enviando ? 'Confirmando...' : textoListo}
      </Boton>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={reenviar} disabled={espera > 0} className="font-semibold text-marino hover:underline disabled:text-tenue disabled:no-underline disabled:cursor-not-allowed">
          {espera > 0 ? `Reenviar código en ${espera} s` : 'Reenviar código'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="text-texto-2 hover:text-texto">
            Usar otra cuenta
          </button>
        )}
      </div>
    </form>
  );
}
