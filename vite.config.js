import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
// Tailwind CSS v4: el diseno de Stitch usa sus clases (bg-primary, rounded-2xl, etc.)
export default defineConfig(({ mode }) => {
  // EUREKA_URL (en .env.local) es donde corre el servidor Eureka del equipo; por defecto esta en esta misma PC
  const env = loadEnv(mode, process.cwd(), '')
  const eureka = env.EUREKA_URL || 'http://localhost:8761'
  // El navegador no puede leer Eureka directo (no manda permisos CORS), asi que Vite le pasa las peticiones:
  // el front pide /eureka/apps y Vite lo trae de EUREKA_URL/eureka/apps. Lo usa el indicador de servicios.
  const proxy = { '/eureka': { target: eureka, changeOrigin: true } }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})
