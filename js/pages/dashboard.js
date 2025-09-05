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
            
            // Initialize tooltips
            this.initializeTooltips();
            
            this.isInitialized = true;
            this.hideLoading();
            
            // Set focus to the amount input for quick entry
            const amountInput = document.getElementById('montant');
            if (amountInput) {
                amountInput.focus();
            }
            
            // Show tooltips automatically after page load (only on first visit)
            setTimeout(() => {
                this.showAutoTooltipsOnce();
            }, 1000); // Wait 1 second after initialization
            
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

        // Test tooltips button
        document.getElementById('testTooltipsBtn').addEventListener('click', () => {
            this.showAutoTooltips();
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

        // Amount input - no formatting needed, just validation

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
            
            // Load form data
            await this.loadFormData();
            
            // Update UI
            this.updateAccountDisplay();
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
            const transactionData = {
                amount: Math.round(parseFloat(formData.get('montant')) * 100), // Convert to centimes
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
                        this.showSuccess('Transaction copiée sur le compte principal');
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
                await this.loadRecentTransactions();
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
        
        const balance = RatchouUtils.currency.format(this.currentAccount.balance);
        const balanceElement = document.getElementById('currentAccountBalance');
        balanceElement.textContent = balance;
        
        // Set color based on balance
        balanceElement.className = 'account-balance ' + 
            (this.currentAccount.balance >= 0 ? 'text-success' : 'text-danger');
    }

    /**
     * Update transactions table (simple list without date grouping)
     */
    updateTransactionsTable() {
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
        
        this.recentTransactions.forEach(transaction => {
            const transactionDate = new Date(transaction.date_mouvement).toLocaleDateString('fr-FR');
            const transactionTime = new Date(transaction.date_mouvement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
            
            const amount = RatchouUtils.currency.format(transaction.amount);
            const amountClass = transaction.amount >= 0 ? 'amount-positive' : 'amount-negative';
            
            html += `
                <tr class="movement-row" data-transaction-id="${transaction.id}" onclick="editMovement('${transaction.id}')">
                    <td class="text-center" style="width: 100px;">
                        <span class="${amountClass}">${amount}</span>
                        <br><small class="text-muted">${transactionDate} ${transactionTime}</small>
                    </td>
                    <td>
                        <div class="fw-bold">${transaction.category_name || 'N/A'}</div>
                        <small class="text-muted">${transaction.payee_name || 'N/A'} - ${transaction.expense_type_name || 'N/A'}</small>
                    </td>
                </tr>
            `;
        });
        
        this.transactionsTable.innerHTML = html;
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

            // Update our cache with fresh data
            this.allAccounts = freshAccounts;
            
            // Also update current account with fresh data if it exists in the list
            const updatedCurrentAccount = freshAccounts.find(acc => acc.id === this.currentAccount?.id);
            if (updatedCurrentAccount) {
                this.currentAccount = updatedCurrentAccount;
                // Update the display in the header with fresh balance
                this.updateAccountDisplay();
            }

            accountsList.innerHTML = freshAccounts.map(account => {
                const balance = RatchouUtils.currency.format(account.balance);
                const isSelected = account.id === this.currentAccount.id;
                const balanceClass = account.balance >= 0 ? 'text-success' : 'text-danger';
                
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
            this.showSuccess(`Compte "${account.nom_compte}" sélectionné`);
            
        } catch (error) {
            console.error('Error selecting account:', error);
            this.showError('Erreur de sélection: ' + error.message);
        }
    }

    /**
     * Load recent transactions for current account
     */
    async loadRecentTransactions() {
        try {
            if (!this.currentAccount) return; 
            
            const transactions = await ratchouApp.models.transactions.getRecentByAccount(this.currentAccount.id, 20);
            this.recentTransactions = await ratchouApp.models.transactions.getEnriched(transactions);
            
            this.updateTransactionsTable();
            
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
    setupBalanceModal() {
        if (!this.currentAccount) return; 
        
        const currentBalanceSpan = document.getElementById('currentBalance');
        const newBalanceInput = document.getElementById('newBalance');
        
        const currentBalance = RatchouUtils.currency.toEuros(this.currentAccount.balance);
        currentBalanceSpan.textContent = RatchouUtils.currency.format(this.currentAccount.balance);
        newBalanceInput.value = currentBalance.toFixed(2);
        newBalanceInput.focus();
        newBalanceInput.select();
    }

    /**
     * Handle balance update
     */
    async handleBalanceUpdate() {
        try {
            const newBalanceInput = document.getElementById('newBalance');
            const newBalance = parseFloat(newBalanceInput.value);
            
            if (isNaN(newBalance)) {
                this.showError('Veuillez saisir un montant valide');
                return;
            }

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
            
            // Fill form fields
            document.getElementById('edit_movement_id').value = transaction.id;
            document.getElementById('edit_montant').value = (transaction.amount / 100).toFixed(2); // Convert from centimes to euros
            document.getElementById('edit_categorie_id').value = transaction.category_id || '';
            document.getElementById('edit_beneficiaire_id').value = transaction.payee_id || '';
            document.getElementById('edit_type_depense_id').value = transaction.expense_type_id || '';
            document.getElementById('edit_rmq').value = transaction.description || '';

            // Update button texts
            this.updateEditButtons(enrichedTransaction);
            
            // Show/hide the duplicate button
            const duplicateBtn = document.getElementById('duplicateToMainBtn');
            const transactionAccount = this.allAccounts.find(acc => acc.id === transaction.account_id);
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
            
            const updateData = {
                id: formData.get('movement_id'),
                amount: Math.round(parseFloat(formData.get('montant')) * 100), // Convert to centimes
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
                this.showSuccess('Transaction copiée sur le compte principal');
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
            item.innerHTML = `${category.libelle}${usageDisplay} ${category.is_mandatory ? '<span class="badge bg-warning ms-2">Obligatoire</span>' : ''}`;
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
            item.innerHTML = `${payee.libelle}${usageDisplay}`;
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
            item.innerHTML = `${type.libelle} ${type.is_default ? '<span class="badge bg-primary ms-2">Par défaut</span>' : ''}`;
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
        
        // Convert to euros for animation
        const oldBalanceInEuros = RatchouUtils.currency.toEuros(oldBalance);
        const newBalanceInEuros = RatchouUtils.currency.toEuros(newBalance);
        
        // Add color class during animation
        balanceElement.classList.add(colorClass);
        
        // Animation parameters
        const duration = 800; // 800ms like the jQuery example
        const startTime = performance.now();
        const difference = newBalanceInEuros - oldBalanceInEuros;
        
        // Animation function
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (similar to jQuery swing)
            const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
            
            // Calculate current value
            const currentValue = oldBalanceInEuros + (difference * easeProgress);
            
            // Update display with formatted currency
            const currentValueInCents = Math.round(currentValue * 100);
            balanceElement.textContent = RatchouUtils.currency.format(currentValueInCents);
            
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
        console.log(`Balance animated: ${RatchouUtils.currency.format(oldBalance)} → ${RatchouUtils.currency.format(newBalance)} (transaction: ${isPositive ? '+' : ''}${RatchouUtils.currency.format(transactionAmount)})`);
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
            const currentBalanceInEuros = RatchouUtils.currency.toEuros(currentBalance);
            
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
                const amountInEuros = RatchouUtils.currency.toEuros(transaction.amount);
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
                    const amountInEuros = RatchouUtils.currency.toEuros(expense.amount);
                    
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
        html += `
            <div class="row g-2 mb-4">
                <div class="col-6 col-md-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">💰 Solde actuel</div>
                            <div class="fs-6 fw-bold">${RatchouUtils.currency.format(currentBalance * 100)}</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">📈 Recettes</div>
                            <div class="fs-6 fw-bold">${RatchouUtils.currency.format(totalIncomes * 100)}</div>
                            <div class="small opacity-75">Sur ${days} jours</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-danger text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">📉 Dépenses</div>
                            <div class="fs-6 fw-bold">${RatchouUtils.currency.format(totalExpenses * 100)}</div>
                            <div class="small opacity-75">Sur ${days} jours</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card ${finalBalance >= 0 ? 'bg-success' : 'bg-warning'} text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">🎯 Solde final</div>
                            <div class="fs-6 fw-bold">${RatchouUtils.currency.format(finalBalance * 100)}</div>
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
                                        Solde: ${RatchouUtils.currency.format(runningBalance * 100)}
                                    </span>
                                </div>
                                
                                <div class="mb-2">
                `;
                
                day.transactions.forEach(transaction => {
                    const isPositive = transaction.amount >= 0;
                    const amountClass = isPositive ? 'text-success' : 'text-danger';
                    const icon = transaction.type === 'recurring' ? '🔄' : (isPositive ? '📈' : '📉');
                    const typeLabel = transaction.type === 'recurring' ? ' (récurrent)' : '';
                    
                    html += `
                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                            <span class="fw-medium">${icon} ${transaction.libelle}${typeLabel}</span>
                            <span class="${amountClass} fw-bold">
                                ${isPositive ? '+' : ''}${RatchouUtils.currency.format(Math.abs(transaction.amountInCents))}
                            </span>
                        </div>
                    `;
                });
                
                if (day.transactions.length > 1) {
                    const netAmountClass = day.totalAmount >= 0 ? 'text-success' : 'text-danger';
                    html += `
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-2">
                            <strong>Total du jour:</strong>
                            <strong class="${netAmountClass} fs-5">
                                ${day.totalAmount >= 0 ? '+' : ''}${RatchouUtils.currency.format(Math.abs(day.totalAmount) * 100)}
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
                <div class="mt-4 p-3 bg-light rounded">
                    <div class="row text-center">
                        <div class="col-4">
                            <div class="small text-muted">Jours avec transactions</div>
                            <div class="fw-bold text-primary">${daysWithTransactions.length} / ${days}</div>
                        </div>
                        <div class="col-4">
                            <div class="small text-muted">Total recettes</div>
                            <div class="fw-bold text-success">${RatchouUtils.currency.format(totalIncomes * 100)}</div>
                        </div>
                        <div class="col-4">
                            <div class="small text-muted">Total dépenses</div>
                            <div class="fw-bold text-danger">${RatchouUtils.currency.format(totalExpenses * 100)}</div>
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
     */
    toggleDuplicateCheckbox() {
        const wrapper = document.getElementById('duplicate-transaction-wrapper');
        const checkbox = document.getElementById('duplicate-transaction');
        if (this.currentAccount && !this.currentAccount.is_principal) {
            wrapper.style.display = 'block';
        } else {
            wrapper.style.display = 'none';
            checkbox.checked = false;
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

    /**
     * Initialize tooltips system
     */
    initializeTooltips() {
        // Initialize standard tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        
        console.log('Tooltips initialized:', tooltipList.length);
    }

    /**
     * Show automatic tooltips for user guidance
     */
    showAutoTooltips() {
        // Elements with tooltips in the header
        const accountName = document.getElementById('currentAccountName');
        const accountBalance = document.getElementById('currentAccountBalance');
        
        const elementsToShow = [];
        
        // Add account name tooltip if element exists
        if (accountName && accountName.hasAttribute('data-bs-toggle')) {
            elementsToShow.push({
                element: accountName,
                delay: 0
            });
        }
        
        // Add account balance tooltip if element exists
        if (accountBalance && accountBalance.hasAttribute('data-tooltip-message')) {
            elementsToShow.push({
                element: accountBalance,
                delay: 3500 // Starts 500ms after first tooltip ends (3000ms + 500ms)
            });
        }
        
        // Show each tooltip with a delay, then hide after 2 seconds
        elementsToShow.forEach(({element, delay}) => {
            setTimeout(() => {
                let tooltip = bootstrap.Tooltip.getInstance(element);
                
                // For elements with data-tooltip-message (like balance), create a temporary tooltip
                if (element.hasAttribute('data-tooltip-message') && !tooltip) {
                    const tooltipMessage = element.getAttribute('data-tooltip-message');
                    const tooltipPlacement = element.getAttribute('data-tooltip-placement') || 'bottom';
                    tooltip = new bootstrap.Tooltip(element, {
                        title: tooltipMessage,
                        placement: tooltipPlacement,
                        trigger: 'manual'
                    });
                }
                
                // For regular tooltip elements, use existing or create new
                if (!tooltip) {
                    tooltip = new bootstrap.Tooltip(element, {
                        trigger: 'manual'
                    });
                }
                
                tooltip.show();
                
                // Hide after 3 seconds
                setTimeout(() => {
                    tooltip.hide();
                    
                    // Dispose temporary tooltips to avoid conflicts
                    if (element.hasAttribute('data-tooltip-message')) {
                        setTimeout(() => {
                            tooltip.dispose();
                        }, 150);
                    }
                }, 3000);
            }, delay);
        });
        
        console.log('Auto-tooltips triggered for', elementsToShow.length, 'elements');
    }

    /**
     * Show automatic tooltips only once per session
     */
    showAutoTooltipsOnce() {
        // Check if tooltips have already been shown in this session
        const hasSeenTooltips = sessionStorage.getItem('ratchou_dashboard_tooltips_shown');
        
        if (!hasSeenTooltips) {
            // Show tooltips and mark as seen for this session
            this.showAutoTooltips();
            sessionStorage.setItem('ratchou_dashboard_tooltips_shown', 'true');
            console.log('Session tooltips displayed and marked as seen');
        } else {
            console.log('Tooltips skipped - user has already seen them in this session');
        }
    }

    /**
     * Reset tooltips display for current session (for testing)
     */
    resetTooltipsFlag() {
        sessionStorage.removeItem('ratchou_dashboard_tooltips_shown');
        console.log('Session tooltips flag reset - they will show again on next dashboard load');
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
