// Barrita animada hasta arriba de la pantalla mientras algun microservicio esta contestando.
// Espera 250 ms antes de salir, para que las respuestas rapidas no hagan parpadear la pantalla.
import { useEffect, useState } from 'react';
import { escuchar, peticionesPendientes } from '../api/cliente';

export default function BarraCarga() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let reloj = null;
    const revisar = (n) => {
      clearTimeout(reloj);
      if (n > 0) reloj = setTimeout(() => setVisible(true), 250);
      else setVisible(false);
    };
    revisar(peticionesPendientes());
    const quitar = escuchar('carga', revisar);
    return () => {
      clearTimeout(reloj);
      quitar();
    };
  }, []);

  return (
    <div className="barra-carga" style={{ opacity: visible ? 1 : 0 }} role="progressbar" aria-hidden={!visible} aria-label="Cargando">
      {visible && <span />}
    </div>
  );
}
