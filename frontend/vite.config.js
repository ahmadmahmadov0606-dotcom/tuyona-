import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Дар вақти коркард (npm run dev) дархостҳои /api ва /uploads ба FastAPI мераванд.
// Суроғаи backend-ро бо API_URL иваз кардан мумкин (run.sh инро мекунад, агар порт банд бошад).
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_URL,
      '/uploads': API_URL,
    },
  },
})
