/**
 * Browser Abstraction Layer - barrel exports.
 *
 * Provides all browser-related components for the SearchService
 * and Provider layers to use:
 *
 * - BrowserEngine (abstract interface)
 * - BrowserSession (state holder)
 * - PlaywrightEngine (concrete implementation)
 * - BrowserFactory (creates engines)
 * - FailureClassifier (classifies exceptions)
 * - RetryPolicy (retry strategy)
 * - BrowserExecutor (orchestrates launch → execute → retry)
 */

const { BrowserEngine } = require('./BrowserEngine');
const { BrowserSession } = require('./BrowserSession');
const { PlaywrightEngine } = require('./PlaywrightEngine');
const { CamofoxEngine } = require('./CamofoxEngine');
const { BrowserFactory } = require('./BrowserFactory');
const { FailureClassifier, FailureCategory } = require('./FailureClassifier');
const { RetryPolicy } = require('./RetryPolicy');
const { BrowserExecutor } = require('./BrowserExecutor');

module.exports = {
  BrowserEngine,
  BrowserSession,
  PlaywrightEngine,
  CamofoxEngine,
  BrowserFactory,
  FailureClassifier,
  FailureCategory,
  RetryPolicy,
  BrowserExecutor,
};
