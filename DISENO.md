# Contrato de diseño de EventoITCH (front)

Este documento es el acuerdo del equipo para que **todas las vistas se vean iguales**, las haga quien las haga.
Viene del diseño de Stitch ("TecNM Chilpancingo Institutional System"). Si algo no está aquí, pregunten en el
equipo antes de inventar un estilo nuevo.

> Regla de oro: **no escribas colores en hexadecimal ni `bg-white` / `text-black` en tus vistas.**
> Usa siempre las clases del sistema (`bg-superficie`, `text-texto`, `border-borde`...). Así tu vista
> funciona sola en modo claro **y** en modo oscuro.

---

## 1. Tipografía

| Uso | Fuente | Clase | Tamaño / peso |
|---|---|---|---|
| Títulos de página | Plus Jakarta Sans | `font-titulo` | `text-2xl md:text-[28px] font-semibold` (ya lo hace `<TituloPagina>`) |
| Títulos de tarjeta | Plus Jakarta Sans | `font-titulo` | `text-lg font-semibold` |
| Texto normal | Inter | (por defecto) | `text-sm` (14 px) |
| Texto secundario | Inter | `text-texto-2` | `text-sm` o `text-xs` |
| Etiquetas en mayúsculas | Inter | `etiqueta` | 12 px, 600, mayúsculas |
| Folios y códigos | JetBrains Mono | `font-mono` | `text-xs` |
| Números en tablas | Inter | `tabular` | números del mismo ancho |

- Las fuentes ya se cargan en `index.html`. No agregues otras.
- Iconos: **Material Symbols Outlined**, siempre con `<Icono nombre="calendar_month" />`
  (`src/components/Icono.jsx`). Busca nombres en https://fonts.google.com/icons. No uses emojis ni otras librerías de iconos.

## 2. Colores (tokens)

Están definidos en `src/index.css` (`@theme`). Cada token crea clases `bg-*`, `text-*`, `border-*`, `ring-*`.

| Token | Claro | Para qué |
|---|---|---|
| `lienzo` | #f6f7f9 | Fondo general de la página |
| `superficie` | #ffffff | Tarjetas, barras, modales, tablas |
| `borde` / `borde-suave` | #e4e7ec / #f2f4f7 | Bordes y separadores / fondos muy suaves |
| `texto` | #101828 | Texto principal |
| `texto-2` | #475467 | Texto secundario |
| `tenue` | #98a2b3 | Ayudas, placeholders, deshabilitado |
| `marino` | #1b396a | Azul TecNM: botón principal, enlaces, elemento activo |
| `marino-osc` | #12284b | Hover del botón principal |
| `marino-tinte` | #e8eef7 | Fondo de elemento seleccionado |
| `marca` | #1b396a | Bloques grandes azules (menú lateral, panel del login) |
| `oro` / `oro-texto` / `oro-tinte` / `oro-borde` | #b38e5d ... | Dorado institucional: **solo acentos** (destacados, métricas) |
| `exito` (+ `-texto`, `-tinte`, `-borde`) | #12b76a | Reservado, activo, guardado |
| `aviso` (+ `-texto`, `-tinte`, `-borde`) | #f79009 | Advertencias, mantenimiento |
| `peligro` (+ `-texto`, `-tinte`, `-borde`) | #d92d20 | Errores, borrar, desactivar |
| `info` (+ `-texto`, `-tinte`, `-borde`) | #2e90fa | Mensajes informativos |

**Modo oscuro:** `<html data-tema="oscuro">` cambia el valor de estos mismos tokens (bloque
`:root[data-tema="oscuro"]` en `index.css`). Tu vista no necesita clases `dark:`; si usas los tokens, ya se ve bien.

Combinaciones que sí van:
- Botón principal: `bg-marino text-white`.
- Insignia de estado: `bg-exito-tinte text-exito-texto border-exito-borde` (igual con aviso, peligro, info).
- Texto encima de `bg-marca` o `bg-marino`: `text-white` y `text-white/70` para lo secundario.

Prohibido: `bg-white`, `bg-gray-*`, `text-black`, `text-gray-*`, `bg-blue-*`, colores `#xxxxxx` sueltos,
y `style={{ color: ... }}`. Única excepción: el color de un dato (como en la agenda), usando `var(--color-...)`.

## 3. Espacios, bordes y sombras

- Separación entre bloques: `gap-4` o `gap-6`. Relleno de tarjetas: `p-5` o `p-6`.
- Esquinas: tarjetas `rounded-xl`, botones y campos `rounded-lg`, insignias `rounded-md`, avatares `rounded-full`.
- Sombras: solo `shadow-sm` en tarjetas; `shadow-xl` en modales y paneles.
- Ancho: el contenido ya viene dentro del layout (`Shell`); no pongas márgenes laterales propios.

## 4. Componentes: úsalos, no los copies

Todo está en `src/components/ui.jsx`. Antes de hacer un botón o un campo nuevo, usa estos:

| Componente | Para qué |
|---|---|
| `TituloPagina` | Título + subtítulo + botones arriba de cada vista (**obligatorio en cada vista**) |
| `Tarjeta`, `EncabezadoTarjeta` | Contenedores blancos con borde |
| `Boton` | `variante`: primario, secundario, oro, peligro, fantasma · `tamano`: sm, md, lg · `icono` |
| `Campo` + `Entrada` / `Selector` / `Interruptor` | Formularios con etiqueta, ayuda y error |
| `Insignia`, `Estado` | Etiquetas de estado (ACTIVO, RESERVADA...) |
| `Aviso` | Mensajes: `tipo` = info, exito, aviso, error |
| `Modal`, `Panel` | Ventana al centro / panel lateral derecho |
| `Pestanas`, `Segmentado` | Pestañas y selector de opciones |
| `Esqueleto`, `EsqueletoTabla` | Mientras carga |
| `Vacio` | Cuando no hay datos |
| `ErrorServicio` | Cuando un microservicio no responde (con botón Reintentar) |
| `Avatar`, `SelectorFoto` | Foto o iniciales de un usuario |

Si necesitas un componente que no existe y lo van a usar varias vistas, agrégalo a `ui.jsx` y avísale al equipo.

## 5. Cómo se ve una vista

```jsx
import { Boton, Tarjeta, TituloPagina, Vacio } from '../components/ui';

export default function Eventos() {
  return (
    <>
      <TituloPagina titulo="Eventos" subtitulo="Eventos registrados del instituto.">
        <Boton icono="add">Nuevo evento</Boton>
      </TituloPagina>
      <Tarjeta className="p-6">
        <Vacio icono="event" titulo="Aún no hay eventos">Crea el primero con el botón de arriba.</Vacio>
      </Tarjeta>
    </>
  );
}
```

Toda vista debe tener los tres estados: **cargando** (`Esqueleto`), **sin datos** (`Vacio`) y **error** (`ErrorServicio`).

## 6. Textos

- Todo en español, con acentos (`Página`, `Sesión`).
- Botones con verbo: "Guardar cambios", "Nueva reserva", "Crear usuario".
- Mensajes de error claros para la persona, no el error técnico.

## 7. Revisión antes de subir

1. Se ve bien en modo claro y en modo oscuro (botón de luna arriba a la derecha).
2. Se ve bien en celular (ancho de 390 px).
3. No hay colores en hexadecimal ni `bg-white` en tu archivo.
4. `npm run build` pasa sin errores.
