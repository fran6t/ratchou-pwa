/**
 * Main Ratchou Application Class
 * Orchestrates all components and provides unified API
 */

class RatchouApp {
    constructor() {
        this.db = null;
        this.auth = null;
        this.models = {};
        this.isInitialized = false;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            RatchouUtils.debug.log('Initializing Ratchou application');
            
            // Initialize IndexedDB wrapper
            this.db = new IndexedDBWrapper('ratchou', 1);
            await this.db.init();

            // Initialize authentication
            this.auth = new RatchouAuth(this.db);
            await this.auth.initialize();

            // Initialize models
            this.models = {
                accounts: new AccountsModel(this.db),
                categories: new CategoriesModel(this.db),
                payees: new PayeesModel(this.db),
                expenseTypes: new ExpenseTypesModel(this.db),
                transactions: new TransactionsModel(this.db),
                recurringExpenses: new RecurringExpensesModel(this.db)
            };

            // Initialize with default data if this is first run
            const accountCount = await this.models.accounts.count();
            if (accountCount === 0) {
                RatchouUtils.debug.log('First run detected, creating default data');
                await this.initializeWithDefaults();
            } else {
                RatchouUtils.debug.log('First run déjà fait');
            }

            this.isInitialized = true;
            
            RatchouUtils.debug.log('Ratchou application initialized successfully');
            console.log('✅ Ratchou application initialization completed');
            return RatchouUtils.error.success('Application initialisée');
            
        } catch (error) {
            console.error('Application initialization error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'initialisation');
        }
    }

    /**
     * Check if app is ready for use
     */
    isReady() {
        return this.isInitialized && this.db && this.auth && this.models;
    }

    /**
     * Ensure app is initialized
     */
    requireInitialized() {
        if (!this.isReady()) {
            throw new Error('Application not initialized. Call initialize() first.');
        }
    }

    // =================================================================
    // Authentication shortcuts
    // =================================================================

    async login(accessCode) {
        this.requireInitialized();
        const result = await this.auth.login(accessCode);
        
        if (result.success) {
            // Process recurring expenses on successful login
            await this.processRecurringExpenses();
        }
        
        return result;
    }

    logout() {
        this.requireInitialized();
        return this.auth.logout();
    }

    isAuthenticated() {
        return this.isReady() && this.auth.isAuthenticated();
    }

    requireAuth() {
        this.requireInitialized();
        return this.auth.requireAuth();
    }

    async changeAccessCode(currentCode, newCode) {
        this.requireInitialized();
        this.requireAuth();
        return await this.auth.changeAccessCode(currentCode, newCode);
    }

    // =================================================================
    // Data management shortcuts
    // =================================================================

    /**
     * Get current account (principal account or last selected)
     */
    async getCurrentAccount() {
        this.requireAuth();
        
        // Try to get from storage first
        const storedAccountId = RatchouUtils.storage.get('current_account_id');
        if (storedAccountId) {
            const account = await this.models.accounts.getById(storedAccountId);
            if (account) return account;
        }

        // Fallback to principal account
        let principal = await this.models.accounts.getPrincipal();
        
        // If no principal account exists, create one
        if (!principal) {
            await this.models.accounts.create({
                nom_compte: 'Compte Principal',
                balance: 0,
                is_principal: true
            });
            principal = await this.models.accounts.getPrincipal();
        }

        // Store current account
        if (principal) {
            RatchouUtils.storage.set('current_account_id', principal.id);
        }

        return principal;
    }

    /**
     * Set current account
     */
    setCurrentAccount(accountId) {
        RatchouUtils.storage.set('current_account_id', accountId);
    }

    /**
     * Process recurring expenses (called on login)
     */
    async processRecurringExpenses() {
        this.requireAuth();
        return await this.models.recurringExpenses.processAll();
    }

    /**
     * Get dashboard data
     */
    async getDashboardData() {
        this.requireAuth();
        
        const currentAccount = await this.getCurrentAccount();
        const recentTransactions = await this.models.transactions.getRecentByAccount(currentAccount.id, 20);
        const enrichedTransactions = await this.models.transactions.getEnriched(recentTransactions);
        const allAccounts = await this.models.accounts.getAllSorted();
        const upcomingExpenses = await this.models.recurringExpenses.getUpcoming(currentAccount.id, 5);
        
        return {
            currentAccount,
            recentTransactions: enrichedTransactions,
            allAccounts,
            upcomingExpenses
        };
    }

    // =================================================================
    // Data import/export
    // =================================================================

    /**
     * Import data from SQLite JSON export
     * @param {object} jsonData - The parsed JSON data from the export file
     * @param {string} deviceId - The new device ID provided by the user
     * @param {string} accessCode - The new access code provided by the user
     */
    async importFromJSON(jsonData, deviceId, accessCode) {
        try {
            this.requireInitialized();
            
            RatchouUtils.debug.log('Starting JSON import for device:', deviceId);
            
            // Validate JSON structure
            if (!jsonData.data) {
                throw new Error('Invalid JSON structure - missing data property');
            }
            if (!deviceId) {
                throw new Error('Device ID is required for import');
            }
            if (!accessCode) {
                throw new Error('Access code is required for import');
            }

            const results = {};
            
            // Import in correct order (respecting dependencies)
            
            // 1. User data (support both old and new format)
            if (jsonData.data.utilisateur?.rows?.[0]) {
                results.user = await this.auth.importFromSQLite(jsonData.data.utilisateur.rows[0], deviceId, accessCode);
            } else if (jsonData.data.UTILISATEUR?.rows?.[0]) {
                results.user = await this.auth.importFromSQLite(jsonData.data.UTILISATEUR.rows[0], deviceId, accessCode);
            } else {
                // If user data is missing from the file, create it from scratch
                results.user = await this.auth.importFromSQLite({}, deviceId, accessCode);
            }

            // 2. Accounts (support both old and new format)
            if (jsonData.data.comptes?.rows) {
                results.accounts = await this.models.accounts.importFromSQLite(jsonData.data.comptes.rows);
            } else if (jsonData.data.COMPTES?.rows) {
                results.accounts = await this.models.accounts.importFromSQLite(jsonData.data.COMPTES.rows);
            }

            // 3. Categories (support both old and new format)
            if (jsonData.data.categories?.rows) {
                results.categories = await this.models.categories.importFromSQLite(jsonData.data.categories.rows);
            } else if (jsonData.data.CATEGORIES?.rows) {
                results.categories = await this.models.categories.importFromSQLite(jsonData.data.CATEGORIES.rows);
            }

            // 4. Payees (support both old and new format)
            if (jsonData.data.beneficiaires?.rows) {
                results.payees = await this.models.payees.importFromSQLite(jsonData.data.beneficiaires.rows);
            } else if (jsonData.data.BENEFICIAIRES?.rows) {
                results.payees = await this.models.payees.importFromSQLite(jsonData.data.BENEFICIAIRES.rows);
            }

            // 5. Expense types (support both old and new format)
            if (jsonData.data.type_depenses?.rows) {
                results.expenseTypes = await this.models.expenseTypes.importFromSQLite(jsonData.data.type_depenses.rows);
            } else if (jsonData.data.TYPE_DEPENSES?.rows) {
                results.expenseTypes = await this.models.expenseTypes.importFromSQLite(jsonData.data.TYPE_DEPENSES.rows);
            }

            // 6. Transactions (support both old and new format)
            if (jsonData.data.mouvements?.rows) {
                results.transactions = await this.models.transactions.importFromSQLite(jsonData.data.mouvements.rows);
            } else if (jsonData.data.MOUVEMENTS?.rows) {
                results.transactions = await this.models.transactions.importFromSQLite(jsonData.data.MOUVEMENTS.rows);
            }

            // 7. Recurring expenses (support both old and new format)
            if (jsonData.data.recurrents?.rows) {
                results.recurringExpenses = await this.models.recurringExpenses.importFromSQLite(jsonData.data.recurrents.rows);
            } else if (jsonData.data.DEPENSES_FIXES?.rows) {
                results.recurringExpenses = await this.models.recurringExpenses.importFromSQLite(jsonData.data.DEPENSES_FIXES.rows);
            }

            RatchouUtils.debug.log('JSON import completed');
            return RatchouUtils.error.success('Import réussi', results);
            
        } catch (error) {
            console.error('Import error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'import');
        }
    }

    /**
     * Export all data to JSON
     */
    async exportToJSON() {
        try {
            this.requireAuth();
            
            RatchouUtils.debug.log('Starting JSON export');
            
            const exportData = {
                meta: {
                    app_version: '1.0.0',
                    schema_version: '1.0',
                    export_date: RatchouUtils.date.now(),
                    description: 'Ratchou IndexedDB data export'
                },
                data: {}
            };

            // Export all data
            const userData = await this.db.getAll('UTILISATEUR');
            const accounts = await this.models.accounts.getAll();
            const categories = await this.models.categories.getAll();
            const payees = await this.models.payees.getAll();
            const expenseTypes = await this.models.expenseTypes.getAll();
            const transactions = await this.models.transactions.getAll();
            const recurringExpenses = await this.models.recurringExpenses.getAll();

            exportData.data = {
                utilisateur: { count: userData.length, rows: userData },
                comptes: { count: accounts.length, rows: accounts },
                categories: { count: categories.length, rows: categories },
                beneficiaires: { count: payees.length, rows: payees },
                type_depenses: { count: expenseTypes.length, rows: expenseTypes },
                mouvements: { count: transactions.length, rows: transactions },
                recurrents: { count: recurringExpenses.length, rows: recurringExpenses }
            };

            // Add statistics
            exportData.meta.statistics = {
                total_accounts: accounts.length,
                total_transactions: transactions.length,
                total_categories: categories.length,
                total_payees: payees.length,
                total_expense_types: expenseTypes.length,
                total_recurring_expenses: recurringExpenses.length
            };

            RatchouUtils.debug.log('JSON export completed');
            return exportData;
            
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    /**
     * Initialize with seed data (for first-time setup)
     */
    async initializeWithDefaults() {
        try {
            // Check if data already exists
            const accountCount = await this.models.accounts.count();
            if (accountCount > 0) {
                return RatchouUtils.error.success('Des données existent déjà');
            }

            RatchouUtils.debug.log('Initializing with default data');
            console.log('🌱 Creating default seed data...');

            // Create default data
            console.log('Creating default accounts...');
            const accountResult = await this.models.accounts.create({
                nom_compte: 'Compte Principal',
                balance: 0,
                is_principal: 1 // Use 1 for true for better IndexedDB indexing
            });
            console.log('Account creation result:', accountResult);

            // Ensure account was created before proceeding
            if (!accountResult.success) {
                console.error('Failed to create principal account, cannot seed further data.');
                return RatchouUtils.error.createResponse(false, 'Impossible de créer le compte principal');
            }
            const principalAccount = accountResult.data;

            // Create second default account
            console.log('Creating Budget Sem. 1 account...');
            const budgetAccountResult = await this.models.accounts.create({
                nom_compte: 'Budget Sem. 1',
                balance: 200.00,
                is_principal: 0 // Secondary account
            });
            console.log('Budget account creation result:', budgetAccountResult);
            
            if (!budgetAccountResult.success) {
                console.error('Failed to create Budget Sem. 1 account:', budgetAccountResult.message);
                // Continue installation even if budget account fails
            }

            console.log('Creating default categories...');
            const categoriesResult = await this.models.categories.createDefaults();
            console.log('Categories creation result:', categoriesResult);
            
            console.log('Creating default payees...');
            const payeesResult = await this.models.payees.createDefaults();
            console.log('Payees creation result:', payeesResult);
            
            console.log('Creating default expense types...');
            const expenseTypesResult = await this.models.expenseTypes.createDefaults();
            console.log('Expense types creation result:', expenseTypesResult);
            
            console.log('Creating default recurring expenses...');
            const recurringResult = await this.models.recurringExpenses.createDefaults(principalAccount);
            console.log('Recurring expenses creation result:', recurringResult);
            
            console.log('✅ Default seed data created successfully');
            return RatchouUtils.error.success('Données par défaut créées');
            
        } catch (error) {
            console.error('Default data initialization error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'initialisation données par défaut');
        }
    }

    /**
     * Clear all application data
     */
    async clearAllData() {
        try {
            this.requireInitialized();
            
            RatchouUtils.debug.log('Clearing all application data');
            
            // Clear all stores
            for (const [name, model] of Object.entries(this.models)) {
                await model.clear();
            }
            
            // Clear user data
            await this.db.clear('UTILISATEUR');
            
            // Clear storage
            RatchouUtils.storage.clear();
            
            // Logout
            this.auth.logout();

            return RatchouUtils.error.success('Toutes les données ont été supprimées');
            
        } catch (error) {
            console.error('Clear data error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'suppression données');
        }
    }

    /**
     * Get application statistics
     */
    async getStats() {
        try {
            this.requireAuth();
            
            const stats = {
                accounts: await this.models.accounts.count(),
                categories: await this.models.categories.count(),
                payees: await this.models.payees.count(),
                expense_types: await this.models.expenseTypes.count(),
                transactions: await this.models.transactions.count(),
                recurring_expenses: await this.models.recurringExpenses.count(),
                total_balance: await this.models.accounts.getTotalBalance()
            };

            return stats;
            
        } catch (error) {
            console.error('Stats error:', error);
            throw error;
        }
    }
}

// Global instance
window.ratchouApp = new RatchouApp();

// Export for use in other modules
window.RatchouApp = RatchouApp;