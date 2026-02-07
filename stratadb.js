'use strict';

const native = require('./index.js');
const {
  StrataError,
  NotFoundError,
  ValidationError,
  ConflictError,
  StateError,
  ConstraintError,
  AccessDeniedError,
  IoError,
  toTypedError,
} = require('./lib/errors.js');

// ---------------------------------------------------------------------------
// Wrap every async prototype method so native errors are re-thrown as typed
// StrataError subclasses.
// ---------------------------------------------------------------------------

const NativeStrata = native.Strata;

// Collect all own method names (excluding constructor) from the prototype.
const methodNames = Object.getOwnPropertyNames(NativeStrata.prototype).filter(
  (name) => name !== 'constructor' && typeof NativeStrata.prototype[name] === 'function',
);

for (const name of methodNames) {
  const original = NativeStrata.prototype[name];
  Object.defineProperty(NativeStrata.prototype, name, {
    value: async function (...args) {
      try {
        return await original.apply(this, args);
      } catch (err) {
        throw toTypedError(err);
      }
    },
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Create a JS wrapper class that delegates to the native class, wrapping
// the static factory methods with error handling.
// ---------------------------------------------------------------------------

class Strata extends NativeStrata {
  static open(...args) {
    try {
      return NativeStrata.open(...args);
    } catch (err) {
      throw toTypedError(err);
    }
  }

  static cache(...args) {
    try {
      return NativeStrata.cache(...args);
    } catch (err) {
      throw toTypedError(err);
    }
  }
}

// Wrap top-level setup() function.
const originalSetup = native.setup;
function setup(...args) {
  try {
    return originalSetup.apply(null, args);
  } catch (err) {
    throw toTypedError(err);
  }
}

// ---------------------------------------------------------------------------
// Re-export everything.
// ---------------------------------------------------------------------------

module.exports = {
  Strata,
  setup,
  // Error classes
  StrataError,
  NotFoundError,
  ValidationError,
  ConflictError,
  StateError,
  ConstraintError,
  AccessDeniedError,
  IoError,
};
