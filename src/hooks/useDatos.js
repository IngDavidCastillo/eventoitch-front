// Carga datos de una funcion async y da { datos, cargando, error, recargar }.
// La funcion se vuelve a llamar cuando cambian las dependencias.
import { useCallback, useEffect, useState } from 'react';

export default function useDatos(funcion, deps = []) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    funcion()
      .then((datos) => vigente && setEstado({ datos, cargando: false, error: null }))
      .catch((error) => vigente && setEstado((e) => ({ datos: e.datos, cargando: false, error })));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);

  const recargar = useCallback(() => setVuelta((n) => n + 1), []);
  return { ...estado, recargar };
}
