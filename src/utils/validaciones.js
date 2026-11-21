// Reglas de los campos de texto de mis vistas (las mismas que validan mis servicios).
// Se aceptan letras con acentos y ñ; al escribir se quitan los caracteres que no corresponden.

const SIGNOS_NOMBRE = "Solo se permiten letras, números, espacios y los signos . , # ( ) / & ' -";
const SIGNOS_TEXTO = "Solo se permiten letras, números, espacios y los signos . , ; : ( ) ¿ ? ¡ ! \" ' # % & + / _ -";

const CAMPOS = {
  nombre: { invalido: /[^\p{L}\p{N} .,#()/&'-]/gu, max: 100, mensaje: `El nombre no admite ese carácter. ${SIGNOS_NOMBRE}` },
  descripcion: { invalido: /[^\p{L}\p{N} .,;:()¿?¡!"'#%&+/_-]/gu, max: 255, mensaje: `La descripción no admite ese carácter. ${SIGNOS_TEXTO}` },
  ubicacion: { invalido: /[^\p{L}\p{N} .,#()/&'-]/gu, max: 150, mensaje: `La ubicación no admite ese carácter. ${SIGNOS_NOMBRE}` },
};

// Capacidad de un espacio (ms-espacios): numero entero de 5 a 10000
export const CAPACIDAD_MINIMA = 5;
export const CAPACIDAD_MAXIMA = 10000;

// Solo digitos: quita letras, signos y decimales; no deja pasar del maximo
export function filtrarCapacidad(valor) {
  let limpio = valor.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  let error = /\D/.test(valor) ? 'Solo números enteros' : '';
  if (Number(limpio) > CAPACIDAD_MAXIMA) {
    limpio = String(CAPACIDAD_MAXIMA);
    error = `Máximo ${CAPACIDAD_MAXIMA.toLocaleString('es-MX')} personas`;
  }
  return { valor: limpio, error };
}

// Quita los caracteres no permitidos; devuelve el texto limpio y el mensaje si se quito algo
export function filtrarCampo(campo, valor) {
  const regla = CAMPOS[campo];
  let limpio = valor.replace(regla.invalido, '');
  let error = limpio !== valor ? regla.mensaje : '';
  if (limpio.length > regla.max) {
    limpio = limpio.slice(0, regla.max);
    error = `Máximo ${regla.max} caracteres`;
  }
  return { valor: limpio, error };
}

// El nombre debe llevar al menos una letra (no puede ser solo numeros o signos)
export const tieneLetra = (texto) => /\p{L}/u.test(texto);

// Solo la primera letra en mayuscula ("Taller de prueba"), como se escribe en español
export const primeraMayuscula = (t) => (t ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1) : t);

// Sin espacios al inicio ni dobles (se usa mientras se escribe)
export const limpiarEspacios = (t) => t.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');

// Texto corto para mensajes: si pasa de `max` caracteres termina en "..."
export const corto = (t, max = 28) => (t.length > max ? `${t.slice(0, max).trim()}…` : t);

// Busqueda por nombre con caracteres que el servidor no acepta dentro de la ruta /buscar/{nombre}:
// "/" y "\" (400), ".." (404), ";" y "%" (401, que el cliente tomaria como sesion vencida y cerraria la sesion).
// Con esos caracteres la busqueda se hace aqui, sobre la lista, con la misma regla que el servicio (contiene, sin mayusculas).
export const busquedaSegura = (texto) => !/[/\\;%]|\.\./.test(texto);
export const contieneTexto = (nombre, texto) => (nombre ?? '').toLowerCase().includes(texto.toLowerCase());

// Mismo nombre sin importar mayusculas ni espacios de las orillas (como lo compara el servicio)
export const mismoNombre = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
