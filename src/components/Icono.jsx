// Icono de Google Material Symbols. Ejemplo: <Icono nombre="dashboard" className="text-[20px]" relleno />
// El CSS de Google fija el tamano en 24px y le gana a las clases de Tailwind, por eso
// el tamano y el color van en el span de afuera y el icono los hereda (fontSize: 'inherit').
export default function Icono({ nombre, className = '', relleno = false }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 ${className}`}>
      <span className={`material-symbols-outlined ${relleno ? 'icono-relleno' : ''}`} style={{ fontSize: 'inherit' }}>
        {nombre}
      </span>
    </span>
  );
}
