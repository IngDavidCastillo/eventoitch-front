// Carga datos de una funcion async y da { datos, cargando, error, recargar }.
// La funcion se vuelve a llamar cuando cambian las dependencias.
// Con `clave`, lo ultimo que se cargo se guarda en memoria: al volver a esa pantalla se muestra
// al instante y se actualiza por detras (la barra de carga de arriba avisa que se esta revisando).
import { useCallback, useEffect, useState } from 'react';

const memoria = new Map();

export default function useDatos(funcion, deps = [], clave = null) {
  const [estado, setEstado] = useState(() => ({ datos: clave ? (memoria.get(clave) ?? null) : null, cargando: true, error: null }));
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ datos: clave && memoria.has(clave) ? memoria.get(clave) : e.datos, cargando: true, error: null }));
    funcion()
      .then((datos) => {
        if (clave) memoria.set(clave, datos);
        if (vigente) setEstado({ datos, cargando: false, error: null });
      })
      .catch((error) => vigente && setEstado((e) => ({ datos: e.datos, cargando: false, error })));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);

  const recargar = useCallback(() => setVuelta((n) => n + 1), []);
  return { ...estado, recargar };
}
