// Escudo oficial del Instituto Tecnologico de Chilpancingo, con fondo transparente.
// claro = version blanca (para fondos azules); si no, version azul marino (para fondos claros).
// Los PNG estan en public/img (itch-escudo-blanco.png e itch-escudo-marino.png).
export default function EscudoITCH({ claro = false, className = 'size-12' }) {
  return (
    <img
      src={claro ? '/img/itch-escudo-blanco.png' : '/img/itch-escudo-marino.png'}
      alt="Escudo del Instituto Tecnológico de Chilpancingo"
      title="Instituto Tecnológico de Chilpancingo"
      className={`shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
