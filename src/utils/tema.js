// Modo claro / oscuro. Se guarda en el navegador (localStorage) y se aplica con <html data-tema="...">.
// Si la persona nunca eligio, se usa el del sistema operativo. index.html lo aplica antes de pintar
// la pagina para que no haya un "parpadeo" blanco al cargar en modo oscuro.
import { useSyncExternalStore } from 'react';

const CLAVE = 'eventoitch-tema';
const oyentes = new Set();
const sistema = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');

function leerGuardado() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'oscuro' || t === 'claro' ? t : null;
  } catch {
    return null;
  }
}

export const temaActual = () => document.documentElement.dataset.tema || leerGuardado() || sistema();

function aplicar(tema, animar) {
  const html = document.documentElement;
  if (animar) {
    html.classList.add('tema-transicion');
    window.setTimeout(() => html.classList.remove('tema-transicion'), 300);
  }
  html.dataset.tema = tema;
  oyentes.forEach((f) => f());
}

export function cambiarTema(tema) {
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin localStorage (modo privado): el tema dura mientras la pestana este abierta
  }
  aplicar(tema, true);
}

// Si nunca eligio, sigue al sistema operativo cuando este cambia
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (!leerGuardado()) aplicar(sistema(), true);
});

const suscribir = (f) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** const [tema, setTema] = useTema();  tema es 'claro' u 'oscuro' */
export function useTema() {
  const tema = useSyncExternalStore(suscribir, temaActual);
  return [tema, cambiarTema];
}
