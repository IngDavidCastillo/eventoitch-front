// Boton redondo para cambiar entre modo claro y oscuro (barra superior, inicio, login y registro).
import { useTema } from '../utils/tema';
import Icono from './Icono';

export default function BotonTema({ className = '', sobreAzul = false }) {
  const [tema, setTema] = useTema();
  const oscuro = tema === 'oscuro';
  const texto = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button
      type="button"
      onClick={() => setTema(oscuro ? 'claro' : 'oscuro')}
      aria-label={texto}
      title={texto}
      className={`size-10 shrink-0 rounded-lg grid place-items-center transition-colors ${
        sobreAzul ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-texto-2 hover:text-texto hover:bg-borde-suave border border-borde'
      } ${className}`}
    >
      <Icono nombre={oscuro ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
    </button>
  );
}

/** Selector Claro / Oscuro con texto, para la pagina Mi perfil */
export function SelectorTema() {
  const [tema, setTema] = useTema();
  const opciones = [
    { valor: 'claro', texto: 'Claro', icono: 'light_mode' },
    { valor: 'oscuro', texto: 'Oscuro', icono: 'dark_mode' },
  ];
  return (
    <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-2 gap-3 max-w-sm">
      {opciones.map((o) => {
        const activo = tema === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => setTema(o.valor)}
            className={`rounded-xl border-2 p-3 text-left transition-colors ${activo ? 'border-marino bg-marino-tinte/50' : 'border-borde hover:border-tenue'}`}
          >
            <span
              className={`block h-14 rounded-lg border mb-3 overflow-hidden ${o.valor === 'oscuro' ? 'bg-[#0a1120] border-[#22304a]' : 'bg-[#f6f7f9] border-[#e4e7ec]'}`}
            >
              <span className={`block h-3 ${o.valor === 'oscuro' ? 'bg-[#0d1a33]' : 'bg-[#1b396a]'}`} />
              <span className={`block m-2 h-5 rounded ${o.valor === 'oscuro' ? 'bg-[#111b2e]' : 'bg-superficie'}`} />
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-texto">
              <Icono nombre={o.icono} className="text-[18px]" />
              {o.texto}
            </span>
          </button>
        );
      })}
    </div>
  );
}
