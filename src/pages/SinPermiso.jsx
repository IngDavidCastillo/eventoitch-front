import { Link } from 'react-router-dom';
import Icono from '../components/Icono';

export default function SinPermiso() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <span className="size-16 rounded-full bg-peligro-tinte text-peligro grid place-items-center">
        <Icono nombre="lock" className="text-[32px]" />
      </span>
      <p className="etiqueta text-peligro-texto mt-6">Error 403</p>
      <h1 className="font-titulo text-2xl font-semibold text-texto mt-2">No tienes permiso para ver esta sección</h1>
      <p className="text-texto-2 mt-2 max-w-md">Si crees que es un error, contacta al administrador.</p>
      <Link to="/panel" className="mt-8 h-11 px-5 rounded-lg bg-marino text-white font-semibold inline-flex items-center hover:bg-marino-osc">
        Volver a mi panel
      </Link>
    </div>
  );
}
