// Prepara la foto de un espacio antes de subirla a ms-espacios.
// A diferencia de la foto de perfil (prepararFoto de imagen.js, que la recorta cuadrada), aqui NO se recorta:
// un salon o una cancha se ven mejor horizontales. Solo se reduce a 1280 px por lado como maximo y se guarda en JPG,
// asi siempre pesa menos de los 2 MB que acepta el servicio.
const LADO_MAXIMO = 1280;
const PESO_MAXIMO = 2 * 1024 * 1024;
export const TIPOS_FOTO_ESPACIO = ['image/jpeg', 'image/png', 'image/webp'];

export async function prepararFotoEspacio(archivo) {
  if (!TIPOS_FOTO_ESPACIO.includes(archivo.type)) throw new Error('La foto debe ser JPG, PNG o WEBP.');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máximo 15 MB).');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia (el JPG no tiene transparencia)
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    // Si aun asi pesara mas de 2 MB, se baja la calidad poco a poco
    let calidad = 0.88;
    let blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
    while (blob && blob.size > PESO_MAXIMO && calidad > 0.5) {
      calidad -= 0.1;
      blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
    }
    if (!blob) throw new Error('No se pudo preparar la imagen.');
    return new File([blob], 'espacio.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
