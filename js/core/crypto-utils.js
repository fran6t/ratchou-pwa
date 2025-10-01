/**
 * Crypto Utilities for Ratchou
 * Simple encryption/decryption using native Web Crypto API (AES-GCM)
 * No external dependencies required
 */

const CryptoUtils = {
    /**
     * Encrypt text with a password using AES-GCM
     * @param {string} text - Text to encrypt
     * @param {string} password - Password for encryption
     * @returns {Promise<string>} Base64 encoded encrypted data (IV + ciphertext)
     */
    async encrypt(text, password) {
        try {
            if (!text || !password) {
                throw new Error('Text and password are required');
            }

            const encoder = new TextEncoder();
            const data = encoder.encode(text);

            // Derive key from password using SHA-256
            const passwordBuffer = encoder.encode(password);
            const passwordHash = await window.crypto.subtle.digest('SHA-256', passwordBuffer);

            // Import key for AES-GCM
            const key = await window.crypto.subtle.importKey(
                'raw',
                passwordHash,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt']
            );

            // Generate random IV (12 bytes for AES-GCM)
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // Encrypt the data
            const encrypted = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );

            // Combine IV + encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to Base64
            return this._arrayBufferToBase64(combined);

        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Erreur lors du chiffrement: ' + error.message);
        }
    },

    /**
     * Decrypt Base64 encoded encrypted data with a password
     * @param {string} encryptedBase64 - Base64 encoded encrypted data (IV + ciphertext)
     * @param {string} password - Password for decryption
     * @returns {Promise<string>} Decrypted text
     */
    async decrypt(encryptedBase64, password) {
        try {
            if (!encryptedBase64 || !password) {
                throw new Error('Encrypted data and password are required');
            }

            // Decode Base64
            const combined = this._base64ToArrayBuffer(encryptedBase64);

            // Extract IV (first 12 bytes) and ciphertext (rest)
            const iv = combined.slice(0, 12);
            const ciphertext = combined.slice(12);

            const encoder = new TextEncoder();

            // Derive key from password using SHA-256
            const passwordBuffer = encoder.encode(password);
            const passwordHash = await window.crypto.subtle.digest('SHA-256', passwordBuffer);

            // Import key for AES-GCM
            const key = await window.crypto.subtle.importKey(
                'raw',
                passwordHash,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );

            // Decrypt the data
            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );

            // Convert to string
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);

        } catch (error) {
            console.error('Decryption error:', error);
            // More user-friendly error message
            if (error.name === 'OperationError' || error.message.includes('decrypt')) {
                throw new Error('Mot de passe incorrect ou données corrompues');
            }
            throw new Error('Erreur lors du déchiffrement: ' + error.message);
        }
    },

    /**
     * Convert ArrayBuffer to Base64 string
     * @private
     */
    _arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    },

    /**
     * Convert Base64 string to ArrayBuffer
     * @private
     */
    _base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    },

    /**
     * Truncate encrypted text for display
     * @param {string} encryptedBase64 - Base64 encoded encrypted data
     * @param {number} maxLength - Maximum length to display (default: 50)
     * @returns {string} Truncated Base64 with ellipsis
     */
    truncateEncrypted(encryptedBase64, maxLength = 50) {
        if (!encryptedBase64) return '';
        if (encryptedBase64.length <= maxLength) return encryptedBase64;
        return encryptedBase64.substring(0, maxLength) + '...';
    }
};

// Export for use in other modules
window.CryptoUtils = CryptoUtils;