// Indicador de servicios en vivo (como el de "cobros con tarjeta" de una caja).
// Cada pocos segundos: 1) le pregunta a Eureka quien esta registrado y 2) toca la puerta de cada servicio
// para confirmar que de verdad responde. Asi un servicio apagado se pone en rojo en segundos,
// sin esperar los 90 s que tarda Eureka en darlo de baja.
import { useSyncExternalStore } from 'react';
import { AGENDA_URL, AUTH_URL, CATEGORIAS_URL, ESPACIOS_URL, EVENTOS_URL, USUARIOS_URL } from './cliente';

const CADA_MS = 3000; // cada cuanto se revisa
const ESPERA_MS = 2500; // cuanto se espera a que un servicio conteste

// Los que esperamos ver. Si alguien registra otro servicio en Eureka, tambien aparece en la lista.
const CONOCIDOS = [
  { id: 'MS-AUTENTICACION', nombre: 'Autenticación', de: 'David', mio: true, url: AUTH_URL },
  { id: 'MS-USUARIOS', nombre: 'Usuarios', de: 'David', mio: true, url: USUARIOS_URL },
  { id: 'MS-AGENDA', nombre: 'Agenda', de: 'David', mio: true, url: AGENDA_URL },
  { id: 'MS-ESPACIOS', nombre: 'Espacios', de: 'Roberta', url: ESPACIOS_URL },
  { id: 'MS-EVENTOS', nombre: 'Eventos', de: 'Roberta', url: EVENTOS_URL },
  { id: 'MS-CATEGORIAS', nombre: 'Categorías', de: 'Roberta', url: CATEGORIAS_URL },
  { id: 'MS-NOTIFICACIONES', nombre: 'Notificaciones', de: 'Compañera', url: '' },
];

let estado = { servicios: [], eureka: 'cargando', revisado: null, general: 'cargando' };
const desde = new Map(); // id -> { en: true/false, hora }
const oyentes = new Set();
let reloj = null;
let revisando = false;

const avisar = () => oyentes.forEach((f) => f());

// fetch "no-cors": no lee la respuesta, solo confirma que el servidor contesto (aunque sea 401 o 404).
// Si el servicio esta apagado o no se alcanza, fetch falla.
async function responde(base) {
  if (!base) return false;
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    await fetch(`${base.replace(/\/$/, '')}/actuator/health`, { mode: 'no-cors', cache: 'no-store', signal: control.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function leerEureka() {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    const r = await fetch('/eureka/apps', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: control.signal });
    if (!r.ok) return null;
    const datos = await r.json();
    const apps = [].concat(datos?.applications?.application ?? []);
    const mapa = new Map();
    for (const app of apps) {
      const inst = [].concat(app.instance ?? []).find((i) => i.status === 'UP') ?? [].concat(app.instance ?? [])[0];
      if (inst) mapa.set(app.name.toUpperCase(), { url: `http://${inst.ipAddr}:${inst.port?.$ ?? inst.port}`, estado: inst.status });
    }
    return mapa;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function nombreBonito(id) {
  const s = id.replace(/^MS-/, '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function revisar() {
  if (revisando) return;
  revisando = true;
  try {
    const registro = await leerEureka();
    const lista = [...CONOCIDOS];
    if (registro) {
      for (const id of registro.keys()) if (!lista.some((s) => s.id === id)) lista.push({ id, nombre: nombreBonito(id), de: 'Equipo', url: '' });
    }
    const servicios = await Promise.all(
      lista.map(async (s) => {
        const enEureka = registro?.get(s.id);
        // Primero se prueba la direccion que usa el front (.env.local); si no hay o no contesta, la que dio
        // el servicio a Eureka. (Eureka guarda la IP que tenia la PC al arrancar el micro: si cambias de red,
        // esa IP queda vieja hasta que reinicies el micro.)
        let url = s.url || enEureka?.url || '';
        let vivo = await responde(url);
        if (!vivo && enEureka?.url && enEureka.url !== url && (await responde(enEureka.url))) {
          url = enEureka.url;
          vivo = true;
        }
        let motivo;
        if (vivo) motivo = enEureka || !registro ? 'En línea' : 'En línea, sin registrar en Eureka';
        else if (registro && !enEureka) motivo = 'No registrado en Eureka';
        else motivo = 'No responde';
        const previo = desde.get(s.id);
        if (!previo || previo.en !== vivo) desde.set(s.id, { en: vivo, hora: new Date() });
        return { ...s, url, vivo, enEureka: Boolean(enEureka), motivo, desde: desde.get(s.id).hora };
      }),
    );
    const misCaidos = servicios.some((s) => s.mio && !s.vivo);
    const otrosCaidos = servicios.some((s) => !s.mio && !s.vivo) || !registro;
    estado = {
      servicios,
      eureka: registro ? 'ok' : 'caido',
      revisado: new Date(),
      general: misCaidos ? 'rojo' : otrosCaidos ? 'amarillo' : 'verde',
    };
    avisar();
  } finally {
    revisando = false;
  }
}

function arrancar() {
  if (reloj) return;
  revisar();
  reloj = setInterval(() => document.visibilityState === 'visible' && revisar(), CADA_MS);
  // Al volver a la pestana o al recuperar internet se revisa en ese momento
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('online', revisar);
}
function detener() {
  clearInterval(reloj);
  reloj = null;
  document.removeEventListener('visibilitychange', alVolver);
  window.removeEventListener('online', revisar);
}
function alVolver() {
  if (document.visibilityState === 'visible') revisar();
}

function suscribir(f) {
  oyentes.add(f);
  if (oyentes.size === 1) arrancar();
  return () => {
    oyentes.delete(f);
    if (oyentes.size === 0) detener();
  };
}

/** Estado en vivo: { servicios, eureka, revisado, general: 'verde' | 'amarillo' | 'rojo' | 'cargando' } */
export function useServicios() {
  return useSyncExternalStore(suscribir, () => estado);
}

export const revisarAhora = revisar;

/** true solo si el indicador ya comprobo que ese servicio no responde (si aun no sabe, false). */
export function servicioCaido(id) {
  return estado.servicios.some((s) => s.id === id && !s.vivo);
}
export const SEGUNDOS = CADA_MS / 1000;
