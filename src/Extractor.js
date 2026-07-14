/**
 * Abstract base class for all extractors.
 * Defines the common interface that all extractors must implement.
 */
class Extractor {
  /**
   * Extracts data from HTML content.
   * @param {string} html - The HTML content to extract from  
   * @returns {Array<object>} Array of extracted data objects
   * @abstract
   */
  extractFrom(html) {
    throw new Error('extractFrom method must be implemented by subclasses');
  }
}

module.exports = Extractor;