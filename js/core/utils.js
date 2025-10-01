/**
 * Utility functions for Ratchou IndexedDB migration
 * Handles data transformations, UUID generation, and formatting
 */

class RatchouUtils {
    /**
     * Currency conversion utilities
     */
    static currency = {
        // Convert amount to storage unit based on currency
        // EUR/USD: cents (x100), BTC: satoshis (x100000000)
        toStorageUnit(amount, currency = 'EUR') {
            if (amount === null || amount === undefined) return 0;
            const numAmount = parseFloat(amount);

            if (currency === 'BTC') {
                // Bitcoin: store as satoshis (8 decimals)
                return Math.round(numAmount * 100000000);
            } else {
                // EUR/USD: store as cents (2 decimals)
                return Math.round(numAmount * 100);
            }
        },

        // Convert storage unit back to amount based on currency
        fromStorageUnit(stored, currency = 'EUR') {
            if (stored === null || stored === undefined) return 0;

            if (currency === 'BTC') {
                // Bitcoin: stored as satoshis
                return stored / 100000000;
            } else {
                // EUR/USD: stored as cents
                return stored / 100;
            }
        },

        // Legacy aliases for backward compatibility
        toCents(euroAmount) {
            return this.toStorageUnit(euroAmount, 'EUR');
        },

        toEuros(cents) {
            return this.fromStorageUnit(cents, 'EUR');
        },

        // Get currency symbol
        getSymbol(currency) {
            const symbols = {
                'EUR': '€',
                'USD': '$',
                'BTC': '₿'
            };
            return symbols[currency] || '€';
        },

        // Format cents as currency string for display (EUR only - legacy)
        format(cents, locale = 'fr-FR') {
            const euros = this.toEuros(cents);
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(euros);
        },

        // Format stored amount with specific currency
        formatWithCurrency(stored, currency = 'EUR', locale = 'fr-FR') {
            const amount = this.fromStorageUnit(stored, currency);

            if (currency === 'BTC') {
                // For BTC, use special formatting (up to 8 decimals)
                // Remove trailing zeros but keep at least 2 decimals
                let formatted = amount.toFixed(8);
                formatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
                if (!formatted.includes('.')) {
                    formatted += '.00';
                } else if (formatted.split('.')[1].length < 2) {
                    formatted += '0';
                }
                return `${formatted} ₿`;
            }

            // For other currencies, use Intl.NumberFormat
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        },

        // Parse user input to cents
        parseInput(input) {
            const cleaned = String(input).replace(/[^\d.,-]/g, '').replace(',', '.');
            const amount = parseFloat(cleaned) || 0;
            return this.toCents(amount);
        }
    };

    /**
     * Date utilities
     */
    static date = {
        // Convert datetime to ISO string
        toISO(dateTime) {
            if (!dateTime) return new Date().toISOString();
            return new Date(dateTime).toISOString();
        },

        // Current timestamp as ISO string
        now() {
            return new Date().toISOString();
        },

        // Format date for display
        format(isoString, locale = 'fr-FR') {
            return new Date(isoString).toLocaleDateString(locale);
        },

        // Format date and time for display
        formatDateTime(isoString, locale = 'fr-FR') {
            return new Date(isoString).toLocaleString(locale);
        },

        // Get date for input[type="date"]
        toInputDate(isoString) {
            return new Date(isoString).toISOString().split('T')[0];
        },

        // Generate filename timestamp in French local time (AAAMMJJHHMM format)
        toLocalFileName(date = new Date()) {
            // Configure for French timezone (Europe/Paris)
            const options = {
                timeZone: 'Europe/Paris',
                year: 'numeric',
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };
            
            // Get formatted parts
            const parts = new Intl.DateTimeFormat('fr-CA', options).formatToParts(date);
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            const hour = parts.find(p => p.type === 'hour').value;
            const minute = parts.find(p => p.type === 'minute').value;
            
            // Return in AAAMMJJHHMM format
            return `${year}${month}${day}${hour}${minute}`;
        }
    };


    /**
     * Generate UUID v4
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }


    /**
     * Validation utilities
     */
    static validate = {
        // Validate access code (4 digits)
        accessCode(code) {
            return typeof code === 'string' && /^\d{4}$/.test(code);
        },

        // Validate UUID format
        uuid(id) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return typeof id === 'string' && uuidRegex.test(id);
        },

        // Validate required fields
        required(value, fieldName) {
            if (value === null || value === undefined || value === '') {
                throw new Error(`Field ${fieldName} is required`);
            }
            return true;
        },

        // Validate email format
        email(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return typeof email === 'string' && emailRegex.test(email);
        }
    };

    /**
     * Error handling utilities
     */
    static error = {
        // Create standardized error response
        createResponse(success, message, data = null) {
            return { success, message, data };
        },

        // Handle IndexedDB errors
        handleIndexedDBError(error, operation) {
            console.error(`IndexedDB ${operation} error:`, error);
            return this.createResponse(false, `Erreur ${operation}: ${error.message}`);
        },

        // Validation error
        validation(message) {
            return this.createResponse(false, `Erreur de validation: ${message}`);
        },

        // Success response
        success(message, data = null) {
            return this.createResponse(true, message, data);
        }
    };

    /**
     * Debug utilities
     */
    static debug = {
        // Log with timestamp
        log(message, data = null) {
            if (window.RATCHOU_DEBUG) {
                console.log(`[${new Date().toISOString()}] ${message}`, data || '');
            }
        },

        // Performance timer
        time(label) {
            if (window.RATCHOU_DEBUG) {
                console.time(label);
            }
        },

        timeEnd(label) {
            if (window.RATCHOU_DEBUG) {
                console.timeEnd(label);
            }
        }
    };

    /**
     * Device identification utilities
     */
    static device = {
        // Generate a unique device ID string
        generateDeviceId() {
            const uniqueSuffix = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
            return `device-${Date.now()}-${uniqueSuffix}`;
        },

        // Set and store the device ID
        setDeviceId(name) {
            if (!name || name.trim() === '') {
                throw new Error('Device name cannot be empty');
            }
            // Clean device name to create a more robust ID
            const cleanName = name.trim()
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_-]/g, '');
            
            const deviceId = `${cleanName}-${Date.now()}`;
            RatchouUtils.storage.set('device_id', deviceId);
            RatchouUtils.debug.log('Device ID set to:', deviceId);
            return deviceId;
        },

        // Get current device ID (synchronous, assumes it already exists)
        getCurrentDeviceId() {
            return RatchouUtils.storage.get('device_id') || null;
        }
    };

    /**
     * Cryptographic utilities
     */
    static crypto = {
        // Hash access code with SHA-256 for secure localStorage storage
        async hashAccessCode(code) {
            try {
                if (!code || typeof code !== 'string') {
                    throw new Error('Code d\'accès invalide');
                }
                
                const encoder = new TextEncoder();
                const data = encoder.encode(code + 'ratchou_salt_2024'); // Application salt
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (error) {
                console.error('Hash error:', error);
                throw error;
            }
        }
    };

    /**
     * Synchronization utilities
     */
    static sync = {
        // Counter for generating revision numbers
        _revCounter: 0,

        // Generate monotonic revision string (device_id:counter)
        newRev(deviceId = null) {
            if (!deviceId) {
                deviceId = RatchouUtils.device.getCurrentDeviceId();
                if (!deviceId) {
                    throw new Error('Device ID not initialized');
                }
            }
            
            this._revCounter++;
            return `${deviceId}:${this._revCounter}`;
        },

        // Add metadata fields for synchronization
        addMeta(data, deviceId = null) {
            if (!deviceId) {
                deviceId = RatchouUtils.device.getCurrentDeviceId();
                if (!deviceId) {
                    throw new Error('Device ID not initialized');
                }
            }

            const now = Date.now();
            
            return {
                ...data,
                device_id: deviceId,
                rev: this.newRev(deviceId),
                updated_at: now,
                is_deleted: 0, // Use 0 for false
                deleted_at: null
            };
        },

        // Mark record as deleted (soft delete)
        markDeleted(data, deviceId = null) {
            if (!deviceId) {
                deviceId = RatchouUtils.device.getCurrentDeviceId();
                if (!deviceId) {
                    throw new Error('Device ID not initialized');
                }
            }

            const now = Date.now();
            
            return {
                ...data,
                device_id: deviceId,
                rev: this.newRev(deviceId),
                updated_at: now,
                is_deleted: 1, // Use 1 for true
                deleted_at: now
            };
        }
    };

    /**
     * Version and environment utilities
     */
    static version = {
        // Get app version from Service Worker
        async getAppVersionFromSW() {
            try {
                // Determine correct path to sw.js based on current location
                const currentPath = window.location.pathname;
                const swPath = currentPath.includes('/manage/') ? '../sw.js' : './sw.js';

                // Try to get version from registered service worker first
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration && registration.active) {
                        // Try to fetch from the correct path
                        try {
                            const response = await fetch(swPath, { cache: 'no-cache' });
                            const swContent = await response.text();
                            const versionMatch = swContent.match(/const APP_VERSION = ['"]([^'"]+)['"]/);
                            if (versionMatch) {
                                return versionMatch[1];
                            }
                        } catch (fetchError) {
                            console.warn('Could not fetch SW from path:', swPath, fetchError);
                        }
                    }
                }

                // Fallback: try both possible paths
                const pathsToTry = [swPath, './sw.js', '../sw.js', '/sw.js'];

                for (const path of pathsToTry) {
                    try {
                        const response = await fetch(path, { cache: 'no-cache' });
                        if (response.ok) {
                            const swContent = await response.text();
                            const versionMatch = swContent.match(/const APP_VERSION = ['"]([^'"]+)['"]/);
                            if (versionMatch) {
                                return versionMatch[1];
                            }
                        }
                    } catch (fetchError) {
                        // Continue to next path
                    }
                }

                return '1.0.0'; // Final fallback

            } catch (error) {
                console.warn('Could not read version from service worker:', error);
                return '1.0.0'; // Fallback version
            }
        },

        // Get environment information based on hostname
        getEnvironmentInfo() {
            const hostname = window.location.hostname;

            if (hostname === 'app.ratchou.fr') {
                return {
                    name: 'PROD',
                    color: 'success',
                    label: 'Production'
                };
            } else if (hostname === 'maison.wse.fr') {
                return {
                    name: 'DEV',
                    color: 'warning',
                    label: 'Développement'
                };
            } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return {
                    name: 'LOCAL',
                    color: 'info',
                    label: 'Local'
                };
            } else {
                return {
                    name: 'OTHER',
                    color: 'secondary',
                    label: 'Autre'
                };
            }
        },

        // Get complete version info with environment
        async getVersionWithEnvironment() {
            const version = await this.getAppVersionFromSW();
            const env = this.getEnvironmentInfo();

            return {
                version,
                environment: env,
                fullVersion: `${version} (${env.name})`
            };
        }
    };

    /**
     * Local storage utilities
     */
    static storage = {
        // Get item with JSON parsing
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(`ratchou_${key}`);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage get error:', e);
                return defaultValue;
            }
        },

        // Set item with JSON stringification
        set(key, value) {
            try {
                localStorage.setItem(`ratchou_${key}`, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },

        // Remove item
        remove(key) {
            localStorage.removeItem(`ratchou_${key}`);
        },

        // Clear all Ratchou data
        clear() {
            Object.keys(localStorage)
                .filter(key => key.startsWith('ratchou_') && key !== 'ratchou_device_id')
                .forEach(key => localStorage.removeItem(key));
        }
    };
}

// Global debug flag (can be set in console for debugging)
window.RATCHOU_DEBUG = false;

// Export for use in other modules
window.RatchouUtils = RatchouUtils;