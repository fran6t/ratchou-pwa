/**
 * Utility functions for Ratchou IndexedDB migration
 * Handles data transformations, UUID generation, and formatting
 */

class RatchouUtils {
    /**
     * Currency conversion utilities
     */
    static currency = {
        // Convert euros (float) to cents (integer) for IndexedDB storage
        toCents(euroAmount) {
            if (euroAmount === null || euroAmount === undefined) return 0;
            return Math.round(parseFloat(euroAmount) * 100);
        },

        // Convert cents (integer) back to euros (float)
        toEuros(cents) {
            if (cents === null || cents === undefined) return 0;
            return cents / 100;
        },

        // Format cents as currency string for display
        format(cents, locale = 'fr-FR') {
            const euros = this.toEuros(cents);
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(euros);
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
        // Convert SQLite datetime to ISO string
        toISO(sqliteDateTime) {
            if (!sqliteDateTime) return new Date().toISOString();
            
            // Handle SQLite format: "2025-08-31 09:12:40"
            if (typeof sqliteDateTime === 'string' && !sqliteDateTime.includes('T')) {
                return new Date(sqliteDateTime + 'Z').toISOString();
            }
            
            return new Date(sqliteDateTime).toISOString();
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
     * Boolean conversion for SQLite INTEGER (0/1) to JavaScript boolean
     */
    static boolean = {
        // Convert SQLite integer to boolean
        fromSQLite(sqliteInt) {
            return sqliteInt === 1 || sqliteInt === true;
        },

        // Convert boolean to SQLite integer
        toSQLite(bool) {
            return bool ? 1 : 0;
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
     * Data transformation from SQLite to IndexedDB format
     */
    static transform = {
        // Transform user data
        user(sqliteUser) {
            return {
                code_acces: sqliteUser.CODE_ACCES
            };
        },

        // Transform account data (supports both SQLite and IndexedDB formats)
        account(account) {
            return {
                id: account.ID || account.id,
                nom_compte: account.NOM_COMPTE || account.nom_compte,
                balance: account.SOLDE !== undefined ? RatchouUtils.currency.toCents(account.SOLDE) : account.balance,
                // Ensure is_principal is stored as a number (1 or 0) for reliable indexing
                is_principal: account.COMPTE_PRINCIPAL !== undefined ? (account.COMPTE_PRINCIPAL ? 1 : 0) : (account.is_principal ? 1 : 0)
            };
        },

        // Transform category data (supports both SQLite and IndexedDB formats)
        category(category) {
            return {
                id: category.ID || category.id,
                libelle: category.LIBELLE || category.libelle,
                is_mandatory: category.DEPENSE_OBLIGATOIRE !== undefined ? (category.DEPENSE_OBLIGATOIRE ? 1 : 0) : (category.is_mandatory ? 1 : 0)
            };
        },

        // Transform payee data (supports both SQLite and IndexedDB formats)
        payee(payee) {
            return {
                id: payee.ID || payee.id,
                libelle: payee.LIBELLE || payee.libelle
            };
        },

        // Transform expense type data (supports both SQLite and IndexedDB formats)
        expenseType(expenseType) {
            return {
                id: expenseType.ID || expenseType.id,
                libelle: expenseType.LIBELLE || expenseType.libelle,
                is_default: expenseType.TYPE_DEFAUT !== undefined ? (expenseType.TYPE_DEFAUT ? 1 : 0) : (expenseType.is_default ? 1 : 0)
            };
        },

        // Transform transaction data (supports both SQLite and IndexedDB formats)
        transaction(transaction) {
            return {
                id: transaction.ID || transaction.id,
                date_mouvement: transaction.DATE_MOUVEMENT ? RatchouUtils.date.toISO(transaction.DATE_MOUVEMENT) : transaction.date_mouvement,
                amount: transaction.MONTANT !== undefined ? RatchouUtils.currency.toCents(transaction.MONTANT) : transaction.amount,
                category_id: transaction.CATEGORIE_ID || transaction.category_id,
                payee_id: transaction.BENEFICIAIRE_ID || transaction.payee_id || null,
                expense_type_id: transaction.TYPE_DEPENSE_ID || transaction.expense_type_id || null,
                description: transaction.RMQ || transaction.description || null,
                account_id: transaction.COMPTE_ID || transaction.account_id
            };
        },

        // Transform recurring expense data (supports both SQLite and IndexedDB formats)
        recurringExpense(recurring) {
            return {
                id: recurring.ID || recurring.id,
                libelle: recurring.LIBELLE || recurring.libelle,
                amount: recurring.MONTANT !== undefined ? RatchouUtils.currency.toCents(recurring.MONTANT) : recurring.amount,
                day_of_month: recurring.JOUR_MOIS || recurring.day_of_month,
                start_month: recurring.MOIS_DEPART || recurring.start_month || null,
                frequency: recurring.FREQUENCE || recurring.frequency || 1,
                category_id: recurring.CATEGORIE_ID || recurring.category_id,
                payee_id: recurring.BENEFICIAIRE_ID || recurring.payee_id || null,
                expense_type_id: recurring.TYPE_DEPENSE_ID || recurring.expense_type_id || null,
                account_id: recurring.COMPTE_ID || recurring.account_id,
                is_active: recurring.ACTIF !== undefined ? (recurring.ACTIF ? 1 : 0) : (recurring.is_active ? 1 : 0),
                last_execution: recurring.DERNIERE_EXECUTION ? 
                    RatchouUtils.date.toISO(recurring.DERNIERE_EXECUTION) : recurring.last_execution || null
            };
        }
    };

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