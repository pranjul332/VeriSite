const { createClient } = require("redis");

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

    return { redisClient, redisConnected };
  } catch (error) {
    console.error("❌ Redis initialization failed:", error.message);
    console.log("⚠️ Running without Redis cache");
    redisConnected = false;
    return { redisClient: null, redisConnected: false };
  }
};

// Redis cache helper functions
const getFromCache = async (key) => {
  if (!redisConnected || !redisClient) return null;

  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
};

const setToCache = async (key, value, ttl = 3600) => {
  if (!redisConnected || !redisClient) return false;

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Cache set error:", error);
    return false;
  }
};

const deleteFromCache = async (key) => {
  if (!redisConnected || !redisClient) return false;

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error("Cache delete error:", error);
    return false;
  }
};

const getCacheStats = async () => {
  if (!redisConnected || !redisClient) {
    return {
      status: "disconnected",
      message: "Redis cache is not connected",
    };
  }

  try {
    const info = await redisClient.info("memory");
    const dbSize = await redisClient.dbSize();

    return {
      status: "connected",
      database_size: dbSize,
      memory_info: info,
    };
  } catch (error) {
    throw new Error(`Failed to get cache stats: ${error.message}`);
  }
};

module.exports = {
  initializeRedis,
  getFromCache,
  setToCache,
  deleteFromCache,
  getCacheStats,
  getRedisClient: () => redisClient,
  isRedisConnected: () => redisConnected,
};
