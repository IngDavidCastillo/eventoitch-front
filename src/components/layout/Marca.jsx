// Logotipo de EventoITCH: el icono del proyecto (public/img/logo-icono.png) + nombre.
// claro = sobre fondo azul (barra lateral, panel del login, pie del inicio).
export default function Marca({ claro = false, compacto = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/img/logo-icono.png"
        alt="EventoITCH"
        width={40}
        height={40}
        className={`size-10 rounded-lg shrink-0 ${claro ? 'ring-1 ring-white/40' : ''}`}
      />
      {!compacto && (
        <div className="leading-tight">
          <p className={`font-titulo font-semibold text-[17px] ${claro ? 'text-white' : 'text-texto'}`}>EventoITCH</p>
          <p className={`text-xs ${claro ? 'text-white/65' : 'text-texto-2'}`}>TecNM · Campus Chilpancingo</p>
        </div>
      )}
    </div>
  );
}
