/**
 * Dashboard Controller for Ratchou IndexedDB
 * Handles transaction creation, account management, and data display
 */

class DashboardController {
    constructor() {
        this.currentAccount = null;
        this.allAccounts = [];
        this.categories = [];
        this.payees = [];
        this.expenseTypes = [];
        this.recentTransactions = [];
        this.isInitialized = false;
        
        // Sort modes for panels
        this.categoriesSortMode = 'alphabetical'; // 'alphabetical' or 'usage'
        this.payeesSortMode = 'alphabetical'; // 'alphabetical' or 'usage'
        
        // DOM elements
        this.transactionForm = null;
        this.transactionsTable = null;
        this.loadingOverlay = null;
        this.accountSelectModal = null;
        this.balanceModal = null;
        this.editMovementModal = null;
        this.balanceCalculationHandler = null;
        this.balanceEnterHandler = null;
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            showAccountInfo: true,
            logoLink: 'dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            console.log('Initializing dashboard...');
            
            // Load components first
            await this.loadComponents();
            
            // Get DOM elements first
            this.setupDOMElements();
            
            // Show loading
            this.showLoading('Initialisation...');
            
            // Initialize Ratchou app if not already done
            if (!ratchouApp.isReady()) {
                await ratchouApp.initialize();
            }
            
            // Check authentication with guard system
            if (window.auth && typeof window.auth.guardPage === 'function') {
                if (!auth.guardPage('app')) {
                    return; // User was redirected, stop initialization
                }
            } else if (!ratchouApp.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }
            
            // Load sort modes from localStorage
            this.loadSortModes();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Setup form validation
            this.setupFormValidation();
            
            
            this.isInitialized = true;
            this.hideLoading();
            
            // Set focus to the amount input for quick entry
            const amountInput = document.getElementById('montant');
            if (amountInput) {
                amountInput.focus();
            }
            
            
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showError('Erreur d\'initialisation: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Setup DOM element references
     */
    setupDOMElements() {
        this.transactionForm = document.getElementById('movementForm');
        this.transactionsTable = document.getElementById('transactionsTableBody');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.accountSelectModal = new bootstrap.Modal(document.getElementById('accountSelectModal'));
        this.balanceModal = new bootstrap.Modal(document.getElementById('balanceModal'));
        this.editMovementModal = new bootstrap.Modal(document.getElementById('editMovementModal'));
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Transaction form submission
        this.transactionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTransactionSubmit();
        });

        // Reset form button
        document.getElementById('resetFormBtn').addEventListener('click', () => {
            this.resetForm();
        });


        // Setup panel buttons
        this.setupPanelButtons();
        
        // Setup panel backdrop click to close
        const backdrop = document.getElementById('panelBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                this.closePanels();
            });
        }

        // Setup remarque modal
        document.getElementById('saveRemarque').addEventListener('click', () => {
            this.saveRemarque();
        });

        // Setup edit movement modal
        document.getElementById('updateMovementBtn').addEventListener('click', () => {
            this.handleMovementUpdate();
        });

        document.getElementById('deleteMovementBtn').addEventListener('click', () => {
            this.handleMovementDelete();
        });

        document.getElementById('duplicateToMainBtn').addEventListener('click', () => {
            this.handleMovementDuplicate();
        });

        document.getElementById('editMovementModal').addEventListener('hidden.bs.modal', () => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.style.overflow = 'auto';
        });

        // Account selection - intercepter le clic sur le nom du compte
        document.addEventListener('click', (e) => {
            if (e.target.id === 'currentAccountName') {
                e.preventDefault();
                this.openAccountSelectModal();
            }
        });

        // Balance correction
        document.getElementById('balanceModal').addEventListener('show.bs.modal', () => {
            this.setupBalanceModal();
        });

        document.getElementById('updateBalanceBtn').addEventListener('click', () => {
            this.handleBalanceUpdate();
        });

        // Financial timeline/projection
        document.getElementById('timelineModal').addEventListener('show.bs.modal', () => {
            this.loadFinancialProjection();
            
            // Setup event listeners for period selection
            document.querySelectorAll('input[name="projectionPeriod"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        this.loadFinancialProjection(parseInt(radio.value));
                    }
                });
            });
        });

        // Quick add modals
        document.getElementById('saveCategoryBtn').addEventListener('click', () => {
            this.handleQuickAddCategory();
        });

        document.getElementById('savePayeeBtn').addEventListener('click', () => {
            this.handleQuickAddPayee();
        });

        // Enter key support for quick add modals
        document.getElementById('newCategoryName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleQuickAddCategory();
            }
        });

        document.getElementById('newPayeeName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleQuickAddPayee();
            }
        });

        // Access code change
        document.getElementById('changeCodeBtn').addEventListener('click', () => {
            this.handleAccessCodeChange();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Import/Export functionality now handled by import-export.js module


        // Transaction row click (for future editing)
        this.transactionsTable.addEventListener('click', (e) => {
            const row = e.target.closest('tr[data-transaction-id]');
            if (row) {
                this.handleTransactionClick(row);
            }
        });

        // Panel filter listeners
        document.getElementById('categorieFilter').addEventListener('input', () => this.filterCategoriesPanel());
        document.getElementById('beneficiaireFilter').addEventListener('input', () => this.filterPayeesPanel());

        // Auto-focus on quick add modals
        const addCategoryModalEl = document.getElementById('addCategoryModal');
        if (addCategoryModalEl) {
            addCategoryModalEl.addEventListener('shown.bs.modal', () => {
                document.getElementById('newCategoryName').focus();
            });
        }

        const addPayeeModalEl = document.getElementById('addPayeeModal');
        if (addPayeeModalEl) {
            addPayeeModalEl.addEventListener('shown.bs.modal', () => {
                document.getElementById('newPayeeName').focus();
            });
        }

        // Sync event listener - auto-refresh when data changes via sync
        window.addEventListener('sync-data-changed', async (event) => {
            const { storeName, status } = event.detail;

            // Rafraîchir les transactions si c'est un mouvement
            if (storeName === 'MOUVEMENTS') {
                console.log(`🔄 Auto-refresh: ${status} in MOUVEMENTS`);
                await this.refreshTransactions();
            }

            // Rafraîchir le solde si c'est un compte
            if (storeName === 'COMPTES') {
                console.log(`🔄 Auto-refresh: ${status} in COMPTES`);
                await this.refreshAccountDisplay();
            }
        });
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            this.showLoading('Chargement des données...');

            const dashboardData = await ratchouApp.getDashboardData();

            this.currentAccount = dashboardData.currentAccount;
            this.allAccounts = dashboardData.allAccounts;
            this.recentTransactions = dashboardData.recentTransactions;

            // Verify that the current account exists in the list of accounts
            // (handles case where deleted account was the current one)
            const accountExists = this.allAccounts.some(acc => acc.id === this.currentAccount.id);
            if (!accountExists) {
                console.log('🏦 Compte courant introuvable - rechargement du compte par défaut');
                // Force reload current account (will fallback to principal)
                const freshAccount = await ratchouApp.getCurrentAccount();
                this.currentAccount = freshAccount;

                // Reload transactions for the new account
                this.recentTransactions = await ratchouApp.models.transactions.getRecentByAccount(freshAccount.id, 20);
                this.recentTransactions = await ratchouApp.models.transactions.getEnriched(this.recentTransactions);
            }

            // Load form data
            await this.loadFormData();

            // Update UI
            this.updateAccountDisplay();
            this.updateWeekNumber();
            this.updateTransactionsTable();
            this.toggleDuplicateCheckbox(); // Initial check

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Erreur de chargement: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Refresh transactions (called after sync)
     */
    async refreshTransactions() {
        try {
            if (!this.currentAccount) return;

            const transactions = await ratchouApp.models.transactions.getRecentByAccount(this.currentAccount.id, 20);
            this.recentTransactions = await ratchouApp.models.transactions.getEnriched(transactions);
            this.updateTransactionsTable();

            // Refresh account balance too since transactions affect it
            await this.refreshAccountBalance();
        } catch (error) {
            console.error('Error refreshing transactions:', error);
        }
    }

    /**
     * Refresh account display (called after sync)
     */
    async refreshAccountDisplay() {
        try {
            const updatedAccount = await ratchouApp.models.accounts.getById(this.currentAccount.id);
            if (updatedAccount) {
                this.currentAccount = updatedAccount;
                this.updateAccountDisplay();
            }
        } catch (error) {
            console.error('Error refreshing account display:', error);
        }
    }

    /**
     * Load form select data
     */
    async loadFormData() {
        try {
            // Load categories with appropriate sort
            if (this.categoriesSortMode === 'usage') {
                this.categories = await ratchouApp.models.categories.getAllSortedByUsage();
            } else {
                this.categories = await ratchouApp.models.categories.getAllSorted();
            }
            this.loadCategoriesPanel();

            // Load payees with appropriate sort
            if (this.payeesSortMode === 'usage') {
                this.payees = await ratchouApp.models.payees.getAllSortedByUsage();
            } else {
                this.payees = await ratchouApp.models.payees.getAllSorted();
            }
            this.loadPayeesPanel();

            // Load expense types
            this.expenseTypes = await ratchouApp.models.expenseTypes.getAllSorted();
            this.loadExpenseTypesPanel();

            // Set default expense type
            this.setDefaultExpenseType();

            // Set current account ID in form
            if (this.currentAccount) {
                document.getElementById('compte_id').value = this.currentAccount.id;
            }

        } catch (error) {
            console.error('Error loading form data:', error);
            this.showError('Erreur de chargement des formulaires: ' + error.message);
        }
    }

    /**
     * Handle transaction form submission
     */
    async handleTransactionSubmit() {
        try {
            if (!this.transactionForm.checkValidity()) {
                this.transactionForm.classList.add('was-validated');
                return;
            }

            const formData = new FormData(this.transactionForm);
            const montantValue = parseFloat(formData.get('montant'));
            const currency = this.currentAccount?.currency || 'EUR';

            const transactionData = {
                amount: RatchouUtils.currency.toStorageUnit(montantValue, currency),
                category_id: formData.get('categorie_id') || null,
                payee_id: formData.get('beneficiaire_id') || null,
                expense_type_id: formData.get('type_depense_id') || null,
                description: formData.get('rmq') || null,
                account_id: this.currentAccount.id
            };

            // Store old balance for animation
            const oldBalance = this.currentAccount.balance;
            
            this.setSubmitLoading(true);
            
            const result = await ratchouApp.models.transactions.create(transactionData);
            
            if (result.success) {
                // Duplicate transaction if checkbox is checked
                const duplicateCheckbox = document.getElementById('duplicate-transaction');
                if (duplicateCheckbox.checked) {
                    const duplicationResult = await ratchouApp.models.transactions.duplicateTransactionToMainAccount(result.data.id);
                    if (duplicationResult.success) {
                        // Pas de toast pour ne pas masquer l'animation du solde
                        // Need to refresh ALL accounts since duplication affects multiple accounts
                        await this.refreshAllAccountsBalance();
                    } else {
                        this.showError(duplicationResult.message);
                    }
                } else {
                    // Single account transaction, just refresh current account
                    await this.refreshAccountBalance();
                }

                // Animate balance update instead of showing toast
                const newBalance = this.currentAccount.balance;
                this.animateBalanceUpdate(oldBalance, newBalance, transactionData.amount);

                this.resetForm();
                await this.loadRecentTransactions(result.data.id); // Pass new transaction ID for animation
            } else {
                this.showError('Erreur: ' + result.message);
            }
            
        } catch (error) {
            console.error('Error creating transaction:', error);
            this.showError('Erreur de création: ' + error.message);
        } finally {
            this.setSubmitLoading(false);
        }
    }

    /**
     * Update account display in header
     */
    updateAccountDisplay() {
        if (!this.currentAccount) return;

        document.getElementById('currentAccountName').textContent = this.currentAccount.nom_compte;

        const currency = this.currentAccount.currency || 'EUR';
        const balance = RatchouUtils.currency.formatWithCurrency(this.currentAccount.balance, currency);
        const balanceElement = document.getElementById('currentAccountBalance');
        balanceElement.textContent = balance;

        // Set color based on balance
        balanceElement.className = 'account-balance ' +
            (this.currentAccount.balance >= 0 ? 'text-success' : 'text-danger');

        // Update amount input step based on currency
        this.updateAmountInputStep(currency);
    }

    /**
     * Update amount input step attribute based on currency
     * BTC needs 8 decimals, EUR/USD need 2 decimals
     */
    updateAmountInputStep(currency) {
        const amountInput = document.getElementById('montant');
        if (!amountInput) return;

        if (currency === 'BTC') {
            amountInput.step = '0.00000001'; // 1 satoshi
            amountInput.placeholder = '0.00000000';
        } else {
            amountInput.step = '0.01';
            amountInput.placeholder = '0.00';
        }
    }

    /**
     * Update the current week number display
     */
    updateWeekNumber() {
        const weekNumberElement = document.getElementById('currentWeekNumber');
        if (weekNumberElement) {
            const weekInfo = RatchouUtils.date.getWeekNumber(new Date());
            const weekLabel = RatchouUtils.date.formatWeek(weekInfo);
            weekNumberElement.textContent = weekLabel;
        }
    }

    /**
     * Update transactions table (with week separators)
     * @param {number|null} newTransactionId - ID of newly created transaction to animate
     */
    updateTransactionsTable(newTransactionId = null) {
        if (!this.recentTransactions || this.recentTransactions.length === 0) {
            this.transactionsTable.innerHTML = `
                <tr>
                    <td colspan="2" class="text-center p-4 text-muted">
                        Aucun mouvement récent
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        let lastWeekKey = null;

        // Pre-calculate totals by week
        const weekTotals = {};
        this.recentTransactions.forEach(transaction => {
            const weekKey = RatchouUtils.date.getWeekKey(transaction.date_mouvement);
            if (!weekTotals[weekKey]) {
                weekTotals[weekKey] = 0;
            }
            weekTotals[weekKey] += transaction.amount;
        });

        this.recentTransactions.forEach(transaction => {
            // Check if we need to add week separator
            const weekKey = RatchouUtils.date.getWeekKey(transaction.date_mouvement);
            if (weekKey !== lastWeekKey) {
                const weekInfo = RatchouUtils.date.getWeekNumber(transaction.date_mouvement);
                const weekLabel = RatchouUtils.date.formatWeek(weekInfo);

                // Calculate week total
                const weekTotal = weekTotals[weekKey] || 0;
                const currency = this.currentAccount?.currency || 'EUR';
                const totalValue = RatchouUtils.currency.fromStorageUnit(weekTotal, currency);

                // Colored rounded badge (only if total != 0)
                let badgeHtml = '';
                if (totalValue !== 0) {
                    const formattedTotal = RatchouUtils.currency.formatWithCurrency(weekTotal, currency);
                    const badgeClass = totalValue > 0 ? 'bg-success' : 'bg-danger';
                    const badgeText = totalValue > 0 ? `+${formattedTotal}` : formattedTotal;
                    badgeHtml = `<span class="badge rounded-pill ${badgeClass} ms-2">${badgeText}</span>`;
                }

                html += `
                    <tr class="week-separator">
                        <td colspan="2" class="text-center fw-bold py-2 bg-body-secondary text-body">
                            📅 ${weekLabel} ${badgeHtml}
                        </td>
                    </tr>
                `;
                lastWeekKey = weekKey;
            }

            const transactionDate = new Date(transaction.date_mouvement).toLocaleDateString('fr-FR');
            const transactionTime = new Date(transaction.date_mouvement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

            // Use the current account's currency for display
            const currency = this.currentAccount?.currency || 'EUR';
            const amount = RatchouUtils.currency.formatWithCurrency(transaction.amount, currency);
            const amountValue = RatchouUtils.currency.fromStorageUnit(transaction.amount, currency);
            const amountClass = amountValue >= 0 ? 'amount-positive' : 'amount-negative';

            const isNewTransaction = newTransactionId && transaction.id == newTransactionId;
            const animationClass = isNewTransaction ? 'movement-new' + (amountValue < 0 ? ' expense' : '') : '';

            html += `
                <tr class="movement-row ${animationClass}" data-transaction-id="${transaction.id}" onclick="editMovement('${transaction.id}')">
                    <td class="text-center" style="width: 100px;">
                        <span class="${amountClass}">${amount}</span>
                        <br><small class="text-muted">${transactionDate} ${transactionTime}</small>
                    </td>
                    <td>
                        <div class="fw-bold">
                            ${transaction.category_name || 'N/A'}
                            ${transaction.recurring_expense_id ? '<span class="badge bg-secondary ms-1" title="Dépense récurrente automatique">🔄</span>' : ''}
                        </div>
                        <small class="text-muted">${transaction.payee_name || 'N/A'} - ${transaction.expense_type_name || 'N/A'}</small>
                    </td>
                </tr>
            `;
        });

        this.transactionsTable.innerHTML = html;

        // If a new transaction was added, set up animation cleanup
        if (newTransactionId) {
            this.setupNewTransactionAnimation(newTransactionId);
        }
    }

    /**
     * Setup animation cleanup for newly added transaction
     * @param {number} transactionId - ID of the new transaction
     */
    setupNewTransactionAnimation(transactionId) {
        // Find the transaction row
        const transactionRow = document.querySelector(`tr[data-transaction-id="${transactionId}"]`);
        if (!transactionRow) return;

        // Remove animation classes after 3.5 seconds (0.5s animation + 3s highlight)
        setTimeout(() => {
            if (transactionRow && transactionRow.classList.contains('movement-new')) {
                transactionRow.classList.add('fade-to-normal');

                // Remove all animation classes after transition completes
                setTimeout(() => {
                    if (transactionRow) {
                        transactionRow.classList.remove('movement-new', 'expense', 'fade-to-normal');
                    }
                }, 3000); // Wait for background transition to complete
            }
        }, 500); // Wait for insert animation to complete
    }

    /**
     * Open account select modal (load data first, then show modal)
     */
    async openAccountSelectModal() {
        try {
            // Load fresh data BEFORE showing the modal
            await this.loadAccountsList();
            
            // Now show the modal with correct data
            this.accountSelectModal.show();
        } catch (error) {
            console.error('Error opening account select modal:', error);
            this.showError('Erreur lors du chargement des comptes: ' + error.message);
        }
    }

    /**
     * Load accounts list in modal
     */
    async loadAccountsList() {
        try {
            const accountsList = document.getElementById('accountsList');
            
            // Show loading state immediately
            accountsList.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <div class="mt-2 small text-muted">Mise à jour des soldes...</div>
                </div>
            `;
            
            // Get fresh accounts data from database to ensure latest balances
            const freshAccounts = await ratchouApp.models.accounts.getAll();

            if (freshAccounts.length === 0) {
                accountsList.innerHTML = '<p class="text-muted text-center">Aucun compte disponible</p>';
                return;
            }

            // Trier les comptes : principal en premier, puis par ordre alphabétique
            const sortedAccounts = freshAccounts.sort((a, b) => {
                // Le compte principal passe toujours en premier
                if (a.is_principal && !b.is_principal) return -1;
                if (!a.is_principal && b.is_principal) return 1;

                // Pour les comptes non-principaux, tri alphabétique
                return a.nom_compte.localeCompare(b.nom_compte);
            });

            // Update our cache with fresh data
            this.allAccounts = sortedAccounts;
            
            // Also update current account with fresh data if it exists in the list
            const updatedCurrentAccount = sortedAccounts.find(acc => acc.id === this.currentAccount?.id);
            if (updatedCurrentAccount) {
                this.currentAccount = updatedCurrentAccount;
                // Update the display in the header with fresh balance
                this.updateAccountDisplay();
            }

            accountsList.innerHTML = sortedAccounts.map(account => {
                const currency = account.currency || 'EUR';
                const balance = RatchouUtils.currency.formatWithCurrency(account.balance, currency);
                const balanceAmount = RatchouUtils.currency.fromStorageUnit(account.balance, currency);
                const isSelected = account.id === this.currentAccount.id;
                const balanceClass = balanceAmount >= 0 ? 'text-success' : 'text-danger';

                return `
                    <div class="account-item d-flex justify-content-between align-items-center p-3 border-bottom ${isSelected ? 'bg-primary bg-opacity-10' : ''}"
                         style="cursor: pointer;"
                         data-account-id="${account.id}">
                        <div>
                            <strong>${account.nom_compte}</strong>
                            ${account.is_principal ? '<span class="badge bg-primary ms-2">Principal</span>' : ''}
                        </div>
                        <div class="fw-bold ${balanceClass}">${balance}</div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            accountsList.addEventListener('click', (e) => {
                const accountItem = e.target.closest('.account-item');
                if (accountItem) {
                    const accountId = accountItem.dataset.accountId;
                    this.selectAccount(accountId);
                }
            });
            
        } catch (error) {
            console.error('Error loading accounts list:', error);
            document.getElementById('accountsList').innerHTML = 
                '<div class="alert alert-danger">Erreur de chargement</div>';
        }
    }

    /**
     * Select account
     */
    async selectAccount(accountId) {
        try {
            // Get fresh account data from database to ensure latest balance
            const account = await ratchouApp.models.accounts.getById(accountId);
            if (!account) {
                this.showError('Compte non trouvé');
                return;
            }

            this.currentAccount = account;
            ratchouApp.setCurrentAccount(accountId);
            
            // Also update the account in our cache
            const accountIndex = this.allAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                this.allAccounts[accountIndex] = account;
            }
            
            this.updateAccountDisplay();
            this.toggleDuplicateCheckbox(); // Show/hide checkbox based on account
            await this.loadRecentTransactions();
            
            this.accountSelectModal.hide();
            
        } catch (error) {
            console.error('Error selecting account:', error);
            this.showError('Erreur de sélection: ' + error.message);
        }
    }

    /**
     * Load recent transactions for current account
     * @param {number|null} newTransactionId - ID of newly created transaction to animate
     */
    async loadRecentTransactions(newTransactionId = null) {
        try {
            if (!this.currentAccount) return; 
            
            const transactions = await ratchouApp.models.transactions.getRecentByAccount(this.currentAccount.id, 20);
            this.recentTransactions = await ratchouApp.models.transactions.getEnriched(transactions);

            this.updateTransactionsTable(newTransactionId);
            
        } catch (error) {
            console.error('Error loading recent transactions:', error);
            this.showError('Erreur de chargement des mouvements: ' + error.message);
        }
    }

    /**
     * Refresh account balance
     */
    async refreshAccountBalance() {
        try {
            const updatedAccount = await ratchouApp.models.accounts.getById(this.currentAccount.id);
            if (updatedAccount) {
                this.currentAccount = updatedAccount;
                this.updateAccountDisplay();
                
                // Also update the account in our cache
                const accountIndex = this.allAccounts.findIndex(acc => acc.id === this.currentAccount.id);
                if (accountIndex !== -1) {
                    this.allAccounts[accountIndex] = updatedAccount;
                }
            }
        } catch (error) {
            console.error('Error refreshing balance:', error);
        }
    }

    /**
     * Refresh all accounts balances (after transactions that might affect multiple accounts)
     */
    async refreshAllAccountsBalance() {
        try {
            // Get fresh data for all accounts
            const freshAccounts = await ratchouApp.models.accounts.getAll();
            this.allAccounts = freshAccounts;
            
            // Update current account if it exists
            const updatedCurrentAccount = freshAccounts.find(acc => acc.id === this.currentAccount?.id);
            if (updatedCurrentAccount) {
                this.currentAccount = updatedCurrentAccount;
                this.updateAccountDisplay();
            }
        } catch (error) {
            console.error('Error refreshing all accounts balance:', error);
        }
    }

    /**
     * Setup balance correction modal
     */
    /**
     * Evaluate a balance expression (simple addition/subtraction)
     * @param {string} input - Expression like "200-118" or "200+20" or "-1420+20"
     * @returns {object} { valid: boolean, result: number|null, error: string|null }
     */
    evaluateBalanceExpression(input) {
        if (!input || typeof input !== 'string') {
            return { valid: false, result: null, error: 'Entrée invalide' };
        }

        const trimmed = input.trim();

        // Validate characters (only digits, ., +, -, spaces)
        if (!/^[\d.\s+\-]+$/.test(trimmed)) {
            return { valid: false, result: null, error: 'Caractères non autorisés' };
        }

        // Check if it's a simple number (no operators)
        if (!trimmed.includes('+') && !trimmed.includes('-')) {
            const num = parseFloat(trimmed);
            return isNaN(num)
                ? { valid: false, result: null, error: 'Nombre invalide' }
                : { valid: true, result: num, error: null };
        }

        // Parse and calculate - handles negative numbers like "-1420+20"
        try {
            // Match: optional sign, then digits/dots, repeated with operators
            // Examples: "-1420", "+20", "50", "-30.5"
            const parts = trimmed.match(/[+\-]?[\d.]+/g);

            if (!parts || parts.length === 0) {
                return { valid: false, result: null, error: 'Expression invalide' };
            }

            // First number
            let result = parseFloat(parts[0]);
            if (isNaN(result)) {
                return { valid: false, result: null, error: 'Expression invalide' };
            }

            // Process remaining parts (each starts with + or -)
            for (let i = 1; i < parts.length; i++) {
                const num = parseFloat(parts[i]);
                if (isNaN(num)) {
                    return { valid: false, result: null, error: 'Expression invalide' };
                }
                result += num; // parseFloat handles the sign correctly
            }

            return { valid: true, result, error: null };
        } catch (error) {
            return { valid: false, result: null, error: 'Erreur de calcul' };
        }
    }

    setupBalanceModal() {
        if (!this.currentAccount) return;

        const currentBalanceSpan = document.getElementById('currentBalance');
        const newBalanceInput = document.getElementById('newBalance');
        const calculatedResult = document.getElementById('calculatedResult');
        const updateBalanceBtn = document.getElementById('updateBalanceBtn');

        const currency = this.currentAccount.currency || 'EUR';
        const currentBalance = RatchouUtils.currency.fromStorageUnit(this.currentAccount.balance, currency);
        currentBalanceSpan.textContent = RatchouUtils.currency.formatWithCurrency(this.currentAccount.balance, currency);

        // Set appropriate decimal places for the input
        const decimals = currency === 'BTC' ? 8 : 2;
        newBalanceInput.value = currentBalance.toFixed(decimals);
        newBalanceInput.focus();
        newBalanceInput.select();

        // Hide calculated result initially
        calculatedResult.classList.add('d-none');

        // Remove previous event listeners if any
        if (this.balanceCalculationHandler) {
            newBalanceInput.removeEventListener('input', this.balanceCalculationHandler);
        }
        if (this.balanceEnterHandler) {
            newBalanceInput.removeEventListener('keydown', this.balanceEnterHandler);
        }

        // Real-time calculation display
        this.balanceCalculationHandler = () => {
            const input = newBalanceInput.value.trim();
            const evaluation = this.evaluateBalanceExpression(input);

            // Show result only if expression contains operators
            const hasOperators = input.includes('+') || input.includes('-');

            if (hasOperators && evaluation.valid) {
                const storageAmount = RatchouUtils.currency.toStorageUnit(evaluation.result, currency);
                const formatted = RatchouUtils.currency.formatWithCurrency(storageAmount, currency);
                calculatedResult.innerHTML = `Résultat du calcul : <strong>${formatted}</strong>`;
                calculatedResult.classList.remove('d-none');
            } else {
                calculatedResult.classList.add('d-none');
            }
        };

        // Handle Enter key to submit
        this.balanceEnterHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateBalanceBtn.click();
            }
        };

        // Attach event listeners
        newBalanceInput.addEventListener('input', this.balanceCalculationHandler);
        newBalanceInput.addEventListener('keydown', this.balanceEnterHandler);
    }

    /**
     * Handle balance update
     */
    async handleBalanceUpdate() {
        try {
            const newBalanceInput = document.getElementById('newBalance');
            const input = newBalanceInput.value.trim();

            // Evaluate expression or simple number
            const evaluation = this.evaluateBalanceExpression(input);

            if (!evaluation.valid) {
                this.showError('Veuillez saisir un montant ou calcul valide');
                return;
            }

            const currency = this.currentAccount.currency || 'EUR';
            const newBalance = evaluation.result;

            console.log('💰 Balance expression evaluated:', { input, newBalance, currency });

            const result = await ratchouApp.models.accounts.updateBalance(this.currentAccount.id, newBalance);

            if (result.success) {
                this.currentAccount = result.data;
                this.updateAccountDisplay();
                this.balanceModal.hide();
                this.showSuccess('Solde mis à jour avec succès');
            } else {
                this.showError('Erreur: ' + result.message);
            }

        } catch (error) {
            console.error('Error updating balance:', error);
            this.showError('Erreur de mise à jour: ' + error.message);
        }
    }

    /**
     * Handle access code change
     */
    async handleAccessCodeChange() {
        try {
            const currentCode = document.getElementById('currentCode').value;
            const newCode = document.getElementById('newCode').value;
            const confirmCode = document.getElementById('confirmCode').value;
            
            if (!currentCode || !newCode || !confirmCode) {
                this.showError('Veuillez remplir tous les champs');
                return;
            }
            
            if (newCode !== confirmCode) {
                this.showError('Les nouveaux codes ne correspondent pas');
                return;
            }
            
            if (!/^\d{4}$/.test(newCode)) {
                this.showError('Le nouveau code doit contenir exactement 4 chiffres');
                return;
            }


            const result = await ratchouApp.changeAccessCode(currentCode, newCode);
            
            if (result.success) {
                document.getElementById('accessCodeForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('accessCodeModal')).hide();
                this.showSuccess('Code d\'accès modifié avec succès');
            } else {
                this.showError('Erreur: ' + result.message);
            }
            
        } catch (error) {
            console.error('Error changing access code:', error);
            this.showError('Erreur de modification: ' + error.message);
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        const result = ratchouApp.logout();
        if (result.success) {
            this.redirectToLogin();
        }
    }

    /**
     * Handle transaction row click
     */
    async handleTransactionClick(row) {
        const transactionId = row.dataset.transactionId;
        console.log('Transaction clicked:', transactionId);
        await this.editMovement(transactionId);
    }

    /**
     * Edit movement (load data into modal)
     */
    async editMovement(transactionId) {
        try {
            this.showLoading('Chargement de la transaction...');
            
            // Get transaction details
            const transaction = await ratchouApp.models.transactions.getById(transactionId);
            if (!transaction) {
                this.showError('Transaction non trouvée');
                return;
            }

            // Get enriched data (with category/payee/expense_type names)
            const enriched = await ratchouApp.models.transactions.getEnriched([transaction]);
            const enrichedTransaction = enriched[0];
            
            // Get transaction account to determine currency
            const transactionAccount = this.allAccounts.find(acc => acc.id === transaction.account_id);
            const currency = transactionAccount?.currency || 'EUR';

            // Fill form fields
            document.getElementById('edit_movement_id').value = transaction.id;

            // Convert amount using currency-aware conversion
            const amountValue = RatchouUtils.currency.fromStorageUnit(transaction.amount, currency);
            const editMontantInput = document.getElementById('edit_montant');

            // Set appropriate input step and value based on currency
            if (currency === 'BTC') {
                editMontantInput.step = '0.00000001';
                editMontantInput.value = amountValue.toFixed(8);
            } else {
                editMontantInput.step = '0.01';
                editMontantInput.value = amountValue.toFixed(2);
            }

            // Update currency symbol
            const currencySymbol = RatchouUtils.currency.getSymbol(currency);
            document.getElementById('edit_currency_symbol').textContent = currencySymbol;

            document.getElementById('edit_categorie_id').value = transaction.category_id || '';
            document.getElementById('edit_beneficiaire_id').value = transaction.payee_id || '';
            document.getElementById('edit_type_depense_id').value = transaction.expense_type_id || '';
            document.getElementById('edit_rmq').value = transaction.description || '';

            // Fill date and time fields
            if (transaction.date_mouvement) {
                const dateObj = new Date(transaction.date_mouvement);
                const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = dateObj.toTimeString().slice(0, 5); // HH:MM
                document.getElementById('edit_date').value = dateStr;
                document.getElementById('edit_time').value = timeStr;
            }

            // Update button texts
            this.updateEditButtons(enrichedTransaction);

            // Show/hide the duplicate button
            const duplicateBtn = document.getElementById('duplicateToMainBtn');
            if (transactionAccount && !transactionAccount.is_principal) {
                duplicateBtn.style.display = 'block';
            } else {
                duplicateBtn.style.display = 'none';
            }

            // Show modal
            this.editMovementModal.show();
            
        } catch (error) {
            console.error('Error loading transaction for edit:', error);
            this.showError('Erreur de chargement: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Update edit modal buttons with current selection
     */
    updateEditButtons(transaction) {
        // Update category button
        const catButton = document.querySelector('#editMovementModal [data-input-target="edit_categorie_id"]');
        if (transaction.category_name) {
            catButton.innerHTML = `📂 ${transaction.category_name}`;
            catButton.classList.remove('btn-outline-primary');
            catButton.classList.add('btn-primary');
        } else {
            catButton.innerHTML = '📂 Sélectionner...';
            catButton.classList.remove('btn-primary');
            catButton.classList.add('btn-outline-primary');
        }

        // Update payee button
        const payeeButton = document.querySelector('#editMovementModal [data-input-target="edit_beneficiaire_id"]');
        if (transaction.payee_name) {
            payeeButton.innerHTML = `👥 ${transaction.payee_name}`;
            payeeButton.classList.remove('btn-outline-primary');
            payeeButton.classList.add('btn-primary');
        } else {
            payeeButton.innerHTML = '👥 Sélectionner...';
            payeeButton.classList.remove('btn-primary');
            payeeButton.classList.add('btn-outline-primary');
        }

        // Update expense type button
        const typeButton = document.querySelector('#editMovementModal [data-input-target="edit_type_depense_id"]');
        if (transaction.expense_type_name) {
            typeButton.innerHTML = `💳 ${transaction.expense_type_name}`;
            typeButton.classList.remove('btn-outline-primary');
            typeButton.classList.add('btn-primary');
        } else {
            typeButton.innerHTML = '💳 Sélectionner...';
            typeButton.classList.remove('btn-primary');
            typeButton.classList.add('btn-outline-primary');
        }
    }

    /**
     * Handle movement update
     */
    async handleMovementUpdate() {
        try {
            const form = document.getElementById('editMovementForm');
            const formData = new FormData(form);

            // Get the transaction to determine its currency
            const transactionId = formData.get('movement_id');
            const transaction = await ratchouApp.models.transactions.getById(transactionId);
            const transactionAccount = this.allAccounts.find(acc => acc.id === transaction.account_id);
            const currency = transactionAccount?.currency || 'EUR';

            // Convert amount using currency-aware conversion
            const montantValue = parseFloat(formData.get('montant'));

            // Combine date and time into ISO format
            const dateStr = formData.get('date');
            const timeStr = formData.get('time');
            let dateMovement = transaction.date_mouvement; // Keep original if not provided
            if (dateStr && timeStr) {
                dateMovement = `${dateStr}T${timeStr}:00`;
            }

            const updateData = {
                id: transactionId,
                amount: RatchouUtils.currency.toStorageUnit(montantValue, currency),
                date_mouvement: dateMovement,
                category_id: formData.get('categorie_id') || null,
                payee_id: formData.get('beneficiaire_id') || null,
                expense_type_id: formData.get('type_depense_id') || null,
                description: formData.get('rmq') || null
            };

            const result = await ratchouApp.models.transactions.update(updateData.id, updateData);
            
            if (result.success) {
                this.editMovementModal.hide();
                this.showSuccess('Transaction mise à jour avec succès');
                await this.refreshAllAccountsBalance(); // Refresh all accounts in case transaction affects multiple
                await this.loadRecentTransactions();
            } else {
                this.showError('Erreur: ' + result.message);
            }
            
        } catch (error) {
            console.error('Error updating transaction:', error);
            this.showError('Erreur de mise à jour: ' + error.message);
        }
    }

    /**
     * Handle movement delete
     */
    async handleMovementDelete() {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
            return;
        }

        try {
            const transactionId = document.getElementById('edit_movement_id').value;
            
            const result = await ratchouApp.models.transactions.delete(transactionId);
            
            if (result.success) {
                this.editMovementModal.hide();
                this.showSuccess('Transaction supprimée avec succès');
                await this.refreshAllAccountsBalance(); // Refresh all accounts 
                await this.loadRecentTransactions();
            } else {
                this.showError('Erreur: ' + result.message);
            }
            
        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.showError('Erreur de suppression: ' + error.message);
        }
    }

    /**
     * Handle movement duplication to main account
     */
    async handleMovementDuplicate() {
        try {
            const transactionId = document.getElementById('edit_movement_id').value;
            const duplicationResult = await ratchouApp.models.transactions.duplicateTransactionToMainAccount(transactionId);

            if (duplicationResult.success) {
                // Pas de toast pour ne pas masquer l'animation du solde
                // Refresh all accounts since duplication affects multiple accounts
                await this.refreshAllAccountsBalance();
                // Optionally, close the modal and refresh, or just disable the button
                document.getElementById('duplicateToMainBtn').disabled = true;
                document.getElementById('duplicateToMainBtn').textContent = 'Dupliqué ✓';
                await this.loadRecentTransactions(); // Refresh list to show new transaction if it's on the main account
            } else {
                this.showError(duplicationResult.message);
            }
        } catch (error) {
            console.error('Error duplicating transaction:', error);
            this.showError('Erreur de duplication: ' + error.message);
        }
    }

    // Export method removed - now handled by import-export.js module

    // Import method removed - now handled by import-export.js module

    // Import helper methods removed - now handled by import-export.js module

    // =================================================================
    // Panel Management Methods
    // =================================================================

    /**
     * Setup panel buttons event listeners
     */
    setupPanelButtons() {
        document.querySelectorAll('[data-panel-target]').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-panel-target');
                const inputTarget = e.currentTarget.getAttribute('data-input-target');
                this.openPanel(target, inputTarget, e.currentTarget);
            });
        });

        // Setup sort toggle buttons
        const categoriesSortBtn = document.getElementById('categoriesSortToggleBtn');
        if (categoriesSortBtn) {
            categoriesSortBtn.addEventListener('click', () => {
                this.toggleCategoriesSortMode();
            });
        }

        const payeesSortBtn = document.getElementById('payeesSortToggleBtn');
        if (payeesSortBtn) {
            payeesSortBtn.addEventListener('click', () => {
                this.togglePayeesSortMode();
            });
        }

        // Update button appearances based on current sort modes
        this.updateSortButtons();
    }

    /**
     * Open selection panel
     */
    openPanel(panelId, inputId, button) {
        // When opening a panel from the edit modal, deactivate the modal's focus trap
        if (this.editMovementModal && this.editMovementModal._isShown && this.editMovementModal._focustrap) {
            this.editMovementModal._focustrap.deactivate();
        }

        this.currentPanelButton = button;
        this.currentPanelInput = inputId;

        // Close other panels without re-activating focus trap
        document.querySelectorAll('.panel-slide').forEach(panel => {
            if (`#${panel.id}` !== panelId) {
                panel.classList.remove('show');
            }
        });
        
        // Show backdrop
        const backdrop = document.getElementById('panelBackdrop');
        if (backdrop) {
            backdrop.classList.add('show');
        }
        
        // Open the selected panel
        const panel = document.querySelector(panelId);
        if (panel) {
            // Highlight the currently selected item
            const currentId = document.getElementById(inputId).value;
            panel.querySelectorAll('.list-group-item-action').forEach(item => {
                item.classList.remove('active');
            });
            if (currentId) {
                const activeItem = panel.querySelector(`[data-id="${currentId}"]`);
                if (activeItem) {
                    activeItem.classList.add('active');
                }
            }

            panel.classList.add('show');
            const filterInput = panel.querySelector('input[placeholder^="Filtrer"]');
            if (filterInput) {
                // Only focus on non-touch devices to avoid bringing up the virtual keyboard
                const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                if (!isTouchDevice) {
                    setTimeout(() => filterInput.focus(), 300);
                }
            }
        }
    }

    /**
     * Close all panels
     */
    closePanels() {
        document.querySelectorAll('.panel-slide').forEach(panel => {
            panel.classList.remove('show');
        });

        // Hide backdrop
        const backdrop = document.getElementById('panelBackdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }

        // If the edit modal is open, reactivate its focus trap
        if (this.editMovementModal._isShown) {
            this.editMovementModal._focustrap.activate();
        }
    }

    /**
     * Load categories into panel
     */
    loadCategoriesPanel() {
        const categoriesList = document.getElementById('categorieList');
        categoriesList.innerHTML = '';
        if (!this.categories || this.categories.length === 0) {
            categoriesList.innerHTML = '<div class="text-center p-3 text-muted">Aucune catégorie</div>';
            return;
        }
        this.categories.forEach(category => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action';
            const usageDisplay = this.categoriesSortMode === 'usage' && (category.usage_count || 0) > 0 ? 
                ` <small class="text-muted">(${category.usage_count || 0})</small>` : '';
            item.innerHTML = `📂 ${category.libelle}`;
            item.setAttribute('data-id', category.id);
            item.addEventListener('click', () => this.selectPanelItem(category.id, category.libelle, '📂'));
            categoriesList.appendChild(item);
        });
    }

    /**
     * Load payees into panel
     */
    loadPayeesPanel() {
        const beneficiairesList = document.getElementById('beneficiaireList');
        beneficiairesList.innerHTML = '';
        if (!this.payees || this.payees.length === 0) {
            beneficiairesList.innerHTML = '<div class="text-center p-3 text-muted">Aucun bénéficiaire</div>';
            return;
        }
        this.payees.forEach(payee => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action';
            const usageDisplay = this.payeesSortMode === 'usage' && (payee.usage_count || 0) > 0 ? 
                ` <small class="text-muted">(${payee.usage_count || 0})</small>` : '';
            item.innerHTML = `👥 ${payee.libelle}`;
            item.setAttribute('data-id', payee.id);
            item.addEventListener('click', () => this.selectPanelItem(payee.id, payee.libelle, '👥'));
            beneficiairesList.appendChild(item);
        });
    }

    /**
     * Load expense types into panel
     */
    loadExpenseTypesPanel() {
        const typeDepensesList = document.getElementById('typeDepenseList');
        typeDepensesList.innerHTML = '';
        if (!this.expenseTypes || this.expenseTypes.length === 0) {
            typeDepensesList.innerHTML = '<div class="text-center p-3 text-muted">Aucun type</div>';
            return;
        }
        this.expenseTypes.forEach(type => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = `💳 ${type.libelle}`;
            item.setAttribute('data-id', type.id);
            item.addEventListener('click', () => this.selectPanelItem(type.id, type.libelle, '💳'));
            typeDepensesList.appendChild(item);
        });
    }

    /**
     * Generic item selection from a panel
     */
    selectPanelItem(value, label, icon) {
        const input = document.getElementById(this.currentPanelInput);
        const currentValue = input.value;

        // If clicking the same item, deselect it
        if (currentValue === value && value !== '') {
            input.value = '';
            const originalText = this.currentPanelButton.getAttribute('data-original-text');
            const originalIcon = this.currentPanelButton.getAttribute('data-icon');
            this.currentPanelButton.innerHTML = `${originalIcon} ${originalText}`;
            this.currentPanelButton.classList.remove('btn-primary');
            this.currentPanelButton.classList.add('btn-outline-primary');
        } else {
            input.value = value;
            const buttonText = value ? `${icon} ${label}` : `${icon} ${this.currentPanelButton.getAttribute('data-original-text')}`;
            this.currentPanelButton.innerHTML = buttonText;

            if (value) {
                this.currentPanelButton.classList.remove('btn-outline-primary');
                this.currentPanelButton.classList.add('btn-primary');
            } else {
                this.currentPanelButton.classList.remove('btn-primary');
                this.currentPanelButton.classList.add('btn-outline-primary');
            }
        }
        
        this.closePanels();
    }

    /**
     * Save remark from modal
     */
    saveRemarque() {
        const remarque = document.getElementById('remarqueText').value;
        document.getElementById('rmq').value = remarque;
        
        const button = document.querySelector('[data-bs-target="#remarqueModal"]');
        if (remarque.trim()) {
            button.innerHTML = `📝 Remarque ✓`;
            button.classList.remove('btn-outline-primary');
            button.classList.add('btn-primary');
        } else {
            button.innerHTML = `📝 Remarque`;
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('remarqueModal')).hide();
    }

    /**
     * Set default expense type
     */
    setDefaultExpenseType() {
        if (!this.expenseTypes || this.expenseTypes.length === 0) return; 
        
        const defaultType = this.expenseTypes.find(type => type.is_default);
        if (defaultType) {
            document.getElementById('type_depense_id').value = defaultType.id;
            
            const button = document.querySelector('[data-input-target="type_depense_id"]');
            if (button) {
                button.innerHTML = `💳 ${defaultType.libelle}`;
                button.classList.remove('btn-outline-primary');
                button.classList.add('btn-primary');
            }
        }
    }

    // =================================================================
    // UI Helper Methods
    // =================================================================

    /**
     * Reset transaction form (renamed from clearForm)
     */
    resetForm() {
        this.transactionForm.reset();
        this.transactionForm.classList.remove('was-validated');
        
        // Explicitly clear all hidden form fields to prevent panel selection persistence
        document.getElementById('categorie_id').value = '';
        document.getElementById('beneficiaire_id').value = '';
        document.getElementById('type_depense_id').value = '';
        document.getElementById('rmq').value = '';
        
        // Reset all button styles to original
        const buttons = [
            document.querySelector('[data-panel-target="#categoriePanel"]'),
            document.querySelector('[data-panel-target="#beneficiairePanel"]'),
            document.querySelector('[data-panel-target="#typeDepensePanel"]'),
            document.querySelector('[data-bs-target="#remarqueModal"]')
        ];
        
        buttons.forEach(button => {
            if (button) {
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-primary');
                // Reset text from data attributes
                const icon = button.dataset.icon;
                const text = button.dataset.originalText;
                if (icon && text) {
                    button.innerHTML = `${icon} ${text}`;
                }
            }
        });
        
        // Clear remark modal
        document.getElementById('remarqueText').value = '';

        // Set default expense type again
        this.setDefaultExpenseType();

        // Restore duplicate checkbox state based on account configuration
        this.toggleDuplicateCheckbox();
        
        // Set current account
        if (this.currentAccount) {
            document.getElementById('compte_id').value = this.currentAccount.id;
        }
        
    }

    /**
     * Setup form validation
     */
    setupFormValidation() {
        // Bootstrap validation
        this.transactionForm.classList.add('needs-validation');
        
        // Simple validation for amount - just check it's a valid number
        const amountInput = document.getElementById('montant');
        amountInput.addEventListener('input', () => {
            const value = parseFloat(amountInput.value);
            if (isNaN(value)) {
                amountInput.setCustomValidity('Veuillez saisir un montant valide');
            } else {
                amountInput.setCustomValidity('');
            }
        });
    }

    /**
     * Format amount input
     */
    formatAmountInput(input) {
        let value = input.value;
        
        // Keep track of negative sign at start
        const isNegative = value.startsWith('-');
        
        // Remove all non-numeric characters except decimal point
        value = value.replace(/[^\d.,]/g, '');
        
        // Replace comma with dot for decimal
        value = value.replace(',', '.');
        
        // Ensure only one decimal point
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Add back negative sign if it was there
        if (isNegative && value !== '') {
            value = '-' + value;
        }
        
        input.value = value;
    }

    /**
     * Truncate text with ellipsis
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Set submit button loading state
     */
    setSubmitLoading(loading) {
        const btn = document.getElementById('submitBtn');
        
        if (loading) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Enregistrement...';
        } else {
            btn.disabled = false;
            btn.innerHTML = 'Enregistrer';
        }
    }

    /**
     * Show/hide loading overlay
     */
    showLoading(message = 'Chargement...') {
        document.getElementById('loadingMessage').textContent = message;
        this.loadingOverlay.style.display = 'block';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        if (location.pathname.endsWith('index.html')) {
            return; // Already on login page
        }
        location.replace('index.html');
    }

    /**
     * Animate balance update with counter effect (vanilla JS)
     */
    animateBalanceUpdate(oldBalance, newBalance, transactionAmount) {
        const balanceElement = document.getElementById('currentAccountBalance');
        if (!balanceElement) return;

        // Determine color class based on transaction amount (not balance difference)
        const isPositive = transactionAmount >= 0;
        const colorClass = isPositive ? 'balance-animating-positive' : 'balance-animating-negative';

        // Convert to display amount for animation
        const currency = this.currentAccount?.currency || 'EUR';
        const oldBalanceAmount = RatchouUtils.currency.fromStorageUnit(oldBalance, currency);
        const newBalanceAmount = RatchouUtils.currency.fromStorageUnit(newBalance, currency);
        
        // Add color class during animation
        balanceElement.classList.add(colorClass);
        
        // Animation parameters
        const duration = 800; // 800ms like the jQuery example
        const startTime = performance.now();
        const difference = newBalanceAmount - oldBalanceAmount;

        // Animation function
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (similar to jQuery swing)
            const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;

            // Calculate current value
            const currentValue = oldBalanceAmount + (difference * easeProgress);

            // Update display with formatted currency
            const currentValueInStorage = RatchouUtils.currency.toStorageUnit(currentValue, currency);
            balanceElement.textContent = RatchouUtils.currency.formatWithCurrency(currentValueInStorage, currency);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - clean up
                setTimeout(() => {
                    balanceElement.classList.remove(colorClass);
                    
                    // Restore normal color based on final balance
                    balanceElement.className = 'account-balance ' + 
                        (newBalance >= 0 ? 'text-success' : 'text-danger');
                }, 200); // Small delay before removing color
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        // Log for debugging
        const oldBalFormatted = RatchouUtils.currency.formatWithCurrency(oldBalance, currency);
        const newBalFormatted = RatchouUtils.currency.formatWithCurrency(newBalance, currency);
        const transAmountFormatted = RatchouUtils.currency.formatWithCurrency(Math.abs(transactionAmount), currency);
        console.log(`Balance animated: ${oldBalFormatted} → ${newBalFormatted} (transaction: ${isPositive ? '+' : '-'}${transAmountFormatted})`);
    }

    /**
     * Toast notifications (simple alerts for now)
     */
    showSuccess(message) {
        // TODO: Replace with toast notifications
        console.log('Success:', message);
        
        // Simple alert for now
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 end-0 m-3';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            <i class="me-2">✅</i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    showError(message) {
        console.error('Error:', message);
        
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 end-0 m-3';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            <i class="me-2">⚠️</i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 7000);
    }

    showInfo(message) {
        console.log('Info:', message);
        
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-info alert-dismissible fade show position-fixed top-0 end-0 m-3';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            <i class="me-2">ℹ️</i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 4000);
    }

    // =================================================================
    // Financial Projection Methods
    // =================================================================

    /**
     * Load and display financial projection for specified period
     */
    async loadFinancialProjection(days = 7) {
        try {
            const timelineContent = document.getElementById('timelineContent');
            
            // Show loading state
            timelineContent.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <div class="mt-2">Calcul de la projection pour ${days} jours...</div>
                </div>
            `;
            
            // Get current account balance
            const currentBalance = this.currentAccount ? this.currentAccount.balance : 0;
            const currency = this.currentAccount?.currency || 'EUR';
            const currentBalanceInEuros = RatchouUtils.currency.fromStorageUnit(currentBalance, currency);
            
            // Get upcoming recurring expenses for the selected period
            const projection = await this.calculateFinancialProjection(days);
            
            // Display the projection
            this.displayFinancialProjection(currentBalanceInEuros, projection, days);
            
        } catch (error) {
            console.error('Error loading financial projection:', error);
            document.getElementById('timelineContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="me-2">⚠️</i>
                    Erreur lors du calcul de la projection : ${error.message}
                </div>
            `;
        }
    }

    /**
     * Calculate financial projection for the next N days
     */
    async calculateFinancialProjection(days) {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + days);
        
        // Get current account ID
        const currentAccountId = this.currentAccount ? this.currentAccount.id : null;
        if (!currentAccountId) {
            throw new Error('Aucun compte sélectionné');
        }
        
        // Get all future transactions for this account in the date range
        const futureTransactions = await this.getFutureTransactions(currentAccountId, today, endDate);
        
        // Get all active recurring expenses for this account
        const recurringExpenses = await ratchouApp.models.recurringExpenses.getActiveByAccount(currentAccountId);
        
        console.log(`Found ${recurringExpenses.length} active recurring expenses for account ${currentAccountId}:`, recurringExpenses);
        
        // Create projection array
        const projection = [];
        
        for (let i = 0; i <= days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            
            console.log(`\n=== Checking day ${i}: ${date.toDateString()} (day of month: ${date.getDate()}) ===`);
            
            const dayProjection = {
                date: date,
                isToday: i === 0,
                transactions: [],
                totalAmount: 0
            };
            
            // Add existing future transactions for this day
            const dayTransactions = futureTransactions.filter(transaction => {
                const transactionDate = new Date(transaction.date_mouvement);
                return transactionDate.toDateString() === date.toDateString();
            });
            
            dayTransactions.forEach(transaction => {
                // Note: For simplicity, assuming all transactions use the same currency as the account
                // In a multi-currency system, each transaction would need its own currency field
                const transactionCurrency = this.currentAccount?.currency || 'EUR';
                const amountInEuros = RatchouUtils.currency.fromStorageUnit(transaction.amount, transactionCurrency);
                dayProjection.transactions.push({
                    id: transaction.id,
                    libelle: transaction.category_name || 'Transaction',
                    amount: amountInEuros,
                    amountInCents: transaction.amount,
                    type: 'existing',
                    isPositive: amountInEuros >= 0
                });
                dayProjection.totalAmount += amountInEuros;
            });

            // Add recurring expenses that should be executed this day
            for (const expense of recurringExpenses) {
                if (this.shouldExecuteRecurringExpense(expense, date)) {
                    const expenseCurrency = this.currentAccount?.currency || 'EUR';
                    const amountInEuros = RatchouUtils.currency.fromStorageUnit(expense.amount, expenseCurrency);
                    
                    // Keep the original sign of the amount (positive for income, negative for expenses)
                    dayProjection.transactions.push({
                        id: expense.id,
                        libelle: expense.libelle,
                        amount: amountInEuros,
                        amountInCents: expense.amount,
                        type: 'recurring',
                        isPositive: amountInEuros >= 0
                    });
                    dayProjection.totalAmount += amountInEuros;
                }
            }
            
            projection.push(dayProjection);
        }
        
        return projection;
    }

    /**
     * Get future transactions for an account within a date range
     */
    async getFutureTransactions(accountId, startDate, endDate) {
        try {
            // Get all transactions for this account
            const allTransactions = await ratchouApp.models.transactions.getByAccount(accountId);
            
            // Filter transactions that are in the future date range
            return allTransactions.filter(transaction => {
                const transactionDate = new Date(transaction.date_mouvement);
                return transactionDate >= startDate && transactionDate <= endDate;
            });
        } catch (error) {
            console.error('Error getting future transactions:', error);
            return [];
        }
    }

    /**
     * Check if a recurring expense should be executed on a given date
     * For projections, we're more permissive than for actual execution
     */
    shouldExecuteRecurringExpense(expense, date) {
        const dayOfMonth = date.getDate();
        const expenseDayOfMonth = expense.day_of_month;
        
        console.log(`Checking recurring expense "${expense.libelle}" for date ${date.toDateString()}`);
        console.log(`- Target day of month: ${expenseDayOfMonth}, Current day: ${dayOfMonth}`);
        
        // Check if the day of month matches
        if (dayOfMonth === expenseDayOfMonth) {
            console.log(`- Day matches! Checking execution history...`);
            
            // For projection purposes, we're more lenient about recent executions
            if (expense.last_execution) {
                const lastExecution = new Date(expense.last_execution);
                const daysDifference = Math.floor((date - lastExecution) / (1000 * 60 * 60 * 24));
                
                console.log(`- Last execution: ${lastExecution.toDateString()}, Days ago: ${daysDifference}`);
                
                // For projection, only skip if it was executed in the current month
                const lastExecutionMonth = lastExecution.getMonth();
                const lastExecutionYear = lastExecution.getFullYear();
                const currentMonth = date.getMonth();
                const currentYear = date.getFullYear();
                
                // Don't execute if already executed this month
                if (lastExecutionMonth === currentMonth && lastExecutionYear === currentYear) {
                    console.log(`- Already executed this month, skipping`);
                    return false;
                }
            }
            
            console.log(`- Should execute!`);
            return true;
        }
        
        return false;
    }

    /**
     * Display the financial projection in the modal
     */
    displayFinancialProjection(currentBalance, projection, days) {
        // Filter out days with no transactions (only show days with transactions)
        const daysWithTransactions = projection.filter(day => day.transactions.length > 0);
        
        // Calculate totals
        const totalNetAmount = projection.reduce((sum, day) => sum + day.totalAmount, 0);
        const finalBalance = currentBalance + totalNetAmount;
        const finalBalanceClass = finalBalance >= 0 ? 'text-success' : 'text-danger';
        
        let html = '';
        
        // Calculate separate totals for display
        const totalExpenses = projection.reduce((sum, day) => {
            const dayExpenses = day.transactions.filter(t => t.amount < 0).reduce((daySum, t) => daySum + Math.abs(t.amount), 0);
            return sum + dayExpenses;
        }, 0);
        
        const totalIncomes = projection.reduce((sum, day) => {
            const dayIncomes = day.transactions.filter(t => t.amount > 0).reduce((daySum, t) => daySum + t.amount, 0);
            return sum + dayIncomes;
        }, 0);

        // Summary at the top
        const currencySymbol = RatchouUtils.currency.getSymbol(currency);
        const currentBalanceFormatted = RatchouUtils.currency.formatWithCurrency(RatchouUtils.currency.toStorageUnit(currentBalance, currency), currency);
        const totalIncomesFormatted = RatchouUtils.currency.formatWithCurrency(RatchouUtils.currency.toStorageUnit(totalIncomes, currency), currency);
        const totalExpensesFormatted = RatchouUtils.currency.formatWithCurrency(RatchouUtils.currency.toStorageUnit(Math.abs(totalExpenses), currency), currency);
        const finalBalanceFormatted = RatchouUtils.currency.formatWithCurrency(RatchouUtils.currency.toStorageUnit(finalBalance, currency), currency);

        html += `
            <div class="row g-2 mb-4">
                <div class="col-6 col-md-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">💰 Solde actuel</div>
                            <div class="fs-6 fw-bold">${currentBalanceFormatted}</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">📈 Recettes</div>
                            <div class="fs-6 fw-bold">${totalIncomesFormatted}</div>
                            <div class="small opacity-75">Sur ${days} jours</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-danger text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">📉 Dépenses</div>
                            <div class="fs-6 fw-bold">${totalExpensesFormatted}</div>
                            <div class="small opacity-75">Sur ${days} jours</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card ${finalBalance >= 0 ? 'bg-success' : 'bg-warning'} text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">🎯 Solde final</div>
                            <div class="fs-6 fw-bold">${finalBalanceFormatted}</div>
                            <div class="small opacity-75">Après ${days} jours</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Display message if no transactions
        if (daysWithTransactions.length === 0) {
            html += `
                <div class="alert alert-info text-center">
                    <i class="me-2">ℹ️</i>
                    <strong>Aucune transaction prévue</strong><br>
                    <small>Aucune transaction future ou dépense récurrente sur les ${days} prochains jours.</small>
                </div>
            `;
        } else {
            // Show days with transactions
            html += '<div class="row g-3">';
            
            let runningBalance = currentBalance;
            
            daysWithTransactions.forEach((day) => {
                const dateStr = day.date.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                });
                
                // Calculate balance after this day
                runningBalance += day.totalAmount;
                const dayClass = day.isToday ? 'border-primary border-2' : '';
                const todayLabel = day.isToday ? ' (Aujourd\'hui)' : '';
                
                html += `
                    <div class="col-12">
                        <div class="card ${dayClass}">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <h6 class="card-title mb-0">
                                        📅 ${dateStr}${todayLabel}
                                    </h6>
                                    <span class="badge ${runningBalance >= 0 ? 'bg-success' : 'bg-danger'}">
                                        Solde: ${RatchouUtils.currency.formatWithCurrency(RatchouUtils.currency.toStorageUnit(runningBalance, currency), currency)}
                                    </span>
                                </div>
                                
                                <div class="mb-2">
                `;
                
                day.transactions.forEach(transaction => {
                    const isPositive = transaction.amount >= 0;
                    const amountClass = isPositive ? 'text-success' : 'text-danger';
                    const icon = transaction.type === 'recurring' ? '🔄' : (isPositive ? '📈' : '📉');
                    const typeLabel = transaction.type === 'recurring' ? ' (récurrent)' : '';
                    
                    const transactionFormatted = RatchouUtils.currency.formatWithCurrency(Math.abs(transaction.amountInCents), currency);

                    html += `
                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-body-secondary rounded">
                            <span class="fw-medium">${icon} ${transaction.libelle}${typeLabel}</span>
                            <span class="${amountClass} fw-bold">
                                ${isPositive ? '+' : ''}${transactionFormatted}
                            </span>
                        </div>
                    `;
                });
                
                if (day.transactions.length > 1) {
                    const netAmountClass = day.totalAmount >= 0 ? 'text-success' : 'text-danger';
                    const dayTotalFormatted = RatchouUtils.currency.formatWithCurrency(RatchouUtils.currency.toStorageUnit(Math.abs(day.totalAmount), currency), currency);
                    html += `
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-2">
                            <strong>Total du jour:</strong>
                            <strong class="${netAmountClass} fs-5">
                                ${day.totalAmount >= 0 ? '+' : ''}${dayTotalFormatted}
                            </strong>
                        </div>
                    `;
                }
                
                html += `
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            // Summary info
            html += `
                <div class="mt-4 p-3 bg-body-secondary rounded">
                    <div class="row text-center">
                        <div class="col-4">
                            <div class="small text-muted">Jours avec transactions</div>
                            <div class="fw-bold text-primary">${daysWithTransactions.length} / ${days}</div>
                        </div>
                        <div class="col-4">
                            <div class="small text-muted">Total recettes</div>
                            <div class="fw-bold text-success">${totalIncomesFormatted}</div>
                        </div>
                        <div class="col-4">
                            <div class="small text-muted">Total dépenses</div>
                            <div class="fw-bold text-danger">${totalExpensesFormatted}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Footer note
        html += `
            <div class="mt-3 p-2 bg-info bg-opacity-10 rounded">
                <small class="text-muted">
                    <i class="me-1">💡</i>Cette projection inclut toutes les transactions futures plannifiées sur le compte actuel, 
                    ainsi que les dépenses récurrentes qui devraient être exécutées.
                </small>
            </div>
        `;
        
        document.getElementById('timelineContent').innerHTML = html;
    }

    // =================================================================
    // Panel Filtering and Quick Add Methods
    // =================================================================

    /**
     * Filter categories panel in real-time
     */
    filterCategoriesPanel() {
        const filterInput = document.getElementById('categorieFilter');
        const filter = filterInput.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const listContainer = document.getElementById('categorieList');
        const items = listContainer.querySelectorAll('.list-group-item-action');

        items.forEach(item => {
            const text = item.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (text.includes(filter)) {
                item.classList.remove('d-none');
            } else {
                item.classList.add('d-none');
            }
        });
    }

    /**
     * Filter payees panel in real-time
     */
    filterPayeesPanel() {
        const filterInput = document.getElementById('beneficiaireFilter');
        const filter = filterInput.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const listContainer = document.getElementById('beneficiaireList');
        const items = listContainer.querySelectorAll('.list-group-item-action');

        items.forEach(item => {
            const text = item.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (text.includes(filter)) {
                item.classList.remove('d-none');
            } else {
                item.classList.add('d-none');
            }
        });
    }

    /**
     * Open add category modal
     */
    openAddCategoryModal() {
        // Clear form
        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryMandatory').checked = false;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
        modal.show();
    }

    /**
     * Open add payee modal
     */
    openAddPayeeModal() {
        // Clear form
        document.getElementById('newPayeeName').value = '';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addPayeeModal'));
        modal.show();
    }

    /**
     * Handle quick category addition
     */
    async handleQuickAddCategory() {
        try {
            const nameInput = document.getElementById('newCategoryName');
            const mandatoryCheckbox = document.getElementById('newCategoryMandatory');
            
            const name = nameInput.value.trim();
            if (!name) {
                this.showError('Le nom de la catégorie est obligatoire');
                nameInput.focus();
                return;
            }

            // Check if category already exists
            const exists = this.categories.some(cat => 
                cat.libelle.toLowerCase() === name.toLowerCase()
            );
            
            if (exists) {
                this.showError('Cette catégorie existe déjà');
                nameInput.focus();
                nameInput.select();
                return;
            }

            this.showLoading('Ajout de la catégorie...');

            const categoryData = {
                libelle: name,
                is_mandatory: mandatoryCheckbox.checked
            };

            const result = await ratchouApp.models.categories.create(categoryData);

            if (result.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
                modal.hide();

                const newCategory = result.data;

                // Reload categories with current sort mode
                await this.reloadCategories();

                this.selectPanelItem(newCategory.id, newCategory.libelle, '📂');

                this.showSuccess(`Catégorie "${name}" ajoutée et sélectionnée`);
            } else {
                this.showError("Erreur lors de l\'ajout : " + result.message);
            }

        } catch (error) {
            console.error('Error adding category:', error);
            this.showError("Erreur lors de l\'ajout de la catégorie : " + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle quick payee addition
     */
    async handleQuickAddPayee() {
        try {
            const nameInput = document.getElementById('newPayeeName');
            
            const name = nameInput.value.trim();
            if (!name) {
                this.showError('Le nom du bénéficiaire est obligatoire');
                nameInput.focus();
                return;
            }

            // Check if payee already exists
            const exists = this.payees.some(payee => 
                payee.libelle.toLowerCase() === name.toLowerCase()
            );
            
            if (exists) {
                this.showError('Ce bénéficiaire existe déjà');
                nameInput.focus();
                nameInput.select();
                return;
            }

            this.showLoading('Ajout du bénéficiaire...');

            const payeeData = {
                libelle: name
            };

            const result = await ratchouApp.models.payees.create(payeeData);

            if (result.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('addPayeeModal'));
                modal.hide();

                const newPayee = result.data;

                // Reload payees with current sort mode
                await this.reloadPayees();

                this.selectPanelItem(newPayee.id, newPayee.libelle, '👥');

                this.showSuccess(`Bénéficiaire "${name}" ajouté et sélectionné`);
            } else {
                this.showError("Erreur lors de l\'ajout : " + result.message);
            }

        } catch (error) {
            console.error('Error adding payee:', error);
            this.showError("Erreur lors de l\'ajout du bénéficiaire : " + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Shows or hides the 'duplicate transaction' checkbox based on the current account.
     * Also auto-checks the checkbox if the account has auto_copy_to_principal enabled.
     * Disables the checkbox if currencies don't match between current and principal accounts.
     */
    async toggleDuplicateCheckbox() {
        const wrapper = document.getElementById('duplicate-transaction-wrapper');
        const checkbox = document.getElementById('duplicate-transaction');
        const label = wrapper.querySelector('label');

        if (this.currentAccount && !this.currentAccount.is_principal) {
            wrapper.classList.remove('d-none');

            // Get principal account to check currency compatibility
            try {
                const principalAccount = await ratchouApp.models.accounts.getPrincipal();
                const currentCurrency = this.currentAccount.currency || 'EUR';
                const principalCurrency = principalAccount?.currency || 'EUR';

                if (currentCurrency !== principalCurrency) {
                    // Currencies don't match - disable checkbox and show message
                    checkbox.disabled = true;
                    checkbox.checked = false;
                    label.innerHTML = `
                        Copier vers le compte principal
                        <small class="text-muted">(Devises incompatibles: ${currentCurrency} ≠ ${principalCurrency})</small>
                    `;
                } else {
                    // Currencies match - enable checkbox
                    checkbox.disabled = false;
                    checkbox.checked = !!this.currentAccount.auto_copy_to_principal;
                    label.innerHTML = 'Copier vers le compte principal';
                }
            } catch (error) {
                console.error('Error checking currency compatibility:', error);
                // In case of error, enable the checkbox with default behavior
                checkbox.disabled = false;
                checkbox.checked = !!this.currentAccount.auto_copy_to_principal;
                label.innerHTML = 'Copier vers le compte principal';
            }
        } else {
            wrapper.classList.add('d-none');
            checkbox.checked = false;
            checkbox.disabled = false;
        }
    }

    // =================================================================
    // Sort management for panels
    // =================================================================

    /**
     * Load sort modes from localStorage
     */
    loadSortModes() {
        const savedCategoriesSort = localStorage.getItem('ratchou_dashboard_categories_sort');
        if (savedCategoriesSort === 'usage' || savedCategoriesSort === 'alphabetical') {
            this.categoriesSortMode = savedCategoriesSort;
        }

        const savedPayeesSort = localStorage.getItem('ratchou_dashboard_payees_sort');
        if (savedPayeesSort === 'usage' || savedPayeesSort === 'alphabetical') {
            this.payeesSortMode = savedPayeesSort;
        }
    }

    /**
     * Save categories sort mode to localStorage
     */
    saveCategoriesSortMode() {
        localStorage.setItem('ratchou_dashboard_categories_sort', this.categoriesSortMode);
    }

    /**
     * Save payees sort mode to localStorage
     */
    savePayeesSortMode() {
        localStorage.setItem('ratchou_dashboard_payees_sort', this.payeesSortMode);
    }

    /**
     * Toggle categories sort mode
     */
    async toggleCategoriesSortMode() {
        this.categoriesSortMode = this.categoriesSortMode === 'alphabetical' ? 'usage' : 'alphabetical';
        this.saveCategoriesSortMode();
        this.updateCategoriesSortButton();
        await this.reloadCategories();
    }

    /**
     * Toggle payees sort mode
     */
    async togglePayeesSortMode() {
        this.payeesSortMode = this.payeesSortMode === 'alphabetical' ? 'usage' : 'alphabetical';
        this.savePayeesSortMode();
        this.updatePayeesSortButton();
        await this.reloadPayees();
    }

    /**
     * Reload categories with current sort mode
     */
    async reloadCategories() {
        try {
            if (this.categoriesSortMode === 'usage') {
                this.categories = await ratchouApp.models.categories.getAllSortedByUsage();
            } else {
                this.categories = await ratchouApp.models.categories.getAllSorted();
            }
            this.loadCategoriesPanel();
        } catch (error) {
            console.error('Error reloading categories:', error);
        }
    }

    /**
     * Reload payees with current sort mode
     */
    async reloadPayees() {
        try {
            if (this.payeesSortMode === 'usage') {
                this.payees = await ratchouApp.models.payees.getAllSortedByUsage();
            } else {
                this.payees = await ratchouApp.models.payees.getAllSorted();
            }
            this.loadPayeesPanel();
        } catch (error) {
            console.error('Error reloading payees:', error);
        }
    }

    /**
     * Update sort buttons appearance
     */
    updateSortButtons() {
        this.updateCategoriesSortButton();
        this.updatePayeesSortButton();
    }

    /**
     * Update categories sort button appearance
     */
    updateCategoriesSortButton() {
        const sortBtn = document.getElementById('categoriesSortToggleBtn');
        if (!sortBtn) return;

        if (this.categoriesSortMode === 'usage') {
            sortBtn.innerHTML = '<i class="bi bi-graph-up"></i>';
            sortBtn.className = 'btn btn-primary btn-sm';
            sortBtn.title = 'Tri par usage (cliquer pour tri alphabétique)';
        } else {
            sortBtn.innerHTML = '<i class="bi bi-sort-alpha-down"></i>';
            sortBtn.className = 'btn btn-outline-secondary btn-sm';
            sortBtn.title = 'Tri alphabétique (cliquer pour tri par usage)';
        }
    }

    /**
     * Update payees sort button appearance
     */
    updatePayeesSortButton() {
        const sortBtn = document.getElementById('payeesSortToggleBtn');
        if (!sortBtn) return;

        if (this.payeesSortMode === 'usage') {
            sortBtn.innerHTML = '<i class="bi bi-graph-up"></i>';
            sortBtn.className = 'btn btn-primary btn-sm';
            sortBtn.title = 'Tri par usage (cliquer pour tri alphabétique)';
        } else {
            sortBtn.innerHTML = '<i class="bi bi-sort-alpha-down"></i>';
            sortBtn.className = 'btn btn-outline-secondary btn-sm';
            sortBtn.title = 'Tri alphabétique (cliquer pour tri par usage)';
        }
    }

}

// Global functions used by HTML onclick handlers
window.closePanels = () => {
    if (window.dashboardController) {
        window.dashboardController.closePanels();
    }
};

window.editMovement = (transactionId) => {
    if (window.dashboardController) {
        window.dashboardController.handleTransactionClick({dataset: {transactionId}});
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.dashboardController = new DashboardController();
    await dashboardController.init();
});

// Enable debug mode for development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.RATCHOU_DEBUG = true;
}
