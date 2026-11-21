// Rutas: Inicio, login y registro son publicas; lo demas necesita sesion y va dentro del Shell
// (menu lateral, barra superior y panel de nueva reserva). /usuarios es solo para ADMINISTRADOR.
// Cada pantalla se carga por partes (React.lazy): el navegador solo baja el codigo de la que se abre, asi el archivo
// inicial pesa menos (antes pasaba de 500 kB). Inicio y Login van directo porque son las primeras que se ven.
import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import RutaPrivada from './components/RutaPrivada';
import VigilanteSesion from './components/VigilanteSesion';
import Shell, { CargandoPagina } from './components/layout/Shell';
import Inicio from './pages/Inicio';
import Login from './pages/Login';

const Registro = lazy(() => import('./pages/Registro'));
const Restablecer = lazy(() => import('./pages/Restablecer'));
const Panel = lazy(() => import('./pages/Panel'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Reservas = lazy(() => import('./pages/Reservas'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Categorias = lazy(() => import('./pages/Categorias'));
const Espacios = lazy(() => import('./pages/Espacios'));
const NoEncontrado = lazy(() => import('./pages/NoEncontrado'));

const privada = (pagina, roles) => (
  <RutaPrivada roles={roles}>
    <Shell>{pagina}</Shell>
  </RutaPrivada>
);

export default function App() {
  return (
    <>
      <Suspense fallback={<CargandoPagina />}>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/panel" element={privada(<Panel />)} />
        <Route path="/dashboard" element={privada(<Panel />)} />
        <Route path="/agenda" element={privada(<Agenda />)} />
        <Route path="/reservas" element={privada(<Reservas />)} />
        <Route path="/usuarios" element={privada(<Usuarios />, ['ADMINISTRADOR'])} />
        <Route path="/perfil" element={privada(<Perfil />)} />
        <Route path="/categorias" element={privada(<Categorias />, ['ADMINISTRADOR', 'ORGANIZADOR'])} />
        <Route path="/espacios" element={privada(<Espacios />, ['ADMINISTRADOR', 'ORGANIZADOR'])} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
      </Suspense>
      <VigilanteSesion />
    </>
  );
}
