import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { env } from "./lib/env";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import chatsRouter from "./routes/chats";
import messagesRouter from "./routes/messages";
import { initIo } from "./realtime/io";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isConfiguredOrigin = env.CORS_ORIGINS.includes(origin);
      const isLocalDevOrigin =
        env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

      callback(null, isConfiguredOrigin || isLocalDevOrigin);
    },
    credentials: true,
  })
);
// До 8MB — голосовые, файлы и аватарки приходят как data URL в JSON.
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/chats/:chatId/messages", messagesRouter);
app.use("/chats", chatsRouter);

// Centralized error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("[error]", err);
  const message = err instanceof Error ? err.message : String(err);
  if (env.NODE_ENV !== "production") {
    res.status(500).json({ error: "Internal server error", details: message });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
});

async function runPendingMigrations(): Promise<void> {
  // Запускаем `prisma migrate deploy` как дочерний процесс. Это идемпотентно:
  // если все миграции применены — отработает за ~300мс и выйдет с 0.
  return new Promise((resolve, reject) => {
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const proc = spawn(npxCmd, ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy exited with code ${code}`));
    });
  });
}

async function bootstrap() {
  try {
    // eslint-disable-next-line no-console
    console.log("→ Applying pending Prisma migrations…");
    await runPendingMigrations();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to apply migrations:", err);
    process.exit(1);
  }

  const server = createServer(app);
  initIo(server);
  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env.PORT} (HTTP + Socket.IO)`);
  });
}

void bootstrap();
