/**
 * Expense Types Model for Ratchou IndexedDB
 * Manages payment methods with default type logic
 */

class ExpenseTypesModel extends BaseModel {
    constructor(db) {
        super(db, 'TYPE_DEPENSES');
    }

    async getAllSorted() {
        const types = await this.getAll();
        return types.sort((a, b) => {
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            return a.libelle.localeCompare(b.libelle);
        });
    }

    async getDefault() {
        const defaults = await this.getAll('default', IDBKeyRange.only(true));
        return defaults.length > 0 ? defaults[0] : null;
    }

    async setDefault(expenseTypeId) {
        try {
            const allTypes = await this.getAll();

            const promises = allTypes.map(async type => {
                type.is_default = (type.id === expenseTypeId);
                return await this.db.putWithMeta(this.storeName, type);
            });

            await Promise.all(promises);
            return RatchouUtils.error.success('Type par défaut défini avec succès');
        } catch (error) {
            return RatchouUtils.error.handleIndexedDBError(error, 'définition du type par défaut');
        }
    }

    validateCreate(data) {
        super.validateCreate(data);
        RatchouUtils.validate.required(data.libelle, 'libelle');
        data.libelle = data.libelle.trim();
        if (data.is_default === undefined) data.is_default = false;
    }

    validateUpdate(data) {
        super.validateUpdate(data);
        if (data.libelle !== undefined) {
            if (!data.libelle || data.libelle.trim() === '') {
                throw new Error('Le libellé ne peut pas être vide');
            }
            data.libelle = data.libelle.trim();
        }
    }


    /**
     * Delete an expense type with automatic dissociation of all related transactions
     * Sets expense_type_id to null in all associated transactions before soft deleting the expense type
     * Cannot delete default expense types - this overrides the base delete method
     */
    async delete(expenseTypeId) {
        try {
            console.log(`Starting expense type dissociation for type: ${expenseTypeId}`);
            
            // 0. Check if this is the default type (cannot delete)
            const expenseType = await this.getById(expenseTypeId);
            if (expenseType && expenseType.is_default) {
                return RatchouUtils.error.validation('Impossible de supprimer le type de paiement par défaut');
            }
            
            // 1. Get all transactions associated with this expense type
            const transactions = await ratchouApp.models.transactions.getByExpenseType(expenseTypeId);
            console.log(`Found ${transactions.length} transactions to dissociate`);
            
            // 2. Dissociate all transactions (set expense_type_id to null)
            for (const transaction of transactions) {
                console.log(`Dissociating transaction: ${transaction.id}`);
                const updateResult = await ratchouApp.models.transactions.update(transaction.id, {
                    expense_type_id: null
                });
                if (!updateResult.success) {
                    console.error(`Failed to dissociate transaction ${transaction.id}:`, updateResult.message);
                    return RatchouUtils.error.validation(`Erreur lors de la dissociation de la transaction ${transaction.id}`);
                }
            }
            
            console.log('All transactions dissociated successfully');
            
            // 3. Also check and dissociate recurring expenses if they exist
            try {
                const recurringExpenses = await ratchouApp.models.recurringExpenses.getByExpenseType(expenseTypeId);
                console.log(`Found ${recurringExpenses.length} recurring expenses to dissociate`);
                
                for (const recurring of recurringExpenses) {
                    console.log(`Dissociating recurring expense: ${recurring.id}`);
                    const updateResult = await ratchouApp.models.recurringExpenses.update(recurring.id, {
                        expense_type_id: null
                    });
                    if (!updateResult.success) {
                        console.error(`Failed to dissociate recurring expense ${recurring.id}:`, updateResult.message);
                        return RatchouUtils.error.validation(`Erreur lors de la dissociation de la dépense récurrente ${recurring.id}`);
                    }
                }
            } catch (recurringError) {
                console.warn('Could not check recurring expenses (possibly no getByExpenseType method):', recurringError);
            }
            
            // 4. Now safely soft delete the expense type
            console.log('Proceeding with expense type soft delete');
            const deleteResult = await super.delete(expenseTypeId);
            
            if (deleteResult.success) {
                console.log('Expense type deleted successfully with full dissociation');
                return RatchouUtils.error.success('Type de paiement supprimé avec succès. Les mouvements associés ont été dissociés.');
            } else {
                return deleteResult;
            }
            
        } catch (error) {
            console.error('Error during expense type dissociation:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'suppression avec dissociation');
        }
    }

    async importFromSQLite(sqliteTypes) {
        const transformed = sqliteTypes.map(RatchouUtils.transform.expenseType);
        return await this.bulkImport(transformed);
    }

    async createDefaults() {
        const defaults = [
            { libelle: 'Espèces', is_default: false },
            { libelle: 'Carte bancaire', is_default: true },
            { libelle: 'Virement', is_default: false },
            { libelle: 'Chèque', is_default: false },
            { libelle: 'Prélèvement automatique', is_default: false },
            { libelle: 'Autre', is_default: false }
        ];

        try {
            // Add UUIDs to each type
            const typesToInsert = defaults.map(type => ({
                ...type,
                id: RatchouUtils.generateUUID()
            }));

            console.log('Creating default expense types with metadata...', typesToInsert);

            // Use bulkPutWithMeta like other models for consistency
            const result = await this.db.bulkPutWithMeta(this.storeName, typesToInsert);
            
            console.log('Default expense types created successfully');
            return RatchouUtils.error.success('Types de dépenses par défaut créés');
        } catch (error) {
            console.error('Error creating default expense types:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'création des types par défaut');
        }
    }
}

window.ExpenseTypesModel = ExpenseTypesModel;
