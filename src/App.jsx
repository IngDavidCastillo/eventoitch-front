// Rutas: Inicio, login y registro son publicas; lo demas necesita sesion y va dentro del Shell
// (menu lateral, barra superior y panel de nueva reserva). /usuarios es solo para ADMINISTRADOR.
import { Route, Routes } from 'react-router-dom';
import RutaPrivada from './components/RutaPrivada';
import VigilanteSesion from './components/VigilanteSesion';
import Shell from './components/layout/Shell';
import Inicio from './pages/Inicio';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Panel from './pages/Panel';
import Agenda from './pages/Agenda';
import Reservas from './pages/Reservas';
import Usuarios from './pages/Usuarios';
import Perfil from './pages/Perfil';
import NoEncontrado from './pages/NoEncontrado';

const privada = (pagina, roles) => (
  <RutaPrivada roles={roles}>
    <Shell>{pagina}</Shell>
  </RutaPrivada>
);

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/panel" element={privada(<Panel />)} />
        <Route path="/dashboard" element={privada(<Panel />)} />
        <Route path="/agenda" element={privada(<Agenda />)} />
        <Route path="/reservas" element={privada(<Reservas />)} />
        <Route path="/usuarios" element={privada(<Usuarios />, ['ADMINISTRADOR'])} />
        <Route path="/perfil" element={privada(<Perfil />)} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
      <VigilanteSesion />
    </>
  );
}
