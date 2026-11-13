// Guarda la sesion (token, usuarioId, rol) y el perfil, y los comparte con todas las pantallas.
// "Mantener sesion" la guarda en localStorage (sobrevive al cerrar el navegador);
// si no, en sessionStorage (se borra al cerrar la pestana).
// Tambien lleva la cuenta de la inactividad: ms-autenticacion cierra la sesion tras N minutos sin uso.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { obtenerUsuario } from '../api/usuarios';
import { escuchar } from '../api/cliente';

const AuthContext = createContext(null);
const CLAVE = 'eventoitch.sesion';

function leerSesion() {
  try {
    const guardada = localStorage.getItem(CLAVE) ?? sessionStorage.getItem(CLAVE);
    const sesion = JSON.parse(guardada);
    return sesion && sesion.expiraEn > Date.now() ? sesion : null;
  } catch {
    return null;
  }
}

function guardar(sesion) {
  // Se borra la sesion vieja del otro lado: si no, al recargar se leeria un token que ya no vale
  // ("La sesion ya fue cerrada") porque leerSesion() mira primero localStorage.
  (sesion.recordar ? sessionStorage : localStorage).removeItem(CLAVE);
  (sesion.recordar ? localStorage : sessionStorage).setItem(CLAVE, JSON.stringify(sesion));
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const [perfil, setPerfil] = useState(null);
  // Minutos de inactividad que permite el backend (llega en /validar) y ultima vez que se uso
  const [inactividad, setInactividad] = useState({ minutos: 15, ultima: Date.now() });
  // Motivo por el que se cerro la sesion sin que el usuario lo pidiera (para el aviso)
  const [cierre, setCierre] = useState(null);

  const olvidarSesion = useCallback(() => {
    localStorage.removeItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    setSesion(null);
    setPerfil(null);
  }, []);

  async function iniciarSesion(username, password, recordar) {
    const r = await authApi.login(username, password);
    abrir(r, recordar);
  }

  // Registro publico: el backend responde igual que el login, asi que la sesion queda abierta
  async function registrarse(datos) {
    const r = await authApi.registro(datos);
    abrir(r, false);
    return r;
  }

  function abrir(r, recordar) {
    const nueva = {
      token: r.token,
      usuarioId: r.usuarioId,
      rol: r.rol,
      recordar,
      iniciadaEn: Date.now(),
      expiraEn: Date.now() + r.expiraEnSegundos * 1000,
    };
    guardar(nueva);
    setCierre(null);
    setInactividad((i) => ({ ...i, ultima: Date.now() }));
    setSesion(nueva);
  }

  // Avisa al backend (borra token_activo) y limpia el navegador aunque el backend falle
  async function cerrarSesion() {
    if (sesion) {
      try {
        await authApi.logout(sesion.token);
      } catch {
        // si el token ya no servia, de todos modos cerramos aqui
      }
    }
    olvidarSesion();
  }

  // Lo llama RutaPrivada con la respuesta de /validar
  const registrarValidacion = useCallback((r) => {
    if (r?.ultimaActividad && r?.inactivaEn) {
      const min = Math.round((new Date(r.inactivaEn) - new Date(r.ultimaActividad)) / 60000);
      setInactividad({ minutos: min > 0 ? min : 0, ultima: Date.now() });
    } else {
      setInactividad((i) => ({ ...i, ultima: Date.now() }));
    }
  }, []);

  const cerrarPorInactividad = useCallback(
    (mensaje) => {
      setCierre(mensaje ?? 'Tu sesión se cerró por inactividad.');
      olvidarSesion();
    },
    [olvidarSesion],
  );

  // Cada llamada que sale bien cuenta como actividad; un 401 con sesion abierta la cierra
  useEffect(() => {
    const quitarA = escuchar('actividad', () => setInactividad((i) => ({ ...i, ultima: Date.now() })));
    const quitarB = escuchar('noAutorizado', (msg) => {
      if (leerSesion()) cerrarPorInactividad(msg);
    });
    return () => {
      quitarA();
      quitarB();
    };
  }, [cerrarPorInactividad]);

  // Perfil del usuario (nombre, foto, tipo) desde ms-usuarios
  const recargarPerfil = useCallback(async () => {
    if (!sesion) return;
    try {
      setPerfil(await obtenerUsuario(sesion.usuarioId, sesion.token));
    } catch {
      setPerfil((p) => p ?? { id: sesion.usuarioId, nombre: 'Usuario', apellidos: '', tipoUsuario: sesion.rol });
    }
  }, [sesion]);

  useEffect(() => {
    recargarPerfil();
  }, [recargarPerfil]);

  return (
    <AuthContext.Provider
      value={{
        sesion,
        perfil,
        setPerfil,
        recargarPerfil,
        iniciarSesion,
        registrarse,
        cerrarSesion,
        olvidarSesion,
        inactividad,
        registrarValidacion,
        cerrarPorInactividad,
        cierre,
        setCierre,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
