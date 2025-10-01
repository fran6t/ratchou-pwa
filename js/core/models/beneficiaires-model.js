/**
 * Payees Model for Ratchou IndexedDB
 * Manages beneficiaries/recipients of transactions
 */

class PayeesModel extends BaseModel {
    constructor(db) {
        super(db, 'BENEFICIAIRES');
    }

    async getAllSorted() {
        const payees = await this.getAll();
        return payees.sort((a, b) => a.libelle.localeCompare(b.libelle));
    }

    /**
     * Get payees sorted by usage count (descending)
     */
    async getAllSortedByUsage() {
        try {
            const payees = await this.getAll();
            return payees.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
        } catch (error) {
            console.error('Error getting payees sorted by usage:', error);
            throw error;
        }
    }

    /**
     * Increment usage count for a payee
     */
    async incrementUsage(payeeId) {
        try {
            const payee = await this.getById(payeeId);
            if (payee) {
                const currentUsage = payee.usage_count || 0;
                await super.update(payeeId, { usage_count: currentUsage + 1 });
            }
        } catch (error) {
            console.error('Error incrementing payee usage:', error);
        }
    }

    async searchByName(prefix, limit = 10) {
        return await this.searchByPrefix('name', prefix, limit);
    }

    async nameExists(libelle, excludeId = null) {
        const payees = await this.getAll('name', IDBKeyRange.only(libelle));
        return payees.some(payee => payee.id !== excludeId);
    }

    validateCreate(data) {
        super.validateCreate(data);
        RatchouUtils.validate.required(data.libelle, 'libelle');
        data.libelle = data.libelle.trim();

        // usage_count defaults to 0
        if (data.usage_count === undefined) {
            data.usage_count = 0;
        }
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


    async create(data) {
        const exists = await this.nameExists(data.libelle);
        if (exists) {
            return RatchouUtils.error.validation('Un bénéficiaire avec ce nom existe déjà');
        }
        return await super.create(data);
    }

    async update(id, data) {
        if (data.libelle) {
            const exists = await this.nameExists(data.libelle, id);
            if (exists) {
                return RatchouUtils.error.validation('Un bénéficiaire avec ce nom existe déjà');
            }
        }
        return await super.update(id, data);
    }

    /**
     * Delete a payee with automatic dissociation of all related transactions
     * Sets payee_id to null in all associated transactions before soft deleting the payee
     * This overrides the base delete method to always perform dissociation
     */
    async delete(payeeId) {
        try {
            console.log(`Starting payee dissociation for payee: ${payeeId}`);

            // 1. Get all transactions associated with this payee
            const transactions = await ratchouApp.models.transactions.getByPayee(payeeId);
            console.log(`Found ${transactions.length} transactions to dissociate`);

            // 2. Dissociate all transactions (set payee_id to null)
            for (const transaction of transactions) {
                console.log(`Dissociating transaction: ${transaction.id}`);
                const updateResult = await ratchouApp.models.transactions.update(transaction.id, {
                    payee_id: null
                });
                if (!updateResult.success) {
                    console.error(`Failed to dissociate transaction ${transaction.id}:`, updateResult.message);
                    return RatchouUtils.error.validation(`Erreur lors de la dissociation de la transaction ${transaction.id}`);
                }
            }

            console.log('All transactions dissociated successfully');

            // 3. Also check and dissociate recurring expenses if they exist
            try {
                const recurringExpenses = await ratchouApp.models.recurringExpenses.getByPayee(payeeId);
                console.log(`Found ${recurringExpenses.length} recurring expenses to dissociate`);

                for (const recurring of recurringExpenses) {
                    console.log(`Dissociating recurring expense: ${recurring.id}`);
                    const updateResult = await ratchouApp.models.recurringExpenses.update(recurring.id, {
                        payee_id: null
                    });
                    if (!updateResult.success) {
                        console.error(`Failed to dissociate recurring expense ${recurring.id}:`, updateResult.message);
                        return RatchouUtils.error.validation(`Erreur lors de la dissociation de la dépense récurrente ${recurring.id}`);
                    }
                }
            } catch (recurringError) {
                console.warn('Could not check recurring expenses (possibly no getByPayee method):', recurringError);
            }

            // 4. Now safely soft delete the payee
            console.log('Proceeding with payee soft delete');
            const deleteResult = await super.delete(payeeId);

            if (deleteResult.success) {
                console.log('Payee deleted successfully with full dissociation');
                return RatchouUtils.error.success('Bénéficiaire supprimé avec succès. Les mouvements associés ont été dissociés.');
            } else {
                return deleteResult;
            }

        } catch (error) {
            console.error('Error during payee dissociation:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'suppression avec dissociation');
        }
    }

    /**
     * Merge two payees: reassign all transactions from mergePayeeId to keepPayeeId,
     * sum usage counts, and delete the merged payee
     */
    async merge(keepPayeeId, mergePayeeId) {
        try {
            console.log(`Starting payee merge: keeping ${keepPayeeId}, merging ${mergePayeeId}`);

            // 1. Verify both payees exist
            const keepPayee = await this.getById(keepPayeeId);
            const mergePayee = await this.getById(mergePayeeId);

            if (!keepPayee) {
                return RatchouUtils.error.validation('Le bénéficiaire à conserver est introuvable');
            }

            if (!mergePayee) {
                return RatchouUtils.error.validation('Le bénéficiaire à fusionner est introuvable');
            }

            console.log(`Merging "${mergePayee.libelle}" into "${keepPayee.libelle}"`);

            // 2. Get all transactions from the payee to be merged
            const transactionsToReassign = await ratchouApp.models.transactions.getByPayee(mergePayeeId);
            console.log(`Found ${transactionsToReassign.length} transactions to reassign`);

            // 3. Reassign all transactions to the kept payee
            for (const transaction of transactionsToReassign) {
                console.log(`Reassigning transaction ${transaction.id} from ${mergePayeeId} to ${keepPayeeId}`);
                const updateResult = await ratchouApp.models.transactions.update(transaction.id, {
                    payee_id: keepPayeeId
                });
                if (!updateResult.success) {
                    console.error(`Failed to reassign transaction ${transaction.id}:`, updateResult.message);
                    return RatchouUtils.error.validation(`Erreur lors de la réassignation de la transaction ${transaction.id}`);
                }
            }

            console.log('All transactions reassigned successfully');

            // 4. Also reassign recurring expenses if they exist
            try {
                const recurringExpenses = await ratchouApp.models.recurringExpenses.getByPayee(mergePayeeId);
                console.log(`Found ${recurringExpenses.length} recurring expenses to reassign`);

                for (const recurring of recurringExpenses) {
                    console.log(`Reassigning recurring expense ${recurring.id} from ${mergePayeeId} to ${keepPayeeId}`);
                    const updateResult = await ratchouApp.models.recurringExpenses.update(recurring.id, {
                        payee_id: keepPayeeId
                    });
                    if (!updateResult.success) {
                        console.error(`Failed to reassign recurring expense ${recurring.id}:`, updateResult.message);
                        return RatchouUtils.error.validation(`Erreur lors de la réassignation de la dépense récurrente ${recurring.id}`);
                    }
                }
            } catch (recurringError) {
                console.warn('Could not check recurring expenses (possibly no getByPayee method):', recurringError);
            }

            // 5. Update the kept payee's usage count (sum both counts)
            const newUsageCount = (keepPayee.usage_count || 0) + (mergePayee.usage_count || 0);
            console.log(`Updating usage count: ${keepPayee.usage_count || 0} + ${mergePayee.usage_count || 0} = ${newUsageCount}`);

            const updateResult = await super.update(keepPayeeId, {
                usage_count: newUsageCount
            });

            if (!updateResult.success) {
                console.error('Failed to update usage count:', updateResult.message);
                return RatchouUtils.error.validation('Erreur lors de la mise à jour du compteur d\'usage');
            }

            // 6. Delete the merged payee (hard delete since we've reassigned everything)
            console.log('Deleting merged payee');
            const deleteResult = await super.delete(mergePayeeId);

            if (!deleteResult.success) {
                console.error('Failed to delete merged payee:', deleteResult.message);
                return RatchouUtils.error.validation('Erreur lors de la suppression du bénéficiaire fusionné');
            }

            console.log('Payee merge completed successfully');

            return RatchouUtils.error.success(
                `Fusion réussie ! "${mergePayee.libelle}" a été fusionné avec "${keepPayee.libelle}". ` +
                `${transactionsToReassign.length} transaction(s) ont été réassignées.`
            );

        } catch (error) {
            console.error('Error during payee merge:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'fusion des bénéficiaires');
        }
    }


    async createDefaults() {
        const defaults = [
            'Employeur', 'Carrefour', 'Leclerc', 'Intermarché', 'Lidl', 'Amazon', 'SNCF', 
            'TotalEnergies', 'EDF', 'Engie', 'Orange', 'Free', 'SFR', 
            'GMF Assurances', 'MAIF', 'Ameli / Sécurité Sociale', 'Urssaf', 
            'Trésor Public', 'Pharmacie', 'Médecin', 'Propriétaire / Syndic'
        ];

        const payeesToInsert = defaults.map(libelle => ({
            libelle,
            id: RatchouUtils.generateUUID(),
            usage_count: 0
        }));

        return await this.db.bulkPutWithMeta(this.storeName, payeesToInsert);
    }
}

window.PayeesModel = PayeesModel;