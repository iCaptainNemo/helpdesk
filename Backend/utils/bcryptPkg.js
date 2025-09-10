/**
 * Custom bcrypt implementation for pkg standalone executables
 * Bypasses node-pre-gyp and directly loads the native binary
 */

const path = require('path');

let bindings;

// Initialize bcrypt bindings for pkg environment
if (process.pkg) {
    // In pkg environment, directly load the native binary from bundled assets
    const nativePath = path.join(__dirname, '../node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node');
    bindings = require(nativePath);
} else {
    // Development environment - use normal bcrypt
    bindings = require('bcrypt');
}

const crypto = require('crypto');

/// generate a salt (sync)
/// @param {Number} [rounds] number of rounds (default 10)  
/// @return {String} salt
function genSaltSync(rounds, minor) {
    rounds = rounds || 10;
    if (typeof rounds !== 'number') {
        throw new Error('rounds must be a number');
    }
    if (rounds < 1) {
        throw new Error('rounds must be greater than 0');
    }
    return bindings.genSaltSync(rounds, minor || 'b');
}

/// generate a salt (async)
/// @param {Number} [rounds] number of rounds (default 10)
/// @param {Function} [callback] callback accepting (err, salt)
function genSalt(rounds, callback) {
    if (typeof rounds === 'function') {
        callback = rounds;
        rounds = 10;
    }
    
    if (typeof callback !== 'function') {
        return new Promise((resolve, reject) => {
            try {
                const salt = genSaltSync(rounds);
                resolve(salt);
            } catch (err) {
                reject(err);
            }
        });
    }
    
    process.nextTick(() => {
        try {
            const salt = genSaltSync(rounds);
            callback(null, salt);
        } catch (err) {
            callback(err);
        }
    });
}

/// hash data (sync)
/// @param {String} data data to hash
/// @param {String} salt salt to hash with
/// @return {String} hash
function hashSync(data, salt) {
    if (typeof data !== 'string') {
        data = String(data);
    }
    if (typeof salt === 'number') {
        salt = genSaltSync(salt);
    }
    return bindings.hashSync(data, salt);
}

/// hash data (async)
/// @param {String} data data to hash
/// @param {String|Number} salt salt to hash with
/// @param {Function} [callback] callback accepting (err, hash)
function hash(data, salt, callback) {
    if (typeof callback !== 'function') {
        return new Promise((resolve, reject) => {
            try {
                const hash = hashSync(data, salt);
                resolve(hash);
            } catch (err) {
                reject(err);
            }
        });
    }
    
    process.nextTick(() => {
        try {
            const hash = hashSync(data, salt);
            callback(null, hash);
        } catch (err) {
            callback(err);
        }
    });
}

/// compare data against hash (sync)
/// @param {String} data data to compare  
/// @param {String} hash hash to compare to
/// @return {Boolean} true if match
function compareSync(data, hash) {
    if (typeof data !== 'string') {
        data = String(data);
    }
    if (typeof hash !== 'string') {
        hash = String(hash);
    }
    return bindings.compareSync(data, hash);
}

/// compare data against hash (async)
/// @param {String} data data to compare
/// @param {String} hash hash to compare to  
/// @param {Function} [callback] callback accepting (err, result)
function compare(data, hash, callback) {
    if (typeof callback !== 'function') {
        return new Promise((resolve, reject) => {
            try {
                const result = compareSync(data, hash);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    }
    
    process.nextTick(() => {
        try {
            const result = compareSync(data, hash);
            callback(null, result);
        } catch (err) {
            callback(err);
        }
    });
}

module.exports = {
    genSaltSync,
    genSalt,
    hashSync,
    hash,
    compareSync,
    compare,
    // Expose constants
    SALT_ROUNDS: 10
};