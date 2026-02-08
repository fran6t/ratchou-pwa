/**
 * Mouvements Controller for Ratchou IndexedDB
 * Handles movement search, filtering, and management
 */

class MouvementsController {
    constructor() {
        this.allAccounts = [];
        this.categories = [];
        this.payees = [];
        this.expenseTypes = [];
        this.currentFilters = {};
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.totalItems = 0;
        this.currentResults = [];
        this.isInitialized = false;
        
        // DOM elements
        this.searchForm = null;
        this.movementsTableBody = null;
        this.loadingOverlay = null;
        this.editMovementModal = null;
        this.totalCountElement = null;
        this.paginationInfo = null;
        this.noResultsElement = null;
        this.resultsTableElement = null;
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '💸 Mouvements',
            showAccountInfo: false,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    /**
     * Initialize the movements page
     */
    async init() {
        try {
            console.log('Initializing movements page...');
            
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
            
            // Check authentication
            // Check authentication with guard system
            if (window.auth && typeof window.auth.guardPage === 'function') {
                if (!auth.guardPage('app')) {
                    return; // User was redirected, stop initialization
                }
            } else if (!ratchouApp.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Load panels data
            await this.loadPanelsData();
            
            // Load all movements by default
            await this.loadAllMovements();
            
            this.isInitialized = true;
            this.hideLoading();
            
            console.log('Movements page initialized successfully');
            
        } catch (error) {
            console.error('Movements page initialization error:', error);
            this.showError('Erreur d\'initialisation: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Setup DOM element references
     */
    setupDOMElements() {
        this.searchForm = document.getElementById('searchForm');
        this.movementsTableBody = document.getElementById('movementsTableBody');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.editMovementModal = new bootstrap.Modal(document.getElementById('editMovementModal'));
        this.totalCountElement = document.getElementById('totalCount');
        this.paginationInfo = document.getElementById('pagination-info');
        this.noResultsElement = document.getElementById('no-results');
        this.resultsTableElement = document.getElementById('results-table');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search form submission
        this.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.performSearch();
        });

        // Clear filters button
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Setup panel buttons
        this.setupPanelButtons();

        // Edit movement modal events
        document.getElementById('updateMovementBtn').addEventListener('click', () => {
            this.updateMovement();
        });

        document.getElementById('deleteMovementBtn').addEventListener('click', () => {
            this.deleteCurrentMovement();
        });

        // Sidebar menu functionality
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                try {
                    const data = await ratchouApp.exportToJSON();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ratchou-export-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showSuccess('✅ Export réussi');
                } catch (error) {
                    this.showError('Erreur lors de l\'export: ' + error.message);
                }
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                ratchouApp.logout();
                this.redirectToLogin();
            });
        }

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

        // Panel filter listeners
        document.getElementById('categorieFilter').addEventListener('input', () => this.filterCategoriesPanel());
        document.getElementById('beneficiaireFilter').addEventListener('input', () => this.filterPayeesPanel());
    }

    /**
     * Setup panel buttons for selection
     */
    setupPanelButtons() {
        document.querySelectorAll('[data-panel-target]').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-panel-target');
                const inputTarget = e.currentTarget.getAttribute('data-input-target');
                this.openPanel(target, inputTarget, e.currentTarget);
            });
        });
    }

    /**
     * Load initial data for form dropdowns
     */
    async loadInitialData() {
        try {
            // Load accounts for dropdown
            this.allAccounts = await ratchouApp.models.accounts.getAll();
            this.populateAccountsDropdown();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Erreur lors du chargement des données');
        }
    }

    /**
     * Load all movements on page load
     */
    async loadAllMovements() {
        try {
            this.showLoading('Chargement des mouvements...');
            
            // Clear any existing filters
            this.currentFilters = {};
            this.currentPage = 1;
            
            // Search all transactions
            await this.searchTransactions();
            
        } catch (error) {
            console.error('Error loading all movements:', error);
            this.showError('Erreur lors du chargement des mouvements: ' + error.message);
            this.showNoResults();
        }
    }

    /**
     * Load data for selection panels
     */
    async loadPanelsData() {
        try {
            // Load categories
            this.categories = await ratchouApp.models.categories.getAll();
            this.populateCategoriesPanel();
            
            // Load payees
            this.payees = await ratchouApp.models.payees.getAll();
            this.populatePayeesPanel();
            
            // Load expense types
            this.expenseTypes = await ratchouApp.models.expenseTypes.getAll();
            this.populateExpenseTypesPanel();
            
        } catch (error) {
            console.error('Error loading panels data:', error);
            this.showError('Erreur lors du chargement des panels');
        }
    }

    /**
     * Populate accounts dropdown
     */
    populateAccountsDropdown() {
        const select = document.getElementById('compte');
        select.innerHTML = '<option value="">Tous les comptes</option>';
        
        this.allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.nom_compte;
            select.appendChild(option);
        });
    }

    /**
     * Populate categories panel
     */
    populateCategoriesPanel() {
        const container = document.getElementById('categorieList');
        container.innerHTML = '';
        
        // Add "All categories" option for filters
        const allItem = document.createElement('button');
        allItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        allItem.innerHTML = '<span>📂 Toutes les catégories</span>';
        allItem.addEventListener('click', () => this.selectPanelItem('', 'Toutes les catégories', '📂'));
        container.appendChild(allItem);
        
        this.categories.forEach(category => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.innerHTML = `<span>📂 ${category.libelle}</span>`;
            item.setAttribute('data-id', category.id);
            item.addEventListener('click', () => this.selectPanelItem(category.id, category.libelle, '📂'));
            container.appendChild(item);
        });
    }

    /**
     * Populate payees panel
     */
    populatePayeesPanel() {
        const container = document.getElementById('beneficiaireList');
        container.innerHTML = '';
        
        // Add "All payees" option for filters
        const allItem = document.createElement('button');
        allItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        allItem.innerHTML = '<span>👥 Tous les bénéficiaires</span>';
        allItem.addEventListener('click', () => this.selectPanelItem('', 'Tous les bénéficiaires', '👥'));
        container.appendChild(allItem);
        
        this.payees.forEach(payee => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.innerHTML = `<span>👥 ${payee.libelle}</span>`;
            item.setAttribute('data-id', payee.id);
            item.addEventListener('click', () => this.selectPanelItem(payee.id, payee.libelle, '👥'));
            container.appendChild(item);
        });
    }

    /**
     * Populate expense types panel
     */
    populateExpenseTypesPanel() {
        const container = document.getElementById('typeDepenseList');
        container.innerHTML = '';
        
        // Add "All types" option for filters
        const allItem = document.createElement('button');
        allItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        allItem.innerHTML = '<span>💳 Tous les types</span>';
        allItem.addEventListener('click', () => this.selectPanelItem('', 'Tous les types', '💳'));
        container.appendChild(allItem);
        
        this.expenseTypes.forEach(type => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.innerHTML = `<span>💳 ${type.libelle}</span>`;
            item.addEventListener('click', () => this.selectPanelItem(type.id, type.libelle, '💳'));
            container.appendChild(item);
        });
    }

    /**
     * Open a selection panel
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
        
        // Open the requested panel
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

        // If the edit modal is open, reactivate its focus trap
        if (this.editMovementModal._isShown) {
            this.editMovementModal._focustrap.activate();
        }
    }

    /**
     * Select an item from a panel
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
            this.currentPanelButton.className = 'btn btn-outline-primary rounded-pill w-100';
        } else {
            input.value = value;
            const buttonText = value ? `${icon} ${label}` : `${icon} ${this.currentPanelButton.getAttribute('data-original-text')}`;
            this.currentPanelButton.innerHTML = buttonText;

            if (value) {
                this.currentPanelButton.className = 'btn btn-primary rounded-pill w-100';
            } else {
                this.currentPanelButton.className = 'btn btn-outline-primary rounded-pill w-100';
            }
        }
        
        this.closePanels();
    }

    /**
     * Perform search based on form data
     */
    async performSearch() {
        try {
            this.showLoading('Recherche en cours...');
            
            // Get form data
            const formData = new FormData(this.searchForm);
            const filters = {};
            
            for (let [key, value] of formData.entries()) {
                if (value.trim()) {
                    filters[key] = value.trim();
                }
            }
            
            this.currentFilters = filters;
            this.currentPage = 1;
            
            // Search transactions
            await this.searchTransactions();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Erreur lors de la recherche: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Search transactions with filters
     */
    async searchTransactions() {
        try {
            const transactions = await ratchouApp.models.transactions.searchWithDetails(this.currentFilters);

            this.currentResults = transactions;
            this.totalItems = transactions.length;

            if (transactions.length === 0) {
                this.showNoResults(true);
            } else {
                this.displayResults(transactions);
            }

        } catch (error) {
            console.error('Error searching transactions:', error);
            this.showError('Erreur lors de la recherche des transactions');
        }
    }

    /**
     * Display search results (with week and date separators)
     */
    displayResults(transactions) {
        // Use Bootstrap classes instead of inline styles
        this.noResultsElement.classList.add('d-none');
        this.resultsTableElement.classList.remove('d-none');

        // Update count
        this.totalCountElement.textContent = this.formatNumber(transactions.length);

        // Clear table
        this.movementsTableBody.innerHTML = '';

        // Group transactions by week, then by date
        const groupedByWeek = this.groupTransactionsByWeek(transactions);

        // Display transactions
        Object.keys(groupedByWeek).sort().reverse().forEach(weekKey => {
            // Add week separator
            const weekRow = document.createElement('tr');
            weekRow.className = 'week-separator';
            const weekInfo = groupedByWeek[weekKey].weekInfo;
            const weekLabel = RatchouUtils.date.formatWeek(weekInfo);
            weekRow.innerHTML = `
                <td colspan="3" class="text-center fw-bold py-2 bg-body-secondary text-body">
                    📅 ${weekLabel}
                </td>
            `;
            this.movementsTableBody.appendChild(weekRow);

            // Group transactions by date within this week
            const groupedByDate = this.groupTransactionsByDate(groupedByWeek[weekKey].transactions);

            // Display each date in this week
            Object.keys(groupedByDate).sort().reverse().forEach(date => {
                // Add date separator
                const dateRow = document.createElement('tr');
                dateRow.className = 'date-separator';
                dateRow.innerHTML = `
                    <td colspan="3" class="text-center fw-bold py-2 bg-light">
                        📆 ${this.formatDate(date)}
                    </td>
                `;
                this.movementsTableBody.appendChild(dateRow);

                // Add transactions for this date
                groupedByDate[date].forEach(transaction => {
                    const row = this.createTransactionRow(transaction);
                    this.movementsTableBody.appendChild(row);
                });
            });
        });
    }

    /**
     * Group transactions by week
     */
    groupTransactionsByWeek(transactions) {
        const grouped = {};

        transactions.forEach(transaction => {
            const weekKey = RatchouUtils.date.getWeekKey(transaction.date_mouvement);
            if (!grouped[weekKey]) {
                grouped[weekKey] = {
                    weekInfo: RatchouUtils.date.getWeekNumber(transaction.date_mouvement),
                    transactions: []
                };
            }
            grouped[weekKey].transactions.push(transaction);
        });

        // Sort transactions within each week by date (descending)
        Object.keys(grouped).forEach(weekKey => {
            grouped[weekKey].transactions.sort((a, b) => new Date(b.date_mouvement) - new Date(a.date_mouvement));
        });

        return grouped;
    }

    /**
     * Group transactions by date
     */
    groupTransactionsByDate(transactions) {
        const grouped = {};

        transactions.forEach(transaction => {
            const date = transaction.date_mouvement.split('T')[0]; // Get date part only
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(transaction);
        });

        // Sort transactions within each date by time (descending)
        Object.keys(grouped).forEach(date => {
            grouped[date].sort((a, b) => new Date(b.date_mouvement) - new Date(a.date_mouvement));
        });

        return grouped;
    }

    /**
     * Create a transaction row
     */
    createTransactionRow(transaction) {
        const row = document.createElement('tr');
        row.className = 'movement-row';
        row.style.cursor = 'pointer';
        row.setAttribute('data-transaction-id', transaction.id);

        // Get account to determine currency
        const account = this.allAccounts.find(a => a.id === transaction.account_id);
        const currency = account?.currency || 'EUR';

        // Convert from storage unit to display value
        const amountInStorage = parseFloat(transaction.amount);
        const amountDisplay = RatchouUtils.currency.fromStorageUnit(amountInStorage, currency);
        const amountClass = amountDisplay >= 0 ? 'amount-positive' : 'amount-negative';
        const formattedAmount = RatchouUtils.currency.formatWithCurrency(amountInStorage, currency);
        const amountText = (amountDisplay >= 0 ? '+' : '') + formattedAmount;
        
        const time = new Date(transaction.date_mouvement).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        row.innerHTML = `
            <td>
                <span class="${amountClass}">${amountText}</span>
                <br>
                <small class="text-muted">${time}</small>
            </td>
            <td>
                <div>
                    <strong>${transaction.category_name || 'N/A'}</strong>
                    ${transaction.recurring_expense_id ? '<span class="badge bg-secondary ms-1" title="Dépense récurrente automatique">🔄</span>' : ''}
                </div>
                <small class="text-muted">
                    🏪 ${transaction.payee_name || 'Aucun'} -
                    💳 ${transaction.expense_type_name || 'N/A'}
                </small>
                ${transaction.description ? `<div><small class="text-info">💬 ${transaction.description}</small></div>` : ''}
            </td>
            <td>
                <small>${transaction.account_name || 'N/A'}</small>
            </td>
        `;
        
        // Add click handler to the row
        row.addEventListener('click', () => {
            this.editMovement(transaction.id);
        });
        
        return row;
    }

    /**
     * Edit a movement
     */
    async editMovement(movementId) {
        try {
            this.showLoading('Chargement du mouvement...');

            const transaction = await ratchouApp.models.transactions.getById(movementId);

            if (!transaction) {
                this.showError('Mouvement introuvable');
                return;
            }

            // Get account to determine currency
            const account = this.allAccounts.find(a => a.id === transaction.account_id);
            const currency = account?.currency || 'EUR';

            // Fill the form (convert from storage unit to display value for form)
            document.getElementById('edit_movement_id').value = transaction.id;
            document.getElementById('edit_montant').value = RatchouUtils.currency.fromStorageUnit(transaction.amount, currency);
            document.getElementById('edit_categorie_id').value = transaction.category_id || '';
            document.getElementById('edit_beneficiaire_id').value = transaction.payee_id || '';
            document.getElementById('edit_type_depense_id').value = transaction.expense_type_id || '';
            document.getElementById('edit_rmq').value = transaction.description || '';

            // Populate date and time fields
            const dateObj = new Date(transaction.date_mouvement);
            document.getElementById('edit_date').value = RatchouUtils.date.toInputDate(transaction.date_mouvement);
            document.getElementById('edit_time').value = dateObj.toTimeString().slice(0, 5); // HH:MM format

            // Store currency for update
            this.currentEditCurrency = currency;

            // Update button texts
            this.updateEditButtonTexts(transaction);

            // Update currency symbol in modal
            const currencySymbol = currency === 'BTC' ? '₿' : '€';
            const currencySymbolElement = document.getElementById('edit_currency_symbol');
            if (currencySymbolElement) {
                currencySymbolElement.textContent = currencySymbol;
            }

            // Show modal
            this.editMovementModal.show();
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading movement:', error);
            this.showError('Erreur lors du chargement du mouvement: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Update button texts in edit modal based on selected values
     */
    updateEditButtonTexts(transaction) {
        // Update category button
        const categoryBtn = document.querySelector('[data-input-target="edit_categorie_id"]');
        if (categoryBtn) {
            if (transaction.category_id) {
                const category = this.categories.find(c => c.id === transaction.category_id);
                if (category) {
                    categoryBtn.innerHTML = `📂 ${category.libelle}`;
                    categoryBtn.className = 'btn btn-primary rounded-pill w-100';
                } else {
                    categoryBtn.innerHTML = '📂 Catégorie';
                    categoryBtn.className = 'btn btn-outline-primary rounded-pill w-100';
                }
            } else {
                categoryBtn.innerHTML = '📂 Catégorie';
                categoryBtn.className = 'btn btn-outline-primary rounded-pill w-100';
            }
        }

        // Update payee button
        const payeeBtn = document.querySelector('[data-input-target="edit_beneficiaire_id"]');
        if (payeeBtn) {
            if (transaction.payee_id) {
                const payee = this.payees.find(p => p.id === transaction.payee_id);
                if (payee) {
                    payeeBtn.innerHTML = `👥 ${payee.libelle}`;
                    payeeBtn.className = 'btn btn-primary rounded-pill w-100';
                } else {
                    payeeBtn.innerHTML = '👥 Bénéficiaire';
                    payeeBtn.className = 'btn btn-outline-primary rounded-pill w-100';
                }
            } else {
                payeeBtn.innerHTML = '👥 Bénéficiaire';
                payeeBtn.className = 'btn btn-outline-primary rounded-pill w-100';
            }
        }

        // Update expense type button
        const typeBtn = document.querySelector('[data-input-target="edit_type_depense_id"]');
        if (typeBtn) {
            if (transaction.expense_type_id) {
                const type = this.expenseTypes.find(t => t.id === transaction.expense_type_id);
                if (type) {
                    typeBtn.innerHTML = `💳 ${type.libelle}`;
                    typeBtn.className = 'btn btn-primary rounded-pill w-100';
                } else {
                    typeBtn.innerHTML = '💳 Type';
                    typeBtn.className = 'btn btn-outline-primary rounded-pill w-100';
                }
            } else {
                typeBtn.innerHTML = '💳 Type';
                typeBtn.className = 'btn btn-outline-primary rounded-pill w-100';
            }
        }
    }

    /**
     * Update movement
     */
    async updateMovement() {
        try {
            const formData = new FormData(document.getElementById('editMovementForm'));
            const movementId = formData.get('movement_id');

            if (!movementId) {
                this.showError('ID du mouvement manquant');
                return;
            }

            this.showLoading('Modification en cours...');

            // Use stored currency from editMovement
            const currency = this.currentEditCurrency || 'EUR';

            // Combine date and time into ISO string
            const dateValue = formData.get('date');
            const timeValue = formData.get('time');
            const combinedDateTime = `${dateValue}T${timeValue}:00.000Z`;

            const updateData = {
                amount: RatchouUtils.currency.toStorageUnit(parseFloat(formData.get('montant')), currency),
                category_id: formData.get('categorie_id') || null,
                payee_id: formData.get('beneficiaire_id') || null,
                expense_type_id: formData.get('type_depense_id') || null,
                description: formData.get('rmq') || null,
                date_mouvement: combinedDateTime
            };

            await ratchouApp.models.transactions.update(movementId, updateData);
            
            this.editMovementModal.hide();
            this.showSuccess('✅ Mouvement modifié avec succès');
            
            // Refresh search results
            await this.searchTransactions();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Error updating movement:', error);
            this.showError('Erreur lors de la modification: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Delete current movement being edited
     */
    async deleteCurrentMovement() {
        const movementId = document.getElementById('edit_movement_id').value;
        if (!movementId) return;
        
        const categoryName = document.getElementById('edit_categorie_id').value;
        await this.deleteMovement(movementId, categoryName || 'Mouvement');
    }

    /**
     * Delete a movement
     */
    async deleteMovement(movementId, movementLabel) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ce mouvement ?`)) {
            return;
        }
        
        try {
            this.showLoading('Suppression en cours...');
            
            await ratchouApp.models.transactions.delete(movementId);
            
            // Close modal if open
            if (this.editMovementModal._isShown) {
                this.editMovementModal.hide();
            }
            
            this.showSuccess('✅ Mouvement supprimé avec succès');
            
            // Refresh search results
            await this.searchTransactions();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Error deleting movement:', error);
            this.showError('Erreur lors de la suppression: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        // Clear form
        this.searchForm.reset();
        
        // Clear hidden inputs
        document.getElementById('categorie_filter').value = '';
        document.getElementById('beneficiaire_filter').value = '';
        document.getElementById('type_depense_filter').value = '';
        
        // Reset buttons
        document.querySelectorAll('[data-panel-target]').forEach(button => {
            const originalText = button.getAttribute('data-original-text');
            const icon = button.getAttribute('data-icon');
            if (originalText && icon) {
                button.innerHTML = `${icon} ${originalText}`;
                button.className = 'btn btn-outline-primary rounded-pill w-100';
            }
        });
        
        // Clear results
        this.currentFilters = {};
        this.currentResults = [];
        this.totalItems = 0;
        this.showNoResults();
    }

    /**
     * Show no results state
     */
    showNoResults(searched = false) {
        this.noResultsElement.classList.remove('d-none');
        this.resultsTableElement.classList.add('d-none');
        this.totalCountElement.textContent = '0';
        
        if (searched) {
            this.noResultsElement.innerHTML = `
                <div class="mb-3">🔍</div>
                <div>Aucun mouvement trouvé avec ces critères</div>
            `;
        } else {
            this.noResultsElement.innerHTML = `
                <div class="mb-3">📭</div>
                <div>Utilisez les filtres ci-dessus pour rechercher des mouvements</div>
            `;
        }
    }

    /**
     * Utility functions
     */
    formatCurrency(amount, currency = 'EUR') {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    formatNumber(number) {
        return new Intl.NumberFormat('fr-FR').format(number);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    showLoading(message = 'Chargement...') {
        if (this.loadingOverlay) {
            document.getElementById('loadingMessage').textContent = message;
            this.loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }

    showError(message) {
        this.showAlert('danger', '❌ ' + message);
    }

    showSuccess(message) {
        this.showAlert('success', message);
    }

    showAlert(type, message) {
        const container = document.querySelector('.container');
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    redirectToLogin() {
        if (location.pathname.endsWith('../index.html') || location.pathname.endsWith('index.html')) {
            return; // Already on login page
        }
        location.replace('../index.html');
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
        
        // Focus on input
        setTimeout(() => {
            document.getElementById('newCategoryName').focus();
        }, 300);
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
        
        // Focus on input
        setTimeout(() => {
            document.getElementById('newPayeeName').focus();
        }, 300);
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
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
                modal.hide();

                // Store current filter value
                const currentFilter = document.getElementById('categorieFilter').value;

                // Refresh categories data
                this.categories = await ratchouApp.models.categories.getAll();
                this.populateCategoriesPanel();

                // Restore filter and apply it
                if (currentFilter) {
                    document.getElementById('categorieFilter').value = currentFilter;
                    this.filterCategoriesPanel();
                }

                this.showSuccess(`✅ Catégorie "${name}" ajoutée avec succès`);
            } else {
                this.showError('Erreur lors de l\'ajout : ' + result.message);
            }

        } catch (error) {
            console.error('Error adding category:', error);
            this.showError('Erreur lors de l\'ajout de la catégorie : ' + error.message);
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
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addPayeeModal'));
                modal.hide();

                // Store current filter value
                const currentFilter = document.getElementById('beneficiaireFilter').value;

                // Refresh payees data
                this.payees = await ratchouApp.models.payees.getAll();
                this.populatePayeesPanel();

                // Restore filter and apply it
                if (currentFilter) {
                    document.getElementById('beneficiaireFilter').value = currentFilter;
                    this.filterPayeesPanel();
                }

                this.showSuccess(`✅ Bénéficiaire "${name}" ajouté avec succès`);
            } else {
                this.showError('Erreur lors de l\'ajout : ' + result.message);
            }

        } catch (error) {
            console.error('Error adding payee:', error);
            this.showError('Erreur lors de l\'ajout du bénéficiaire : ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
}

// Global functions for onclick handlers
window.closePanels = function() {
    if (window.mouvementsController) {
        window.mouvementsController.closePanels();
    }
};

// Initialize controller when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.mouvementsController = new MouvementsController();
    await window.mouvementsController.init();
});