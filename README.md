# EventoITCH · Front

Front de la plataforma de eventos del ITChilpancingo (proyecto integrador de Taller de Programación Web).
React 19 + Vite + Tailwind CSS v4 + React Router.

**Antes de hacer una vista, lee [DISENO.md](DISENO.md)** (tipografía, colores y componentes del equipo).

## Cómo correrlo

Necesitas Node 20 o más nuevo.

```bash
npm install
cp .env.example .env.local   # en Windows: copy .env.example .env.local
npm run dev                  # abre http://localhost:5173
```

En `.env.local` van las URLs de los microservicios. Ese archivo **no se sube** (está en `.gitignore`).
No pongas contraseñas ni llaves en el front: todo lo que empieza con `VITE_` lo puede ver cualquiera en el navegador.

## Quién hace qué

| Parte | Microservicio | Responsable |
|---|---|---|
| Login, Registro, Usuarios, Mi perfil | ms-autenticacion (8082), ms-usuarios (8081) | David |
| Panel, Agenda de espacios, Reservas | ms-agenda (8086) | David |
| Espacios, Eventos, Categorías | ms-espacios (8085), ms-eventos (8083), ms-categorias (8084) | Roberta |
| Correo de bienvenida | ms-notificaciones (9093) | [compañera] |

## Carpetas

```
src/
  api/          llamadas a cada microservicio (un archivo por servicio)
  components/   ui.jsx (botones, campos, tarjetas...), Icono, layout/Shell (menú y barra)
  context/      AuthContext: sesión, token y perfil
  hooks/        useDatos (cargar datos con estado de carga y error)
  pages/        una vista por archivo
  utils/        fechas, formato, tema (claro/oscuro), imagen
```

## Cómo agregar tu vista

1. Crea `src/pages/TuVista.jsx` siguiendo el ejemplo de DISENO.md.
2. Si llama a tu microservicio, crea o usa `src/api/<servicio>.js` con la función `pedir` de `api/cliente.js`
   y agrega la URL en `.env.example` como `VITE_<SERVICIO>_URL`.
3. Agrega la ruta en `src/App.jsx`:
   `<Route path="/eventos" element={privada(<Eventos />)} />`
   (para limitar por rol: `privada(<Eventos />, ['ADMINISTRADOR', 'ORGANIZADOR'])`).
4. Agrega la opción del menú en `MENU` y el título en `TITULOS` de `src/components/layout/Shell.jsx`.
5. Revisa claro, oscuro y celular, y corre `npm run build`.

## Cómo trabajamos con Git

- Nadie sube directo a `main`. Cada quien trabaja en su rama: `git checkout -b vista-eventos`.
- Cuando tu vista esté lista: `git push -u origin vista-eventos` y abre un Pull Request en GitHub.
- Otra persona del equipo lo revisa contra DISENO.md y lo une a `main`.
- Antes de empezar cada día: `git checkout main && git pull`.
