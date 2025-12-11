/**
 * Main Ratchou Application Class
 * Orchestrates all components and provides unified API
 */

// Version supprimée - utilise maintenant le Service Worker comme source unique

class RatchouApp {
    constructor() {
        this.db = null;
        this.auth = null;
        this.models = {};
        this.isInitialized = false;
    }

    /**
     * Get application version from Service Worker
     * @returns {Promise<string>} Application version
     */
    async getVersion() {
        return await RatchouUtils.version.getAppVersionFromSW();
    }

    /**
     * Get application version with environment info
     * @returns {Promise<object>} Version info with environment
     */
    async getVersionWithEnvironment() {
        return await RatchouUtils.version.getVersionWithEnvironment();
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
     * Initialize ONLY the structure (database, auth, models) without data
     * Used for import/restore operations - Phase 1 of 2-phase initialization
     */
    async initializeStructure() {
        try {
            RatchouUtils.debug.log('Initializing database structure for import...');
            console.log('🏗️ Phase 1: Initializing database structure...');

            // 1. Recreate database completely (deletes everything and recreates structure)
            await this.db.recreateDatabase();
            console.log('✅ Database recreated');

            // 2. Initialize IndexedDB connection and create stores
            await this.db.init();
            console.log('✅ Database structure initialized');

            // 3. Initialize authentication system
            this.auth = new RatchouAuth(this.db);
            await this.auth.initialize();
            console.log('✅ Authentication system initialized');

            // 4. Initialize models with clean database connection
            this.models = {
                accounts: new AccountsModel(this.db),
                categories: new CategoriesModel(this.db),
                payees: new PayeesModel(this.db),
                expenseTypes: new ExpenseTypesModel(this.db),
                transactions: new TransactionsModel(this.db),
                recurringExpenses: new RecurringExpensesModel(this.db)
            };
            console.log('✅ Data models initialized');

            // Mark as structurally ready (but not fully initialized until data is added)
            this.isInitialized = true;

            RatchouUtils.debug.log('Database structure initialization completed');
            console.log('✅ Phase 1 completed: Structure ready for data import');
            return RatchouUtils.error.success('Structure de base initialisée');

        } catch (error) {
            console.error('Structure initialization error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'initialisation structure');
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
            const recurringResult = await this.processRecurringExpenses();

            // Toast discret si mouvements créés
            if (recurringResult && recurringResult.created > 0) {
                RatchouUtils.ui.toast(
                    `${recurringResult.created} dépense(s) récurrente(s) créée(s)`,
                    'success',
                    3000
                );
            }
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
        const principal = await this.models.accounts.getPrincipal();

        // If no principal account exists, this is a data integrity issue
        if (!principal) {
            throw new Error('Aucun compte principal trouvé. Veuillez réinitialiser l\'application ou importer des données.');
        }

        // Store current account
        RatchouUtils.storage.set('current_account_id', principal.id);

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

    // =================================================================

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
     * Import data from IndexedDB JSON export
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

            // 1. User data - create new user with provided credentials
            const userData = {
                code_acces: accessCode,
                device_id: deviceId
            };
            await this.db.put('UTILISATEUR', userData);
            results.user = RatchouUtils.error.success('Données utilisateur importées');

            // 2. Accounts
            if (jsonData.data.comptes?.rows) {
                // Transform solde_initial to balance during import
                const transformAccount = (account) => {
                    if (account.solde_initial !== undefined) {
                        account.balance = account.solde_initial;
                        delete account.solde_initial;
                    }
                    return account;
                };
                results.accounts = await this.models.accounts.bulkImport(jsonData.data.comptes.rows, transformAccount);
            }

            // 3. Categories
            if (jsonData.data.categories?.rows) {
                results.categories = await this.models.categories.bulkImport(jsonData.data.categories.rows);
            }

            // 4. Payees
            if (jsonData.data.beneficiaires?.rows) {
                results.payees = await this.models.payees.bulkImport(jsonData.data.beneficiaires.rows);
            }

            // 5. Expense types
            if (jsonData.data.type_depenses?.rows) {
                results.expenseTypes = await this.models.expenseTypes.bulkImport(jsonData.data.type_depenses.rows);
            }

            // 6. Transactions
            if (jsonData.data.mouvements?.rows) {
                results.transactions = await this.models.transactions.bulkImport(jsonData.data.mouvements.rows);
            }

            // 7. Recurring expenses
            if (jsonData.data.recurrents?.rows) {
                results.recurringExpenses = await this.models.recurringExpenses.bulkImport(
                    jsonData.data.recurrents.rows,
                    (row) => {
                        // Transform boolean is_active to numeric for IndexedDB
                        if (typeof row.is_active === 'boolean') {
                            row.is_active = row.is_active ? 1 : 0;
                        }
                        return row;
                    }
                );
            }

            // Ensure minimum required data exists after import
            await this.ensureMinimumData();

            RatchouUtils.debug.log('JSON import completed - Phase 2 finished');
            console.log('✅ Phase 2 completed: Data import successful');
            return RatchouUtils.error.success('Import réussi', results);

        } catch (error) {
            console.error('Import error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'import');
        }
    }

    /**
     * Ensure minimum required data exists after import
     * Creates default data if essential data is missing
     */
    async ensureMinimumData() {
        try {
            console.log('🔍 Checking for minimum required data...');

            // Check accounts - if none exist, create defaults
            const accounts = await this.models.accounts.getAll();
            if (accounts.length === 0) {
                console.log('No accounts found, creating defaults...');
                await this.initializeWithDefaults();
                return; // initializeWithDefaults creates everything
            }

            // Accounts exist, but check for essential supporting data
            const categories = await this.models.categories.getAll();
            if (categories.length === 0) {
                console.log('No categories found, creating defaults...');
                await this.models.categories.createDefaults();
            }

            const expenseTypes = await this.models.expenseTypes.getAll();
            if (expenseTypes.length === 0) {
                console.log('No expense types found, creating defaults...');
                await this.models.expenseTypes.createDefaults();
            }

            console.log('✅ Minimum data verification complete');
        } catch (error) {
            console.error('Error ensuring minimum data:', error);
            // Don't throw - this shouldn't fail the import
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
            const accounts = await this.models.accounts.getAll();
            if (accounts.length > 0) {
                return RatchouUtils.error.success('Des données existent déjà');
            }

            RatchouUtils.debug.log('Initializing with default data');
            console.log('🌱 Creating default seed data...');

            // Create default data
            console.log('Creating default accounts...');
            const accountResult = await this.models.accounts.create({
                nom_compte: 'Compte Principal',
                balance: 0,
                is_principal: 1, // Use 1 for true for better IndexedDB indexing
                currency: 'EUR',
                remarque_encrypted: null
            });
            console.log('Account creation result:', accountResult);

            // Ensure account was created before proceeding
            if (!accountResult.success) {
                console.error('Failed to create principal account, cannot seed further data.');
                return RatchouUtils.error.createResponse(false, 'Impossible de créer le compte principal');
            }
            const principalAccount = accountResult.data;

            // Create 4 default week budget accounts
            console.log('Creating 4 Budget Sem. accounts...');
            const budgetAccounts = ['Budget Sem. 1', 'Budget Sem. 2', 'Budget Sem. 3', 'Budget Sem. 4'];

            for (let i = 0; i < budgetAccounts.length; i++) {
                const accountName = budgetAccounts[i];
                console.log(`Creating ${accountName} account...`);

                const budgetAccountResult = await this.models.accounts.create({
                    nom_compte: accountName,
                    balance: 20000.00,
                    is_principal: 0, // Secondary account
                    currency: 'EUR',
                    remarque_encrypted: null
                });
                console.log(`${accountName} creation result:`, budgetAccountResult);

                if (!budgetAccountResult.success) {
                    console.error(`Failed to create ${accountName} account:`, budgetAccountResult.message);
                    // Continue installation even if budget account fails
                }
            }

            // Create BTC account
            console.log('Creating Mes BTC account...');
            const btcAccountResult = await this.models.accounts.create({
                nom_compte: 'Mes BTC',
                balance: 0.0025,
                is_principal: 0, // Secondary account
                currency: 'BTC',
                remarque_encrypted: null
            });
            console.log('Mes BTC creation result:', btcAccountResult);

            if (!btcAccountResult.success) {
                console.error('Failed to create Mes BTC account:', btcAccountResult.message);
                // Continue installation even if BTC account fails
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