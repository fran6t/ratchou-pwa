/**
 * IndexedDB Wrapper for Ratchou
 * Provides a clean async/await interface over IndexedDB
 */

// Centralized Database Schema Definition
const DATABASE_SCHEMA = {
    UTILISATEUR: {
        keyPath: 'code_acces',
        indexes: {
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
        },
        fields: {
            code_acces: { type: 'string', required: true },
            device_id: { type: 'string', required: true },
            updated_at: { type: 'number', required: true },
            is_deleted: { type: 'number', required: true },
            rev: { type: 'string', required: false },
        }
    },
    COMPTES: {
        keyPath: 'id',
        indexes: {
            name: { keyPath: 'nom_compte', options: { unique: true } },
            principal: { keyPath: 'is_principal', options: { unique: false } },
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
        },
        fields: {
            id: { type: 'string', required: true },
            nom_compte: { type: 'string', required: true },
            solde_initial: { type: 'number', required: true },
            is_principal: { type: 'number', required: true }, // 0 or 1
            currency: { type: 'string', required: false, default: 'EUR' }, // EUR, USD, BTC
            remarque_encrypted: { type: 'string', required: false, default: null }, // Encrypted or plain text remark
        }
    },
    CATEGORIES: {
        keyPath: 'id',
        indexes: {
            name: { keyPath: 'libelle', options: { unique: true } },
            mandatory: { keyPath: 'is_mandatory', options: { unique: false } },
            usage_count: { keyPath: 'usage_count', options: { unique: false } },
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
        },
        fields: {
            id: { type: 'string', required: true },
            libelle: { type: 'string', required: true },
            is_mandatory: { type: 'number', required: true },
            usage_count: { type: 'number', required: true },
        }
    },
    BENEFICIAIRES: {
        keyPath: 'id',
        indexes: {
            name: { keyPath: 'libelle', options: { unique: true } },
            usage_count: { keyPath: 'usage_count', options: { unique: false } },
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
        },
        fields: {
            id: { type: 'string', required: true },
            libelle: { type: 'string', required: true },
            usage_count: { type: 'number', required: true },
        }
    },
    TYPE_DEPENSES: {
        keyPath: 'id',
        indexes: {
            name: { keyPath: 'libelle', options: { unique: true } },
            default: { keyPath: 'is_default', options: { unique: false } },
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
        },
        fields: {
            id: { type: 'string', required: true },
            libelle: { type: 'string', required: true },
            is_default: { type: 'number', required: true },
        }
    },
    MOUVEMENTS: {
        keyPath: 'id',
        indexes: {
            date: { keyPath: 'date_mouvement', options: { unique: false } },
            account_id: { keyPath: 'account_id', options: { unique: false } },
            category_id: { keyPath: 'category_id', options: { unique: false } },
            payee_id: { keyPath: 'payee_id', options: { unique: false } },
            expense_type_id: { keyPath: 'expense_type_id', options: { unique: false } },
            amount: { keyPath: 'amount', options: { unique: false } },
            date_account: { keyPath: ['date_mouvement', 'account_id'], options: { unique: false } },
            reconcile_key: { keyPath: ['account_id', 'date_mouvement', 'amount'], options: { unique: false } },
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
            recurring_expense_id: { keyPath: 'recurring_expense_id', options: { unique: false } },
        },
        fields: {
            id: { type: 'string', required: true },
            date_mouvement: { type: 'string', required: true },
            description: { type: 'string', required: false },
            amount: { type: 'number', required: true },
            account_id: { type: 'string', required: true },
            category_id: { type: 'string', required: true },
            payee_id: { type: 'string', required: true },
            expense_type_id: { type: 'string', required: true },
            recurring_expense_id: { type: 'string', required: false },
        }
    },
    DEPENSES_FIXES: {
        keyPath: 'id',
        indexes: {
            account_id: { keyPath: 'account_id', options: { unique: false } },
            category_id: { keyPath: 'category_id', options: { unique: false } },
            payee_id: { keyPath: 'payee_id', options: { unique: false } },
            expense_type_id: { keyPath: 'expense_type_id', options: { unique: false } },
            active: { keyPath: 'is_active', options: { unique: false } },
            day_month: { keyPath: 'day_of_month', options: { unique: false } },
            device_id: { keyPath: 'device_id', options: { unique: false } },
            updated_at: { keyPath: 'updated_at', options: { unique: false } },
            is_deleted: { keyPath: 'is_deleted', options: { unique: false } },
            sync_rev: { keyPath: 'rev', options: { unique: false } },
        },
        fields: {
            id: { type: 'string', required: true },
            libelle: { type: 'string', required: true },
            day_of_month: { type: 'number', required: true },
            amount: { type: 'number', required: true },
            description: { type: 'string', required: false },
            account_id: { type: 'string', required: true },
            category_id: { type: 'string', required: true },
            payee_id: { type: 'string', required: true },
            expense_type_id: { type: 'string', required: true },
            is_active: { type: 'number', required: true },
            frequency: { type: 'number', required: true },
            start_date: { type: 'string', required: true },
            last_execution: { type: 'string', required: false },
        }
    },
};


class IndexedDBWrapper {
    constructor(dbName = 'ratchou', version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    /**
     * Public method to get the database schema
     */
    getSchema() {
        return DATABASE_SCHEMA;
    }

    /**
     * Initialize the database connection
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(new Error('Failed to open database: ' + request.error));
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully:', this.dbName);
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                console.log('Database upgrade needed from version', event.oldVersion, 'to', this.version);
                this.setupStores(event.target.result, event.oldVersion, event.target.transaction);
            };
        });
    }

    /**
     * Force database recreation by deleting and recreating it
     */
    async recreateDatabase() {
        if (this.db) {
            this.db.close();
        }
        
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.dbName);
            
            deleteRequest.onsuccess = () => {
                console.log('Database deleted successfully');
                this.init().then(resolve).catch(reject);
            };
            
            deleteRequest.onerror = () => {
                console.error('Failed to delete database:', deleteRequest.error);
                reject(new Error('Failed to delete database: ' + deleteRequest.error));
            };
            
            deleteRequest.onblocked = () => {
                console.warn('Database deletion blocked. Please close all tabs with this application.');
                reject(new Error('Database deletion blocked. Please close all tabs with this application.'));
            };
        });
    }

    /**
     * Setup object stores and indexes during database upgrade
     */
    setupStores(db, oldVersion, transaction) {
        console.log(`🔄 Upgrading database from version ${oldVersion} to ${this.version}`);

        // Create initial stores idempotently
        this.createInitialStores(db, transaction);

        // Version-specific migrations
        if (oldVersion < 2) {
            console.log('📦 Migrating to version 2: Recurring expenses enhancements');
            this.migrateToVersion2(transaction);
        }
    }

    /**
     * Migration vers version 2
     * Ajoute start_date, frequency, libelle, last_execution aux dépenses récurrentes
     * Ajoute recurring_expense_id aux mouvements
     */
    migrateToVersion2(transaction) {
        try {
            console.log('🔄 Starting migration to version 2...');

            // 1. Migrer DEPENSES_FIXES
            this.migrateRecurringExpenses(transaction);

            // 2. Migrer MOUVEMENTS
            this.migrateMovements(transaction);

            console.log('✅ Migration to version 2 completed');
        } catch (error) {
            console.error('❌ Critical error in migrateToVersion2:', error);
            throw error;
        }
    }

    /**
     * Migre les dépenses récurrentes existantes
     */
    migrateRecurringExpenses(transaction) {
        const store = transaction.objectStore('DEPENSES_FIXES');
        const request = store.openCursor();
        let count = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                console.log(`✅ Migrated ${count} recurring expenses`);
                return;
            }

            const expense = cursor.value;
            let updated = false;

            // Ajouter start_date si manquant
            if (!expense.start_date) {
                if (expense.last_execution) {
                    // Utiliser last_execution comme référence
                    expense.start_date = expense.last_execution.split('T')[0];
                } else {
                    // Défaut : début du mois actuel
                    const now = new Date();
                    now.setDate(expense.day_of_month);
                    expense.start_date = now.toISOString().split('T')[0];
                }
                updated = true;
            }

            // Ajouter frequency si manquant (défaut: 1 = mensuel)
            if (expense.frequency === undefined || expense.frequency === null) {
                expense.frequency = 1;
                updated = true;
            }

            // Ajouter last_execution si manquant
            if (expense.last_execution === undefined) {
                expense.last_execution = null;
                updated = true;
            }

            // Ajouter libelle si manquant (cas rare)
            if (!expense.libelle && expense.description) {
                expense.libelle = expense.description;
                updated = true;
            }

            // Supprimer start_month obsolète
            if (expense.start_month !== undefined) {
                delete expense.start_month;
                updated = true;
            }

            if (updated) {
                cursor.update(expense);
                count++;
                console.log(`✅ Migrated: ${expense.libelle || expense.id}`);
            }

            cursor.continue();
        };

        request.onerror = () => {
            console.error('❌ Error migrating DEPENSES_FIXES:', request.error);
        };
    }

    /**
     * Migre les mouvements existants
     * Ajoute recurring_expense_id = null (tous considérés comme manuels)
     */
    migrateMovements(transaction) {
        const store = transaction.objectStore('MOUVEMENTS');
        const request = store.openCursor();
        let count = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                console.log(`✅ Migrated ${count} movements`);
                return;
            }

            const movement = cursor.value;

            // Ajouter recurring_expense_id (null pour tous les existants = manuels)
            if (movement.recurring_expense_id === undefined) {
                movement.recurring_expense_id = null;
                cursor.update(movement);
                count++;
            }

            cursor.continue();
        };

        request.onerror = () => {
            console.error('❌ Error migrating MOUVEMENTS:', request.error);
        };
    }

    /**
     * Create all initial object stores with their indexes based on the schema
     */
    createInitialStores(db, transaction) {
        for (const storeName in DATABASE_SCHEMA) {
            const schema = DATABASE_SCHEMA[storeName];

            // Helper function to create a store if it doesn't exist
            const ensureStore = (name, options) => {
                return db.objectStoreNames.contains(name)
                    ? transaction.objectStore(name)
                    : db.createObjectStore(name, options);
            };

            // Create the store
            const store = ensureStore(storeName, { keyPath: schema.keyPath });

            // Create indexes
            for (const indexName in schema.indexes) {
                const index = schema.indexes[indexName];
                if (!store.indexNames.contains(indexName)) {
                    store.createIndex(indexName, index.keyPath, index.options);
                }
            }
        }
        console.log('All object stores and indexes are set up based on the schema.');
    }

    /**
     * Transaction helper - creates a transaction for the given stores
     */
    tx(storeNames, mode = 'readonly') {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }
        
        if (typeof storeNames === 'string') {
            storeNames = [storeNames];
        }
        
        return this.db.transaction(storeNames, mode);
    }

    /**
     * Generic get operation
     */
    async get(storeName, key) {
        const tx = this.tx([storeName]);
        const store = tx.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to get ${key} from ${storeName}: ${request.error}`));
        });
    }

    /**
     * Generic put operation (insert or update)
     */
    async put(storeName, data) {
        const tx = this.tx([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to put data in ${storeName}: ${request.error}`));
        });
    }

    /**
     * Generic delete operation
     */
    async delete(storeName, key) {
        const tx = this.tx([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to delete ${key} from ${storeName}: ${request.error}`));
        });
    }

    /**
     * Get all records from a store
     */
    async getAll(storeName, indexName = null, query = null) {
        const tx = this.tx([storeName]);
        const store = tx.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        
        return new Promise((resolve, reject) => {
            const request = query ? source.getAll(query) : source.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to get all from ${storeName}: ${request.error}`));
        });
    }

    /**
     * Count records in a store
     */
    async count(storeName, indexName = null, query = null) {
        const tx = this.tx([storeName]);
        const store = tx.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        
        return new Promise((resolve, reject) => {
            const request = query ? source.count(query) : source.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to count in ${storeName}: ${request.error}`));
        });
    }

    /**
     * Cursor iteration helper
     */
    async cursorToArray(cursorRequest, limit = null) {
        return new Promise((resolve, reject) => {
            const results = [];
            let count = 0;
            
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && (!limit || count < limit)) {
                    results.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            cursorRequest.onerror = () => reject(new Error('Cursor operation failed: ' + cursorRequest.error));
        });
    }

    /**
     * Range query with optional limit
     */
    async getRange(storeName, indexName, range, limit = null) {
        const tx = this.tx([storeName]);
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        
        const cursorRequest = index.openCursor(range);
        return this.cursorToArray(cursorRequest, limit);
    }

    /**
     * Search with prefix (for autocomplete)
     */
    async searchByPrefix(storeName, indexName, prefix, limit = 10) {
        const range = IDBKeyRange.bound(
            prefix,
            prefix + '\uffff',
            false,
            true
        );
        
        return this.getRange(storeName, indexName, range, limit);
    }

    /**
     * Bulk insert operation within a single transaction
     */
    async bulkPut(storeName, dataArray) {
        const tx = this.tx([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        const promises = dataArray.map(data => {
            return new Promise((resolve, reject) => {
                const request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error(`Failed to bulk put in ${storeName}: ${request.error}`));
            });
        });
        
        return Promise.all(promises);
    }

    /**
     * Clear all data from a store
     */
    async clear(storeName) {
        const tx = this.tx([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to clear ${storeName}: ${request.error}`));
        });
    }

    /**
     * Put operation with automatic synchronization metadata
     */
    async putWithMeta(storeName, data) {
        try {
            // Ensure device ID is initialized
            const deviceId = RatchouUtils.device.getCurrentDeviceId();
            
            // Add synchronization metadata
            const dataWithMeta = RatchouUtils.sync.addMeta(data, deviceId);
            
            // Use regular put operation
            return await this.put(storeName, dataWithMeta);
        } catch (error) {
            console.error('putWithMeta error:', error);
            throw new Error(`Failed to put data with metadata in ${storeName}: ${error.message}`);
        }
    }

    /**
     * Soft delete operation (mark as deleted without physical removal)
     */
    async softDelete(storeName, key) {
        try {
            // Get the existing record
            const existingData = await this.get(storeName, key);
            if (!existingData) {
                throw new Error(`Record with key ${key} not found in ${storeName}`);
            }

            // Ensure device ID is initialized
            const deviceId = RatchouUtils.device.getCurrentDeviceId();
            
            // Mark as deleted with metadata
            const deletedData = RatchouUtils.sync.markDeleted(existingData, deviceId);
            
            // Update the record (don't physically delete)
            return await this.put(storeName, deletedData);
        } catch (error) {
            console.error('softDelete error:', error);
            throw new Error(`Failed to soft delete ${key} from ${storeName}: ${error.message}`);
        }
    }

    /**
     * Get all non-deleted records from a store
     */
    async getAllActive(storeName, indexName = null, query = null) {
        const allRecords = await this.getAll(storeName, indexName, query);
        
        // Filter out deleted records
        return allRecords.filter(record => !record.is_deleted);
    }

    /**
     * Bulk insert operation with automatic synchronization metadata
     */
    async bulkPutWithMeta(storeName, dataArray) {
        try {
            // Ensure device ID is initialized
            const deviceId = RatchouUtils.device.getCurrentDeviceId();
            
            // Add synchronization metadata to all records
            const dataWithMeta = dataArray.map(data => RatchouUtils.sync.addMeta(data, deviceId));
            
            // --- DEBUG LOG ---
            if (dataWithMeta.length > 0) {
                console.log(`DEBUG: Tentative d'écriture dans ${storeName}. Premier enregistrement :`, JSON.parse(JSON.stringify(dataWithMeta[0])));
            }
            // --- END DEBUG LOG ---

            // Use regular bulk put operation
            return await this.bulkPut(storeName, dataWithMeta);
        } catch (error) {
            console.error('bulkPutWithMeta error:', error);
            throw new Error(`Failed to bulk put data with metadata in ${storeName}: ${error.message}`);
        }
    }

    /**
     * Initialize device ID if not already done
     */
    async ensureDeviceId() {
        return RatchouUtils.device.getCurrentDeviceId();
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('Database connection closed');
        }
    }
}

// Export for use in other modules
window.IndexedDBWrapper = IndexedDBWrapper;