/**
 * IndexedDB Wrapper for Ratchou
 * Provides a clean async/await interface over IndexedDB
 */

class IndexedDBWrapper {
    constructor(dbName = 'ratchou', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
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
        // The setup is now idempotent, so we can run it on every upgrade.
        // We could add version-specific logic here if needed in the future.
        this.createInitialStores(db, transaction);
    }

    /**
     * Create all initial object stores with their indexes
     */
    createInitialStores(db, transaction) {
        // Helper function to create a store if it doesn't exist
        const ensureStore = (storeName, options) => {
            return db.objectStoreNames.contains(storeName)
                ? transaction.objectStore(storeName)
                : db.createObjectStore(storeName, options);
        };

        // Helper function to create an index if it doesn't exist
        const ensureIndex = (store, indexName, keyPath, options) => {
            if (!store.indexNames.contains(indexName)) {
                store.createIndex(indexName, keyPath, options);
            }
        };

        // 1. User store
        const userStore = ensureStore('UTILISATEUR', { keyPath: 'code_acces' });
        ensureIndex(userStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(userStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(userStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(userStore, 'sync_rev', 'rev', { unique: false });

        // 2. Comptes store
        const comptesStore = ensureStore('COMPTES', { keyPath: 'id' });
        ensureIndex(comptesStore, 'name', 'nom_compte', { unique: true });
        ensureIndex(comptesStore, 'principal', 'is_principal', { unique: false });
        ensureIndex(comptesStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(comptesStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(comptesStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(comptesStore, 'sync_rev', 'rev', { unique: false });

        // 3. Categories store
        const categoriesStore = ensureStore('CATEGORIES', { keyPath: 'id' });
        ensureIndex(categoriesStore, 'name', 'libelle', { unique: true });
        ensureIndex(categoriesStore, 'mandatory', 'is_mandatory', { unique: false });
        ensureIndex(categoriesStore, 'usage_count', 'usage_count', { unique: false });
        ensureIndex(categoriesStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(categoriesStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(categoriesStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(categoriesStore, 'sync_rev', 'rev', { unique: false });

        // 4. Beneficiaires store
        const beneficiairesStore = ensureStore('BENEFICIAIRES', { keyPath: 'id' });
        ensureIndex(beneficiairesStore, 'name', 'libelle', { unique: true });
        ensureIndex(beneficiairesStore, 'usage_count', 'usage_count', { unique: false });
        ensureIndex(beneficiairesStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(beneficiairesStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(beneficiairesStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(beneficiairesStore, 'sync_rev', 'rev', { unique: false });

        // 5. Type depenses store
        const typeDepensesStore = ensureStore('TYPE_DEPENSES', { keyPath: 'id' });
        ensureIndex(typeDepensesStore, 'name', 'libelle', { unique: true });
        ensureIndex(typeDepensesStore, 'default', 'is_default', { unique: false });
        ensureIndex(typeDepensesStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(typeDepensesStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(typeDepensesStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(typeDepensesStore, 'sync_rev', 'rev', { unique: false });

        // 6. Mouvements store
        const mouvementsStore = ensureStore('MOUVEMENTS', { keyPath: 'id' });
        ensureIndex(mouvementsStore, 'date', 'date_mouvement', { unique: false });
        ensureIndex(mouvementsStore, 'account_id', 'account_id', { unique: false });
        ensureIndex(mouvementsStore, 'category_id', 'category_id', { unique: false });
        ensureIndex(mouvementsStore, 'payee_id', 'payee_id', { unique: false });
        ensureIndex(mouvementsStore, 'expense_type_id', 'expense_type_id', { unique: false });
        ensureIndex(mouvementsStore, 'amount', 'amount', { unique: false });
        ensureIndex(mouvementsStore, 'date_account', ['date_mouvement', 'account_id'], { unique: false });
        ensureIndex(mouvementsStore, 'reconcile_key', ['account_id', 'date_mouvement', 'amount'], { unique: false });
        ensureIndex(mouvementsStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(mouvementsStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(mouvementsStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(mouvementsStore, 'sync_rev', 'rev', { unique: false });

        // 7. Depenses fixes store
        const depensesFixesStore = ensureStore('DEPENSES_FIXES', { keyPath: 'id' });
        ensureIndex(depensesFixesStore, 'account_id', 'account_id', { unique: false });
        ensureIndex(depensesFixesStore, 'category_id', 'category_id', { unique: false });
        ensureIndex(depensesFixesStore, 'payee_id', 'payee_id', { unique: false });
        ensureIndex(depensesFixesStore, 'expense_type_id', 'expense_type_id', { unique: false });
        ensureIndex(depensesFixesStore, 'active', 'is_active', { unique: false });
        ensureIndex(depensesFixesStore, 'day_month', 'day_of_month', { unique: false });
        ensureIndex(depensesFixesStore, 'device_id', 'device_id', { unique: false });
        ensureIndex(depensesFixesStore, 'updated_at', 'updated_at', { unique: false });
        ensureIndex(depensesFixesStore, 'is_deleted', 'is_deleted', { unique: false });
        ensureIndex(depensesFixesStore, 'sync_rev', 'rev', { unique: false });

        console.log('All object stores and indexes are set up.');
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