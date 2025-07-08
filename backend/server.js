const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");
const redis = require("redis");
const { createClient } = require("redis");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Redis client setup
let redisClient;
let redisConnected = false;

const initializeRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 60000,
        lazyConnect: true,
      },
      retry_strategy: (options) => {
        if (options.error && options.error.code === "ECONNREFUSED") {
          console.log("❌ Redis connection refused");
          return new Error("Redis connection refused");
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.log("❌ Redis retry time exhausted");
          return new Error("Retry time exhausted");
        }
        if (options.attempt > 10) {
          console.log("❌ Redis retry attempts exhausted");
          return new Error("Retry attempts exhausted");
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis client error:", err);
      redisConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("🔄 Redis connecting...");
    });

    redisClient.on("ready", () => {
      console.log("✅ Redis connected and ready");
      redisConnected = true;
    });

    redisClient.on("end", () => {
      console.log("🔌 Redis connection ended");
      redisConnected = false;
    });

    await redisClient.connect();
  } catch (error) {
    console.error("❌ Redis initialization failed:", error.message);
    console.log("⚠️ Running without Redis cache");
    redisConnected = false;
  }
};

// Rate limiting with Redis store
const createRateLimiter = (windowMs, max, message) => {
  const limiterOptions = {
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: "Too many requests",
        message: message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString(),
      });
    },
  };

  // Use Redis store if available
  if (redisConnected) {
    const { RedisStore } = require("rate-limit-redis");
    limiterOptions.store = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
  }

  return rateLimit(limiterOptions);
};

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// General API rate limiting
app.use("/api/", createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  "Too many requests from this IP, please try again later."
));

// Stricter rate limiting for verification endpoints
app.use("/api/verify", createRateLimiter(
  10 * 60 * 1000, // 10 minutes
  20, // 20 requests per window
  "Too many verification requests. Please wait before trying again."
));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'https://your-frontend-domain.com',
      'https://your-app.vercel.app',
      'https://your-app.netlify.app',
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key']
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ 
  limit: "10mb",
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ 
        error: "Invalid JSON",
        message: "Request body contains invalid JSON",
        timestamp: new Date().toISOString()
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: "10mb" 
}));

// Redis cache helper functions
const getFromCache = async (key) => {
  if (!redisConnected) return null;
  
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
};

const setToCache = async (key, value, ttl = 3600) => {
  if (!redisConnected) return false;
  
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Cache set error:", error);
    return false;
  }
};

const deleteFromCache = async (key) => {
  if (!redisConnected) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error("Cache delete error:", error);
    return false;
  }
};

// Make cache functions available to routes
app.locals.cache = {
  get: getFromCache,
  set: setToCache,
  del: deleteFromCache,
  connected: () => redisConnected,
};

// API validation middleware
const validateApiKeys = (req, res, next) => {
  const missingKeys = [];
  
  if (!process.env.GEMINI_API_KEY) {
    missingKeys.push('GEMINI_API_KEY');
  }
  
  if (!process.env.SERPER_API_KEY && !process.env.BING_SEARCH_API_KEY) {
    missingKeys.push('SERPER_API_KEY or BING_SEARCH_API_KEY');
  }
  
  if (missingKeys.length > 0) {
    return res.status(500).json({
      error: "API configuration error",
      message: `Missing required API keys: ${missingKeys.join(', ')}`,
      required_keys: missingKeys,
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

// Apply API key validation to verification routes
app.use('/api/verify', validateApiKeys);

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error("Server error:", err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: "CORS policy violation",
      message: "Origin not allowed",
      timestamp: new Date().toISOString(),
    });
  }
  
  if (err.message === 'Invalid JSON') {
    return res.status(400).json({
      error: "Invalid request format",
      message: "Request body contains invalid JSON",
      timestamp: new Date().toISOString(),
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: "File too large",
      message: "Uploaded file exceeds the 5MB limit",
      timestamp: new Date().toISOString(),
    });
  }
  
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production' ? "Something went wrong" : err.message,
    timestamp: new Date().toISOString(),
  });
};

// Basic health check
app.get("/", (req, res) => {
  res.json({
    message: "🔍 Enhanced Fact-Checking API Server",
    version: "2.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    redis_connected: redisConnected,
    endpoints: {
      health: "/api/health",
      verify_image: "POST /api/verify/",
      verify_text: "POST /api/verify/text",
      detailed_health: "/api/verify/health",
      clear_cache: "POST /api/verify/clear-cache",
    },
    features: [
      "Image fact-checking with Gemini Vision",
      "Text fact-checking with multiple sources",
      "Redis caching for performance",
      "Rate limiting with Redis store",
      "Cross-source verification",
      "Credibility scoring",
    ],
  });
});

// API test endpoint
app.get("/api/test", (req, res) => {
  const apiStatus = {
    gemini: !!process.env.GEMINI_API_KEY,
    serper: !!process.env.SERPER_API_KEY,
    newsapi: !!process.env.NEWS_API_KEY,
    bing: !!process.env.BING_SEARCH_API_KEY,
  };
  
  res.json({
    message: "API is working!",
    timestamp: new Date().toISOString(),
    server_time: new Date().toLocaleString(),
    environment: process.env.NODE_ENV || "development",
    api_status: apiStatus,
    redis_status: {
      connected: redisConnected,
      client_ready: redisClient?.isReady || false,
    },
    system_info: {
      node_version: process.version,
      platform: process.platform,
      memory_usage: process.memoryUsage(),
    },
  });
});

// Cache statistics endpoint
app.get("/api/cache/stats", async (req, res) => {
  if (!redisConnected) {
    return res.json({
      status: "disconnected",
      message: "Redis cache is not connected",
      timestamp: new Date().toISOString(),
    });
  }
  
  try {
    const info = await redisClient.info('memory');
    const dbSize = await redisClient.dbSize();
    
    res.json({
      status: "connected",
      database_size: dbSize,
      memory_info: info,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get cache stats",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Import and use verification routes
const verificationRoutes = require('./routes/verify');
app.use('/api/verify', verificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      "GET /",
      "GET /api/test",
      "GET /api/cache/stats",
      "GET /api/verify/health",
      "POST /api/verify/",
      "POST /api/verify/text",
      "POST /api/verify/clear-cache",
    ],
  });
});

// Apply error handling middleware
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Close Redis connection
    if (redisClient && redisConnected) {
      await redisClient.quit();
      console.log("✅ Redis connection closed");
    }
    
    // Close server
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Initialize Redis
    await initializeRedis();
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Fact-Checking API Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔄 Redis cache: ${redisConnected ? 'Connected' : 'Disconnected'}`);
      console.log(`📝 API Documentation: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/test`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize server
startServer();

module.exports = app;