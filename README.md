# Enhanced Fact-Checking API 🔍

A comprehensive AI-powered fact-checking system that verifies both text and images using multiple sources and advanced analysis techniques.

## 🌟 Features

### Core Capabilities
- **Text Fact-Checking**: Analyze text content for factual accuracy
- **Image Verification**: Verify images using Google's Gemini Vision AI
- **Multi-Source Verification**: Cross-reference claims across multiple APIs
- **Credibility Scoring**: Assess source reliability and content confidence
- **Real-time Analysis**: Fast processing with intelligent caching

### Technical Features
- **Redis Caching**: Performance optimization with distributed caching
- **Rate Limiting**: Prevent abuse with configurable limits
- **Security**: Helmet.js security headers and CORS protection
- **Error Handling**: Comprehensive error responses and logging
- **Graceful Shutdown**: Proper cleanup of resources

## 🏗️ Architecture

### Backend Stack
- **Framework**: Express.js with Node.js
- **AI Analysis**: Google Gemini 1.5 Flash
- **Image Processing**: Sharp for optimization
- **Caching**: Redis for performance
- **Security**: Helmet, CORS, Rate Limiting

### Frontend Stack
- **Framework**: Next.js 13+ with App Router
- **Styling**: Tailwind CSS
- **File Upload**: React Dropzone
- **HTTP Client**: Axios

### External APIs
- **Serper API**: Google Search and News
- **NewsAPI**: Alternative news source
- **Bing Search API**: Fact-checking fallback
- **Gemini AI**: Content analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Redis server (optional but recommended)
- API keys for external services

### 1. Clone and Install

```bash
git clone <repository-url>
cd enhanced-fact-checking-api

# Install backend dependencies
npm install

# Install frontend dependencies (if using Next.js frontend)
cd frontend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Required API Keys
GEMINI_API_KEY=your_gemini_api_key_here
SERPER_API_KEY=your_serper_api_key_here

# Optional API Keys
NEWS_API_KEY=your_newsapi_key_here
BING_SEARCH_API_KEY=your_bing_search_key_here
```

### 3. Start Redis (Optional)

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or install locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
```

### 4. Start the Services

```bash
# Start backend server
npm start

# Start frontend (in another terminal)
cd frontend
npm run dev
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
No authentication required for basic usage. Rate limiting applies.

### Endpoints

#### 1. Text Verification
```http
POST /api/verify/text
Content-Type: application/json

{
  "text": "The text content to verify"
}
```

#### 2. Image Verification
```http
POST /api/verify/
Content-Type: multipart/form-data

Form data:
- image: [file] (max 5MB, supported formats: jpg, png, gif, bmp, webp)
```

#### 3. Health Check
```http
GET /api/verify/health
```

#### 4. Clear Cache
```http
POST /api/verify/clear-cache
```

### Response Format

All verification endpoints return:

```json
{
  "success": true,
  "verdict": "mostly_true|mostly_false|mixed|insufficient_evidence",
  "confidence": 85,
  "explanation": "Detailed analysis explanation",
  "initial_analysis": {
    "verdict": "true",
    "confidence": 90,
    "extracted_claims": [
      {
        "claim": "Specific factual statement",
        "category": "historical|scientific|current_events|statistics|other",
        "time_sensitive": true,
        "verifiable": true
      }
    ],
    "red_flags": [
      {
        "flag": "Description of suspicious element",
        "severity": "low|medium|high"
      }
    ],
    "context_analysis": "Analysis of presentation and context"
  },
  "source_verification": {
    "total_sources": 12,
    "sources_analyzed": 8,
    "verification_results": [
      {
        "claim": "Claim being verified",
        "status": "verified_true|verified_false|partially_true|contradicted|no_evidence",
        "confidence": 95,
        "supporting_sources": [],
        "contradicting_sources": [],
        "explanation": "Detailed verification explanation"
      }
    ],
    "source_quality": {
      "total_sources": 8,
      "high_credibility_sources": 5,
      "recent_sources": 3,
      "consensus_level": "strong|moderate|weak|none"
    }
  },
  "sources": [
    {
      "title": "Source title",
      "url": "https://example.com",
      "snippet": "Relevant excerpt",
      "published_at": "2024-01-15T10:00:00Z",
      "source": "example.com",
      "type": "news|web|fact_check",
      "credibility": "very_high|high|medium|low"
    }
  ],
  "recommendations": "What users should do next",
  "metadata": {
    "processing_time_ms": 2500,
    "timestamp": "2024-01-15T12:00:00Z",
    "apis_used": ["Gemini 1.5 Flash", "Serper API"],
    "search_errors": []
  }
}
```

## 🔧 Configuration

### API Keys Setup

1. **Gemini API Key** (Required)
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add to `.env` as `GEMINI_API_KEY`

2. **Serper API Key** (Required)
   - Visit [Serper.dev](https://serper.dev)
   - Sign up and get your API key
   - Add to `.env` as `SERPER_API_KEY`

3. **NewsAPI Key** (Optional)
   - Visit [NewsAPI.org](https://newsapi.org)
   - Get your free API key
   - Add to `.env` as `NEWS_API_KEY`

4. **Bing Search API Key** (Optional)
   - Visit [Azure Portal](https://portal.azure.com)
   - Create a Bing Search resource
   - Add to `.env` as `BING_SEARCH_API_KEY`

### Rate Limiting Configuration

Default limits:
- General API: 100 requests per 15 minutes
- Verification endpoints: 20 requests per 10 minutes

Modify in `server.js`:
```javascript
app.use("/api/verify", createRateLimiter(
  10 * 60 * 1000, // Window: 10 minutes
  20,             // Max requests: 20
  "Custom message"
));
```

### CORS Configuration

Add your frontend domains to `corsOptions` in `server.js`:
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-domain.com',
  // Add your domains here
];
```

## 🛠️ Development

### Running Tests
```bash
# Run API tests
npm test

# Run with coverage
npm run test:coverage
```

### Development Mode
```bash
# Start with auto-reload
npm run dev

# Start with debugging
npm run debug
```

### Building for Production
```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Deployment
```bash
# Build image
docker build -t fact-checking-api .

# Run with docker-compose
docker-compose up -d
```

## 📈 Performance Optimization

### Caching Strategy
- **Redis**: Distributed caching for search results
- **TTL**: 1 hour for most cached data
- **Cache Keys**: Structured for efficient invalidation

### Image Processing
- **Sharp**: Optimized image resizing and compression
- **Size Limit**: 5MB maximum file size
- **Format Support**: JPEG, PNG, GIF, BMP, WebP

### API Optimization
- **Compression**: Gzip compression enabled
- **Connection Pooling**: Efficient HTTP client usage
- **Timeout Handling**: Proper request timeouts

## 🔒 Security

### Security Headers
- **Helmet.js**: Security headers configuration
- **CSP**: Content Security Policy
- **CORS**: Cross-origin resource sharing protection

### Input Validation
- **File Type Validation**: Strict image file checking
- **Size Limits**: File size and request body limits
- **JSON Validation**: Request body validation

### Error Handling
- **Sanitized Errors**: No sensitive data exposure
- **Logging**: Comprehensive error logging
- **Graceful Degradation**: Fallback mechanisms

## 🚨 Troubleshooting

### Common Issues

1. **Redis Connection Error**
   ```bash
   # Check Redis status
   redis-cli ping
   
   # Restart Redis
   brew services restart redis  # macOS
   sudo systemctl restart redis # Linux
   ```

2. **API Key Issues**
   ```bash
   # Check environment variables
   node -e "console.log(process.env.GEMINI_API_KEY)"
   
   # Test API key
   curl -X GET "/api/verify/health"
   ```

3. **File Upload Issues**
   - Check file size (max 5MB)
   - Verify file format (images only)
   - Ensure proper Content-Type header

4. **Rate Limiting**
   - Wait for rate limit window to reset
   - Check rate limit headers in response
   - Consider implementing authentication for higher limits

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Check specific components
DEBUG=cache,redis npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
- Use ESLint configuration
- Follow Prettier formatting
- Write comprehensive tests
- Document new features


## 🙏 Acknowledgments

- Google Gemini AI for advanced content analysis
- Serper.dev for search API services
- NewsAPI.org for news data
- Redis Labs for caching infrastructure
- The open-source community for excellent tools



---

**Version**: 1.0.0  
**Last Updated**: July 2025  
**Minimum Node.js Version**: 18.0.0
