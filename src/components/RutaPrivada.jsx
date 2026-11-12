// Protege las pantallas privadas. Cada vez que entras a una vista le pregunta a ms-autenticacion
// si el token sigue siendo valido (GET /api/v1/auth/validar); eso tambien cuenta como actividad.
// Si se pasan `roles`, solo esos roles entran; los demas ven la pantalla 403.
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validar } from '../api/auth';
import Icono from './Icono';
import { ErrorServicio } from './ui';
import SinPermiso from '../pages/SinPermiso';
import Shell from './layout/Shell';

export default function RutaPrivada({ roles, children }) {
  const { sesion, olvidarSesion, registrarValidacion, cerrarPorInactividad } = useAuth();
  const { pathname } = useLocation();
  const [resultado, setResultado] = useState(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!sesion) return;
    let vigente = true;
    validar(sesion.token)
      .then((r) => {
        if (!vigente) return;
        if (r.valido === false) olvidarSesion();
        else registrarValidacion(r);
        setResultado({ ruta: pathname, valido: r.valido !== false });
      })
      .catch((err) => {
        if (!vigente) return;
        // 401 = sesion cerrada, inactiva o token vencido; otro error = no se pudo preguntar
        if (err.status === 401) cerrarPorInactividad(err.message);
        else setResultado({ ruta: pathname, error: err.message });
      });
    return () => {
      vigente = false;
    };
  }, [sesion, pathname, intento, olvidarSesion, registrarValidacion, cerrarPorInactividad]);

  if (!sesion) return <Navigate to="/login" replace />;

  if (resultado?.ruta !== pathname) {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-texto-2 text-sm">
        <Icono nombre="progress_activity" className="text-[20px] animate-spin" />
        Verificando tu sesión...
      </div>
    );
  }

  if (resultado.error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <ErrorServicio servicio="El servicio de autenticación" mensaje={resultado.error} onReintentar={() => setIntento((n) => n + 1)} />
      </div>
    );
  }

  if (roles && !roles.includes(sesion.rol))
    return (
      <Shell>
        <SinPermiso />
      </Shell>
    );

  return children;
}
