import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite" // 1. Add this import

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss() // 2. Add this to the plugins list
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})