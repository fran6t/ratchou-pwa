/**
 * Base Model for all entities in Ratchou IndexedDB
 * Provides common CRUD operations and validation
 */

class BaseModel {
    constructor(db, storeName) {
        this.db = db;
        this.storeName = storeName;
    }

    /**
     * Get entity by ID
     */
    async getById(id) {
        try {
            RatchouUtils.debug.log(`Getting ${this.storeName} by ID: ${id}`);
            const result = await this.db.get(this.storeName, id);
            return result || null;
        } catch (error) {
            console.error(`Error getting ${this.storeName} by ID:`, error);
            throw error;
        }
    }

    /**
     * Get all entities, optionally filtered (only active records)
     */
    async getAll(indexName = null, query = null) {
        try {
            RatchouUtils.debug.log(`Getting all active ${this.storeName}`, { indexName, query });
            return await this.db.getAllActive(this.storeName, indexName, query);
        } catch (error) {
            console.error(`Error getting all ${this.storeName}:`, error);
            throw error;
        }
    }

    /**
     * Create new entity
     */
    async create(data) {
        try {
            this.validateCreate(data);
            if (!data.id) data.id = RatchouUtils.generateUUID();
            const transformedData = this.transformForStorage({ ...data });

            await this.db.putWithMeta(this.storeName, transformedData);

            // Queue pour sync si activée
            await this.queueSyncOperation('CREATE', transformedData.id, transformedData);

            return RatchouUtils.error.success('Enregistrement créé avec succès', transformedData);
        } catch (error) {
            console.error(`Error creating ${this.storeName}:`, error);
            return RatchouUtils.error.handleIndexedDBError(error, 'création');
        }
    }

    /**
     * Update existing entity
     */
    async update(id, data) {
        try {
            const existing = await this.getById(id);
            if (!existing) {
                throw new Error(`${this.storeName} with ID ${id} not found`);
            }

            this.validateUpdate(data);
            const updatedData = { ...existing, ...data, id };
            const transformedData = this.transformForStorage(updatedData);

            await this.db.putWithMeta(this.storeName, transformedData);

            // Re-fetch before queueing to ensure we send the definitive merged state
            const finalData = await this.getById(id);
            await this.queueSyncOperation('UPDATE', id, finalData);

            return RatchouUtils.error.success('Enregistrement mis à jour avec succès', finalData);
        } catch (error) {
            console.error(`Error updating ${this.storeName}:`, error);
            return RatchouUtils.error.handleIndexedDBError(error, 'mise à jour');
        }
    }

    /**
     * Delete entity (soft delete)
     */
    async delete(id) {
        try {
            // Check if entity exists
            const existing = await this.getById(id);
            if (!existing) {
                throw new Error(`${this.storeName} with ID ${id} not found`);
            }

            // Check for references before deletion
            const canDelete = await this.canDelete(id);
            if (!canDelete.success) {
                return canDelete;
            }

            RatchouUtils.debug.log(`Soft deleting ${this.storeName} with ID: ${id}`);
            await this.db.softDelete(this.storeName, id);

            // Queue pour sync si activée
            const deletedRecord = await this.getById(id);
            await this.queueSyncOperation('DELETE', id, deletedRecord);

            return RatchouUtils.error.success('Enregistrement supprimé avec succès');
        } catch (error) {
            console.error(`Error deleting ${this.storeName}:`, error);
            return RatchouUtils.error.handleIndexedDBError(error, 'suppression');
        }
    }

    /**
     * Count entities
     */
    async count(indexName = null, query = null) {
        try {
            return await this.db.count(this.storeName, indexName, query);
        } catch (error) {
            console.error(`Error counting ${this.storeName}:`, error);
            throw error;
        }
    }

    /**
     * Search entities by prefix (for autocomplete)
     */
    async searchByPrefix(indexName, prefix, limit = 10) {
        try {
            RatchouUtils.debug.log(`Searching ${this.storeName} by prefix:`, { indexName, prefix, limit });
            return await this.db.searchByPrefix(this.storeName, indexName, prefix, limit);
        } catch (error) {
            console.error(`Error searching ${this.storeName}:`, error);
            throw error;
        }
    }

    /**
     * Get entities within a range
     */
    async getRange(indexName, range, limit = null) {
        try {
            return await this.db.getRange(this.storeName, indexName, range, limit);
        } catch (error) {
            console.error(`Error getting range from ${this.storeName}:`, error);
            throw error;
        }
    }

    // =================================================================
    // Methods to be overridden by specific models
    // =================================================================

    /**
     * Validate data for creation (override in specific models)
     */
    validateCreate(data) {
        // Basic validation - specific models should override
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data provided');
        }
    }

    /**
     * Validate data for update (override in specific models)
     */
    validateUpdate(data) {
        // Basic validation - specific models should override
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data provided');
        }
    }

    /**
     * Transform data for storage (override in specific models if needed)
     *
     * Generic boolean to number conversion for IndexedDB indexes
     * Can be overridden by specific models for additional transformations
     */
    transformForStorage(data) {
        // Clone data to avoid mutations
        const transformed = { ...data };

        // List of known boolean fields that should be numeric for IndexedDB
        const booleanFields = ['is_active', 'is_principal', 'is_mandatory', 'is_default', 'is_deleted'];

        // Convert boolean values to numbers (true → 1, false → 0)
        for (const field of booleanFields) {
            if (field in transformed && typeof transformed[field] === 'boolean') {
                transformed[field] = transformed[field] ? 1 : 0;
            }
        }

        return transformed;
    }

    /**
     * Check if entity can be deleted (override in specific models)
     */
    async canDelete(id) {
        // By default, allow deletion
        return RatchouUtils.error.success('Deletion allowed');
    }

    /**
     * Enqueue une opération pour synchronisation (si sync activée)
     * @param {string} operation - CREATE, UPDATE, DELETE
     * @param {string} recordId - ID du record
     * @param {object} data - Données complètes du record
     */
    async queueSyncOperation(operation, recordId, data) {
        try {
            // Vérifier si sync est configurée
            const syncConfig = await this.db.get('SYNC_CONFIG', 'config');
            if (!syncConfig) {
                // Sync non configurée - skip queueing
                RatchouUtils.debug.log(`Sync non configurée - skip queue pour ${operation} ${recordId}`);
                return;
            }

            // Ne pas queue les stores SYNC_* (éviter boucle infinie)
            if (this.storeName.startsWith('SYNC_')) {
                return;
            }

            const queueEntry = {
                id: `sync_${Date.now()}_${RatchouUtils.generateUUID().slice(0, 8)}`,
                store_name: this.storeName,
                record_id: recordId,
                operation: operation,
                data: data,
                schema_version: 1,
                timestamp: Date.now(),
                synced: 0
            };

            await this.db.put('SYNC_QUEUE', queueEntry);
            RatchouUtils.debug.log(`✅ Queued ${operation} for ${this.storeName}:${recordId}`);
        } catch (error) {
            // Échec du queueing = non-critique - l'opération réussit quand même
            console.warn(`Échec queueing sync (non-critique):`, error);
        }
    }

    /**
     * Bulk import data (for migration)
     */
    async bulkImport(dataArray, transformFn = null) {
        try {
            RatchouUtils.debug.time(`Bulk import ${this.storeName}`);
            
            const transformedData = transformFn ? 
                dataArray.map(transformFn) : 
                dataArray;

            await this.db.bulkPutWithMeta(this.storeName, transformedData);
            
            RatchouUtils.debug.timeEnd(`Bulk import ${this.storeName}`);
            return RatchouUtils.error.success(`Imported ${transformedData.length} ${this.storeName} successfully`);
        } catch (error) {
            console.error(`Error bulk importing ${this.storeName}:`, error);
            return RatchouUtils.error.handleIndexedDBError(error, 'import en lot');
        }
    }

    /**
     * Clear all data from store
     */
    async clear() {
        try {
            RatchouUtils.debug.log(`Clearing all ${this.storeName}`);
            await this.db.clear(this.storeName);
            return RatchouUtils.error.success(`${this.storeName} cleared successfully`);
        } catch (error) {
            console.error(`Error clearing ${this.storeName}:`, error);
            return RatchouUtils.error.handleIndexedDBError(error, 'vidage');
        }
    }
}

// Export for use in other modules
window.BaseModel = BaseModel;