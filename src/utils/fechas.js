// Fechas en formato local (sin zona horaria), igual que las guarda ms-agenda: "2026-11-12" y "10:00".

export function aIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deIso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export const hoyIso = () => aIso(new Date());

export function sumarDias(iso, n) {
  const d = deIso(iso);
  d.setDate(d.getDate() + n);
  return aIso(d);
}

// Lunes de la semana de esa fecha
export function lunesDe(iso) {
  const d = deIso(iso);
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  return aIso(d);
}

export function diasEntre(desde, hasta) {
  const lista = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) lista.push(f);
  return lista;
}

// "10:30" -> 630
export function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function horas(horaInicio, horaFin) {
  return (minutos(horaFin) - minutos(horaInicio)) / 60;
}

const fmt = (op) => new Intl.DateTimeFormat('es-MX', op);
const corto = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const largo = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const mesAnio = fmt({ month: 'long', year: 'numeric' });

const limpiar = (s) => s.replace(/\./g, '');
export const fechaCorta = (iso) => limpiar(corto.format(deIso(iso)));
export const fechaLarga = (iso) => largo.format(deIso(iso));
export const nombreMes = (iso) => mesAnio.format(deIso(iso));
export const diaSemana = (iso) => limpiar(fmt({ weekday: 'short' }).format(deIso(iso)));

export function rangoSemana(lunes) {
  const dom = sumarDias(lunes, 6);
  const a = deIso(lunes);
  const b = deIso(dom);
  const mes = (d) => limpiar(fmt({ month: 'short' }).format(d));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`;
}

// "hace 2 d", "hace 3 h" a partir de "2026-11-09T08:37:59"
export function haceCuanto(fechaHora) {
  if (!fechaHora) return '';
  const ms = Date.now() - new Date(fechaHora).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
