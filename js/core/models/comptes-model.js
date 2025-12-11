/**
 * Accounts Model for Ratchou IndexedDB
 * Manages bank accounts with balance tracking and principal account logic
 */

class AccountsModel extends BaseModel {
    constructor(db) {
        super(db, 'COMPTES');
    }

    /**
     * Get the principal account
     */
    async getPrincipal() {
        try {
            // The 'principal' index is on the 'is_principal' property.
            // We query for the number 1, which is more reliable for IndexedDB indexes than a boolean.
            const result = await this.db.getAll('COMPTES', 'principal', 1);
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error getting principal account with index:', error);
            // Fallback to iterating through all accounts if index fails
            try {
                const allAccounts = await this.getAll();
                return allAccounts.find(acc => acc.is_principal) || null;
            } catch (fallbackError) {
                console.error('Fallback failed for getPrincipal:', fallbackError);
                return null;
            }
        }
    }

    /**
     * Set an account as principal. Simplified version using BaseModel methods.
     */
    async setPrincipal(accountId) {
        try {
            // 1. Récupérer tous les comptes
            const accounts = await this.getAll();

            if (accounts.length === 0) {
                return RatchouUtils.error.success('Aucun compte à modifier');
            }

            // 2. Mettre à jour les flags is_principal
            for (const account of accounts) {
                const newPrincipalStatus = (account.id === accountId);

                // Ne modifier que si le statut change (évite les écritures inutiles)
                if (account.is_principal !== newPrincipalStatus) {
                    account.is_principal = newPrincipalStatus;
                    const updateResult = await this.update(account.id, account);

                    if (!updateResult.success) {
                        return RatchouUtils.error.createResponse(false,
                            `Erreur lors de la mise à jour du compte ${account.nom_compte}`);
                    }
                }
            }

            return RatchouUtils.error.success('Compte principal défini avec succès');

        } catch (error) {
            console.error('Error setting principal account:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'définition compte principal');
        }
    }

    /**
     * Update account balance
     */
    async updateBalance(accountId, newBalance) {
        try {
            const account = await this.getById(accountId);
            if (!account) {
                throw new Error('Account not found');
            }

            const currency = account.currency || 'EUR';
            account.balance = RatchouUtils.currency.toStorageUnit(newBalance, currency);
            return await this.update(accountId, { balance: account.balance });
        } catch (error) {
            console.error('Error updating balance:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'mise à jour du solde');
        }
    }

    /**
     * Correct account balance (for manual adjustments)
     * @param {number} accountId - Account ID
     * @param {number} newBalanceStorageUnit - New balance in storage units (cents for EUR, satoshis for BTC)
     * @returns {Promise<Object>} Result with success status and updated account data
     */
    async correctBalance(accountId, newBalanceStorageUnit) {
        try {
            const account = await this.getById(accountId);
            if (!account) {
                return RatchouUtils.error.error('Compte introuvable');
            }

            // Update balance directly with storage unit value (no conversion needed)
            const result = await this.update(accountId, { balance: newBalanceStorageUnit });

            return result;
        } catch (error) {
            console.error('Error correcting balance:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'correction du solde');
        }
    }

    /**
     * Get accounts sorted by principal first, then by name
     */
    async getAllSorted() {
        try {
            const accounts = await this.getAll();
            return accounts.sort((a, b) => {
                if (a.is_principal && !b.is_principal) return -1;
                if (!a.is_principal && b.is_principal) return 1;
                return a.nom_compte.localeCompare(b.nom_compte);
            });
        } catch (error) {
            console.error('Error getting sorted accounts:', error);
            throw error;
        }
    }

    /**
     * Calculate total balance across all accounts
     */
    async getTotalBalance() {
        try {
            const accounts = await this.getAll();
            return accounts.reduce((total, account) => total + account.balance, 0);
        } catch (error) {
            console.error('Error calculating total balance:', error);
            throw error;
        }
    }

    // =================================================================
    // Validation and transformation
    // =================================================================

    validateCreate(data) {
        super.validateCreate(data);
        RatchouUtils.validate.required(data.nom_compte, 'nom_compte');
        if (typeof data.nom_compte !== 'string' || data.nom_compte.trim() === '') {
            throw new Error('Le nom du compte est requis');
        }
        // Set defaults
        if (data.balance === undefined) data.balance = 0;
        if (data.currency === undefined) data.currency = 'EUR';

        // Convert balance to storage unit if it's a decimal number
        if (typeof data.balance === 'number' && data.balance !== Math.floor(data.balance)) {
            data.balance = RatchouUtils.currency.toStorageUnit(data.balance, data.currency);
        }
        if (data.is_principal === undefined) data.is_principal = 0;
        // Convert boolean to number for IndexedDB index reliability
        if (typeof data.is_principal === 'boolean') {
            data.is_principal = data.is_principal ? 1 : 0;
        }
        if (data.auto_copy_to_principal === undefined) data.auto_copy_to_principal = 0;
        // Convert boolean to number for IndexedDB index reliability
        if (typeof data.auto_copy_to_principal === 'boolean') {
            data.auto_copy_to_principal = data.auto_copy_to_principal ? 1 : 0;
        }
        // Validate currency
        if (data.currency === undefined) data.currency = 'EUR';
        if (!['EUR', 'USD', 'BTC'].includes(data.currency)) {
            throw new Error('Devise invalide. Valeurs autorisées : EUR, USD, BTC');
        }
        // Validate encrypted remark (optional)
        if (data.remarque_encrypted === undefined) data.remarque_encrypted = null;
        if (data.remarque_encrypted !== null && typeof data.remarque_encrypted !== 'string') {
            throw new Error('La remarque chiffrée doit être une chaîne de caractères');
        }
    }

    validateUpdate(data) {
        super.validateUpdate(data);
        if (data.nom_compte !== undefined && (typeof data.nom_compte !== 'string' || data.nom_compte.trim() === '')) {
            throw new Error('Le nom du compte ne peut pas être vide');
        }
        if (data.balance !== undefined) {
            if (typeof data.balance !== 'number') throw new Error('Le solde doit être un nombre');
            // Convert balance to storage unit if it's a decimal number
            // Note: currency should be provided along with balance for proper conversion
            if (data.balance !== Math.floor(data.balance)) {
                const currency = data.currency || 'EUR'; // fallback to EUR if not provided
                data.balance = RatchouUtils.currency.toStorageUnit(data.balance, currency);
            }
        }
        // Convert boolean to number for IndexedDB index reliability
        if (data.is_principal !== undefined && typeof data.is_principal === 'boolean') {
            data.is_principal = data.is_principal ? 1 : 0;
        }
        if (data.auto_copy_to_principal !== undefined && typeof data.auto_copy_to_principal === 'boolean') {
            data.auto_copy_to_principal = data.auto_copy_to_principal ? 1 : 0;
        }
        // Validate currency if provided
        if (data.currency !== undefined && !['EUR', 'USD', 'BTC'].includes(data.currency)) {
            throw new Error('Devise invalide. Valeurs autorisées : EUR, USD, BTC');
        }
        // Validate encrypted remark if provided
        if (data.remarque_encrypted !== undefined && data.remarque_encrypted !== null && typeof data.remarque_encrypted !== 'string') {
            throw new Error('La remarque chiffrée doit être une chaîne de caractères');
        }
    }

    async canDelete(accountId) {
        try {
            const account = await this.getById(accountId);
            if (account && account.is_principal) {
                return RatchouUtils.error.validation('Impossible de supprimer le compte principal');
            }
            const transactionCount = await this.db.count('MOUVEMENTS', 'account_id', IDBKeyRange.only(accountId));
            if (transactionCount > 0) {
                return RatchouUtils.error.validation('Ce compte contient des mouvements et ne peut pas être supprimé');
            }
            const recurringCount = await this.db.count('DEPENSES_FIXES', 'account_id', IDBKeyRange.only(accountId));
            if (recurringCount > 0) {
                return RatchouUtils.error.validation('Ce compte contient des dépenses fixes et ne peut pas être supprimé');
            }
            return RatchouUtils.error.success('Deletion allowed');
        } catch (error) {
            console.error('Error checking if account can be deleted:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'vérification suppression');
        }
    }

}

// Export for use in other modules
window.AccountsModel = AccountsModel;
