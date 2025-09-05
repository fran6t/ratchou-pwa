/**
 * Projection Page Controller
 * Handles the financial projection page functionality
 */

class ProjectionController {
    constructor() {
        this.currentAccount = null;
        this.allAccounts = [];
        
        // Modal references
        this.accountSelectModal = null;
        this.balanceModal = null;
    }

    /**
     * Initialize the projection page
     */
    async init() {
        try {
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
                location.replace('index.html');
                return;
            }

            await this.loadComponents();
            this.setupDOMElements();
            await this.initializeData();
            this.setupEventListeners();
            this.updateAccountDisplay();
            await this.loadFinancialProjection();
            
        } catch (error) {
            console.error('Error initializing projection page:', error);
            this.showError('Erreur d\'initialisation: ' + error.message);
        }
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '📅 Projection financière',
            showAccountInfo: true,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    /**
     * Setup DOM elements and modals
     */
    setupDOMElements() {
        // Initialize modals
        this.accountSelectModal = new bootstrap.Modal(document.getElementById('accountSelectModal'));
        this.balanceModal = new bootstrap.Modal(document.getElementById('balanceModal'));
    }

    /**
     * Initialize data (load accounts)
     */
    async initializeData() {
        // Get all accounts
        const accounts = await ratchouApp.models.accounts.getAll();
        this.allAccounts = accounts;
        
        if (accounts.length === 0) {
            throw new Error('Aucun compte disponible');
        }
        
        // Use current account from ratchouApp if available, otherwise use principal account, or first account
        try {
            this.currentAccount = await ratchouApp.getCurrentAccount();
        } catch (error) {
            console.log('No current account found, using fallback');
        }
        
        // Fallback to principal account or first account if current account not found
        if (!this.currentAccount) {
            this.currentAccount = accounts.find(acc => acc.is_principal) || accounts[0];
            // Update ratchouApp with the selected account
            ratchouApp.setCurrentAccount(this.currentAccount.id);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Period selection change
        document.querySelectorAll('input[name="projectionPeriod"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.loadFinancialProjection(parseInt(radio.value));
                }
            });
        });

        // Account name click - open account selection modal
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'currentAccountName') {
                this.openAccountSelectModal();
            }
        });

        // Setup balance modal
        this.setupBalanceModal();
    }

    /**
     * Load and display financial projection for specified period
     */
    async loadFinancialProjection(days = 7) {
        try {
            const projectionContent = document.getElementById('projectionContent');
            
            // Show loading state
            projectionContent.innerHTML = `
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
            document.getElementById('projectionContent').innerHTML = `
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
            
            // Add recurring expenses if they should execute on this day
            recurringExpenses.forEach(expense => {
                if (this.shouldRecurringExpenseExecute(expense, date)) {
                    console.log(`  → Adding recurring expense: ${expense.libelle} (${RatchouUtils.currency.format(expense.amount)})`);
                    const amountInEuros = RatchouUtils.currency.toEuros(expense.amount);
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
            });
            
            projection.push(dayProjection);
        }
        
        return projection;
    }

    /**
     * Get future transactions for a specific account and date range
     */
    async getFutureTransactions(accountId, startDate, endDate) {
        try {
            // Get all transactions for this account
            const allTransactions = await ratchouApp.models.transactions.getByAccount(accountId);
            
            // Filter for future transactions within the date range
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
     * Check if a recurring expense should execute on a given date
     */
    shouldRecurringExpenseExecute(expense, checkDate) {
        // For projections, we're more permissive than for actual execution
        // We want to show what *could* happen, not just what *will* happen based on strict rules
        
        const dayOfMonth = checkDate.getDate();
        const expenseDayOfMonth = expense.day_of_month;
        
        console.log(`  → Checking recurring expense "${expense.libelle}" for day ${dayOfMonth} (expense day: ${expenseDayOfMonth})`);
        
        // Check if the day matches
        if (dayOfMonth !== expenseDayOfMonth) {
            console.log(`    × Day doesn't match (${dayOfMonth} !== ${expenseDayOfMonth})`);
            return false;
        }
        
        // For projection purposes, we're more lenient about recent executions
        if (expense.last_execution) {
            const lastExecution = new Date(expense.last_execution);
            const currentMonth = checkDate.getMonth();
            const currentYear = checkDate.getFullYear();
            const lastExecutionMonth = lastExecution.getMonth();
            const lastExecutionYear = lastExecution.getFullYear();
            
            // For projection, only skip if it was executed in the current month
            if (lastExecutionYear === currentYear && lastExecutionMonth === currentMonth) {
                console.log(`    × Already executed this month (${lastExecution.toDateString()})`);
                return false;
            }
        }
        
        console.log(`    ✓ Should execute on ${checkDate.toDateString()}`);
        return true;
    }

    /**
     * Display the financial projection
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
                            <div class="small mb-1">💰 Solde</div>
                            <div class="fs-6 fw-bold">${RatchouUtils.currency.format(currentBalance * 100)}</div>
                            <div class="small opacity-75">Actuel</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card ${finalBalanceClass === 'text-success' ? 'bg-success' : 'bg-danger'} text-white">
                        <div class="card-body text-center py-2">
                            <div class="small mb-1">🎯 Solde final</div>
                            <div class="fs-6 fw-bold">${RatchouUtils.currency.format(finalBalance * 100)}</div>
                            <div class="small opacity-75">Dans ${days} jours</div>
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
            </div>
        `;

        if (daysWithTransactions.length === 0) {
            html += `
                <div class="text-center p-5">
                    <i class="mb-3 d-block" style="font-size: 3rem;">😴</i>
                    <h5 class="text-muted">Aucune transaction prévue</h5>
                    <p class="text-muted">Aucun mouvement planifié pour les ${days} prochains jours sur le compte "${this.currentAccount.nom_compte}".</p>
                    <i class="me-1">💡</i>Cette projection inclut toutes les transactions futures plannifiées sur le compte actuel, 
                    ainsi que les dépenses récurrentes programmées.
                </div>
            `;
        } else {
            // Timeline of transactions
            html += `<div class="timeline">`;
            
            daysWithTransactions.forEach((day, index) => {
                const dayBalance = currentBalance + projection.slice(0, projection.indexOf(day) + 1).reduce((sum, d) => sum + d.totalAmount, 0);
                const dayBalanceClass = dayBalance >= 0 ? 'text-success' : 'text-danger';
                
                const isToday = day.isToday;
                const dateStr = day.date.toLocaleDateString('fr-FR', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                });
                
                html += `
                    <div class="timeline-item ${isToday ? 'timeline-today' : ''}">
                        <div class="timeline-marker ${isToday ? 'timeline-marker-today' : ''}">
                            ${isToday ? '📍' : '📅'}
                        </div>
                        <div class="timeline-content">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="mb-0 ${isToday ? 'text-primary' : ''}">${dateStr} ${isToday ? '(Aujourd\'hui)' : ''}</h6>
                                <div class="text-end">
                                    <div class="fw-bold ${dayBalanceClass}">
                                        ${RatchouUtils.currency.format(dayBalance * 100)}
                                    </div>
                                    <small class="text-muted">Solde après</small>
                                </div>
                            </div>
                            <div class="transactions-list">
                `;
                
                day.transactions.forEach(transaction => {
                    const amountClass = transaction.isPositive ? 'text-success' : 'text-danger';
                    const typeIcon = transaction.type === 'recurring' ? '🔄' : '💸';
                    const typeLabel = transaction.type === 'recurring' ? 'Récurrent' : 'Planifié';
                    
                    html += `
                        <div class="transaction-item d-flex justify-content-between align-items-center">
                            <div class="flex-grow-1">
                                <div class="fw-bold">${transaction.libelle}</div>
                                <small class="text-muted">${typeIcon} ${typeLabel}</small>
                            </div>
                            <div class="text-end">
                                <span class="fw-bold ${amountClass}">
                                    ${RatchouUtils.currency.format(transaction.amountInCents)}
                                </span>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
            
            // Final info
            html += `
                <div class="mt-4 p-3 bg-light rounded">
                    <small class="text-muted">
                        <i class="me-1">💡</i>Cette projection inclut toutes les transactions futures plannifiées sur le compte actuel, 
                        ainsi que les dépenses récurrentes programmées. Les montants sont indicatifs et peuvent varier.
                    </small>
                </div>
            `;
        }
        
        document.getElementById('projectionContent').innerHTML = html;
    }

    // =================================================================
    // Multi-Account Management Methods
    // =================================================================

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
     * Select and switch to a different account
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
            
            this.updateAccountDisplay();
            await this.loadFinancialProjection(); // Reload projection for new account
            
            this.accountSelectModal.hide();
            this.showSuccess(`Compte "${account.nom_compte}" sélectionné`);
            
        } catch (error) {
            console.error('Error selecting account:', error);
            this.showError('Erreur de sélection: ' + error.message);
        }
    }

    /**
     * Setup balance correction modal
     */
    setupBalanceModal() {
        const updateBtn = document.getElementById('updateBalanceBtn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.handleBalanceCorrection());
        }

        // Show current balance when modal opens
        document.getElementById('balanceModal').addEventListener('show.bs.modal', () => {
            if (this.currentAccount) {
                const currentBalanceSpan = document.getElementById('currentBalance');
                const newBalanceInput = document.getElementById('newBalance');
                
                const balanceInEuros = RatchouUtils.currency.toEuros(this.currentAccount.balance);
                currentBalanceSpan.textContent = RatchouUtils.currency.format(this.currentAccount.balance);
                newBalanceInput.value = balanceInEuros.toFixed(2);
                newBalanceInput.select();
            }
        });
    }

    /**
     * Handle balance correction
     */
    async handleBalanceCorrection() {
        try {
            const newBalanceEuros = parseFloat(document.getElementById('newBalance').value);
            
            if (isNaN(newBalanceEuros)) {
                this.showError('Montant invalide');
                return;
            }

            const result = await ratchouApp.models.accounts.correctBalance(
                this.currentAccount.id, 
                Math.round(newBalanceEuros * 100) // Convert to centimes
            );

            if (result.success) {
                // Update current account balance
                this.currentAccount.balance = Math.round(newBalanceEuros * 100);
                this.updateAccountDisplay();
                this.balanceModal.hide();
                this.showSuccess('Solde mis à jour avec succès');
                
                // Reload projection with updated balance
                await this.loadFinancialProjection();
            } else {
                this.showError('Erreur: ' + result.message);
            }
            
        } catch (error) {
            console.error('Error updating balance:', error);
            this.showError('Erreur de mise à jour: ' + error.message);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const container = document.querySelector('.container');
        if (container) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-success alert-dismissible fade show';
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            container.insertBefore(alert, container.firstChild);
            
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 3000);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Simple error display
        const container = document.querySelector('.container');
        if (container) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-danger alert-dismissible fade show';
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            container.insertBefore(alert, container.firstChild);
            
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 5000);
        }
    }
}

// Initialize the controller when DOM is loaded
let projectionController;
document.addEventListener('DOMContentLoaded', async () => {
    projectionController = new ProjectionController();
    await projectionController.init();
});

// Global function for external access if needed
window.projectionController = projectionController;