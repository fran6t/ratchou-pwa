/**
 * Sync Crypto Utilities for Ratchou
 * AES-256-GCM encryption for end-to-end encrypted sync payloads
 *
 * DIFFERENT from crypto-utils.js (password-based encryption)
 * This module uses CryptoKey objects for sync operations
 *
 * @version 1.0.0
 * @author Ratchou Team
 */
class SyncCrypto {
    /**
     * Generate a new AES-256-GCM encryption key
     * Used during master device bootstrap
     *
     * @returns {Promise<CryptoKey>} - AES-GCM CryptoKey object
     * @throws {Error} - If key generation fails
     *
     * @example
     * const key = await syncCrypto.generateKey();
     * // Returns CryptoKey object ready for encrypt/decrypt
     */
    async generateKey() {
        try {
            return await crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true,  // extractable (needed for exportKey)
                ["encrypt", "decrypt"]
            );
        } catch (error) {
            console.error('🔐 Error generating encryption key:', error);
            throw new Error(`Erreur génération clé: ${error.message}`);
        }
    }

    /**
     * Encrypt data with AES-256-GCM
     *
     * @param {Object} data - Plain object to encrypt
     * @param {CryptoKey} key - AES-GCM key
     * @returns {Promise<Object>} - {iv: Base64, data: Base64}
     * @throws {Error} - If encryption fails
     *
     * @example
     * const encrypted = await syncCrypto.encrypt(
     *   { type: 'SYNC_REQUEST', records: [...] },
     *   cryptoKey
     * );
     * // Returns: { iv: "base64...", data: "base64..." }
     */
    async encrypt(data, key) {
        try {
            // Validate inputs
            if (!data) {
                throw new Error('Data is required for encryption');
            }
            if (!key || key.type !== 'secret') {
                throw new Error('Valid CryptoKey required');
            }

            // Serialize to JSON
            const jsonString = JSON.stringify(data);
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(jsonString);

            // Generate random IV (12 bytes for GCM mode)
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // Encrypt
            const encryptedBuffer = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                key,
                dataBuffer
            );

            // Convert to Base64 for transmission/storage
            return {
                iv: this.arrayBufferToBase64(iv),
                data: this.arrayBufferToBase64(encryptedBuffer)
            };
        } catch (error) {
            console.error('🔐 Encryption error:', error);
            throw new Error(`Erreur chiffrement: ${error.message}`);
        }
    }

    /**
     * Decrypt AES-256-GCM encrypted data
     *
     * @param {Object} encrypted - {iv: Base64, data: Base64}
     * @param {CryptoKey} key - AES-GCM key
     * @returns {Promise<Object>} - Decrypted plain object
     * @throws {Error} - If decryption fails (wrong key, corrupted data)
     *
     * @example
     * const decrypted = await syncCrypto.decrypt(
     *   { iv: "base64...", data: "base64..." },
     *   cryptoKey
     * );
     */
    async decrypt(encrypted, key) {
        try {
            // Validate inputs
            if (!encrypted || !encrypted.iv || !encrypted.data) {
                throw new Error('Encrypted payload must have iv and data fields');
            }
            if (!key || key.type !== 'secret') {
                throw new Error('Valid CryptoKey required');
            }

            // Convert Base64 → ArrayBuffer
            const iv = this.base64ToArrayBuffer(encrypted.iv);
            const encryptedData = this.base64ToArrayBuffer(encrypted.data);

            // Decrypt
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                encryptedData
            );

            // Convert ArrayBuffer → JSON object
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(decryptedBuffer);

            return JSON.parse(jsonString);
        } catch (error) {
            console.error('🔐 Decryption error:', error);

            // User-friendly error messages
            if (error.name === 'OperationError' || error.message.includes('decrypt')) {
                throw new Error('Échec déchiffrement: clé incorrecte ou données corrompues');
            }
            throw new Error(`Erreur déchiffrement: ${error.message}`);
        }
    }

    /**
     * Export CryptoKey to Base64 string for storage in IndexedDB
     *
     * @param {CryptoKey} key - AES-GCM key to export
     * @returns {Promise<string>} - Base64 encoded raw key
     * @throws {Error} - If export fails
     *
     * @example
     * const base64Key = await syncCrypto.exportKeyToBase64(cryptoKey);
     * // Store in SYNC_CONFIG.encryption_key
     */
    async exportKeyToBase64(key) {
        try {
            if (!key || key.type !== 'secret') {
                throw new Error('Valid CryptoKey required');
            }

            const exported = await crypto.subtle.exportKey("raw", key);
            return this.arrayBufferToBase64(exported);
        } catch (error) {
            console.error('🔐 Key export error:', error);
            throw new Error(`Erreur export clé: ${error.message}`);
        }
    }

    /**
     * Import Base64 string to CryptoKey for use in encrypt/decrypt
     *
     * @param {string} base64 - Base64 encoded raw key
     * @returns {Promise<CryptoKey>} - AES-GCM CryptoKey object
     * @throws {Error} - If import fails
     *
     * @example
     * const config = await db.get('SYNC_CONFIG', 'config');
     * const cryptoKey = await syncCrypto.importKeyFromBase64(config.encryption_key);
     */
    async importKeyFromBase64(base64) {
        try {
            if (!base64 || typeof base64 !== 'string') {
                throw new Error('Valid Base64 key string required');
            }

            const keyData = this.base64ToArrayBuffer(base64);

            return await crypto.subtle.importKey(
                "raw",
                keyData,
                { name: "AES-GCM" },
                true,  // extractable
                ["encrypt", "decrypt"]
            );
        } catch (error) {
            console.error('🔐 Key import error:', error);
            throw new Error(`Erreur import clé: ${error.message}`);
        }
    }

    /**
     * Convert ArrayBuffer to Base64 string
     * @private
     * @param {ArrayBuffer|Uint8Array} buffer
     * @returns {string} Base64 encoded string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     * @private
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Export singleton instance (matches existing Ratchou pattern)
const syncCrypto = new SyncCrypto();
window.SyncCrypto = syncCrypto;
