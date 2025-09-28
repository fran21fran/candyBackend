import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // In development, log response bodies for debugging
      if (process.env.NODE_ENV !== "production" && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error(err);
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `API endpoint ${req.path} not found` });
  });

  // Default handler
  app.get('/', (req, res) => {
    res.json({ 
      message: 'CandyWeb Backend API',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /health',
        'POST /api/register',
        'POST /api/login',
        'GET /api/user',
        'GET /api/user-info',
        'POST /api/logout',
        'POST /api/create-subscription',
        'POST /api/mercadopago/webhook',
        'POST /api/test-email',
        'POST /api/game-scores',
        'GET /api/user-scores',
        'GET /api/leaderboard/game/:gameId',
        'GET /api/leaderboard/global',
        'GET /api/user-ranking',
        'POST /api/contact',
        'GET /api/suggestions',
        'POST /api/suggestions',
        'POST /api/suggestions/:id/like'
      ]
    });
  });

  // Start server
  const port = parseInt(process.env.PORT || '8000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    console.log(`🚀 CandyWeb Backend API serving on port ${port}`);
    console.log(`📡 Health check: http://localhost:${port}/health`);
    console.log(`📊 API endpoints: http://localhost:${port}/api/*`);
  });
})();