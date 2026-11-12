// Pagina publica de inicio, antes de iniciar sesion
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icono from '../components/Icono';
import Marca from '../components/layout/Marca';
import BotonTema from '../components/BotonTema';

const ESPACIOS = [
  { icono: 'theater_comedy', titulo: 'Auditorios', texto: 'Congresos, conferencias y ceremonias.' },
  { icono: 'meeting_room', titulo: 'Aulas', texto: 'Talleres, cursos y sesiones de grupo.' },
  { icono: 'computer', titulo: 'Laboratorios', texto: 'Prácticas y eventos con equipo de cómputo.' },
  { icono: 'sports_soccer', titulo: 'Canchas', texto: 'Torneos y actividades deportivas.' },
];

const PASOS = [
  { icono: 'person_add', titulo: '1. Crea tu cuenta', texto: 'Regístrate con tu número de control de estudiante o con tu correo si eres invitado.', pie: 'Validación con el padrón de usuarios' },
  { icono: 'event_available', titulo: '2. Consulta la agenda', texto: 'Mira qué auditorios, aulas y canchas están libres en cada horario de la semana.', pie: 'Disponibilidad en tiempo real' },
  { icono: 'verified', titulo: '3. Reserva sin choques', texto: 'Los organizadores apartan un espacio para uno o varios días; el sistema no deja que dos reservas se crucen.', pie: 'Revisión de choques automática' },
];

export default function Inicio() {
  const { sesion } = useAuth();
  return (
    <div className="min-h-screen bg-superficie">
      <header className="sticky top-0 z-20 bg-superficie/95 backdrop-blur border-b border-borde">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-6">
          <Marca />
          <nav className="hidden md:flex items-center gap-6 text-sm text-texto-2 ml-6">
            <a href="#espacios" className="hover:text-texto">Espacios</a>
            <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <BotonTema />
            {sesion ? (
              <Link to="/panel" className="h-10 px-4 rounded-lg bg-marino text-white text-sm font-semibold inline-flex items-center hover:bg-marino-osc">
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link to="/login" className="h-10 px-4 rounded-lg border border-borde text-sm font-semibold text-texto inline-flex items-center hover:bg-borde-suave">
                  Iniciar sesión
                </Link>
                <Link to="/registro" className="hidden sm:inline-flex h-10 px-4 rounded-lg bg-marino text-white text-sm font-semibold items-center hover:bg-marino-osc">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="flex items-center gap-2 etiqueta text-oro">
            <span className="size-1.5 rounded-full bg-oro" />
            Tecnológico Nacional de México · Campus Chilpancingo
          </p>
          <h1 className="font-titulo text-[34px] md:text-5xl font-semibold text-texto leading-tight mt-4">Todos los eventos del Tec, en un solo lugar</h1>
          <p className="text-texto-2 text-[17px] leading-relaxed mt-5 max-w-xl">
            Consulta la agenda de auditorios, aulas, laboratorios y canchas, y reserva espacios para congresos, talleres y actividades sin papeleo y sin choques de horario.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={sesion ? '/agenda' : '/login'} className="h-12 px-5 rounded-lg bg-marino text-white font-semibold inline-flex items-center gap-2 hover:bg-marino-osc">
              Ver agenda <Icono nombre="arrow_forward" className="text-[18px]" />
            </Link>
            <Link to="/registro" className="h-12 px-5 rounded-lg border border-borde font-semibold text-texto inline-flex items-center gap-2 hover:bg-borde-suave">
              <Icono nombre="person_add" className="text-[18px]" /> Crear cuenta
            </Link>
          </div>
        </div>

        {/* Vista previa ilustrativa de la agenda */}
        <div className="rounded-2xl border border-borde bg-lienzo p-4 shadow-sm" aria-hidden="true">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="size-2.5 rounded-full bg-borde" />
            <span className="size-2.5 rounded-full bg-borde" />
            <span className="size-2.5 rounded-full bg-borde" />
            <span className="ml-3 flex-1 h-7 rounded-md bg-superficie border border-borde text-[11px] text-tenue flex items-center px-3">Agenda de espacios</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Auditorio', 'RESERVADA', 'info', '10:00 – 13:00'],
              ['Laboratorio 1', 'DISPONIBLE', 'exito', 'Libre toda la tarde'],
              ['Cancha de futbol', 'RESERVADA', 'info', '16:00 – 18:00'],
              ['Aula P101', 'DISPONIBLE', 'exito', 'Libre hoy'],
            ].map(([n, e, t, h]) => (
              <div key={n} className="rounded-xl bg-superficie border border-borde p-4">
                <span className={`etiqueta text-[10px] ${t === 'exito' ? 'text-exito-texto' : 'text-info-texto'}`}>{e}</span>
                <p className="font-semibold text-texto text-sm mt-2">{n}</p>
                <p className="text-xs text-texto-2 mt-1 tabular">{h}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="espacios" className="bg-lienzo border-y border-borde">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-14">
          <p className="etiqueta text-oro">Infraestructura del campus</p>
          <h2 className="font-titulo text-2xl font-semibold text-texto mt-2">Espacios que puedes consultar</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ESPACIOS.map((e) => (
              <div key={e.titulo} className="rounded-xl bg-superficie border border-borde p-5">
                <span className="size-11 rounded-lg bg-marino-tinte text-marino grid place-items-center">
                  <Icono nombre={e.icono} className="text-[22px]" />
                </span>
                <p className="font-titulo font-semibold text-texto mt-4">{e.titulo}</p>
                <p className="text-sm text-texto-2 mt-1">{e.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="text-center">
          <p className="etiqueta text-oro">Procedimiento digital</p>
          <h2 className="font-titulo text-2xl font-semibold text-texto mt-2">Cómo funciona</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {PASOS.map((p) => (
            <div key={p.titulo} className="rounded-xl border border-borde p-6">
              <span className="size-11 rounded-lg border border-borde grid place-items-center text-marino">
                <Icono nombre={p.icono} className="text-[22px]" />
              </span>
              <p className="font-titulo font-semibold text-texto mt-5">{p.titulo}</p>
              <p className="text-sm text-texto-2 mt-2 leading-relaxed">{p.texto}</p>
              <p className="mt-5 pt-4 border-t border-borde text-xs text-exito-texto flex items-center gap-1.5">
                <Icono nombre="check_circle" className="text-[16px]" /> {p.pie}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-borde p-6 flex flex-col md:flex-row md:items-center gap-5">
          <span className="size-11 rounded-lg bg-marino text-white grid place-items-center shrink-0">
            <Icono nombre="event" className="text-[22px]" />
          </span>
          <div className="flex-1">
            <p className="font-titulo font-semibold text-texto">¿Necesitas reservar un espacio para una actividad académica?</p>
            <p className="text-sm text-texto-2 mt-1">Los organizadores y administradores reservan auditorios, aulas, laboratorios y canchas desde su panel.</p>
          </div>
          <Link to="/login" className="h-11 px-5 rounded-lg bg-marino text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-marino-osc">
            Nueva reserva <Icono nombre="add" className="text-[18px]" />
          </Link>
        </div>
      </section>

      <footer className="bg-marca text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <Marca claro />
            <p className="text-sm text-white/65 mt-4 leading-relaxed">Instituto Tecnológico de Chilpancingo · Tecnológico Nacional de México. Chilpancingo de los Bravo, Guerrero.</p>
          </div>
          <div>
            <p className="etiqueta text-oro-claro">Navegación</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li><Link to="/login" className="hover:text-white">Agenda de espacios</Link></li>
              <li><a href="#como-funciona" className="hover:text-white">Cómo funciona</a></li>
              <li><Link to="/registro" className="hover:text-white">Crear cuenta</Link></li>
            </ul>
          </div>
          <div>
            <p className="etiqueta text-oro-claro">Proyecto integrador</p>
            <p className="mt-3 text-sm text-white/75">Taller de Programación Web · Arquitectura de microservicios EventoITCH.</p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="max-w-6xl mx-auto px-4 md:px-6 py-5 text-xs text-white/55">© {new Date().getFullYear()} Instituto Tecnológico de Chilpancingo · TecNM</p>
        </div>
      </footer>
    </div>
  );
}
