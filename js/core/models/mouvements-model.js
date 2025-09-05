/**
 * Transactions Model for Ratchou IndexedDB
 * Manages financial transactions with account balance updates
 */

class TransactionsModel extends BaseModel {
    constructor(db) {
        super(db, 'MOUVEMENTS');
    }

    /**
     * Get all transactions for an account (only active ones)
     */
    async getByAccount(accountId) {
        try {
            // Get all active transactions and filter by account
            const allTransactions = await this.getAll();
            return allTransactions.filter(t => t.account_id === accountId && !t.is_deleted);
        } catch (error) {
            console.error('Error getting transactions by account:', error);
            throw error;
        }
    }

    /**
     * Get recent transactions for an account
     */
    async getRecentByAccount(accountId, limit = 20) {
        try {
            // Get all active transactions for this account
            const allTransactions = await this.getAll();
            
            // Filter by account and exclude deleted records
            const accountTransactions = allTransactions.filter(t => 
                t.account_id === accountId && !t.is_deleted
            );
            
            // Sort by date descending (most recent first)
            accountTransactions.sort((a, b) => new Date(b.date_mouvement) - new Date(a.date_mouvement));
            
            return accountTransactions.slice(0, limit);
        } catch (error) {
            console.error('Error getting recent transactions:', error);
            throw error;
        }
    }

    /**
     * Get transactions within a date range for an account (only active ones)
     */
    async getByAccountAndDateRange(accountId, startDate, endDate) {
        try {
            // Get all active transactions for the account and filter by date
            const accountTransactions = await this.getByAccount(accountId);
            
            // Filter by date range
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            return accountTransactions.filter(transaction => {
                const transactionDate = new Date(transaction.date_mouvement);
                return transactionDate >= start && transactionDate <= end;
            });
        } catch (error) {
            console.error('Error getting transactions by date range:', error);
            throw error;
        }
    }

    /**
     * Get transactions by category (only active ones)
     */
    async getByCategory(categoryId) {
        try {
            // Get all active transactions and filter by category
            const allTransactions = await this.getAll();
            return allTransactions.filter(t => t.category_id === categoryId && !t.is_deleted);
        } catch (error) {
            console.error('Error getting transactions by category:', error);
            throw error;
        }
    }

    /**
     * Get transactions by payee (only active ones)
     */
    async getByPayee(payeeId) {
        try {
            // Get all active transactions and filter by payee
            const allTransactions = await this.getAll();
            return allTransactions.filter(t => t.payee_id === payeeId && !t.is_deleted);
        } catch (error) {
            console.error('Error getting transactions by payee:', error);
            throw error;
        }
    }

    /**
     * Get transactions by expense type (only active ones)
     */
    async getByExpenseType(expenseTypeId) {
        try {
            // Get all active transactions and filter by expense type
            const allTransactions = await this.getAll();
            return allTransactions.filter(t => t.expense_type_id === expenseTypeId && !t.is_deleted);
        } catch (error) {
            console.error('Error getting transactions by expense type:', error);
            throw error;
        }
    }

    /**
     * Get transactions with enriched data (joined with related entities)
     */
    async getEnriched(transactions = null) {
        try {
            if (!transactions) {
                transactions = await this.getAll();
            }

            const enrichedTransactions = [];
            
            for (const transaction of transactions) {
                // Get related data
                const account = await this.db.get('COMPTES', transaction.account_id);
                const category = transaction.category_id ? await this.db.get('CATEGORIES', transaction.category_id) : null;
                const payee = transaction.payee_id ? await this.db.get('BENEFICIAIRES', transaction.payee_id) : null;
                const expenseType = transaction.expense_type_id ? await this.db.get('TYPE_DEPENSES', transaction.expense_type_id) : null;

                enrichedTransactions.push({
                    ...transaction,
                    account_name: account?.nom_compte || 'Compte supprimé',
                    category_name: category?.libelle || 'Sans catégorie',
                    payee_name: payee?.libelle || 'Sans bénéficiaire',
                    expense_type_name: expenseType?.libelle || 'Sans type'
                });
            }

            return enrichedTransactions;
        } catch (error) {
            console.error('Error enriching transactions:', error);
            throw error;
        }
    }

    /**
     * Calculate account balance from transactions (only active ones)
     */
    async calculateAccountBalance(accountId) {
        try {
            const transactions = await this.getByAccount(accountId); // Uses our corrected method
            return transactions.reduce((balance, transaction) => balance + transaction.amount, 0);
        } catch (error) {
            console.error('Error calculating account balance:', error);
            throw error;
        }
    }

    /**
     * Get transaction statistics for an account
     */
    async getAccountStats(accountId, startDate = null, endDate = null) {
        try {
            let transactions;
            
            if (startDate && endDate) {
                transactions = await this.getByAccountAndDateRange(accountId, startDate, endDate);
            } else {
                transactions = await this.getByAccount(accountId); // Uses our corrected method
            }

            const stats = {
                total_transactions: transactions.length,
                total_income: 0,
                total_expenses: 0,
                net_amount: 0,
                by_category: {}
            };

            for (const transaction of transactions) {
                if (transaction.amount > 0) {
                    stats.total_income += transaction.amount;
                } else {
                    stats.total_expenses += Math.abs(transaction.amount);
                }
                stats.net_amount += transaction.amount;

                // Group by category
                if (transaction.category_id) {
                    if (!stats.by_category[transaction.category_id]) {
                        stats.by_category[transaction.category_id] = {
                            count: 0,
                            total: 0
                        };
                    }
                    stats.by_category[transaction.category_id].count++;
                    stats.by_category[transaction.category_id].total += transaction.amount;
                }
            }

            return stats;
        } catch (error) {
            console.error('Error getting account stats:', error);
            throw error;
        }
    }

    // =================================================================
    // CRUD operations with account balance updates
    // =================================================================

    async create(data) {
        try {
            // Validate and create transaction
            const result = await super.create(data);
            
            if (result.success) {
                // Update account balance
                await this.updateAccountBalance(data.account_id, data.amount);

                // Increment usage counters
                if (data.category_id && window.ratchouApp && window.ratchouApp.models && window.ratchouApp.models.categories) {
                    await window.ratchouApp.models.categories.incrementUsage(data.category_id);
                }
                if (data.payee_id && window.ratchouApp && window.ratchouApp.models && window.ratchouApp.models.payees) {
                    await window.ratchouApp.models.payees.incrementUsage(data.payee_id);
                }
            }

            return result;
        } catch (error) {
            console.error('Error creating transaction:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'création');
        }
    }

    async update(id, data) {
        try {
            // Get original transaction to calculate balance difference
            const originalTransaction = await this.getById(id);
            if (!originalTransaction) {
                throw new Error('Transaction not found');
            }

            const result = await super.update(id, data);
            
            if (result.success) {
                // Calculate balance difference and update account
                const amountDiff = (data.amount || originalTransaction.amount) - originalTransaction.amount;
                if (amountDiff !== 0) {
                    await this.updateAccountBalance(originalTransaction.account_id, amountDiff);
                }
            }

            return result;
        } catch (error) {
            console.error('Error updating transaction:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'mise à jour');
        }
    }

    async delete(id) {
        try {
            // Get transaction to update account balance
            const transaction = await this.getById(id);
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            const result = await super.delete(id);
            
            if (result.success) {
                // Reverse the transaction amount from account balance
                await this.updateAccountBalance(transaction.account_id, -transaction.amount);
            }

            return result;
        } catch (error) {
            console.error('Error deleting transaction:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'suppression');
        }
    }

    // =================================================================
    // Validation and transformation
    // =================================================================

    validateCreate(data) {
        super.validateCreate(data);
        
        RatchouUtils.validate.required(data.account_id, 'account_id');
        RatchouUtils.validate.required(data.amount, 'amount');
        
        if (!RatchouUtils.validate.uuid(data.account_id)) {
            throw new Error('ID de compte invalide');
        }

        if (typeof data.amount !== 'number') {
            throw new Error('Le montant doit être un nombre');
        }

        // Convert amount to cents if it's in euros
        if (data.amount !== Math.floor(data.amount)) {
            data.amount = RatchouUtils.currency.toCents(data.amount);
        }

        // Set default date if not provided
        if (!data.date_mouvement) {
            data.date_mouvement = RatchouUtils.date.now();
        } else {
            data.date_mouvement = RatchouUtils.date.toISO(data.date_mouvement);
        }

        // Validate optional references
        if (data.category_id && !RatchouUtils.validate.uuid(data.category_id)) {
            throw new Error('ID de catégorie invalide');
        }
        if (data.payee_id && !RatchouUtils.validate.uuid(data.payee_id)) {
            throw new Error('ID de bénéficiaire invalide');
        }
        if (data.expense_type_id && !RatchouUtils.validate.uuid(data.expense_type_id)) {
            throw new Error('ID de type de dépense invalide');
        }
    }

    validateUpdate(data) {
        super.validateUpdate(data);
        
        if (data.account_id && !RatchouUtils.validate.uuid(data.account_id)) {
            throw new Error('ID de compte invalide');
        }

        if (data.amount !== undefined && typeof data.amount !== 'number') {
            throw new Error('Le montant doit être un nombre');
        }

        if (data.date_mouvement) {
            data.date_mouvement = RatchouUtils.date.toISO(data.date_mouvement);
        }

        // Convert amount to cents if necessary
        if (data.amount !== undefined && data.amount !== Math.floor(data.amount)) {
            data.amount = RatchouUtils.currency.toCents(data.amount);
        }
    }

    /**
     * Helper: Update account balance
     */
    async updateAccountBalance(accountId, amountDiff) {
        try {
            const account = await this.db.get('COMPTES', accountId);
            if (account) {
                account.balance += amountDiff;
                await this.db.putWithMeta('COMPTES', account);
            }
        } catch (error) {
            console.error('Error updating account balance:', error);
            throw error;
        }
    }

    /**
     * Import from SQLite data
     */
    async importFromSQLite(sqliteTransactions) {
        const transformedTransactions = sqliteTransactions.map(RatchouUtils.transform.transaction);
        return await this.bulkImport(transformedTransactions);
    }

    /**
     * Search transactions with details (enriched data)
     */
    async searchWithDetails(filters = {}) {
        try {
            let transactions = await this.getAll();
            
            // Apply filters
            if (Object.keys(filters).length > 0) {
                transactions = this.applyFilters(transactions, filters);
            }
            
            // Sort by date descending (most recent first)
            transactions.sort((a, b) => new Date(b.date_mouvement) - new Date(a.date_mouvement));
            
            // Enrich with related data
            return await this.getEnriched(transactions);
            
        } catch (error) {
            console.error('Error searching transactions with details:', error);
            throw error;
        }
    }

    /**
     * Apply filters to transactions
     */
    applyFilters(transactions, filters) {
        return transactions.filter(transaction => {
            // Date from filter
            if (filters.date_from) {
                const transactionDate = new Date(transaction.date_mouvement);
                const fromDate = new Date(filters.date_from);
                if (transactionDate < fromDate) return false;
            }
            
            // Date to filter
            if (filters.date_to) {
                const transactionDate = new Date(transaction.date_mouvement);
                const toDate = new Date(filters.date_to + 'T23:59:59'); // End of day
                if (transactionDate > toDate) return false;
            }
            
            // Account filter
            if (filters.compte && transaction.account_id !== filters.compte) {
                return false;
            }
            
            // Category filter
            if (filters.categorie && transaction.category_id !== filters.categorie) {
                return false;
            }
            
            // Payee filter
            if (filters.beneficiaire && transaction.payee_id !== filters.beneficiaire) {
                return false;
            }
            
            // Expense type filter
            if (filters.type_depense && transaction.expense_type_id !== filters.type_depense) {
                return false;
            }
            
            // Amount min filter (convert euros to cents for comparison)
            if (filters.montant_min) {
                const minAmountInCents = RatchouUtils.currency.toCents(parseFloat(filters.montant_min));
                if (Math.abs(transaction.amount) < minAmountInCents) return false;
            }
            
            // Amount max filter (convert euros to cents for comparison)
            if (filters.montant_max) {
                const maxAmountInCents = RatchouUtils.currency.toCents(parseFloat(filters.montant_max));
                if (Math.abs(transaction.amount) > maxAmountInCents) return false;
            }
            
            // Search in text fields
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const description = (transaction.description || '').toLowerCase();
                
                // For now, just search in description
                // TODO: Search in enriched data (category name, payee name, etc.)
                if (!description.includes(searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * Export transactions to CSV format
     */
    async exportToCSV(accountId = null, startDate = null, endDate = null) {
        try {
            let transactions;
            
            if (accountId && startDate && endDate) {
                transactions = await this.getByAccountAndDateRange(accountId, startDate, endDate);
            } else if (accountId) {
                transactions = await this.getByAccount(accountId); // Uses our corrected method
            } else {
                transactions = await this.getAll(); // Already uses getAllActive()
            }

            const enrichedTransactions = await this.getEnriched(transactions);
            
            // CSV header
            const headers = ['Date', 'Montant', 'Catégorie', 'Bénéficiaire', 'Type', 'Description', 'Compte'];
            
            // CSV rows
            const rows = enrichedTransactions.map(transaction => [
                RatchouUtils.date.format(transaction.date_mouvement),
                RatchouUtils.currency.format(transaction.amount),
                transaction.category_name || '',
                transaction.payee_name || '',
                transaction.expense_type_name || '',
                transaction.description || '',
                transaction.account_name
            ]);

            // Combine header and rows
            const csvContent = [headers, ...rows]
                .map(row => row.map(field => `"${field}"`).join(';'))
                .join('\n');

            return csvContent;
        } catch (error) {
            console.error('Error exporting transactions to CSV:', error);
            throw error;
        }
    }

    /**
     * Duplicates a transaction to the main account.
     * @param {string} transactionId - The ID of the transaction to duplicate.
     * @returns {Promise<{success: boolean, data?: object, message?: string}>}
     */
    async duplicateTransactionToMainAccount(transactionId) {
        try {
            // 1. Find the main account
            const allAccounts = await this.db.getAll('COMPTES');
            const mainAccount = allAccounts.find(acc => acc.is_principal);
            if (!mainAccount) {
                return { success: false, message: "Aucun compte principal n'a été trouvé." };
            }

            // 2. Get the original transaction
            const originalTransaction = await this.getById(transactionId);
            if (!originalTransaction) {
                return { success: false, message: 'Transaction originale non trouvée.' };
            }

            // 3. Check if it's already on the main account
            if (originalTransaction.account_id === mainAccount.id) {
                return { success: false, message: 'La transaction est déjà sur le compte principal.' };
            }

            // 4. Get the original account's name for the note
            const originalAccount = await this.db.get('COMPTES', originalTransaction.account_id);
            const originalAccountName = originalAccount ? originalAccount.nom_compte : 'un autre compte';

            // 5. Prepare new transaction data
            const newTransactionData = {
                amount: originalTransaction.amount,
                category_id: originalTransaction.category_id,
                payee_id: originalTransaction.payee_id,
                expense_type_id: originalTransaction.expense_type_id,
                description: (`${originalTransaction.description || ''} [Copié depuis ${originalAccountName}]`).trim(),
                account_id: mainAccount.id,
                date_mouvement: originalTransaction.date_mouvement // Keep the same date
            };

            // 6. Create the new transaction (the create method handles ID, date, and balance update)
            const result = await this.create(newTransactionData);

            return result;

        } catch (error) {
            console.error('Error duplicating transaction:', error);
            return { success: false, message: `Erreur lors de la duplication : ${error.message}` };
        }
    }
}

// Export for use in other modules
window.TransactionsModel = TransactionsModel;