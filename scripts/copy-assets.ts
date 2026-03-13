import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDir = resolve(import.meta.dirname, '..', 'public');

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const quizDir = resolve(import.meta.dirname, '..', 'quizzes');
const vizDir = resolve(import.meta.dirname, '..', 'visualizations');

if (existsSync(quizDir)) {
  cpSync(quizDir, resolve(publicDir, 'quizzes'), { recursive: true, filter: (src) => src.endsWith('.html') || !src.includes('.') });
}

if (existsSync(vizDir)) {
  cpSync(vizDir, resolve(publicDir, 'visualizations'), { recursive: true, filter: (src) => src.endsWith('.html') || !src.includes('.') });
}

console.log('Assets copied to public/');
