import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 3000,
    headers: {
      "Content-Security-Policy": 
        command === "serve"
          ? // Development: Allow inline scripts for HMR and React plugin
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://lmsapi.suraksha.lk https://*.s3.us-east-1.amazonaws.com wss: ws: localhost:*; worker-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com;"
          : // Production: Strict CSP
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://lmsapi.suraksha.lk https://*.s3.us-east-1.amazonaws.com wss:; worker-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com;",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
