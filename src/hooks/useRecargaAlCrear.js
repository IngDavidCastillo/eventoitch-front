// Vuelve a cargar los datos cuando se crea una reserva desde el panel lateral (sube la version)
import { useEffect, useRef } from 'react';
import { useNuevaReserva } from '../components/layout/Shell';

export default function useRecargaAlCrear(recargar) {
  const { version } = useNuevaReserva();
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    recargar();
  }, [version, recargar]);
}
