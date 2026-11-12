import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Tailwind CSS v4: el diseno de Stitch usa sus clases (bg-primary, rounded-2xl, etc.)
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
