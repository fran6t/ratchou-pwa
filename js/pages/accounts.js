/**
 * Accounts Management Controller
 * Handles all account-related operations in the accounts management page
 */
class AccountsController {
    constructor() {
        this.accounts = [];
        this.addModal = null;
        this.editModal = null;
        this.loadingOverlay = null;
    }

    /**
     * Initialize the controller
     */
    async initialize() {
        try {
            // Load components first
            await this.loadComponents();
            
            this.initializeElements();
            this.setupEventListeners();
            await this.loadAccounts();
        } catch (error) {
            console.error('Error initializing accounts controller:', error);
            this.showError('Erreur lors de l\'initialisation de la page');
        }
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '🏦 Comptes',
            showAccountInfo: false,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.addModal = new bootstrap.Modal(document.getElementById('addModal'));
        this.editModal = new bootstrap.Modal(document.getElementById('editAccountModal'));
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Create account button (in modal)
        document.getElementById('createAccountBtn').addEventListener('click', () => {
            this.handleCreateAccount();
        });

        // Update account button
        document.getElementById('updateAccountBtn').addEventListener('click', () => {
            this.handleUpdateAccount();
        });

        // Modal cleanup
        document.getElementById('addModal').addEventListener('hidden.bs.modal', () => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.style.overflow = 'auto';
        });
        
        document.getElementById('editAccountModal').addEventListener('hidden.bs.modal', () => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.style.overflow = 'auto';
        });
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Show loading state on button
     */
    showButtonLoading(button) {
        const spinner = button.querySelector('.spinner-border');
        if (spinner) {
            spinner.style.display = 'inline-block';
        }
        button.disabled = true;
    }

    /**
     * Hide loading state on button
     */
    hideButtonLoading(button) {
        const spinner = button.querySelector('.spinner-border');
        if (spinner) {
            spinner.style.display = 'none';
        }
        button.disabled = false;
    }

    /**
     * Show success alert
     */
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    /**
     * Show error alert
     */
    showError(message) {
        this.showAlert(message, 'danger');
    }

    /**
     * Show alert message
     */
    showAlert(message, type) {
        const alertContainer = document.getElementById('alertContainer');
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        alertContainer.innerHTML = alertHtml;

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    /**
     * Load all accounts
     */
    async loadAccounts() {
        try {
            this.accounts = await ratchouApp.models.accounts.getAll();
            this.renderAccounts();
        } catch (error) {
            console.error('Error loading accounts:', error);
            this.showError('Erreur lors du chargement des comptes');
        }
    }

    /**
     * Render accounts list
     */
    renderAccounts() {
        const accountsList = document.getElementById('accountsList');

        if (this.accounts.length === 0) {
            accountsList.innerHTML = '<li class="list-group-item text-muted">Aucun compte trouvé.</li>';
            return;
        }

        const accountsHtml = this.accounts.map(account => {
            const balanceInEuros = RatchouUtils.currency.toEuros(account.balance);
            const balanceClass = balanceInEuros >= 0 ? 'amount-positive' : 'amount-negative';
            const formattedBalance = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(balanceInEuros);

            return `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${this.escapeHtml(account.nom_compte)}</strong>
                        ${account.is_principal ? '<span class="badge bg-primary ms-2">Principal</span>' : ''}
                        <br>
                        <small class="${balanceClass}">${formattedBalance}</small>
                    </div>
                    <div class="btn-group">
                        ${!account.is_principal ? `
                            <button class="btn btn-sm btn-outline-success" title="Définir comme principal" 
                                    onclick="accountsController.setPrincipal('${account.id}')">
                                ★
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-primary" title="Modifier" 
                                onclick="accountsController.editAccount('${account.id}', '${this.escapeHtml(account.nom_compte)}', ${balanceInEuros})">
                            ✏️
                        </button>
                        ${!account.is_principal ? `
                            <button class="btn btn-sm btn-outline-danger" title="Supprimer" 
                                    onclick="accountsController.deleteAccount('${account.id}', '${this.escapeHtml(account.nom_compte)}')">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </li>
            `;
        }).join('');

        accountsList.innerHTML = accountsHtml;
    }

    /**
     * Handle create account (from modal)
     */
    async handleCreateAccount() {
        const createButton = document.getElementById('createAccountBtn');
        const form = document.getElementById('addAccountForm');
        
        if (!createButton || !form) {
            console.error('Create button or form not found');
            this.showError('Erreur: éléments introuvables');
            return;
        }
        
        try {
            this.showButtonLoading(createButton);

            const formData = new FormData(form);
            const accountData = {
                nom_compte: formData.get('nom_compte').trim(),
                balance: RatchouUtils.currency.toCents(parseFloat(formData.get('solde_initial') || 0)),
                is_principal: formData.has('compte_principal')
            };

            // Validation
            if (!accountData.nom_compte) {
                this.showError('Le nom du compte est requis');
                return;
            }

            // Check if account name already exists
            const existingAccount = this.accounts.find(acc => 
                acc.nom_compte.toLowerCase() === accountData.nom_compte.toLowerCase()
            );
            if (existingAccount) {
                this.showError('Un compte avec ce nom existe déjà');
                return;
            }

            const result = await ratchouApp.models.accounts.create(accountData);

            if (result.success) {
                this.addModal.hide();
                this.showSuccess('Compte créé avec succès');
                form.reset();
                await this.loadAccounts();
            } else {
                this.showError(result.message || 'Erreur lors de la création du compte');
            }

        } catch (error) {
            console.error('Error adding account:', error);
            this.showError('Erreur lors de la création du compte');
        } finally {
            this.hideButtonLoading(createButton);
        }
    }

    /**
     * Edit account
     */
    editAccount(id, name, balance) {
        document.getElementById('edit_account_id').value = id;
        document.getElementById('edit_nom_compte').value = name;
        document.getElementById('edit_solde').value = balance;
        this.editModal.show();
    }

    /**
     * Handle update account
     */
    async handleUpdateAccount() {
        const updateButton = document.getElementById('updateAccountBtn');
        
        try {
            this.showButtonLoading(updateButton);

            const accountId = document.getElementById('edit_account_id').value;
            const accountName = document.getElementById('edit_nom_compte').value.trim();
            const accountBalance = parseFloat(document.getElementById('edit_solde').value || 0);

            // Validation
            if (!accountName) {
                this.showError('Le nom du compte est requis');
                return;
            }

            // Check if account name already exists (excluding current account)
            const existingAccount = this.accounts.find(acc => 
                acc.id !== accountId && acc.nom_compte.toLowerCase() === accountName.toLowerCase()
            );
            if (existingAccount) {
                this.showError('Un compte avec ce nom existe déjà');
                return;
            }

            const updateData = {
                nom_compte: accountName,
                balance: RatchouUtils.currency.toCents(accountBalance),
                date_maj: new Date().toISOString()
            };

            const result = await ratchouApp.models.accounts.update(accountId, updateData);

            if (result.success) {
                this.editModal.hide();
                this.showSuccess('Compte mis à jour avec succès');
                await this.loadAccounts();
            } else {
                this.showError(result.message || 'Erreur lors de la mise à jour du compte');
            }

        } catch (error) {
            console.error('Error updating account:', error);
            this.showError('Erreur lors de la mise à jour du compte');
        } finally {
            this.hideButtonLoading(updateButton);
        }
    }

    /**
     * Delete account
     */
    async deleteAccount(id, name) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le compte "${name}" ?\n\nAttention: Cette action supprimera également toutes les transactions associées.`)) {
            return;
        }

        try {
            this.showLoading();

            // Check if account has transactions
            const transactions = await ratchouApp.models.transactions.getByAccount(id);
            if (transactions.length > 0) {
                const confirmWithTransactions = confirm(
                    `Le compte "${name}" contient ${transactions.length} transaction(s).\n\n` +
                    `Supprimer le compte supprimera également toutes ces transactions.\n\n` +
                    `Êtes-vous vraiment sûr de vouloir continuer ?`
                );
                if (!confirmWithTransactions) {
                    return;
                }
            }

            const result = await ratchouApp.models.accounts.delete(id);

            if (result.success) {
                this.showSuccess('Compte supprimé avec succès');
                await this.loadAccounts();
            } else {
                this.showError(result.message || 'Erreur lors de la suppression du compte');
            }

        } catch (error) {
            console.error('Error deleting account:', error);
            this.showError('Erreur lors de la suppression du compte');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Set account as principal
     */
    async setPrincipal(id) {
        try {
            this.showLoading();

            const result = await ratchouApp.models.accounts.setPrincipal(id);

            if (result.success) {
                this.showSuccess('Compte principal défini avec succès');
                await this.loadAccounts();
            } else {
                this.showError(result.message || 'Erreur lors de la définition du compte principal');
            }

        } catch (error) {
            console.error('Error setting principal account:', error);
            this.showError('Erreur lors de la définition du compte principal');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}

// Global instance
let accountsController;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Ratchou app
        await ratchouApp.initialize();
        
        // Check authentication
        // Check authentication with guard system
        if (window.auth && typeof window.auth.guardPage === 'function') {
            if (!auth.guardPage('app')) {
                return; // User was redirected, stop initialization
            }
        } else if (!ratchouApp.isAuthenticated()) {
            location.replace('../index.html');
            return;
        }

        // Initialize accounts controller
        accountsController = new AccountsController();
        await accountsController.initialize();

    } catch (error) {
        console.error('Error initializing accounts page:', error);
        alert('Erreur lors de l\'initialisation de la page');
    }
});