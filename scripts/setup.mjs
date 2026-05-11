#!/usr/bin/env node
// Локальный setup для разработки:
//   1. Установка зависимостей в backend и frontend
//   2. Копирование .env / .env.local из примеров (без перезаписи)
//   3. Запуск Postgres в Docker
//   4. Ожидание готовности БД
//   5. Прогон миграций Prisma
//
// Запуск: `npm run setup`  (из корня проекта)

import { execSync, spawnSync } from "node:child_process";
import { existsSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function step(title, fn) {
  console.log(`\n${c.bold}${c.cyan}▶ ${title}${c.reset}`);
  try {
    fn();
  } catch (err) {
    console.error(`${c.red}${c.bold}✖ ${title} провалился${c.reset}`);
    console.error(err.message || err);
    process.exit(1);
  }
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function which(cmd) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], {
    stdio: "ignore",
  });
  return r.status === 0;
}

// ─────────────────────────────────────────────
step("Проверка зависимостей системы", () => {
  if (!which("docker")) {
    throw new Error(
      "Не найден docker. Установи Docker Desktop и попробуй снова: https://docs.docker.com/get-docker/"
    );
  }
  console.log(`  ${c.green}✓${c.reset} docker найден`);
});

step("Установка npm-зависимостей (backend + frontend)", () => {
  run("npm install --prefix backend --no-audit --no-fund");
  run("npm install --prefix frontend --no-audit --no-fund");
});

step("Создание .env файлов", () => {
  const pairs = [
    ["backend/.env.example", "backend/.env"],
    ["frontend/.env.local.example", "frontend/.env.local"],
  ];
  for (const [from, to] of pairs) {
    const dest = resolve(ROOT, to);
    if (existsSync(dest)) {
      console.log(`  ${c.dim}${to} уже есть, пропускаю${c.reset}`);
    } else {
      copyFileSync(resolve(ROOT, from), dest);
      console.log(`  ${c.green}✓${c.reset} ${to} создан`);
    }
  }
});

step("Запуск Postgres в Docker", () => {
  run("docker compose up -d postgres");
});

step("Ожидание готовности Postgres", () => {
  const start = Date.now();
  const TIMEOUT_MS = 60_000;
  while (Date.now() - start < TIMEOUT_MS) {
    const r = spawnSync(
      "docker",
      ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "messenger", "-d", "messenger"],
      { stdio: "ignore", cwd: ROOT }
    );
    if (r.status === 0) {
      console.log(`  ${c.green}✓${c.reset} postgres готов`);
      return;
    }
    process.stdout.write(".");
    spawnSync(process.platform === "win32" ? "timeout" : "sleep", ["1"], { stdio: "ignore" });
  }
  throw new Error("postgres не поднялся за 60 секунд");
});

step("Прогон миграций Prisma", () => {
  const migrationsDir = resolve(ROOT, "backend/prisma/migrations");
  const hasMigrations =
    existsSync(migrationsDir) &&
    readdirSync(migrationsDir).some((f) => !f.startsWith(".") && f !== "migration_lock.toml");

  if (hasMigrations) {
    // Уже есть миграции — просто применяем
    run("npx prisma migrate deploy", { cwd: resolve(ROOT, "backend") });
  } else {
    // Первый запуск — создаём init-миграцию
    run("npx prisma migrate dev --name init --skip-seed", { cwd: resolve(ROOT, "backend") });
  }
});

console.log(
  `\n${c.bold}${c.green}✓ Готово.${c.reset}\n\n  Теперь запусти:  ${c.bold}npm run dev${c.reset}\n  Frontend:        ${c.cyan}http://localhost:3000${c.reset}\n  Backend health:  ${c.cyan}http://localhost:4000/health${c.reset}\n  Prisma Studio:   ${c.cyan}npm run studio${c.reset}\n`
);
