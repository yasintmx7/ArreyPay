import { defineConfig } from 'vite';
export default defineConfig({root:'web',publicDir:'../public',build:{outDir:'../dist',emptyOutDir:true,target:'es2022',sourcemap:false,chunkSizeWarningLimit:650},server:{host:'0.0.0.0',port:4173,strictPort:true}});
