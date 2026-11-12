import { Link } from 'react-router-dom';
import Marca from '../components/layout/Marca';

export default function NoEncontrado() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-lienzo">
      <Marca />
      <p className="font-titulo text-[96px] font-semibold text-borde leading-none mt-12 tabular">404</p>
      <h1 className="font-titulo text-2xl font-semibold text-texto mt-4">No encontramos esta página</h1>
      <p className="text-texto-2 mt-2 max-w-md">La dirección no existe o cambió. Revisa el enlace o vuelve al inicio.</p>
      <Link to="/" className="mt-8 h-11 px-5 rounded-lg bg-marino text-white font-semibold inline-flex items-center hover:bg-marino-osc">
        Volver al inicio
      </Link>
    </div>
  );
}
