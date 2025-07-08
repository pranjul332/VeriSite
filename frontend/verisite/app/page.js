// pages/index.js
"use client";
import Head from "next/head";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // File upload handler
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError("Please select a valid image file (max 5MB)");
      return;
    }

    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".bmp", ".webp"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
  });

  // Submit handlers
  const handleTextSubmit = async (e) => {
    e.preventDefault();

    if (!textInput.trim()) {
      setError("Please enter some text to verify");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/verify/text`, {
        text: textInput,
      });

      setResult(response.data);
    } catch (err) {
      console.error("Text verification error:", err);
      setError(err.response?.data?.message || "Failed to verify text");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError("Please select an image file");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await axios.post(
        `${API_BASE_URL}/api/verify/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(response.data);
    } catch (err) {
      console.error("Image verification error:", err);
      setError(err.response?.data?.message || "Failed to verify image");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTextInput("");
    setSelectedFile(null);
    setResult(null);
    setError(null);
  };
 
  const getVerdictColor = (verdict) => {
    switch (verdict) {
      case "true":
      case "verified_true":
      case "mostly_true":
        return "text-green-600 bg-green-50 border-green-200";
      case "likely_fake":
      case "verified_false":
      case "mostly_false":
        return "text-red-600 bg-red-50 border-red-200";
      case "misleading":
      case "partially_true":
      case "mixed":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Enhanced Fact-Checker</title>
        <meta
          name="description"
          content="AI-powered fact-checking for text and images"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🔍 Enhanced Fact-Checker
          </h1>
          <p className="text-gray-600 text-lg">
            AI-powered verification for text and images using multiple sources
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-sm p-1">
            <button
              onClick={() => setActiveTab("text")}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === "text"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📝 Text Verification
            </button>
            <button
              onClick={() => setActiveTab("image")}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === "image"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              🖼️ Image Verification
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            {activeTab === "text" ? (
              <form onSubmit={handleTextSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="text"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Enter text to verify
                  </label>
                  <textarea
                    id="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="6"
                    placeholder="Paste any text, claim, or statement you want to fact-check..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading || !textInput.trim()}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "Verifying..." : "Verify Text"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleImageSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload image to verify
                  </label>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <input {...getInputProps()} />
                    {selectedFile ? (
                      <div>
                        <p className="text-green-600 font-medium">
                          ✅ {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-600">
                          {isDragActive
                            ? "📁 Drop your image here..."
                            : "🖼️ Drag & drop an image here, or click to select"}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Supports: JPG, PNG, GIF, WEBP (max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading || !selectedFile}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "Verifying..." : "Verify Image"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                <span className="text-gray-600">
                  Analyzing and fact-checking...
                </span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <div className="flex items-center">
                <span className="text-red-600 mr-2">❌</span>
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isLoading && (
            <div className="space-y-6">
              {/* Main Verdict */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  📊 Verification Results
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div
                    className={`p-4 rounded-lg border ${getVerdictColor(
                      result.verdict
                    )}`}
                  >
                    <div className="font-semibold text-lg mb-1">Verdict</div>
                    <div className="text-2xl font-bold capitalize">
                      {result.verdict.replace("_", " ")}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="font-semibold text-lg mb-1">Confidence</div>
                    <div
                      className={`text-2xl font-bold ${getConfidenceColor(
                        result.confidence
                      )}`}
                    >
                      {result.confidence}%
                    </div>
                  </div>
                </div>

                {result.explanation && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-2">Explanation</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {result.explanation}
                    </p>
                  </div>
                )}

                {result.recommendations && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      💡 Recommendations
                    </h3>
                    <p className="text-blue-800">{result.recommendations}</p>
                  </div>
                )}
              </div>

              {/* Claims Analysis */}
              {result.initial_analysis?.extracted_claims?.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    🔍 Extracted Claims
                  </h3>
                  <div className="space-y-3">
                    {result.initial_analysis.extracted_claims.map(
                      (claim, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="font-medium text-gray-900 mb-2">
                            {claim.claim}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                              {claim.category}
                            </span>
                            {claim.time_sensitive && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                                Time-sensitive
                              </span>
                            )}
                            {claim.verifiable && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                Verifiable
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {result.initial_analysis?.red_flags?.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    🚩 Red Flags
                  </h3>
                  <div className="space-y-3">
                    {result.initial_analysis.red_flags.map((flag, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          flag.severity === "high"
                            ? "border-red-200 bg-red-50"
                            : flag.severity === "medium"
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="mr-2">
                            {flag.severity === "high"
                              ? "🔴"
                              : flag.severity === "medium"
                              ? "🟡"
                              : "🟢"}
                          </span>
                          <div>
                            <div className="font-medium capitalize">
                              {flag.severity} Severity
                            </div>
                            <div className="text-gray-700">{flag.flag}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Verification */}
              {result.source_verification?.verification_results?.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    📚 Source Verification
                  </h3>
                  <div className="space-y-4">
                    {result.source_verification.verification_results.map(
                      (verification, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="font-medium text-gray-900 mb-2">
                            {verification.claim}
                          </div>
                          <div className="flex items-center mb-2">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                verification.status === "verified_true"
                                  ? "bg-green-100 text-green-800"
                                  : verification.status === "verified_false"
                                  ? "bg-red-100 text-red-800"
                                  : verification.status === "partially_true"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {verification.status.replace("_", " ")}
                            </span>
                            <span className="ml-2 text-sm text-gray-600">
                              {verification.confidence}% confidence
                            </span>
                          </div>
                          {verification.explanation && (
                            <p className="text-gray-700 text-sm">
                              {verification.explanation}
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Sources */}
              {result.sources?.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    📰 Sources Checked
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.sources.slice(0, 8).map((source, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              source.type === "fact_check"
                                ? "bg-green-100 text-green-800"
                                : source.type === "news"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {source.type.replace("_", " ")}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              source.credibility === "very_high"
                                ? "bg-green-100 text-green-800"
                                : source.credibility === "high"
                                ? "bg-blue-100 text-blue-800"
                                : source.credibility === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {source.credibility.replace("_", " ")} credibility
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                          {source.title}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                          {source.snippet}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {source.source}
                          </span>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 text-sm"
                          >
                            Read more →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {result.metadata && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    📈 Analysis Metadata
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      Processing time: {result.metadata.processing_time_ms}ms
                    </div>
                    <div>
                      APIs used: {result.metadata.apis_used?.join(", ")}
                    </div>
                    <div>
                      Sources found:{" "}
                      {result.source_verification?.total_sources || 0}
                    </div>
                    <div>
                      Analysis completed:{" "}
                      {new Date(result.metadata.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
