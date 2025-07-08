// app/utils/ocr.js
import Tesseract from "tesseract.js";

/**
 * Extract text from an image using Tesseract.js OCR
 * @param {File} imageFile - The image file to process
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromImage = async (imageFile, onProgress) => {
  try {
    // Create a promise that resolves with the OCR result
    const result = await Tesseract.recognize(imageFile, "eng", {
      logger: (m) => {
        // Update progress based on Tesseract's status
        if (m.status === "recognizing text") {
          const progress = Math.round(m.progress * 100);
          onProgress?.(progress);
        }
      },
    });

    return result.data.text;
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image");
  }
};

/**
 * Alternative OCR implementation using browser's built-in capabilities
 * This is a fallback option if Tesseract.js is not available
 */
export const extractTextFromImageCanvas = async (imageFile, onProgress) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // This is a simplified version - you'd need a proper OCR library
      // For now, we'll return a placeholder
      onProgress?.(100);
      resolve(
        "OCR text extraction would happen here with a proper OCR library"
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(imageFile);
  });
};
