// Logotipo de texto (el escudo oficial del TecNM se pone despues, no lo inventamos)
export default function Marca({ claro = false, compacto = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`size-10 rounded-lg grid place-items-center font-titulo font-bold text-lg ${claro ? 'bg-white text-[#1b396a]' : 'bg-marino text-white'}`}>E</span>
      {!compacto && (
        <div className="leading-tight">
          <p className={`font-titulo font-semibold text-[17px] ${claro ? 'text-white' : 'text-texto'}`}>EventoITCH</p>
          <p className={`text-xs ${claro ? 'text-white/65' : 'text-texto-2'}`}>TecNM · Campus Chilpancingo</p>
        </div>
      )}
    </div>
  );
}
