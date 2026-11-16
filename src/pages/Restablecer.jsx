// Pagina del enlace del correo: /restablecer?token=... (POST /auth/password/restablecer).
// Reglas de la contrasena (las mismas del backend): 8+ caracteres, al menos una letra y un numero.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { restablecerConEnlace } from '../api/auth';
import Icono from '../components/Icono';
import { Aviso, Boton, Campo, Entrada } from '../components/ui';
import Marca from '../components/layout/Marca';
import BotonTema from '../components/BotonTema';
import LadoInstitucional from './LadoInstitucional';

export default function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [form, setForm] = useState({ nueva: '', confirmar: '' });
  const [ver, setVer] = useState(false);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);

  const cambiar = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrores((x) => ({ ...x, [e.target.name]: null }));
  };

  async function enviar(e) {
    e.preventDefault();
    const x = {};
    if (form.nueva.length < 8) x.nueva = 'Mínimo 8 caracteres';
    else if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(form.nueva) || !/\d/.test(form.nueva)) x.nueva = 'Usa al menos una letra y un número';
    if (form.confirmar !== form.nueva) x.confirmar = 'Las contraseñas no coinciden';
    setErrores(x);
    if (Object.keys(x).length) return;
    setEnviando(true);
    setError(null);
    try {
      await restablecerConEnlace(token, form.nueva);
      setListo(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const ojo = (
    <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'} className="text-tenue hover:text-texto-2">
      <Icono nombre={ver ? 'visibility_off' : 'visibility'} className="text-[18px]" />
    </button>
  );

  return (
    <div className="min-h-screen flex bg-superficie">
      <LadoInstitucional
        chip="Recupera tu acceso"
        titulo="Crea tu contraseña nueva."
        texto="Al guardarla se cierra la sesión que tuvieras abierta y te llega un correo de aviso."
        puntos={[
          { icono: 'password', titulo: 'Contraseña fuerte', texto: '8 o más caracteres, con letras y números. Que no sea tu usuario.' },
          { icono: 'verified_user', titulo: 'Un solo uso', texto: 'Este enlace deja de servir en cuanto la cambies.' },
        ]}
        pie={<p className="italic text-white/85">"Tu cuenta, siempre en tus manos."</p>}
      />
      <main className="relative flex-1 flex flex-col items-center justify-center px-5 py-10">
        <BotonTema className="absolute top-4 right-4 bg-superficie" />
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-10 flex justify-center">
            <Marca />
          </div>
          <h2 className="font-titulo text-[28px] font-semibold text-texto">Contraseña nueva</h2>

          {!token ? (
            <Aviso tipo="error" titulo="Falta el enlace" className="mt-6">
              Abre el enlace completo que te llegó por correo. Si ya no lo tienes, pide al administrador que te mande otro.
            </Aviso>
          ) : listo ? (
            <>
              <Aviso tipo="exito" titulo="Listo, ya cambió tu contraseña" className="mt-6">
                Ya puedes iniciar sesión con tu contraseña nueva.
              </Aviso>
              <Link to="/login" className="mt-6 block">
                <Boton tamano="lg" icono="login" className="w-full">
                  Iniciar sesión
                </Boton>
              </Link>
            </>
          ) : (
            <form onSubmit={enviar} className="mt-8 space-y-5" noValidate>
              {error && (
                <Aviso tipo="error" titulo="No se pudo cambiar">
                  {error}
                </Aviso>
              )}
              <Campo etiqueta="Contraseña nueva" obligatorio ayuda="8 o más caracteres, con letras y números" error={errores.nueva}>
                <Entrada icono="key" name="nueva" type={ver ? 'text' : 'password'} autoComplete="new-password" value={form.nueva} onChange={cambiar} error={errores.nueva} derecha={ojo} autoFocus />
              </Campo>
              <Campo etiqueta="Confirmar contraseña" obligatorio error={errores.confirmar}>
                <Entrada icono="lock_reset" name="confirmar" type={ver ? 'text' : 'password'} autoComplete="new-password" value={form.confirmar} onChange={cambiar} error={errores.confirmar} />
              </Campo>
              <Boton type="submit" tamano="lg" icono="lock_reset" cargando={enviando} className="w-full">
                Guardar contraseña
              </Boton>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-borde text-center text-sm text-texto-2">
            <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-marino hover:underline">
              <Icono nombre="arrow_back" className="text-[18px]" />
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
