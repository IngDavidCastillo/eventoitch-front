// Numero que sube de 0 a su valor en menos de un segundo (para las tarjetas del panel).
// Acepta texto como "42%": anima el numero y deja el resto igual.
import { useEffect, useState } from 'react';

const DURACION = 700;

export default function Contador({ valor }) {
  const texto = String(valor ?? '');
  const coincide = texto.match(/^(\d+)(.*)$/);
  const meta = coincide ? Number(coincide[1]) : null;
  const [actual, setActual] = useState(meta ?? 0);

  useEffect(() => {
    if (meta === null) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.movimiento === 'reducido') {
      setActual(meta);
      return;
    }
    let cuadro;
    const inicio = performance.now();
    const paso = (t) => {
      const avance = Math.min((t - inicio) / DURACION, 1);
      setActual(Math.round(meta * (1 - Math.pow(1 - avance, 3)))); // empieza rapido y frena al final
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [meta]);

  if (meta === null) return texto;
  return (
    <>
      {actual}
      {coincide[2]}
    </>
  );
}
