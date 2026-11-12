// Panel azul con cuadricula de la izquierda en Login y Registro
import Icono from '../components/Icono';
import Marca from '../components/layout/Marca';

export default function LadoInstitucional({ chip, titulo, texto, puntos, pie }) {
  return (
    <aside className="cuadricula relative hidden lg:flex flex-col justify-between w-1/2 min-h-screen p-12 xl:p-16 text-white overflow-hidden">
      <div className="absolute -top-40 -right-40 size-[520px] rounded-full border border-white/10" />
      <div className="flex items-center gap-3">
        <Marca claro />
        <span className="rounded-md border border-oro-borde/70 bg-oro-tinte px-2 py-0.5 text-[11px] font-semibold tracking-wide text-marino">CAMPUS CHILPANCINGO</span>
      </div>
      <div className="max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-marino-osc px-3 py-1 text-xs text-oro-claro">
          <span className="size-1.5 rounded-full bg-oro-claro" />
          {chip}
        </span>
        <h1 className="font-titulo text-4xl xl:text-[44px] font-semibold leading-tight mt-6">{titulo}</h1>
        <p className="text-white/75 mt-4 text-[15px] leading-relaxed">{texto}</p>
        {puntos && (
          <ul className="mt-8 space-y-4 border-t border-white/15 pt-8">
            {puntos.map((p) => (
              <li key={p.titulo} className="flex gap-3">
                <Icono nombre={p.icono ?? 'check_circle'} className="text-[20px] text-oro-claro mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{p.titulo}</p>
                  <p className="text-sm text-white/60">{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-white/15 bg-marino-noche/70 p-5">{pie}</div>
    </aside>
  );
}
