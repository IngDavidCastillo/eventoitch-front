// Prepara la foto de perfil antes de subirla: la recorta cuadrada (al centro) y la reduce a 512 x 512
// en JPG. Asi pesa poco (unos 50 KB) aunque sea una foto grande del celular.
const LADO = 512;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

export async function prepararFoto(archivo) {
  if (!TIPOS_FOTO.includes(archivo.type)) throw new Error('La foto debe ser JPG, PNG o WEBP.');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máximo 15 MB).');

  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const corte = Math.min(img.naturalWidth, img.naturalHeight);
    const lado = Math.min(LADO, corte);
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, lado, lado);
    ctx.drawImage(img, (img.naturalWidth - corte) / 2, (img.naturalHeight - corte) / 2, corte, corte, 0, 0, lado, lado);
    const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.88));
    if (!blob) throw new Error('No se pudo preparar la imagen.');
    return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
