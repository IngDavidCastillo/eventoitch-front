// Crear cuenta en 3 pasos con POST /api/v1/auth/registro.
// El registro publico solo permite ESTUDIANTE (entra con su numero de control) o INVITADO (entra con su correo).
// Docentes, organizadores y administradores los da de alta un administrador.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { correoNoEnviado } from '../api/auth';
import { subirFoto } from '../api/usuarios';
import Icono from '../components/Icono';
import { Aviso, Boton, Campo, Entrada, SelectorFoto } from '../components/ui';
import Marca from '../components/layout/Marca';
import BotonTema from '../components/BotonTema';
import LadoInstitucional from './LadoInstitucional';

const PASOS = ['Tipo de cuenta', 'Tus datos', 'Seguridad'];

const TIPOS = [
  { valor: 'ESTUDIANTE', titulo: 'Estudiante', icono: 'school', texto: 'Alumno del Tec. Entras con tu número de control.' },
  { valor: 'INVITADO', titulo: 'Invitado', icono: 'badge', texto: 'Visitante externo. Entras con tu correo.' },
];

function Pasos({ actual }) {
  return (
    <ol className="flex items-center mb-8">
      {PASOS.map((p, i) => (
        <li key={p} className={`flex items-center ${i < PASOS.length - 1 ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`size-9 rounded-full grid place-items-center text-sm font-semibold border-2 ${
                i < actual ? 'bg-marino border-marino text-white' : i === actual ? 'border-marino text-marino bg-superficie' : 'border-borde text-tenue bg-superficie'
              }`}
            >
              {i < actual ? <Icono nombre="check" className="text-[18px]" /> : i + 1}
            </span>
            <span className={`text-xs whitespace-nowrap ${i <= actual ? 'text-texto font-medium' : 'text-tenue'}`}>{p}</span>
          </div>
          {i < PASOS.length - 1 && <span className={`flex-1 h-0.5 mx-2 mb-5 ${i < actual ? 'bg-marino' : 'bg-borde'}`} />}
        </li>
      ))}
    </ol>
  );
}

// Fuerza de la contrasena: largo, mayusculas, numeros y simbolos
function fuerza(p) {
  let n = 0;
  if (p.length >= 8) n++;
  if (p.length >= 12) n++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) n++;
  if (/\d/.test(p)) n++;
  if (/[^A-Za-z0-9]/.test(p)) n++;
  return Math.min(n, 4);
}
const NIVELES = [
  ['Muy débil', 'bg-peligro'],
  ['Débil', 'bg-peligro'],
  ['Regular', 'bg-aviso'],
  ['Buena', 'bg-exito'],
  ['Fuerte', 'bg-exito'],
];

export default function Registro() {
  const { sesion, registrarse, setPerfil } = useAuth();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState({ tipoUsuario: 'ESTUDIANTE', nombre: '', apellidos: '', numeroControl: '', email: '', telefono: '', password: '', confirmar: '', acepto: false });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [ver, setVer] = useState(false);
  // Lo que dijo el backend del correo de bienvenida (se mando o no)
  const [avisoCorreo, setAvisoCorreo] = useState(null);
  // Foto opcional: se sube a ms-usuarios en cuanto se crea la cuenta (ya con su token)
  const [foto, setFoto] = useState(null);
  const [avisoFoto, setAvisoFoto] = useState(null);
  const vista = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => vista && URL.revokeObjectURL(vista), [vista]);
  // Al crear la cuenta la sesion se abre sola; esto evita saltar al panel antes de ver el mensaje de exito
  const creando = useRef(false);

  if (sesion && !creando.current) return <Navigate to="/panel" replace />;

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrores((x) => ({ ...x, [name]: null }));
  };

  function validarDatos() {
    const x = {};
    if (!form.nombre.trim()) x.nombre = 'Escribe tu nombre';
    if (!form.apellidos.trim()) x.apellidos = 'Escribe tus apellidos';
    if (form.tipoUsuario === 'ESTUDIANTE' && !form.numeroControl.trim()) x.numeroControl = 'Tu número de control es tu usuario';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) x.email = 'Escribe un correo válido';
    if (form.telefono && !/^\d{10,15}$/.test(form.telefono.replace(/\s/g, ''))) x.telefono = 'Solo números, de 10 a 15 dígitos';
    setErrores(x);
    return !Object.keys(x).length;
  }

  function validarSeguridad() {
    const x = {};
    if (form.password.length < 8) x.password = 'Mínimo 8 caracteres';
    if (form.confirmar !== form.password) x.confirmar = 'Las contraseñas no coinciden';
    if (!form.acepto) x.acepto = 'Necesitas aceptar para continuar';
    setErrores(x);
    return !Object.keys(x).length;
  }

  async function crear() {
    if (!validarSeguridad()) return;
    setEnviando(true);
    setError(null);
    creando.current = true;
    try {
      const r = await registrarse({
        tipoUsuario: form.tipoUsuario,
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        numeroControl: form.tipoUsuario === 'ESTUDIANTE' ? form.numeroControl.trim() : null,
        email: form.email.trim(),
        telefono: form.telefono.replace(/\s/g, '') || null,
        password: form.password,
      });
      setAvisoCorreo(r?.avisoCorreo ?? null);
      if (foto && r?.usuarioId) {
        try {
          setPerfil(await subirFoto(r.usuarioId, foto, r.token));
        } catch (err) {
          setAvisoFoto(`Tu cuenta se creó, pero la foto no se pudo guardar: ${err.message}. Puedes subirla después en Mi perfil.`);
        }
      }
      setPaso(3);
    } catch (err) {
      creando.current = false;
      // 409 = ya existe esa cuenta (numero de control o correo); regresamos al paso de datos
      if (err.status === 409) {
        setPaso(1);
        setError({ titulo: 'Esa cuenta ya existe', texto: `${err.message}. Si es tuya, inicia sesión.` });
      } else {
        setError({ titulo: 'No se pudo crear la cuenta', texto: [err.message, ...(err.detalles ?? [])].join(' · ') });
      }
    } finally {
      setEnviando(false);
    }
  }

  const f = fuerza(form.password);
  const usuario = form.tipoUsuario === 'ESTUDIANTE' ? form.numeroControl : form.email;

  return (
    <div className="min-h-screen flex bg-lienzo">
      <LadoInstitucional
        chip="Sistema integral de eventos académicos"
        titulo="Comienza a gestionar y reservar espacios en el Tec."
        texto="Únete a la comunidad de estudiantes, docentes y organizadores del Instituto Tecnológico de Chilpancingo."
        puntos={[
          { titulo: 'Cuenta institucional', texto: 'Tu perfil queda en el padrón de usuarios del Tec.' },
          { titulo: 'Reserva de recintos y eventos oficiales', texto: 'Auditorio, aulas, laboratorios y canchas deportivas.' },
          { titulo: 'Agenda en tiempo real', texto: 'Ve qué espacios están libres antes de pedirlos.' },
        ]}
        pie={
          <p className="flex items-center gap-3 text-sm">
            <Icono nombre="verified_user" className="text-[22px] text-oro-claro" />
            <span>
              <b>Plataforma oficial de registro y accesos</b>
              <br />
              <span className="text-white/60">Departamento de Sistemas y Computación</span>
            </span>
          </p>
        }
      />

      <main className="relative flex-1 flex flex-col items-center justify-center px-5 py-10">
        <BotonTema className="absolute top-4 right-4 bg-superficie" />
        <div className="lg:hidden mb-8">
          <Marca />
        </div>
        <div className="w-full max-w-[480px] bg-superficie border border-borde rounded-2xl p-6 sm:p-8 shadow-sm">
          {paso < 3 && <Pasos actual={paso} />}
          {error && (
            <Aviso tipo="error" titulo={error.titulo} className="mb-6" onCerrar={() => setError(null)}>
              {error.texto}
            </Aviso>
          )}

          {paso === 0 && (
            <>
              <h2 className="font-titulo text-2xl font-semibold text-texto">¿Qué tipo de cuenta necesitas?</h2>
              <p className="text-sm text-texto-2 mt-1">Elige la que te corresponde.</p>
              <div className="mt-6 space-y-3">
                {TIPOS.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setForm((x) => ({ ...x, tipoUsuario: t.valor }))}
                    className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${form.tipoUsuario === t.valor ? 'border-marino bg-marino-tinte/50' : 'border-borde hover:border-tenue'}`}
                  >
                    <span className="size-11 rounded-lg bg-superficie border border-borde grid place-items-center text-marino">
                      <Icono nombre={t.icono} className="text-[22px]" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-texto">{t.titulo}</span>
                      <span className="block text-sm text-texto-2">{t.texto}</span>
                    </span>
                    <Icono nombre={form.tipoUsuario === t.valor ? 'radio_button_checked' : 'radio_button_unchecked'} className={`text-[22px] ${form.tipoUsuario === t.valor ? 'text-marino' : 'text-tenue'}`} />
                  </button>
                ))}
              </div>
              <Aviso tipo="info" className="mt-5">
                ¿Eres docente u organizador? Tu cuenta la crea el administrador del sistema.
              </Aviso>
              <Boton tamano="lg" className="w-full mt-6" onClick={() => setPaso(1)}>
                Continuar <Icono nombre="arrow_forward" className="text-[18px]" />
              </Boton>
            </>
          )}

          {paso === 1 && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-titulo text-2xl font-semibold text-texto">Tus datos</h2>
                  <p className="text-sm text-texto-2 mt-1">{form.tipoUsuario === 'ESTUDIANTE' ? 'Estudiante ITCH · Completa tu información' : 'Invitado · Completa tu información'}</p>
                </div>
                <button onClick={() => setPaso(0)} className="rounded-md border border-exito-borde bg-exito-tinte px-2 py-1 text-xs font-semibold text-exito-texto">
                  {form.tipoUsuario === 'ESTUDIANTE' ? 'Estudiante' : 'Invitado'} · Cambiar
                </button>
              </div>
              <SelectorFoto
                perfil={{ nombre: form.nombre, apellidos: form.apellidos }}
                foto={vista}
                onElegir={async (archivo) => setFoto(archivo)}
                onQuitar={() => setFoto(null)}
                className="mt-6"
              />
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <Campo etiqueta="Nombre(s)" obligatorio error={errores.nombre}>
                  <Entrada name="nombre" value={form.nombre} onChange={cambiar} error={errores.nombre} autoComplete="given-name" />
                </Campo>
                <Campo etiqueta="Apellidos" obligatorio error={errores.apellidos}>
                  <Entrada name="apellidos" value={form.apellidos} onChange={cambiar} error={errores.apellidos} autoComplete="family-name" />
                </Campo>
                {form.tipoUsuario === 'ESTUDIANTE' && (
                  <Campo etiqueta="Número de control" obligatorio className="sm:col-span-2" error={errores.numeroControl} ayuda="Será tu usuario para iniciar sesión.">
                    <Entrada icono="badge" name="numeroControl" value={form.numeroControl} onChange={cambiar} error={errores.numeroControl} inputMode="numeric" placeholder="20520145" />
                  </Campo>
                )}
                <Campo etiqueta="Correo" obligatorio className="sm:col-span-2" error={errores.email} ayuda={form.tipoUsuario === 'INVITADO' ? 'Será tu usuario para iniciar sesión.' : undefined}>
                  <Entrada icono="mail" name="email" type="email" value={form.email} onChange={cambiar} error={errores.email} autoComplete="email" placeholder="nombre@chilpancingo.tecnm.mx" />
                </Campo>
                <Campo etiqueta="Teléfono (opcional)" className="sm:col-span-2" error={errores.telefono}>
                  <Entrada icono="call" name="telefono" value={form.telefono} onChange={cambiar} error={errores.telefono} inputMode="tel" placeholder="7471234567" />
                </Campo>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Boton variante="secundario" tamano="lg" onClick={() => setPaso(0)}>
                  Atrás
                </Boton>
                <Boton tamano="lg" className="col-span-2" onClick={() => validarDatos() && setPaso(2)}>
                  Continuar <Icono nombre="arrow_forward" className="text-[18px]" />
                </Boton>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <h2 className="font-titulo text-2xl font-semibold text-texto">Seguridad</h2>
              <p className="text-sm text-texto-2 mt-1">
                Tu usuario será <b className="text-texto">{usuario}</b>
              </p>
              <div className="mt-6 space-y-4">
                <Campo etiqueta="Contraseña" obligatorio error={errores.password}>
                  <Entrada
                    icono="lock"
                    name="password"
                    type={ver ? 'text' : 'password'}
                    value={form.password}
                    onChange={cambiar}
                    error={errores.password}
                    autoComplete="new-password"
                    derecha={
                      <button type="button" onClick={() => setVer((v) => !v)} aria-label="Ver contraseña" className="text-texto-2">
                        <Icono nombre={ver ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                      </button>
                    }
                  />
                </Campo>
                {form.password && (
                  <div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`h-1.5 rounded-full ${i < f ? NIVELES[f][1] : 'bg-borde'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-texto-2 mt-1.5">
                      Seguridad: <b>{NIVELES[f][0]}</b> · Usa 8 o más caracteres con mayúsculas, números y un símbolo.
                    </p>
                  </div>
                )}
                <Campo etiqueta="Confirmar contraseña" obligatorio error={errores.confirmar}>
                  <Entrada icono="lock_reset" name="confirmar" type={ver ? 'text' : 'password'} value={form.confirmar} onChange={cambiar} error={errores.confirmar} autoComplete="new-password" />
                </Campo>
                <label className="flex items-start gap-3 text-sm text-texto-2 cursor-pointer">
                  <input type="checkbox" name="acepto" checked={form.acepto} onChange={cambiar} className="size-[18px] mt-0.5 accent-marino" />
                  <span>
                    Acepto el aviso de privacidad y las normas de uso de los espacios del ITCH.
                    {errores.acepto && <span className="block text-xs text-peligro-texto mt-1">{errores.acepto}</span>}
                  </span>
                </label>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Boton variante="secundario" tamano="lg" onClick={() => setPaso(1)}>
                  Atrás
                </Boton>
                <Boton tamano="lg" className="col-span-2" cargando={enviando} onClick={crear}>
                  Crear cuenta
                </Boton>
              </div>
            </>
          )}

          {paso === 3 && (
            <div className="text-center py-4">
              <span className="mx-auto size-16 rounded-full bg-exito-tinte text-exito grid place-items-center">
                <Icono nombre="check_circle" className="text-[36px]" relleno />
              </span>
              <h2 className="font-titulo text-2xl font-semibold text-texto mt-5">¡Tu cuenta está lista!</h2>
              <p className="text-sm text-texto-2 mt-2">
                Ya puedes entrar con <b className="text-texto">{usuario}</b> y tu contraseña.
              </p>
              {vista && !avisoFoto && (
                <img src={vista} alt="" className="mx-auto mt-5 size-20 rounded-full object-cover ring-4 ring-borde-suave" />
              )}
              {avisoFoto && (
                <Aviso tipo="aviso" className="mt-5 text-left">
                  {avisoFoto}
                </Aviso>
              )}
              {avisoCorreo && (
                <Aviso tipo={correoNoEnviado(avisoCorreo) ? 'aviso' : 'info'} className="mt-5 text-left">
                  {avisoCorreo}
                </Aviso>
              )}
              <Boton tamano="lg" className="w-full mt-8" onClick={() => navigate('/panel')}>
                Ir a mi panel
              </Boton>
            </div>
          )}

          {paso < 3 && (
            <p className="mt-6 pt-5 border-t border-borde text-center text-sm text-texto-2">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="font-semibold text-marino hover:underline">
                Iniciar sesión
              </Link>
            </p>
          )}
        </div>
        <p className="mt-6 text-xs text-tenue">EventoITCH · Instituto Tecnológico de Chilpancingo · TecNM</p>
      </main>
    </div>
  );
}
