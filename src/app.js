import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import preglediRoutes from "./routes/pregledi.routes.js";
import kliseRoutes from "./routes/klise.routes.js";
import narudzbeRoutes from "./routes/narudzbe.routes.js";
import terenRoutes from "./routes/teren.routes.js";
import artikliRoutes from "./routes/artikli.routes.js";
import partneriRoutes from "./routes/partneri.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/pregledi", preglediRoutes);
  app.use("/api/klise", kliseRoutes);
  app.use("/api/narudzbe", narudzbeRoutes);
  app.use("/api/teren", terenRoutes);
  app.use("/api/artikli", artikliRoutes);
  app.use("/api/partneri", partneriRoutes);

  // Serviranje frontenda u produkciji
  if (env.NODE_ENV === "production") {
    const distPath = path.join(__dirname, "../dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
};
