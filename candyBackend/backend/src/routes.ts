import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import cors from "cors";
import { storage } from "./storage.js";
import { insertUserSchema, loginUserSchema, insertGameScoreSchema } from "./schema.js";
import bcrypt from "bcrypt";
import { sendSubscriptionNotification, sendTestEmail } from "./emailService.js";
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { client } from "./db.js";



// Initialize MercadoPago client
let mercadoPagoClient: MercadoPagoConfig | null = null;
if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
  mercadoPagoClient = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    options: { timeout: 5000 }
  });
}

// Session middleware setup
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for Render deployment
  app.set('trust proxy', 1);

  // CORS configuration for cross-origin requests
  const allowedOrigins: (string | RegExp)[] = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://candyfrontend12.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  // In production, allow only specific Vercel project domains
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_PROJECT_NAME) {
    // Only allow your specific Vercel project subdomains
    allowedOrigins.push(new RegExp(`^https://.*-${process.env.VERCEL_PROJECT_NAME}.*\\.vercel\\.app$`));
  }

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  /*app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origen (Postman, curl, etc.)
    if (!origin) return callback(null, true);

    // Validar origen
    const isAllowed = allowedOrigins.some(o => {
      if (typeof o === 'string') return o === origin;
      if (o instanceof RegExp) return o.test(origin);
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true, // permite cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));*/

  // PostgreSQL session store configuration
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 24 * 60 * 60, // 24 hours in seconds
    tableName: "sessions",
  });
  sessionStore.on("error", (err) => {
    console.error("❌ Error en sessionStore (PostgreSQL):", err);
  });
  // Require SESSION_SECRET in production
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable must be set in production");
  }

  // Session configuration with PostgreSQL store
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Allow cross-site cookies in production
    }
  }));

  // Health check endpoint
  app.get("/healthz", (_, res) => {
    console.log("🟢 Health check recibido");
    res.status(200).send("ok");
    //res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  app.get("/test-db", async (req, res) => {
  try {
    const result = await client`SELECT NOW()`;
    res.json({ success: true, time: result[0].now });
  } catch (err) {
    console.error("❌ Error de conexión a Supabase:", err);
    res.status(500).json({ error: "DB connection failed" });
  }
});

  

  // Register route
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "El usuario ya existe" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      // Set session
      req.session.userId = user.id;

      res.json({ 
        message: "Usuario registrado exitosamente",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Error al registrar usuario" });
    }
  });

  // Login route
  app.post("/api/login", async (req, res) => {
    try {
      const loginData = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(loginData.username);
      if (!user) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const validPassword = await bcrypt.compare(loginData.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      req.session.userId = user.id;

      res.json({
        message: "Login exitoso",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  // New temporary route for user info
  app.get("/api/user-info", async (req, res) => {
    if (!req.session.userId) {
      return res.status(200).json(null);
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        //req.session.userId = undefined;
        return res.status(200).json(null);
      }
      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium
      });
    } catch (error) {
      console.error("Get user error:", error);
      //req.session.userId = undefined;
      return res.status(200).json(null);
    }
  });

  // Get current user - UPDATED VERSION - allow both authenticated and guest access  
  app.get("/api/user", async (req, res) => {
    // CHANGED: Return null for guest users instead of error
    if (!req.session.userId) {
      return res.status(200).json(null);
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        //req.session.userId = undefined;
        return res.status(200).json(null);
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium
      });
    } catch (error) {
      console.error("Get user error:", error);
      //req.session.userId = undefined;
      return res.status(200).json(null);
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada exitosamente" });
    });
  });

  // Mercado Pago subscription route
  app.post("/api/create-subscription", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Create Mercado Pago preference for subscription
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      
      const preference = {
        items: [
          {
            id: "candyweb_premium_subscription",
            title: "CandyWeb Premium - Suscripción Anual",
            description: "Acceso completo a juegos premium y práctica de habla",
            quantity: 1,
            currency_id: "ARS", // Argentine Peso
            unit_price: 500
          }
        ],
        payer: {
          name: user.username,
          email: user.email || "usuario@candyweb.com"
        },
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12
        },
        back_urls: {
          success: `${frontendUrl}/subscription?status=success`,
          failure: `${frontendUrl}/subscription?status=failure`,
          pending: `${frontendUrl}/subscription?status=pending`
        },
        auto_return: "approved",
        notification_url: `${backendUrl}/api/mercadopago/webhook`,
        metadata: {
          user_id: user.id
        },
        // Configure payment destination - funds will go to Cami.abi..
        external_reference: `candyweb-premium-${user.id}-${Date.now()}`,
        statement_descriptor: "CandyWeb Premium"
      };

      // Use official Mercado Pago SDK
      if (!mercadoPagoClient) {
        throw new Error("Mercado Pago client not initialized. Check ACCESS_TOKEN.");
      }

      const preferenceAPI = new Preference(mercadoPagoClient);
      const response = await preferenceAPI.create({ body: preference });

      // Send notification email about new subscription attempt
      const emailSent = await sendSubscriptionNotification({
        userId: user.id,
        username: user.username,
        email: user.email || "No email provided",
        timestamp: new Date().toLocaleString('es-ES', { 
          timeZone: 'America/Argentina/Buenos_Aires',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        amount: 500,
        currency: "ARS"
      });

      if (emailSent) {
        console.log("Subscription notification email sent successfully");
      } else {
        console.error("Failed to send subscription notification email");
      }

      // Return real MercadoPago preference response
      res.json({
        id: response.id,
        init_point: response.init_point,
        sandbox_init_point: response.sandbox_init_point,
        collector_alias: "Cami.abi..",
        message: "Preferencia de pago creada exitosamente. Los fondos se depositarán en la billetera virtual con alias Cami.abi..",
        email_notification: emailSent ? "Email notification sent" : "Email notification failed"
      });
    } catch (error) {
      console.error("Subscription error:", error);
      res.status(500).json({ message: "Error al crear preferencia de pago" });
    }
  });

  // Mercado Pago webhook for payment notifications
  app.post("/api/mercadopago/webhook", async (req, res) => {
    try {
      const { type, data } = req.body;
      console.log("Webhook received:", { type, data });

      if (type === "payment" && data?.id) {
        const paymentId = data.id;
        console.log("Processing payment notification:", paymentId);

        if (!mercadoPagoClient) {
          console.error("MercadoPago client not initialized for webhook");
          return res.status(500).json({ message: "Payment verification unavailable" });
        }

        try {
          // Verify payment with MercadoPago API
          const paymentAPI = new Payment(mercadoPagoClient);
          const payment = await paymentAPI.get({ id: paymentId });
          
          console.log("Payment details:", {
            id: payment.id,
            status: payment.status,
            external_reference: payment.external_reference,
            transaction_amount: payment.transaction_amount
          });

          // Process approved payments
          if (payment.status === "approved" && payment.external_reference) {
            // Extract user ID from external reference (format: candyweb-premium-{userId}-{timestamp})
            const referenceMatch = payment.external_reference.match(/candyweb-premium-([^-]+)-\d+/);
            
            if (referenceMatch && referenceMatch[1]) {
              const userId = referenceMatch[1];
              
              // Activate premium subscription
              await storage.updateUserPremium(userId, true);
              console.log(`✅ Premium subscription activated for user: ${userId}`);
              console.log(`💰 Payment of $${payment.transaction_amount} ARS deposited to Cami.abi..`);
              
              // Send confirmation email
              const user = await storage.getUser(userId);
              if (user) {
                await sendSubscriptionNotification({
                  userId: user.id,
                  username: user.username,
                  email: user.email || "No email provided",
                  timestamp: new Date().toLocaleString('es-ES', { 
                    timeZone: 'America/Argentina/Buenos_Aires',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }),
                  amount: payment.transaction_amount || 500,
                  currency: "ARS"
                });
                console.log("✅ Confirmation email sent to candyweb44@gmail.com");
              }
            } else {
              console.error("Could not extract user ID from external reference:", payment.external_reference);
            }
          } else {
            console.log(`Payment ${paymentId} status: ${payment.status} - not processing`);
          }
        } catch (verificationError) {
          console.error("Error verifying payment:", verificationError);
          return res.status(500).json({ message: "Payment verification failed" });
        }
      }

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", async (req, res) => {
    try {
      const emailSent = await sendTestEmail();
      
      if (emailSent) {
        res.json({ 
          message: "Email de prueba enviado exitosamente a candyweb44@gmail.com",
          success: true
        });
      } else {
        res.status(500).json({ 
          message: "Error al enviar email de prueba",
          success: false
        });
      }
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ message: "Error al enviar email de prueba" });
    }
  });

  // Game scores endpoints
  app.post("/api/game-scores", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const scoreData = insertGameScoreSchema.parse(req.body);
      const score = await storage.saveGameScore(req.session.userId, scoreData);
      res.json(score);
    } catch (error) {
      console.error("Error saving game score:", error);
      res.status(500).json({ message: "Failed to save game score" });
    }
  });

  app.get("/api/user-scores", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      console.log("🔍 session userId:", req.session.userId);
      const scores = await storage.getUserScores(req.session.userId);
      res.json(scores);
    } catch (error) {
      console.error("Error fetching user scores:", error);
      res.status(500).json({ message: "Failed to fetch user scores" });
    }
  });

  app.get("/api/leaderboard/game/:gameId", async (req, res) => {
    try {
      const { gameId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await storage.getGameLeaderboard(gameId, limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching game leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch game leaderboard" });
    }
  });

  app.get("/api/leaderboard/global", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await storage.getGlobalLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching global leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch global leaderboard" });
    }
  });

  app.get("/api/user-ranking", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const ranking = await storage.getUserRanking(req.session.userId);
      res.json(ranking);
    } catch (error) {
      console.error("Error fetching user ranking:", error);
      res.status(500).json({ message: "Failed to fetch user ranking" });
    }
  });

  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      
      // Here you would typically send an email to candyweb44@gmail.com
      // For now, we'll just log it
      console.log("Contact form submission:", {
        name,
        email,
        message,
        timestamp: new Date().toISOString()
      });

      res.json({ message: "Mensaje enviado exitosamente" });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ message: "Error al enviar mensaje" });
    }
  });

  const httpServer = createServer(app);
  
  // Suggestions routes
  app.get("/api/suggestions", async (req, res) => {
    try {
      const language = req.query.language as string;
      const userId = req.session?.userId;

      if (language) {
        const suggestions = await storage.getSuggestionsByLanguage(language, userId);
        res.json(suggestions);
      } else {
        const suggestions = await storage.getAllSuggestions(userId);
        res.json(suggestions);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ message: "Error al obtener sugerencias" });
    }
  });

  app.post("/api/suggestions", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const suggestionData = req.body;
      const suggestion = await storage.createSuggestion(req.session.userId, suggestionData);
      res.json(suggestion);
    } catch (error) {
      console.error("Error creating suggestion:", error);
      res.status(500).json({ message: "Error al crear sugerencia" });
    }
  });

  app.post("/api/suggestions/:id/like", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const suggestionId = req.params.id;
      await storage.likeSuggestion(req.session.userId, suggestionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error liking suggestion:", error);
      res.status(500).json({ message: "Error al dar like" });
    }
  });

  return httpServer;
}
