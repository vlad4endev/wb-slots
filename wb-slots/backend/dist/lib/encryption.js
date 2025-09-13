"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.generateKey = generateKey;
const crypto = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    if (key.startsWith('hex:')) {
        return Buffer.from(key.slice(4), 'hex');
    }
    return crypto.pbkdf2Sync(key, 'wb-slots-salt', 100000, KEY_LENGTH, 'sha256');
};
function encrypt(text) {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        cipher.setAAD(Buffer.from('wb-slots-aad', 'utf8'));
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
        return 'hex:' + combined.toString('hex');
    }
    catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}
function decrypt(encryptedText) {
    try {
        if (!encryptedText.startsWith('hex:')) {
            return encryptedText;
        }
        const key = getEncryptionKey();
        const combined = Buffer.from(encryptedText.slice(4), 'hex');
        const iv = combined.slice(0, IV_LENGTH);
        const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAAD(Buffer.from('wb-slots-aad', 'utf8'));
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}
function generateKey() {
    const key = crypto.randomBytes(KEY_LENGTH);
    return 'hex:' + key.toString('hex');
}
//# sourceMappingURL=encryption.js.map