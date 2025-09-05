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
     * Set an account as principal. This is the dedicated method for this business rule.
     * It ensures atomicity by performing all reads and writes in a single transaction.
     */
    async setPrincipal(accountId) {
        const tx = this.db.tx(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        try {
            const allAccounts = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (allAccounts.length === 0) {
                return RatchouUtils.error.success('Aucun compte à modifier');
            }
            
            const promises = allAccounts.map(async account => {
                account.is_principal = (account.id === accountId);
                return await this.db.putWithMeta(this.storeName, account);
            });

            await Promise.all(promises);
            
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });

            return RatchouUtils.error.success('Compte principal défini avec succès');
        } catch (error) {
            console.error('Error setting principal account:', error);
            if (tx && tx.readyState !== 'done') tx.abort();
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

            account.balance = RatchouUtils.currency.toCents(newBalance);
            return await this.update(accountId, { balance: account.balance });
        } catch (error) {
            console.error('Error updating balance:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'mise à jour du solde');
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
        if (data.balance === undefined) data.balance = 0;
        if (typeof data.balance === 'number' && data.balance !== Math.floor(data.balance)) {
            data.balance = RatchouUtils.currency.toCents(data.balance);
        }
        if (data.is_principal === undefined) data.is_principal = false;
    }

    validateUpdate(data) {
        super.validateUpdate(data);
        if (data.nom_compte !== undefined && (typeof data.nom_compte !== 'string' || data.nom_compte.trim() === '')) {
            throw new Error('Le nom du compte ne peut pas être vide');
        }
        if (data.balance !== undefined) {
            if (typeof data.balance !== 'number') throw new Error('Le solde doit être un nombre');
            if (data.balance !== Math.floor(data.balance)) {
                data.balance = RatchouUtils.currency.toCents(data.balance);
            }
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

    /**
     * Import from SQLite data
     */
    async importFromSQLite(sqliteAccounts) {
        const transformedAccounts = sqliteAccounts.map(RatchouUtils.transform.account);
        return await this.bulkImport(transformedAccounts);
    }
}

// Export for use in other modules
window.AccountsModel = AccountsModel;
