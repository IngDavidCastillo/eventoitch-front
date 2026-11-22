// Llaves de acceso (passkeys / WebAuthn): lo que habla con el navegador.
// La libreria @simplewebauthn/browser se carga solo cuando se usa (no pesa en la primera pantalla).
// El servidor da { solicitud, publicKey }; publicKey va directo a la libreria.

// true si el navegador sabe usar llaves de acceso (todos los modernos; no los muy viejos ni algunos en modo incognito)
export function soportaLlaves() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

// Pide la huella/rostro/PIN y firma con una llave guardada (login)
export async function firmarConLlave(publicKey) {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  try {
    return await startAuthentication({ optionsJSON: publicKey });
  } catch (err) {
    throw new Error(mensaje(err));
  }
}

// Pide la huella/rostro/PIN y crea una llave nueva en este dispositivo (o en el celular, con el QR)
export async function crearEnDispositivo(publicKey) {
  const { startRegistration } = await import('@simplewebauthn/browser');
  try {
    return await startRegistration({ optionsJSON: publicKey });
  } catch (err) {
    throw new Error(mensaje(err));
  }
}

// Los errores del navegador traducidos (NotAllowedError es el mas comun: se cancelo o se acabo el tiempo)
function mensaje(err) {
  const nombre = err?.cause?.name ?? err?.name;
  if (nombre === 'NotAllowedError') return 'Se canceló o se acabó el tiempo. Inténtalo de nuevo.';
  if (nombre === 'InvalidStateError') return 'Este dispositivo ya tiene una llave de acceso para tu cuenta.';
  if (nombre === 'SecurityError') return 'Las llaves de acceso solo funcionan en la dirección oficial del sitio.';
  if (nombre === 'NotSupportedError') return 'Este navegador o dispositivo no admite llaves de acceso.';
  return err?.message || 'No se pudo usar la llave de acceso.';
}
