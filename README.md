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

Hay dos ramas fijas:

- `develop`: la de trabajo. **Todas las ramas salen de aquí y todos los Pull Request van aquí.**
- `main`: lo que está publicado en https://eventoitch-front.vercel.app. Solo David pasa `develop` a `main` cuando todo está probado. Nadie abre Pull Request hacia `main`.

Pasos para tu vista:

1. Antes de empezar: `git checkout develop && git pull`.
2. Crea tu rama desde `develop`: `git checkout -b vista-eventos`.
3. Cuando esté lista: `git push -u origin vista-eventos` y abre el Pull Request en GitHub. Revisa que arriba diga **base: `develop`** ← `vista-eventos` (si dice `main`, cámbialo con *Edit* junto al título).
4. David lo revisa contra DISENO.md y lo une a `develop`. Cada Pull Request hacia `develop` tiene su propia vista previa en Vercel (el enlace aparece en el Pull Request).
5. Si `develop` cambió mientras trabajabas: `git checkout develop && git pull`, regresa a tu rama y `git merge develop`.

## Subirlo a la nube (Vercel)

1. En Vercel: Add New › Project › repositorio `eventoitch-front` (rama `main`). Vercel detecta Vite: build `npm run build`, carpeta `dist`.
2. Settings › Environment Variables, con las URL **https** públicas de cada servicio (sin `/` al final): `VITE_AUTH_URL`, `VITE_USUARIOS_URL`, `VITE_AGENDA_URL` y, como respaldo, `VITE_ESPACIOS_URL`, `VITE_EVENTOS_URL`, `VITE_CATEGORIAS_URL`. Después de cambiarlas hay que volver a desplegar (Redeploy), porque Vite las mete al compilar.
3. `vercel.json`: ya apunta al Eureka del equipo, `https://eventoitch-eureka.onrender.com` (si cambia, se cambia ahí). Así el indicador de servicios puede leer Eureka (el navegador no puede hacerlo directo porque Eureka no manda permisos CORS). La otra regla manda todas las rutas a `index.html` para que funcionen enlaces como `/restablecer?token=...`.
4. La URL que da Vercel (ej. `https://eventoitch.vercel.app`) va en `CORS_ORIGENES` de los micros y en `FRONT_URL` de ms-autenticacion.

En la nube los micros se registran en Eureka con su nombre público y https; el indicador y la lista de espacios ya usan esa dirección.

### Cómo quedó (17-nov-2026)

URL pública: **https://eventoitch-front.vercel.app** (Vercel, plan Hobby gratis).

| Servicio | Dónde | URL |
| --- | --- | --- |
| Front | Vercel | https://eventoitch-front.vercel.app |
| Eureka | Render (Docker, gratis) | https://eventoitch-eureka.onrender.com |
| ms-autenticacion | Clever Cloud XS + MySQL Clever Cloud | https://app-da385a8b-7643-44a4-bbcd-17e19d0061f3.cleverapps.io |
| ms-usuarios | Railway + MySQL Railway | https://eventoitch-ms-usuarios-production.up.railway.app |
| ms-agenda | Render (Docker, gratis) + TiDB Cloud | https://eventoitch-ms-agenda.onrender.com |

Variables en Vercel: `VITE_AUTH_URL`, `VITE_USUARIOS_URL` y `VITE_AGENDA_URL` con esas URL, y `VITE_ESPACIOS_RESPALDO=1,2,3,4`.

**Antes de una prueba (unos 15 min antes), en este orden:**
1. Abrir https://eventoitch-eureka.onrender.com para despertar Eureka.
2. Railway: MySQL y luego ms-usuarios › Deployments › ⋮ › *Redeploy* (si estaban apagados).
3. Clever Cloud: ms-autenticacion › *START* (3 a 5 min).
4. Abrir https://eventoitch-ms-agenda.onrender.com/actuator/health para despertar agenda.
5. Entrar al front y revisar que el indicador marque los tres servicios en verde.

Para no gastar después: Clever Cloud › *STOP APP* y Railway › ⋮ › *Remove* (los datos se quedan en sus volúmenes). Render, TiDB y Vercel son gratis.