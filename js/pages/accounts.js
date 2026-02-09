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

        // Handle principal account checkbox change in add modal
        document.getElementById('compte_principal').addEventListener('change', (e) => {
            this.toggleAutoCopySection(e.target.checked, 'auto_copy_section');
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
     * Toggle auto copy section visibility based on principal account status
     */
    toggleAutoCopySection(isPrincipal, sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = isPrincipal ? 'none' : 'block';
            // Reset checkbox if becoming principal
            if (isPrincipal) {
                const checkbox = section.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                }
            }
        }
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.setProperty('display', 'flex', 'important');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.setProperty('display', 'none', 'important');
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
            console.log('🏦 [loadAccounts] Chargement des comptes...');
            this.accounts = await ratchouApp.models.accounts.getAll();
            console.log('🏦 [loadAccounts] Comptes récupérés:', this.accounts.length, 'comptes');

            this.renderAccounts();
            console.log('🏦 [loadAccounts] Rendu terminé');
        } catch (error) {
            console.error('🏦 [loadAccounts] Erreur:', error);
            this.showError('Erreur lors du chargement des comptes');
        }
    }

    /**
     * Render accounts list
     */
    renderAccounts() {
        try {
            console.log('🏦 [renderAccounts] Début du rendu, comptes:', this.accounts?.length || 0);

            const accountsList = document.getElementById('accountsList');
            if (!accountsList) {
                console.error('🏦 [renderAccounts] Élément accountsList non trouvé !');
                return;
            }

            if (!this.accounts || this.accounts.length === 0) {
                console.log('🏦 [renderAccounts] Aucun compte à afficher');
                accountsList.innerHTML = '<li class="list-group-item text-muted">Aucun compte trouvé.</li>';
                return;
            }

            const accountsHtml = this.accounts.map(account => {
                console.log('🏦 [renderAccounts] Rendu compte:', account.nom_compte, 'Principal:', account.is_principal);

                const currency = account.currency || 'EUR';
                const currencySymbol = RatchouUtils.currency.getSymbol(currency);
                const formattedBalance = RatchouUtils.currency.formatWithCurrency(account.balance, currency);
                const balanceAmount = RatchouUtils.currency.fromStorageUnit(account.balance, currency);
                const balanceClass = balanceAmount >= 0 ? 'amount-positive' : 'amount-negative';

                return `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${this.escapeHtml(account.nom_compte)}</strong>
                            ${account.is_principal ? '<span class="badge bg-primary ms-2">Principal</span>' : ''}
                            ${account.auto_copy_to_principal ? '<span class="badge bg-info ms-2" title="Copie automatique vers compte principal">📋</span>' : ''}
                            ${account.remarque_encrypted ? '<span class="badge bg-secondary ms-2" title="Remarque chiffrée">🔒</span>' : ''}
                            <br>
                            <small class="${balanceClass}">${formattedBalance}</small>
                        </div>
                        <div class="btn-group">
                            ${!account.is_principal ? `
                                <button class="btn btn-sm btn-outline-success" title="Définir comme principal"
                                        onclick="accountsController.setPrincipal('${account.id}')" id="btn-principal-${account.id}">
                                    ★
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-primary" title="Modifier"
                                    onclick="accountsController.editAccount('${account.id}', '${this.escapeHtml(account.nom_compte)}', ${balanceAmount})">
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

            console.log('🏦 [renderAccounts] Mise à jour du DOM...');
            accountsList.innerHTML = accountsHtml;
            console.log('🏦 [renderAccounts] DOM mis à jour avec succès');

        } catch (error) {
            console.error('🏦 [renderAccounts] Erreur lors du rendu:', error);
            this.showError('Erreur lors de l\'affichage des comptes');
        }
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
            const isPrincipal = formData.has('compte_principal');

            // Get remarque and crypto key
            const remarque = formData.get('remarque')?.trim() || '';
            const cryptoKey = formData.get('crypto_key')?.trim() || '';
            let remarqueEncrypted = null;

            // Encrypt remarque if both remarque and key are provided
            if (remarque && cryptoKey) {
                try {
                    remarqueEncrypted = await CryptoUtils.encrypt(remarque, cryptoKey);
                } catch (encryptError) {
                    this.showError('Erreur de chiffrement: ' + encryptError.message);
                    return;
                }
            } else if (remarque && !cryptoKey) {
                // Store plain text if no key provided
                remarqueEncrypted = remarque;
            }

            const currency = formData.get('devise') || 'EUR';
            const soldeInitial = parseFloat(formData.get('solde_initial') || 0);

            const accountData = {
                nom_compte: formData.get('nom_compte').trim(),
                balance: RatchouUtils.currency.toStorageUnit(soldeInitial, currency),
                currency: currency,
                is_principal: isPrincipal,
                auto_copy_to_principal: isPrincipal ? false : formData.has('auto_copy_to_principal'),
                remarque_encrypted: remarqueEncrypted
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
        // Find the account to get all its properties
        const account = this.accounts.find(acc => acc.id === id);

        document.getElementById('edit_account_id').value = id;
        document.getElementById('edit_nom_compte').value = name;
        document.getElementById('edit_solde').value = balance;

        // Set currency
        if (account && account.currency) {
            document.getElementById('edit_devise').value = account.currency;
        } else {
            document.getElementById('edit_devise').value = 'EUR';
        }

        // Set auto copy checkbox and visibility
        if (account) {
            const autoCopyCheckbox = document.getElementById('edit_auto_copy_to_principal');
            const autoCopySection = document.getElementById('edit_auto_copy_section');

            if (account.is_principal) {
                // Hide section for principal accounts
                autoCopySection.style.display = 'none';
                autoCopyCheckbox.checked = false;
            } else {
                // Show section and set current value for non-principal accounts
                autoCopySection.style.display = 'block';
                autoCopyCheckbox.checked = !!account.auto_copy_to_principal;
            }

            // Display encrypted remark
            const encryptedDisplay = document.getElementById('encrypted_display');
            const encryptedPreview = document.getElementById('encrypted_preview');
            const noRemarkDisplay = document.getElementById('no_remark_display');

            if (account.remarque_encrypted) {
                encryptedPreview.textContent = CryptoUtils.truncateEncrypted(account.remarque_encrypted, 60);
                encryptedDisplay.style.display = 'block';
                noRemarkDisplay.style.display = 'none';
            } else {
                encryptedDisplay.style.display = 'none';
                noRemarkDisplay.style.display = 'block';
            }

            // Clear remarque textarea and crypto key
            document.getElementById('edit_remarque').value = '';
            document.getElementById('edit_crypto_key').value = '';

            // Setup decrypt button
            this.setupDecryptButton(account);
        }

        this.editModal.show();
    }

    /**
     * Setup decrypt button handler
     */
    setupDecryptButton(account) {
        const decryptBtn = document.getElementById('decryptBtn');
        const newHandler = async () => {
            const cryptoKey = document.getElementById('edit_crypto_key').value.trim();
            const remarqueTextarea = document.getElementById('edit_remarque');

            if (!cryptoKey) {
                this.showError('Veuillez saisir la clé de déchiffrement');
                return;
            }

            if (!account.remarque_encrypted) {
                this.showError('Aucune remarque à déchiffrer');
                return;
            }

            try {
                const decrypted = await CryptoUtils.decrypt(account.remarque_encrypted, cryptoKey);
                remarqueTextarea.value = decrypted;
                this.showSuccess('Remarque déchiffrée avec succès');
            } catch (error) {
                this.showError(error.message);
            }
        };

        // Remove old listener and add new one
        const newBtn = decryptBtn.cloneNode(true);
        decryptBtn.parentNode.replaceChild(newBtn, decryptBtn);
        newBtn.addEventListener('click', newHandler);
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
            const currency = document.getElementById('edit_devise').value;

            // Get remarque and crypto key
            const remarque = document.getElementById('edit_remarque').value.trim();
            const cryptoKey = document.getElementById('edit_crypto_key').value.trim();

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

            // Find the account to check if it's principal
            const account = this.accounts.find(acc => acc.id === accountId);
            const autoCopyCheckbox = document.getElementById('edit_auto_copy_to_principal');

            const updateData = {
                nom_compte: accountName,
                balance: RatchouUtils.currency.toStorageUnit(accountBalance, currency),
                currency: currency,
                auto_copy_to_principal: (account && account.is_principal) ? false : autoCopyCheckbox.checked,
                date_maj: new Date().toISOString()
            };

            // Handle remarque encryption if modified
            if (remarque) {
                if (cryptoKey) {
                    // Encrypt new remarque
                    try {
                        updateData.remarque_encrypted = await CryptoUtils.encrypt(remarque, cryptoKey);
                    } catch (encryptError) {
                        this.showError('Erreur de chiffrement: ' + encryptError.message);
                        return;
                    }
                } else {
                    // Store plain text
                    updateData.remarque_encrypted = remarque;
                }
            }
            // If remarque is empty, don't modify the existing remarque_encrypted field

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
     * Delete account with cascade deletion of transactions
     */
    async deleteAccount(id, name) {
        // 1st confirmation
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le compte "${name}" ?\n\nAttention: Cette action supprimera également toutes les transactions associées.`)) {
            return;
        }

        try {
            this.showLoading();

            // Get transactions associated with this account
            const transactions = await ratchouApp.models.transactions.getByAccount(id);

            // 2nd confirmation if transactions exist
            if (transactions.length > 0) {
                const confirmWithTransactions = confirm(
                    `Le compte "${name}" contient ${transactions.length} transaction(s).\n\n` +
                    `Supprimer le compte supprimera également toutes ces transactions.\n\n` +
                    `Êtes-vous vraiment sûr de vouloir continuer ?`
                );
                if (!confirmWithTransactions) {
                    this.hideLoading();
                    return;
                }

                // Cascade deletion: delete all transactions
                console.log('🗑️ Suppression en cascade de', transactions.length, 'transaction(s)...');
                for (const transaction of transactions) {
                    await ratchouApp.models.transactions.delete(transaction.id);
                }
                console.log('✅ Transactions supprimées');
            }

            // Delete the account (now without transactions)
            const result = await ratchouApp.models.accounts.delete(id);

            if (result.success) {
                this.showSuccess('Compte supprimé avec succès');

                // If the deleted account was the current account, clear it from storage
                const currentAccountId = RatchouUtils.storage.get('current_account_id');
                if (currentAccountId === id) {
                    console.log('🏦 Compte courant supprimé - nettoyage du localStorage');
                    RatchouUtils.storage.remove('current_account_id');
                }

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
            console.log('🏦 [setPrincipal] Début - Compte ID:', id);

            // Indicateur visuel sur le bouton
            const button = document.getElementById(`btn-principal-${id}`);
            if (button) {
                button.innerHTML = '⏳';
                button.disabled = true;
                console.log('🏦 [setPrincipal] Bouton mis à jour avec indicateur');
            }

            const result = await ratchouApp.models.accounts.setPrincipal(id);
            console.log('🏦 [setPrincipal] Résultat BDD:', result);

            if (result.success) {
                this.showSuccess('Compte principal défini avec succès');

                console.log('🏦 [setPrincipal] Rafraîchissement de la liste...');
                await this.loadAccounts();
                console.log('🏦 [setPrincipal] Rafraîchissement terminé');
            } else {
                console.error('🏦 [setPrincipal] Échec:', result.message);
                this.showError(result.message || 'Erreur lors de la définition du compte principal');

                // Restaurer le bouton en cas d'erreur
                if (button) {
                    button.innerHTML = '★';
                    button.disabled = false;
                }
            }

        } catch (error) {
            console.error('🏦 [setPrincipal] Exception:', error);
            this.showError('Erreur lors de la définition du compte principal');

            // Restaurer le bouton en cas d'erreur
            const button = document.getElementById(`btn-principal-${id}`);
            if (button) {
                button.innerHTML = '★';
                button.disabled = false;
            }
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