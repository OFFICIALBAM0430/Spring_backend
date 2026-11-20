const crypto = require('crypto');

function generateReference(prefix = 'DGEP') {
    const uniqueId =
    crypto.randomBytes(8).toString('hex').toUpperCase();

    return `${prefix}-${Date.now()}-${uniqueId}`;
}

module.exports = generateReference;