// Esqueleto de las pantallas privadas: menu lateral azul (escritorio), barra superior,
// pie institucional y barra de pestanas abajo en celular. Tambien abre el panel "Nueva reserva"
// desde cualquier pantalla con useNuevaReserva().
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES_QUE_RESERVAN, nombreCompleto, nombreTipo } from '../../utils/formato';
import Icono from '../Icono';
import { Avatar, Boton, Modal } from '../ui';
import { preferencia } from '../../utils/preferencias';
import Marca from './Marca';
import BotonTema from '../BotonTema';
import IndicadorServicios from '../IndicadorServicios';
import BarraCarga from '../BarraCarga';
import NuevaReserva from '../../pages/NuevaReserva';

const ReservaContext = createContext(null);
export const useNuevaReserva = () => useContext(ReservaContext);

const MENU = [
  { a: '/panel', texto: 'Inicio', icono: 'space_dashboard' },
  { a: '/agenda', texto: 'Agenda de espacios', icono: 'calendar_month' },
  { a: '/reservas', texto: 'Reservas', icono: 'event_available' },
  { a: '/usuarios', texto: 'Usuarios', icono: 'group', roles: ['ADMINISTRADOR'] },
];

const TITULOS = { '/panel': 'Panel principal', '/agenda': 'Agenda', '/reservas': 'Reservas', '/usuarios': 'Usuarios', '/perfil': 'Mi perfil' };

function MenuLateral({ onNueva }) {
  const { sesion, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const reserva = ROLES_QUE_RESERVAN.includes(sesion.rol);
  const item = ({ isActive }) =>
    `relative flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${isActive ? 'bg-white/[0.12] text-white font-semibold' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'}`;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] flex-col bg-marca text-white z-30">
      <div className="px-5 h-16 flex items-center border-b border-white/10">
        <Marca claro />
      </div>
      <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-6">
        {reserva && (
          <Boton variante="oro" icono="add" onClick={onNueva} className="w-full">
            Nueva reserva
          </Boton>
        )}
        <nav className="flex flex-col gap-1">
          {MENU.filter((m) => !m.roles || m.roles.includes(sesion.rol)).map((m) => (
            <NavLink key={m.a} to={m.a} className={item}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r bg-oro" />}
                  <Icono nombre={m.icono} className="text-[20px]" relleno={isActive} />
                  {m.texto}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div>
          <p className="etiqueta text-white/45 px-3 mb-2">Mi cuenta</p>
          <nav className="flex flex-col gap-1">
            <NavLink to="/perfil" className={item}>
              <Icono nombre="person" className="text-[20px]" />
              Mi perfil
            </NavLink>
            <button
              onClick={async () => {
                await cerrarSesion();
                navigate('/login');
              }}
              className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
            >
              <Icono nombre="logout" className="text-[20px]" />
              Cerrar sesión
            </button>
          </nav>
        </div>
      </div>
    </aside>
  );
}

function BarraSuperior() {
  const { sesion, perfil } = useAuth();
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-20 h-16 bg-superficie/95 backdrop-blur border-b border-borde flex items-center gap-4 px-4 md:px-8">
      <div className="lg:hidden">
        <Marca compacto />
      </div>
      <nav aria-label="Ruta" className="hidden md:flex items-center gap-2 text-sm">
        <Link to="/panel" className="text-texto-2 hover:text-texto">
          Inicio
        </Link>
        <Icono nombre="chevron_right" className="text-[16px] text-tenue" />
        <span className="font-semibold text-texto">{TITULOS[pathname] ?? 'EventoITCH'}</span>
      </nav>
      <p className="md:hidden font-titulo font-semibold text-texto">{TITULOS[pathname]}</p>
      <div className="ml-auto flex items-center gap-3">
        <IndicadorServicios />
        <BotonTema />
        <Link to="/perfil" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-borde-suave">
          <div className="hidden sm:block text-right leading-tight">
            <p className="text-sm font-semibold text-texto">{perfil ? nombreCompleto(perfil) : '...'}</p>
            <p className="etiqueta text-[10px] text-oro">{nombreTipo(sesion.rol)}</p>
          </div>
          <Avatar perfil={perfil} />
        </Link>
      </div>
    </header>
  );
}

function PieInstitucional() {
  return (
    <footer className="mt-10 border-t border-borde px-4 md:px-8 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-texto-2">
      <p>
        <b className="text-texto">EventoITCH</b> · Instituto Tecnológico de Chilpancingo · TecNM
      </p>
      <p>Sistema de gestión de eventos y espacios</p>
    </footer>
  );
}

// Pestanas abajo en celular: Inicio, Agenda, Reservas, Perfil
function BarraCelular({ onNueva }) {
  const { sesion } = useAuth();
  const reserva = ROLES_QUE_RESERVAN.includes(sesion.rol);
  const tabs = [
    { a: '/panel', texto: 'Inicio', icono: 'home' },
    { a: '/agenda', texto: 'Agenda', icono: 'calendar_month' },
    { a: '/reservas', texto: 'Reservas', icono: 'event_available' },
    { a: '/perfil', texto: 'Perfil', icono: 'person' },
  ];
  return (
    <>
      {reserva && (
        <button
          onClick={onNueva}
          aria-label="Nueva reserva"
          className="lg:hidden fixed z-30 right-4 bottom-20 h-12 pl-4 pr-5 rounded-full bg-marino text-white shadow-lg flex items-center gap-2 text-sm font-semibold"
        >
          <Icono nombre="add" className="text-[20px]" />
          Nueva reserva
        </button>
      )}
      <nav className="lg:hidden fixed z-30 bottom-0 inset-x-0 h-16 bg-superficie border-t border-borde grid grid-cols-4">
        {tabs.map((t) => (
          <NavLink key={t.a} to={t.a} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-marino' : 'text-texto-2'}`}>
            {({ isActive }) => (
              <>
                <Icono nombre={t.icono} className="text-[22px]" relleno={isActive} />
                {t.texto}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

// Atajos de teclado (se apagan en Mi perfil > Preferencias). No se activan mientras se escribe en un campo.
export const ATAJOS = [
  { tecla: 'N', texto: 'Nueva reserva', roles: ROLES_QUE_RESERVAN },
  { tecla: 'I', texto: 'Ir a Inicio', a: '/panel' },
  { tecla: 'A', texto: 'Ir a la Agenda', a: '/agenda' },
  { tecla: 'R', texto: 'Ir a Reservas', a: '/reservas' },
  { tecla: 'U', texto: 'Ir a Usuarios', a: '/usuarios', roles: ['ADMINISTRADOR'] },
  { tecla: 'P', texto: 'Ir a Mi perfil', a: '/perfil' },
  { tecla: '?', texto: 'Ver esta lista de atajos' },
];

function useAtajos(abrir, setAyuda) {
  const { sesion } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    function tecla(e) {
      if (!preferencia('atajos') || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || document.querySelector('[role="dialog"]')) return;
      const k = e.key === '?' ? '?' : e.key.toUpperCase();
      const atajo = ATAJOS.find((x) => x.tecla === k && (!x.roles || x.roles.includes(sesion.rol)));
      if (!atajo) return;
      e.preventDefault();
      if (k === '?') setAyuda(true);
      else if (k === 'N') abrir();
      else navigate(atajo.a);
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abrir, navigate, setAyuda, sesion.rol]);
}

function AyudaAtajos({ abierta, onCerrar }) {
  const { sesion } = useAuth();
  return (
    <Modal abierto={abierta} onCerrar={onCerrar}>
      <div className="p-6">
        <h2 className="font-titulo text-lg font-semibold text-texto">Atajos de teclado</h2>
        <p className="text-sm text-texto-2 mt-1 mb-4">Funcionan cuando no estás escribiendo en un campo. Se apagan en Mi perfil, Preferencias.</p>
        <ul className="divide-y divide-borde-suave">
          {ATAJOS.filter((x) => !x.roles || x.roles.includes(sesion.rol)).map((x) => (
            <li key={x.tecla} className="flex items-center justify-between py-2 text-sm text-texto">
              {x.texto}
              <kbd className="min-w-7 h-7 px-2 grid place-items-center rounded-md border border-borde bg-lienzo font-mono text-xs font-semibold text-texto-2">{x.tecla}</kbd>
            </li>
          ))}
        </ul>
        <div className="flex justify-end mt-5">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

export default function Shell({ children }) {
  // Al cambiar de pantalla, el contenido entra con una animacion suave (key en <main>)
  const { pathname } = useLocation();
  // version sube cada vez que se crea una reserva, para que las pantallas recarguen
  const [nueva, setNueva] = useState({ abierta: false, inicial: null, version: 0 });
  const abrir = useCallback((inicial = null) => setNueva((n) => ({ ...n, abierta: true, inicial })), []);
  const valor = { abrir, version: nueva.version };
  const [ayuda, setAyuda] = useState(false);
  useAtajos(abrir, setAyuda);

  return (
    <ReservaContext.Provider value={valor}>
      <div className="min-h-screen bg-lienzo">
        <BarraCarga />
        <MenuLateral onNueva={() => abrir()} />
        <div className="lg:pl-[260px] flex flex-col min-h-screen pb-16 lg:pb-0">
          <BarraSuperior />
          <main key={pathname} className="aparecer flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8">
            {children}
          </main>
          <PieInstitucional />
        </div>
        <BarraCelular onNueva={() => abrir()} />
        <AyudaAtajos abierta={ayuda} onCerrar={() => setAyuda(false)} />
        <NuevaReserva
          abierta={nueva.abierta}
          inicial={nueva.inicial}
          onCerrar={() => setNueva((n) => ({ ...n, abierta: false }))}
          onCreada={() => setNueva((n) => ({ ...n, version: n.version + 1 }))}
        />
      </div>
    </ReservaContext.Provider>
  );
}
