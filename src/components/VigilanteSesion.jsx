// Avisa un minuto antes de que la sesion se cierre por inactividad ("Seguir conectado")
// y muestra la ventana "Tu sesion se cerro" cuando ya paso.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validar } from '../api/auth';
import Icono from './Icono';
import { Boton, Modal } from './ui';

export default function VigilanteSesion() {
  const { sesion, inactividad, registrarValidacion, cerrarPorInactividad, cierre, setCierre } = useAuth();
  const navigate = useNavigate();
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const limite = inactividad.minutos * 60000;
  const restante = sesion && limite > 0 ? inactividad.ultima + limite - ahora : Infinity;

  useEffect(() => {
    if (sesion && restante <= 0) cerrarPorInactividad('Pasaron ' + inactividad.minutos + ' minutos sin actividad. Por seguridad cerramos tu sesión.');
  }, [sesion, restante, inactividad.minutos, cerrarPorInactividad]);

  async function seguir() {
    try {
      registrarValidacion(await validar(sesion.token));
    } catch (e) {
      cerrarPorInactividad(e.message);
    }
  }

  function ir(ruta) {
    setCierre(null);
    navigate(ruta);
  }

  return (
    <>
      {sesion && restante > 0 && restante <= 60000 && (
        <div role="status" className="fixed z-50 bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-[420px] flex items-center gap-3 rounded-xl bg-tostada text-white px-4 py-3 shadow-xl">
          <Icono nombre="timer" className="text-[22px] text-oro-claro" />
          <p className="flex-1 text-sm">
            Tu sesión se cerrará en <b className="tabular">{Math.ceil(restante / 1000)} s</b> por inactividad
          </p>
          <button onClick={seguir} className="text-sm font-semibold text-oro-claro hover:underline">
            Seguir conectado
          </button>
        </div>
      )}

      <Modal abierto={!!cierre && !sesion} onCerrar={() => ir('/')}>
        <div className="p-6 text-center">
          <span className="mx-auto size-14 rounded-full bg-marino-tinte text-marino grid place-items-center mb-4">
            <Icono nombre="schedule" className="text-[28px]" />
          </span>
          <h2 className="font-titulo text-xl font-semibold text-texto">Tu sesión se cerró</h2>
          <p className="text-sm text-texto-2 mt-2">{cierre}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Boton tamano="lg" onClick={() => ir('/login')}>
              Iniciar sesión
            </Boton>
            <Boton variante="secundario" onClick={() => ir('/')}>
              Ir al inicio
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
