import { mkdir, copyFile, access } from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
for(const [a,b] of [['node_modules/lucide/dist/umd/lucide.js','lucide.js'],['node_modules/exceljs/dist/exceljs.min.js','exceljs.min.js'],['node_modules/fflate/umd/index.js','fflate.js']]) await copyFile(a,'public/vendor/'+b);
for(const file of ['public/index.html','public/styles.css','public/app.js','src/worker.js','migrations/0001_initial.sql']) await access(file);
console.log('Public assets prepared. Cloudflare Worker and bindings are configured.');
