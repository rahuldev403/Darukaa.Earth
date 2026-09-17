import { existsSync } from 'node:fs';

const resolveBin = (candidates, fallback) => candidates.find((p) => existsSync(p)) ?? fallback;

const ruff = resolveBin(['backend/.venv/Scripts/ruff.exe', 'backend/.venv/bin/ruff'], 'ruff');

const oxlint = resolveBin(
  ['frontend/node_modules/.bin/oxlint.cmd', 'frontend/node_modules/.bin/oxlint'],
  'oxlint'
);

export default {
  'frontend/**/*.{js,jsx,css,json,md}': ['prettier --write'],
  'frontend/**/*.{js,jsx}': [`${oxlint} --fix`],
  '*.{json,md}': ['prettier --write'],
  'backend/**/*.py': [`${ruff} check --fix`, `${ruff} format`],
};
