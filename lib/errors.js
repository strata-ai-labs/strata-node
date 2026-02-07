'use strict';

/**
 * Base error class for all StrataDB errors.
 *
 * Every StrataDB error has a `.code` property (e.g. "NOT_FOUND", "VALIDATION")
 * that can be used for programmatic error handling.
 */
class StrataError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {string} code    - Machine-readable error category.
   */
  constructor(message, code) {
    super(message);
    this.name = 'StrataError';
    this.code = code;
  }
}

class NotFoundError extends StrataError {
  constructor(message) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ValidationError extends StrataError {
  constructor(message) {
    super(message, 'VALIDATION');
    this.name = 'ValidationError';
  }
}

class ConflictError extends StrataError {
  constructor(message) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

class StateError extends StrataError {
  constructor(message) {
    super(message, 'STATE');
    this.name = 'StateError';
  }
}

class ConstraintError extends StrataError {
  constructor(message) {
    super(message, 'CONSTRAINT');
    this.name = 'ConstraintError';
  }
}

class AccessDeniedError extends StrataError {
  constructor(message) {
    super(message, 'ACCESS_DENIED');
    this.name = 'AccessDeniedError';
  }
}

class IoError extends StrataError {
  constructor(message) {
    super(message, 'IO');
    this.name = 'IoError';
  }
}

/**
 * Map from error code prefix to typed error class.
 * @type {Record<string, typeof StrataError>}
 */
const ERROR_MAP = {
  NOT_FOUND: NotFoundError,
  VALIDATION: ValidationError,
  CONFLICT: ConflictError,
  STATE: StateError,
  CONSTRAINT: ConstraintError,
  ACCESS_DENIED: AccessDeniedError,
  IO: IoError,
};

/**
 * Parse a native error message and return a typed StrataError subclass.
 *
 * Native errors are prefixed with `[CODE] message`. If the prefix is
 * recognized, the appropriate subclass is returned; otherwise a generic
 * StrataError is returned with code "UNKNOWN".
 *
 * @param {Error} err - Raw error from the native binding.
 * @returns {StrataError}
 */
function toTypedError(err) {
  const msg = err.message || String(err);
  const match = msg.match(/^\[([A-Z_]+)\]\s*(.*)/s);
  if (match) {
    const [, code, rest] = match;
    const Cls = ERROR_MAP[code];
    if (Cls) {
      return new Cls(rest);
    }
    return new StrataError(rest, code);
  }
  // No prefix — wrap as generic StrataError.
  return new StrataError(msg, 'UNKNOWN');
}

module.exports = {
  StrataError,
  NotFoundError,
  ValidationError,
  ConflictError,
  StateError,
  ConstraintError,
  AccessDeniedError,
  IoError,
  toTypedError,
};
