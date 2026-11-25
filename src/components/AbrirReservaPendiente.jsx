// Abre el panel "Nueva reserva" de David al llegar a la Agenda desde otra pantalla (por ejemplo, Eventos > Apartar lugar y fecha).
// El panel vive en Shell y Shell se crea de nuevo en cada ruta: abrirlo antes de navegar lo cerraria. Por eso quien navega
// manda los datos en location.state ({ nuevaReserva: { eventoId, espacioId } }) y aqui se abre ya dentro de la nueva pantalla.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNuevaReserva } from './layout/Shell';

export default function AbrirReservaPendiente() {
  const { state, pathname } = useLocation();
  const navegar = useNavigate();
  const { abrir } = useNuevaReserva();
  const pendiente = state?.nuevaReserva;

  useEffect(() => {
    if (!pendiente) return;
    abrir(pendiente);
    // Se quita para que no se vuelva a abrir al recargar o al regresar
    navegar(pathname, { replace: true, state: null });
  }, [pendiente, abrir, navegar, pathname]);

  return null;
}
