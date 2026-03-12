const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { notFound, errorHandler } = require("./middlewares/error");

const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const entityRoutes = require("./routes/entities.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const exportRoutes = require("./routes/export.routes");
const assistantRoutes = require("./routes/assistant.routes");
const millRoutes = require("./routes/mills.routes");
const quantityRoutes = require("./routes/quantities.routes");
const designNoRoutes = require("./routes/designNos.routes");
const userRoutes = require("./routes/users.routes");

function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  const vercelOrigins = [
    normalizeOrigin(process.env.VERCEL_URL),
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  ].filter(Boolean);
  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://localhost:5173",
    ...configuredOrigins,
    ...vercelOrigins
  ]);

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        const normalizedOrigin = normalizeOrigin(origin);
        if (allowedOrigins.has(normalizedOrigin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
      },
      credentials: true
    })
  );

  app.get("/health", (_, res) => res.json({ ok: true }));

  // Admin auth + profile
  app.use("/api/auth", authRoutes);
  app.use("/api/admin/profile", profileRoutes);
  app.use("/api/entities", entityRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/assistant", assistantRoutes);

  // Management modules
  app.use("/api/mills", millRoutes);
  app.use("/api/quantities", quantityRoutes);
  app.use("/api/design-nos", designNoRoutes);

  // User auth
  app.use("/api/users", userRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
