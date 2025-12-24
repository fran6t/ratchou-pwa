/**
 * Network Client for Ratchou Sync
 * Handles HTTP communication with sync server
 *
 * All endpoints return {success: boolean, ...} format
 * Compatible with RatchouUtils.error.createResponse pattern
 *
 * @version 1.0.0
 * @author Ratchou Team
 */
class NetworkClient {
    /**
     * Constructor
     * @param {string|null} apiUrl - Override API URL (for testing)
     *                                If null, will load from SYNC_CONFIG on first call
     */
    constructor(apiUrl = null) {
        this.apiUrl = apiUrl;
        this.db = null;  // Will be set on first call if apiUrl is null
        this.requestTimeout = 30000; // 30 seconds
    }

    /**
     * Ensure API URL is loaded from SYNC_CONFIG if not provided
     * @private
     */
    async ensureApiUrl() {
        if (this.apiUrl) return;

        // Load from SYNC_CONFIG (permanent source of truth)
        if (!this.db && window.db) {
            this.db = window.db; // Use global IndexedDB wrapper
        }

        if (this.db) {
            try {
                const config = await this.db.get('SYNC_CONFIG', 'config');
                if (config && config.api_url) {
                    this.apiUrl = config.api_url;
                    console.log('🌐 NetworkClient: Loaded API URL from SYNC_CONFIG');
                    return;
                }
            } catch (error) {
                console.warn('⚠️ NetworkClient: Could not load API URL from SYNC_CONFIG:', error);
            }
        }

        // Fallback to localStorage (for initial bootstrap before SYNC_CONFIG exists)
        const localStorageUrl = localStorage.getItem('ratchou_api_url');
        if (localStorageUrl) {
            this.apiUrl = localStorageUrl;
            console.log('🌐 NetworkClient: Loaded API URL from localStorage (bootstrap mode)');
            return;
        }

        throw new Error('API URL not configured. Please set api_url in SYNC_CONFIG.');
    }

    /**
     * Generic POST helper with timeout and error handling
     * @private
     *
     * @param {string} endpoint - API endpoint (e.g., '/pair', '/push')
     * @param {Object} payload - Request body (will be JSON.stringify'd)
     * @returns {Promise<Object>} - {success, ...} response
     */
    async post(endpoint, payload) {
        await this.ensureApiUrl();

        const url = `${this.apiUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            console.log(`🌐 POST ${endpoint}`, payload);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Parse JSON response
            const data = await response.json();

            // Handle HTTP errors
            if (!response.ok) {
                console.error(`🌐 HTTP ${response.status} ${endpoint}:`, data);

                // Enrichir l'erreur pour rate limit (429)
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    return {
                        success: false,
                        error: 'rate_limit',
                        message: data.message || 'Trop de requêtes. Veuillez patienter.',
                        httpStatus: 429,
                        retryAfter: retryAfter ? parseInt(retryAfter, 10) : 900  // 15 min par défaut
                    };
                }

                return {
                    success: false,
                    error: data.error || 'http_error',
                    message: data.message || `Erreur HTTP ${response.status}`,
                    httpStatus: response.status
                };
            }

            console.log(`🌐 ✅ POST ${endpoint}:`, data);
            return data;

        } catch (error) {
            clearTimeout(timeoutId);

            console.error(`🌐 Network error ${endpoint}:`, error);

            // Network errors
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'timeout',
                    message: `Timeout après ${this.requestTimeout / 1000}s`
                };
            }

            // Fetch errors (network offline, CORS, etc.)
            return {
                success: false,
                error: 'network_error',
                message: `Erreur réseau: ${error.message}`
            };
        }
    }

    // ==================== PAIRING ENDPOINTS ====================

    /**
     * Pair a new device with the sync server
     *
     * @param {Object} deviceData
     * @param {string} deviceData.device_id - Unique device identifier
     * @param {string} deviceData.role - 'master' or 'slave'
     * @param {boolean} [deviceData.bootstrap] - True for initial master creation
     * @param {string} [deviceData.master_id] - Master device ID (for slaves)
     * @param {string} [deviceData.recovery_key] - Recovery key (for master restoration)
     *
     * @returns {Promise<Object>} {success, device_token, ...}
     *
     * @example
     * // Master bootstrap
     * const result = await networkClient.pair({
     *   device_id: 'master_123',
     *   role: 'master',
     *   bootstrap: true
     * });
     *
     * // Slave pairing
     * const result = await networkClient.pair({
     *   device_id: 'slave_456',
     *   role: 'slave',
     *   master_id: 'master_123'
     * });
     */
    async pair(deviceData) {
        return await this.post('/pair', deviceData);
    }

    /**
     * Initiate pairing with short code (master initiates)
     *
     * @param {Object} payload - Pairing payload with encryption key
     * @returns {Promise<Object>} {success, short_code, expires_at}
     *
     * @example
     * const result = await networkClient.pairingInitiate({
     *   v: 2,
     *   master_id: 'master_123',
     *   encryption_key: 'base64...',
     *   api_url: 'https://sync.example.com'
     * });
     * // Returns: {success: true, short_code: 'A4T9-B2X5', expires_at: 1234567890}
     */
    async pairingInitiate(payload) {
        return await this.post('/pairing/initiate', { payload });
    }

    /**
     * Claim pairing via short code (slave claims)
     *
     * @param {string} shortCode - Short code from master (e.g., 'A4T9-B2X5')
     * @param {Object} fingerprint - Device fingerprint for verification
     * @returns {Promise<Object>} {success, payload: {...}}
     *
     * @example
     * const result = await networkClient.pairingClaim('A4T9-B2X5', {
     *   canvas: 'fp...',
     *   webgl: 'renderer...',
     *   ua: navigator.userAgent
     * });
     * // Returns pairing payload for slave to store in SYNC_CONFIG
     */
    async pairingClaim(shortCode, fingerprint) {
        return await this.post('/pairing/claim', {
            short_code: shortCode,
            fingerprint: fingerprint
        });
    }

    // ==================== SYNC ENDPOINTS ====================

    /**
     * Push encrypted messages to another device
     *
     * @param {string} deviceId - Sender device ID
     * @param {string} token - Sender device token
     * @param {string} to - Recipient device ID
     * @param {Object} payload - Encrypted payload {iv, data}
     *
     * @returns {Promise<Object>} {success, message_id}
     *
     * @example
     * const encrypted = await syncCrypto.encrypt(syncData, key);
     * const result = await networkClient.push(
     *   myDeviceId,
     *   myToken,
     *   masterDeviceId,
     *   encrypted
     * );
     */
    async push(deviceId, token, to, payload) {
        return await this.post('/push', {
            device_id: deviceId,
            device_token: token,
            to: to,
            payload: payload
        });
    }

    /**
     * Pull pending messages for this device
     *
     * @param {string} deviceId - Device ID
     * @param {string} token - Device token
     *
     * @returns {Promise<Object>} {success, messages: [{message_id, from, payload, created_at}, ...]}
     *
     * @example
     * const result = await networkClient.pull(myDeviceId, myToken);
     * if (result.success) {
     *   for (const msg of result.messages) {
     *     const decrypted = await syncCrypto.decrypt(msg.payload, key);
     *     // Process decrypted message
     *   }
     * }
     */
    async pull(deviceId, token) {
        return await this.post('/pull', {
            device_id: deviceId,
            device_token: token
        });
    }

    /**
     * Send heartbeat to update device status
     *
     * @param {string} deviceId - Device ID
     * @param {string} token - Device token
     *
     * @returns {Promise<Object>} {success, cluster_status: {master_alive, ...}}
     *
     * @example
     * const result = await networkClient.heartbeat(myDeviceId, myToken);
     * if (!result.cluster_status.master_alive) {
     *   // Master is offline - consider promotion
     * }
     */
    async heartbeat(deviceId, token) {
        return await this.post('/heartbeat', {
            device_id: deviceId,
            device_token: token
        });
    }

    // ==================== DEVICE MANAGEMENT ENDPOINTS ====================

    /**
     * Get list of devices in cluster
     *
     * @param {string} deviceId - Device ID
     * @param {string} token - Device token
     *
     * @returns {Promise<Object>} {success, devices: [{device_id, role, name, last_seen, ...}, ...]}
     *
     * @example
     * const result = await networkClient.getDevices(myDeviceId, myToken);
     * // Display in sync-devices.html
     */
    async getDevices(deviceId, token) {
        return await this.post('/devices', {
            device_id: deviceId,
            device_token: token
        });
    }

    /**
     * Revoke a device from the cluster
     *
     * @param {string} deviceId - Device ID (requester)
     * @param {string} token - Device token
     * @param {string} targetId - Device ID to revoke
     * @param {string} [reason] - Optional reason (e.g., 'lost', 'stolen')
     *
     * @returns {Promise<Object>} {success, notified_devices}
     *
     * @example
     * // Master revokes a slave
     * const result = await networkClient.revoke(
     *   myDeviceId,
     *   myToken,
     *   'slave_to_remove',
     *   'lost'
     * );
     *
     * // Self-revocation (depair)
     * const result = await networkClient.revoke(
     *   myDeviceId,
     *   myToken,
     *   myDeviceId
     * );
     */
    async revoke(deviceId, token, targetId, reason = null) {
        const payload = {
            device_id: deviceId,
            device_token: token,
            target_device_id: targetId
        };

        if (reason) {
            payload.reason = reason;
        }

        return await this.post('/revoke', payload);
    }

    /**
     * Update device custom name
     *
     * @param {string} deviceId - Device ID
     * @param {string} token - Device token
     * @param {string} name - New device name
     *
     * @returns {Promise<Object>} {success}
     *
     * @example
     * const result = await networkClient.updateDeviceName(
     *   myDeviceId,
     *   myToken,
     *   'iPhone de Marie'
     * );
     */
    async updateDeviceName(deviceId, token, name) {
        return await this.post('/device-name', {
            device_id: deviceId,
            device_token: token,
            device_name: name
        });
    }

    /**
     * Promote a slave to master
     *
     * @param {string} deviceId - Requesting device ID (must be slave)
     * @param {string} token - Device token
     * @param {string} masterId - Current master ID (for verification)
     *
     * @returns {Promise<Object>} {success, notified_slaves}
     *
     * @example
     * const result = await networkClient.promote(
     *   myDeviceId,
     *   myToken,
     *   inactiveMasterId
     * );
     */
    async promote(deviceId, token, masterId) {
        return await this.post('/promote', {
            device_id: deviceId,
            device_token: token,
            master_id: masterId
        });
    }

    /**
     * Set custom request timeout
     * @param {number} ms - Timeout in milliseconds
     */
    setTimeout(ms) {
        if (ms > 0 && ms <= 120000) {  // Max 2 minutes
            this.requestTimeout = ms;
        } else {
            throw new Error('Timeout must be between 1ms and 120000ms');
        }
    }
}

// Export singleton instance (matches existing Ratchou pattern)
const networkClient = new NetworkClient();
window.NetworkClient = networkClient;
