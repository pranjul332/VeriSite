const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const sharp = require("sharp");
const axios = require("axios");
const NodeCache = require("node-cache");

const router = express.Router();

// Initialize cache (1 hour TTL)
const cache = new NodeCache({ stdTTL: 3600 });

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to convert image to base64
const imageToBase64 = async (buffer) => {
  try {
    const processedBuffer = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return processedBuffer.toString("base64");
  } catch (error) {
    console.error("Error processing image:", error);
    throw new Error("Failed to process image");
  }
};

// Enhanced search function with multiple sources
const searchMultipleSources = async (query, options = {}) => {
  const {
    includeNews = true,
    includeWeb = true,
    includeFactCheck = true,
    maxResults = 10,
  } = options;

  const cacheKey = `search_${query}_${JSON.stringify(options)}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    console.log("🎯 Using cached search results");
    return cachedResult;
  }

  const allSources = [];
  const errors = [];

  // 1. NEWS SEARCH - Using Serper (Google News)
  if (includeNews && process.env.SERPER_API_KEY) {
    try {
      console.log("🔍 Searching news sources...");
      const newsResponse = await axios.post(
        "https://google.serper.dev/news",
        {
          q: query,
          num: 5,
          hl: "en",
          gl: "us",
        },
        {
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
          },
          timeout: 5000,
        }
      );

      const newsSources =
        newsResponse.data.news?.map((result) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          published_at: result.date,
          source: result.source,
          type: "news",
          credibility: "high",
        })) || [];

      allSources.push(...newsSources);
      console.log(`✅ Found ${newsSources.length} news sources`);
    } catch (error) {
      console.error("❌ Serper News API error:", error.message);
      errors.push({ api: "serper_news", error: error.message });
    }
  }

  // 2. WEB SEARCH - Using Serper (Google Web)
  if (includeWeb && process.env.SERPER_API_KEY) {
    try {
      console.log("🌐 Searching web sources...");
      const webResponse = await axios.post(
        "https://google.serper.dev/search",
        {
          q: query,
          num: 5,
          hl: "en",
          gl: "us",
        },
        {
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
          },
          timeout: 5000,
        }
      );

      const webSources =
        webResponse.data.organic?.map((result) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          published_at: result.date || null,
          source: result.source || extractDomain(result.link),
          type: "web",
          credibility: getSourceCredibility(result.link),
        })) || [];

      allSources.push(...webSources);
      console.log(`✅ Found ${webSources.length} web sources`);
    } catch (error) {
      console.error("❌ Serper Web API error:", error.message);
      errors.push({ api: "serper_web", error: error.message });
    }
  }

  // 3. FACT-CHECK SEARCH - Using Bing (fallback)
  if (includeFactCheck && process.env.BING_SEARCH_API_KEY) {
    try {
      console.log("🔍 Searching fact-check sources...");
      const factCheckQuery = `${query} site:snopes.com OR site:factcheck.org OR site:politifact.com OR site:reuters.com/fact-check OR site:apnews.com/hub/ap-fact-check`;

      const factCheckResponse = await axios.get(
        "https://api.bing.microsoft.com/v7.0/search",
        {
          headers: {
            "Ocp-Apim-Subscription-Key": process.env.BING_SEARCH_API_KEY,
          },
          params: {
            q: factCheckQuery,
            count: 3,
            textDecorations: false,
            textFormat: "Raw",
          },
          timeout: 5000,
        }
      );

      const factCheckSources =
        factCheckResponse.data.webPages?.value?.map((page) => ({
          title: page.name,
          url: page.url,
          snippet: page.snippet,
          published_at: page.dateLastCrawled,
          source: extractDomain(page.url),
          type: "fact_check",
          credibility: "very_high",
        })) || [];

      allSources.push(...factCheckSources);
      console.log(`✅ Found ${factCheckSources.length} fact-check sources`);
    } catch (error) {
      console.error("❌ Bing Search API error:", error.message);
      errors.push({ api: "bing_search", error: error.message });
    }
  }

  // 4. NEWSAPI.ORG - Alternative news source
  if (
    includeNews &&
    process.env.NEWS_API_KEY &&
    allSources.filter((s) => s.type === "news").length < 3
  ) {
    try {
      console.log("📰 Searching NewsAPI...");
      const newsApiResponse = await axios.get(
        `https://newsapi.org/v2/everything`,
        {
          params: {
            q: query,
            apiKey: process.env.NEWS_API_KEY,
            sortBy: "publishedAt",
            pageSize: 5,
            language: "en",
          },
          timeout: 5000,
        }
      );

      const newsApiSources =
        newsApiResponse.data.articles?.map((article) => ({
          title: article.title,
          url: article.url,
          snippet: article.description,
          published_at: article.publishedAt,
          source: article.source.name,
          author: article.author,
          type: "news",
          credibility: "high",
        })) || [];

      allSources.push(...newsApiSources);
      console.log(`✅ Found ${newsApiSources.length} NewsAPI sources`);
    } catch (error) {
      console.error("❌ NewsAPI error:", error.message);
      errors.push({ api: "newsapi", error: error.message });
    }
  }

  // Remove duplicates and sort
  const uniqueSources = removeDuplicates(allSources);
  const sortedSources = uniqueSources
    .sort((a, b) => {
      // Sort by credibility first, then by recency
      const credibilityOrder = { very_high: 4, high: 3, medium: 2, low: 1 };
      const credibilityDiff =
        credibilityOrder[b.credibility] - credibilityOrder[a.credibility];

      if (credibilityDiff !== 0) return credibilityDiff;

      const dateA = new Date(a.published_at || 0);
      const dateB = new Date(b.published_at || 0);
      return dateB - dateA;
    })
    .slice(0, maxResults);

  const result = {
    sources: sortedSources,
    total_found: allSources.length,
    search_errors: errors,
    timestamp: new Date().toISOString(),
  };

  // Cache the result
  cache.set(cacheKey, result);

  return result;
};

// Helper functions
const extractDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
};

const getSourceCredibility = (url) => {
  const domain = extractDomain(url).toLowerCase();

  const veryHighCredibility = [
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "cnn.com",
    "npr.org",
  ];
  const highCredibility = [
    "nytimes.com",
    "washingtonpost.com",
    "wsj.com",
    "guardian.com",
  ];
  const mediumCredibility = ["wikipedia.org", "britannica.com"];

  if (veryHighCredibility.some((d) => domain.includes(d))) return "very_high";
  if (highCredibility.some((d) => domain.includes(d))) return "high";
  if (mediumCredibility.some((d) => domain.includes(d))) return "medium";
  return "low";
};

const removeDuplicates = (sources) => {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source.url || source.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Enhanced Gemini analysis
const analyzeWithGemini = async (content, isImage = false) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are an expert fact-checker and misinformation detector. ${
      isImage ? "Analyze this image carefully" : "Analyze this text carefully"
    } and provide a comprehensive fact-check.

${!isImage ? `Text to analyze: "${content}"` : ""}

Please provide your analysis in this exact JSON format:
{
  "verdict": "true" | "likely_fake" | "misleading" | "unverifiable",
  "confidence": 0-100,
  "extracted_claims": [
    {
      "claim": "specific factual statement",
      "category": "historical|scientific|current_events|statistics|other",
      "time_sensitive": true/false,
      "verifiable": true/false
    }
  ],
  "explanation": "Detailed explanation of your analysis and reasoning",
  "red_flags": [
    {
      "flag": "description of suspicious element",
      "severity": "low|medium|high"
    }
  ],
  "recommendations": "What users should do next to verify this information",
  "context_analysis": "Analysis of how the content is presented and any contextual issues",
  "search_suggestions": ["keyword1", "keyword2", "keyword3"]
}

Focus on:
1. Extracting all verifiable factual claims
2. Identifying potential misinformation patterns
3. Analyzing the credibility of presentation
4. Providing specific claims that can be fact-checked
5. Suggesting search terms for verification

Be thorough but concise. Base your analysis on factual evidence and logical reasoning.
`;

    const input = isImage
      ? [
          prompt,
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: content,
            },
          },
        ]
      : [prompt];

    const result = await model.generateContent(input);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          analysis: parsed,
        };
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return {
        success: false,
        fallback: {
          verdict: "unverifiable",
          confidence: 50,
          extracted_claims: [],
          explanation: text,
          red_flags: [],
          recommendations: "Manual verification recommended",
          context_analysis: "Analysis could not be properly parsed",
          search_suggestions: [],
        },
      };
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw error;
  }
};

// Cross-reference analysis with sources
const crossReferenceWithSources = async (claims, sources) => {
  if (!claims || claims.length === 0 || !sources || sources.length === 0) {
    return {
      verification_results: [],
      overall_assessment: "insufficient_data",
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const claimsText = claims
      .map((c) => `- ${c.claim} (Category: ${c.category})`)
      .join("\n");
    const sourcesText = sources
      .slice(0, 8)
      .map(
        (s) =>
          `Source: ${s.title}\nURL: ${s.url}\nType: ${s.type}\nCredibility: ${s.credibility}\nContent: ${s.snippet}\n---`
      )
      .join("\n");

    const prompt = `
As a fact-checking expert, cross-reference these claims with the provided sources:

CLAIMS TO VERIFY:
${claimsText}

AVAILABLE SOURCES:
${sourcesText}

For each claim, analyze the sources and provide verification results in this JSON format:
{
  "verification_results": [
    {
      "claim": "exact claim text",
      "status": "verified_true|verified_false|partially_true|contradicted|no_evidence",
      "confidence": 0-100,
      "supporting_sources": [
        {
          "title": "source title",
          "url": "source url",
          "relevance": "high|medium|low",
          "credibility": "very_high|high|medium|low"
        }
      ],
      "contradicting_sources": [],
      "explanation": "detailed explanation of verification"
    }
  ],
  "overall_assessment": {
    "verdict": "mostly_true|mostly_false|mixed|insufficient_evidence",
    "confidence": 0-100,
    "summary": "brief summary of findings"
  },
  "source_quality_assessment": {
    "total_sources": number,
    "high_credibility_sources": number,
    "recent_sources": number,
    "consensus_level": "strong|moderate|weak|none"
  }
}

Focus on:
1. Matching claims to relevant sources
2. Assessing source credibility and relevance
3. Identifying consensus or contradictions
4. Providing evidence-based conclusions
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in cross-reference response");
      }
    } catch (parseError) {
      console.error("Cross-reference parsing error:", parseError);
      return {
        verification_results: [],
        overall_assessment: {
          verdict: "analysis_error",
          confidence: 0,
          summary: "Failed to parse cross-reference analysis",
        },
      };
    }
  } catch (error) {
    console.error("Cross-reference analysis error:", error);
    return {
      verification_results: [],
      overall_assessment: {
        verdict: "analysis_error",
        confidence: 0,
        summary: "Error during cross-reference analysis",
      },
    };
  }
};

// Main image verification endpoint
router.post("/", upload.single("image"), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Gemini API key not configured",
      });
    }

    console.log("🖼️ Processing image verification...");

    // Step 1: Process image
    const base64Image = await imageToBase64(req.file.buffer);
    console.log("✅ Image processed successfully");

    // Step 2: Analyze with Gemini
    console.log("🧠 Analyzing with Gemini...");
    const geminiResult = await analyzeWithGemini(base64Image, true);

    if (!geminiResult.success) {
      console.log("⚠️ Gemini analysis failed, using fallback");
    }

    const analysis = geminiResult.success
      ? geminiResult.analysis
      : geminiResult.fallback;

    // Step 3: Search for sources
    console.log("🔍 Searching for verification sources...");
    const searchQuery =
      analysis.search_suggestions?.join(" ") ||
      analysis.extracted_claims?.map((c) => c.claim).join(" ") ||
      "fact check verification";

    const searchResult = await searchMultipleSources(searchQuery, {
      includeNews: true,
      includeWeb: true,
      includeFactCheck: true,
      maxResults: 10,
    });

    // Step 4: Cross-reference claims with sources
    console.log("🔗 Cross-referencing claims with sources...");
    const crossReference = await crossReferenceWithSources(
      analysis.extracted_claims,
      searchResult.sources
    );

    // Step 5: Generate final response
    const processingTime = Date.now() - startTime;

    const response = {
      success: true,
      verdict: crossReference.overall_assessment?.verdict || analysis.verdict,
      confidence:
        crossReference.overall_assessment?.confidence || analysis.confidence,
      explanation: analysis.explanation,

      // Detailed analysis
      initial_analysis: {
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        extracted_claims: analysis.extracted_claims || [],
        red_flags: analysis.red_flags || [],
        context_analysis: analysis.context_analysis,
      },

      // Source verification
      source_verification: {
        total_sources: searchResult.total_found,
        sources_analyzed: searchResult.sources.length,
        verification_results: crossReference.verification_results || [],
        source_quality: crossReference.source_quality_assessment,
      },

      // Sources
      sources: searchResult.sources,

      // Recommendations
      recommendations: analysis.recommendations,

      // Metadata
      metadata: {
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        apis_used: [
          "Gemini 1.5 Flash",
          ...(searchResult.search_errors?.length > 0 ? [] : ["Serper API"]),
          ...(process.env.NEWS_API_KEY ? ["NewsAPI"] : []),
          ...(process.env.BING_SEARCH_API_KEY ? ["Bing Search"] : []),
        ],
        search_errors: searchResult.search_errors || [],
      },
    };

    console.log(`✅ Image verification completed in ${processingTime}ms`);
    res.json(response);
  } catch (error) {
    console.error("❌ Image verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify image",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Text verification endpoint
router.post("/text", async (req, res) => {
  const startTime = Date.now();

  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "No text provided",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Gemini API key not configured",
      });
    }

    console.log("📝 Processing text verification...");

    // Step 1: Analyze with Gemini
    console.log("🧠 Analyzing with Gemini...");
    const geminiResult = await analyzeWithGemini(text, false);

    if (!geminiResult.success) {
      console.log("⚠️ Gemini analysis failed, using fallback");
    }

    const analysis = geminiResult.success
      ? geminiResult.analysis
      : geminiResult.fallback;

    // Step 2: Search for sources
    console.log("🔍 Searching for verification sources...");
    const searchQuery =
      analysis.search_suggestions?.join(" ") ||
      analysis.extracted_claims?.map((c) => c.claim).join(" ") ||
      text.substring(0, 100);

    const searchResult = await searchMultipleSources(searchQuery, {
      includeNews: true,
      includeWeb: true,
      includeFactCheck: true,
      maxResults: 10,
    });

    // Step 3: Cross-reference claims with sources
    console.log("🔗 Cross-referencing claims with sources...");
    const crossReference = await crossReferenceWithSources(
      analysis.extracted_claims,
      searchResult.sources
    );

    // Step 4: Generate final response
    const processingTime = Date.now() - startTime;

    const response = {
      success: true,
      verdict: crossReference.overall_assessment?.verdict || analysis.verdict,
      confidence:
        crossReference.overall_assessment?.confidence || analysis.confidence,
      explanation: analysis.explanation,

      // Detailed analysis
      initial_analysis: {
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        extracted_claims: analysis.extracted_claims || [],
        red_flags: analysis.red_flags || [],
        context_analysis: analysis.context_analysis,
      },

      // Source verification
      source_verification: {
        total_sources: searchResult.total_found,
        sources_analyzed: searchResult.sources.length,
        verification_results: crossReference.verification_results || [],
        source_quality: crossReference.source_quality_assessment,
      },

      // Sources
      sources: searchResult.sources,

      // Recommendations
      recommendations: analysis.recommendations,

      // Metadata
      metadata: {
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        apis_used: [
          "Gemini 1.5 Flash",
          ...(searchResult.search_errors?.length > 0 ? [] : ["Serper API"]),
          ...(process.env.NEWS_API_KEY ? ["NewsAPI"] : []),
          ...(process.env.BING_SEARCH_API_KEY ? ["Bing Search"] : []),
        ],
        search_errors: searchResult.search_errors || [],
      },
    };

    console.log(`✅ Text verification completed in ${processingTime}ms`);
    res.json(response);
  } catch (error) {
    console.error("❌ Text verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify text",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  const apiStatus = {
    gemini: !!process.env.GEMINI_API_KEY,
    serper: !!process.env.SERPER_API_KEY,
    newsapi: !!process.env.NEWS_API_KEY,
    bing: !!process.env.BING_SEARCH_API_KEY,
  };

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Enhanced Fact-Checking API",
    api_status: apiStatus,
    cache_stats: cache.getStats(),
  });
});

// Clear cache endpoint (for development)
router.post("/clear-cache", (req, res) => {
  cache.flushAll();
  res.json({
    success: true,
    message: "Cache cleared successfully",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
