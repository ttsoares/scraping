/**
 * Repository module exports
 *
 * Re-exports the core Repository interface and all storage implementations.
 * Consumers typically import from this index rather than individual files.
 */

const { Repository, PATHS } = require('./Repository');
const { SQLiteRepository, SCHEMA_VERSION } = require('./SQLiteRepository');

module.exports = {
  /**
   * Abstract Repository interface.
   */
  Repository,
  /**
   * SQLite implementation.
   */
  SQLiteRepository,
  /**
   * Configuration constants (used to resolve DB paths).
   */
  PATHS,
  /**
   * Current schema version.
   */
  SCHEMA_VERSION,
};
