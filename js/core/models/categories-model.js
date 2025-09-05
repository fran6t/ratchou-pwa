/**
 * Categories Model for Ratchou IndexedDB
 * Manages expense categories with mandatory/optional classification
 */

class CategoriesModel extends BaseModel {
    constructor(db) {
        super(db, 'CATEGORIES');
    }

    /**
     * Get categories sorted by name
     */
    async getAllSorted() {
        try {
            const categories = await this.getAll();
            return categories.sort((a, b) => a.libelle.localeCompare(b.libelle));
        } catch (error) {
            console.error('Error getting sorted categories:', error);
            throw error;
        }
    }

    /**
     * Get mandatory categories only
     */
    async getMandatory() {
        try {
            return await this.getAll('mandatory', IDBKeyRange.only(true));
        } catch (error) {
            console.error('Error getting mandatory categories:', error);
            throw error;
        }
    }

    /**
     * Get optional categories only
     */
    async getOptional() {
        try {
            return await this.getAll('mandatory', IDBKeyRange.only(false));
        } catch (error) {
            console.error('Error getting optional categories:', error);
            throw error;
        }
    }

    /**
     * Search categories by name (for autocomplete)
     */
    async searchByName(prefix, limit = 10) {
        return await this.searchByPrefix('name', prefix, limit);
    }

    /**
     * Check if a category name already exists
     */
    async nameExists(libelle, excludeId = null) {
        try {
            const categories = await this.getAll('name', IDBKeyRange.only(libelle));
            return categories.some(cat => cat.id !== excludeId);
        } catch (error) {
            console.error('Error checking category name existence:', error);
            throw error;
        }
    }

    // =================================================================
    // Validation and transformation
    // =================================================================

    validateCreate(data) {
        super.validateCreate(data);
        
        RatchouUtils.validate.required(data.libelle, 'libelle');
        
        if (typeof data.libelle !== 'string' || data.libelle.trim() === '') {
            throw new Error('Le libellé de la catégorie est requis');
        }

        // Ensure libelle is trimmed
        data.libelle = data.libelle.trim();

        // is_mandatory defaults to false
        if (data.is_mandatory === undefined) {
            data.is_mandatory = false;
        }

        if (typeof data.is_mandatory !== 'boolean') {
            data.is_mandatory = RatchouUtils.boolean.fromSQLite(data.is_mandatory);
        }

        // usage_count defaults to 0
        if (data.usage_count === undefined) {
            data.usage_count = 0;
        }
    }

    validateUpdate(data) {
        super.validateUpdate(data);
        
        if (data.libelle !== undefined) {
            if (typeof data.libelle !== 'string' || data.libelle.trim() === '') {
                throw new Error('Le libellé de la catégorie ne peut pas être vide');
            }
            data.libelle = data.libelle.trim();
        }

        if (data.is_mandatory !== undefined && typeof data.is_mandatory !== 'boolean') {
            data.is_mandatory = RatchouUtils.boolean.fromSQLite(data.is_mandatory);
        }
    }


    async create(data) {
        try {
            // Check if name already exists
            const exists = await this.nameExists(data.libelle);
            if (exists) {
                return RatchouUtils.error.validation('Une catégorie avec ce nom existe déjà');
            }

            return await super.create(data);
        } catch (error) {
            console.error('Error creating category:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'création');
        }
    }

    async update(id, data) {
        try {
            // Check if name already exists (excluding current record)
            if (data.libelle) {
                const exists = await this.nameExists(data.libelle, id);
                if (exists) {
                    return RatchouUtils.error.validation('Une catégorie avec ce nom existe déjà');
                }
            }

            return await super.update(id, data);
        } catch (error) {
            console.error('Error updating category:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'mise à jour');
        }
    }

    /**
     * Get categories sorted by usage count (descending)
     */
    async getAllSortedByUsage() {
        try {
            const categories = await this.getAll();
            return categories.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
        } catch (error) {
            console.error('Error getting categories sorted by usage:', error);
            throw error;
        }
    }

    /**
     * Increment usage count for a category
     */
    async incrementUsage(categoryId) {
        try {
            const category = await this.getById(categoryId);
            if (category) {
                const currentUsage = category.usage_count || 0;
                await super.update(categoryId, { usage_count: currentUsage + 1 });
            }
        } catch (error) {
            console.error('Error incrementing category usage:', error);
        }
    }

    /**
     * Get categories with usage statistics
     */
    async getWithStats() {
        try {
            const categories = await this.getAllSorted();
            const categoriesWithStats = [];

            for (const category of categories) {
                const transactionCount = await this.db.count('MOUVEMENTS', 'category_id', IDBKeyRange.only(category.id));
                const recurringCount = await this.db.count('DEPENSES_FIXES', 'category_id', IDBKeyRange.only(category.id));
                
                categoriesWithStats.push({
                    ...category,
                    transaction_count: transactionCount,
                    recurring_count: recurringCount,
                    total_usage: transactionCount + recurringCount
                });
            }

            return categoriesWithStats;
        } catch (error) {
            console.error('Error getting categories with stats:', error);
            throw error;
        }
    }

    /**
     * Delete a category with automatic dissociation of all related transactions
     * Sets category_id to null in all associated transactions before soft deleting the category
     * This overrides the base delete method to always perform dissociation
     */
    async delete(categoryId) {
        try {
            console.log(`Starting category dissociation for category: ${categoryId}`);
            
            // 1. Get all transactions associated with this category
            const transactions = await ratchouApp.models.transactions.getByCategory(categoryId);
            console.log(`Found ${transactions.length} transactions to dissociate`);
            
            // 2. Dissociate all transactions (set category_id to null)
            for (const transaction of transactions) {
                console.log(`Dissociating transaction: ${transaction.id}`);
                const updateResult = await ratchouApp.models.transactions.update(transaction.id, {
                    category_id: null
                });
                if (!updateResult.success) {
                    console.error(`Failed to dissociate transaction ${transaction.id}:`, updateResult.message);
                    return RatchouUtils.error.validation(`Erreur lors de la dissociation de la transaction ${transaction.id}`);
                }
            }
            
            console.log('All transactions dissociated successfully');
            
            // 3. Also check and dissociate recurring expenses if they exist
            try {
                const recurringExpenses = await ratchouApp.models.recurringExpenses.getByCategory(categoryId);
                console.log(`Found ${recurringExpenses.length} recurring expenses to dissociate`);
                
                for (const recurring of recurringExpenses) {
                    console.log(`Dissociating recurring expense: ${recurring.id}`);
                    const updateResult = await ratchouApp.models.recurringExpenses.update(recurring.id, {
                        category_id: null
                    });
                    if (!updateResult.success) {
                        console.error(`Failed to dissociate recurring expense ${recurring.id}:`, updateResult.message);
                        return RatchouUtils.error.validation(`Erreur lors de la dissociation de la dépense récurrente ${recurring.id}`);
                    }
                }
            } catch (recurringError) {
                console.warn('Could not check recurring expenses (possibly no getByCategory method):', recurringError);
            }
            
            // 4. Now safely soft delete the category
            console.log('Proceeding with category soft delete');
            const deleteResult = await super.delete(categoryId);
            
            if (deleteResult.success) {
                console.log('Category deleted successfully with full dissociation');
                return RatchouUtils.error.success('Catégorie supprimée avec succès. Les mouvements associés ont été dissociés.');
            } else {
                return deleteResult;
            }
            
        } catch (error) {
            console.error('Error during category dissociation:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'suppression avec dissociation');
        }
    }

    /**
     * Import from SQLite data
     */
    async importFromSQLite(sqliteCategories) {
        const transformedCategories = sqliteCategories.map(RatchouUtils.transform.category);
        return await this.bulkImport(transformedCategories);
    }

    /**
     * Create default categories (seed data)
     */
    async createDefaults() {
        const defaultCategories = [
            { libelle: 'Alimentation / Courses', is_mandatory: true },
            { libelle: 'Logement (Loyer / Crédit)', is_mandatory: true },
            { libelle: 'Charges / Énergie (Élec/Gaz/Eau)', is_mandatory: true },
            { libelle: 'Internet / Téléphone', is_mandatory: true },
            { libelle: 'Assurances', is_mandatory: true },
            { libelle: 'Impôts / Taxes', is_mandatory: true },
            { libelle: 'Transports (Carburant/TP)', is_mandatory: true },
            { libelle: 'Santé (Médecin/Pharmacie/Mutuelle)', is_mandatory: true },
            { libelle: 'Éducation / Garde', is_mandatory: false },
            { libelle: 'Loisirs / Culture', is_mandatory: false },
            { libelle: 'Vêtements', is_mandatory: false },
            { libelle: 'Cadeaux / Fêtes', is_mandatory: false },
            { libelle: 'Épargne / Placement', is_mandatory: false },
            { libelle: 'Revenus (Salaire/Pension)', is_mandatory: false },
            { libelle: 'Divers', is_mandatory: false }
        ];

        // Add UUIDs and usage_count
        const categoriesToInsert = defaultCategories.map(cat => ({
            ...cat,
            id: RatchouUtils.generateUUID(),
            usage_count: 0
        }));

        return await this.db.bulkPutWithMeta(this.storeName, categoriesToInsert);
    }
}

// Export for use in other modules
window.CategoriesModel = CategoriesModel;