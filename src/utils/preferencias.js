// Preferencias de esta persona en este navegador (Mi perfil > Preferencias).
// Las visuales (letra, movimiento, contraste, foco) se aplican con atributos data-* en <html>;
// index.html las aplica antes de pintar, igual que el tema. Las demas las leen las pantallas
// con preferencia('nombre') (Login, Agenda, Reservas, Nueva reserva y los atajos del Shell).
import { useSyncExternalStore } from 'react';

const CLAVE = 'eventoitch-preferencias';
const INICIALES = {
  letra: 'normal', // normal | grande | muy-grande
  movimiento: 'normal', // normal | reducido
  contraste: 'normal', // normal | alto
  foco: 'normal', // normal | resaltado (subraya enlaces y marca fuerte el foco del teclado)
  inicio: '/panel', // pantalla al entrar: /panel | /agenda | /reservas
  vistaAgenda: 'auto', // auto | semana | dia
  liberadasAgenda: true, // mostrar en la agenda las reservas liberadas
  rangoReservas: 'dos', // semana | dos | mes | pasada (igual que RANGOS en Reservas)
  duracion: 120, // minutos de una reserva nueva
  espacioFavorito: null, // id del espacio que se elige solo en Nueva reserva
  recordarEvento: false, // Nueva reserva empieza con el ultimo evento usado
  ultimoEvento: null,
  atajos: true, // atajos de teclado (ver ATAJOS en Shell)
};
const VISUALES = ['letra', 'movimiento', 'contraste', 'foco'];
const oyentes = new Set();

function leer() {
  try {
    return { ...INICIALES, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') };
  } catch {
    return { ...INICIALES };
  }
}

let actuales = leer();

function aplicar() {
  const html = document.documentElement;
  VISUALES.forEach((v) => {
    html.dataset[v] = actuales[v];
  });
}

/** Valor actual de una preferencia, para usarlo fuera de React o al iniciar un estado */
export const preferencia = (nombre) => actuales[nombre];

/** true si alguna preferencia es distinta a la de fabrica (sin contar el ultimo evento usado) */
export const hayCambios = (p) => Object.keys(INICIALES).some((k) => k !== 'ultimoEvento' && p[k] !== INICIALES[k]);

export function cambiarPreferencia(nombre, valor) {
  actuales = { ...actuales, [nombre]: valor };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actuales));
  } catch {
    // Sin localStorage (modo privado): dura mientras la pestana este abierta
  }
  aplicar();
  oyentes.forEach((f) => f());
}

export function restablecerPreferencias() {
  actuales = { ...INICIALES };
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
  aplicar();
  oyentes.forEach((f) => f());
}

const suscribir = (f) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** const [prefs, cambiar] = usePreferencias();  cambiar('letra', 'grande') */
export function usePreferencias() {
  const prefs = useSyncExternalStore(suscribir, () => actuales);
  return [prefs, cambiarPreferencia];
}
