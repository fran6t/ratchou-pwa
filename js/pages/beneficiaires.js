/**
 * Beneficiaires Management Controller
 * Handles all beneficiary-related operations in the beneficiaires management page
 */
class BeneficiairesController {
    constructor() {
        this.beneficiaires = [];
        this.currentFilter = '';
        this.currentSortMode = 'alphabetical'; // 'alphabetical' or 'usage'
        this.addModal = null;
        this.editModal = null;
        this.deleteModal = null;
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
            this.loadSortMode();
            await this.loadBeneficiaires();
        } catch (error) {
            console.error('Error initializing beneficiaires controller:', error);
            this.showError('Erreur lors de l\'initialisation de la page');
        }
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '👥 Bénéficiaires',
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
        this.editModal = new bootstrap.Modal(document.getElementById('editModal'));
        this.deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Create beneficiary button (in modal)
        const createBtn = document.getElementById('createBeneficiaryBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.handleCreateBeneficiaire();
            });
        }

        // Update beneficiary button - vérifier si l'élément existe
        const updateBtn = document.getElementById('updateBeneficiaryBtn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => {
                this.handleUpdateBeneficiaire();
            });
        }

        // Delete beneficiary button from edit modal
        const deleteBeneficiaryFromEditBtn = document.getElementById('deleteBeneficiaryFromEditBtn');
        if (deleteBeneficiaryFromEditBtn) {
            deleteBeneficiaryFromEditBtn.addEventListener('click', () => {
                this.handleDeleteBeneficiaryFromEdit();
            });
        }

        // Delete beneficiary button - vérifier si l'élément existe
        const deleteBtn = document.getElementById('deleteBeneficiaryBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.handleDeleteBeneficiaire();
            });
        }

        // Filter functionality
        const filterInput = document.getElementById('beneficiaryFilter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this.filterBeneficiaires(e.target.value);
            });
        }

        // Clear filter button
        const clearFilterBtn = document.getElementById('clearFilterBtn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                this.clearFilter();
            });
        }

        // Sort toggle button
        const sortToggleBtn = document.getElementById('sortToggleBtn');
        if (sortToggleBtn) {
            sortToggleBtn.addEventListener('click', () => {
                this.toggleSortMode();
            });
        }

        // Modal cleanup
        const addModal = document.getElementById('addModal');
        if (addModal) {
            addModal.addEventListener('hidden.bs.modal', () => {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.style.overflow = 'auto';
            });
        }
        
        const editModal = document.getElementById('editModal');
        if (editModal) {
            editModal.addEventListener('hidden.bs.modal', () => {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.style.overflow = 'auto';
            });
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
        if (!button) {
            console.warn('Button is null in showButtonLoading');
            return;
        }
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
        if (!button) {
            console.warn('Button is null in hideButtonLoading');
            return;
        }
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
     * Load all beneficiaires
     */
    async loadBeneficiaires() {
        try {
            if (this.currentSortMode === 'usage') {
                this.beneficiaires = await ratchouApp.models.payees.getAllSortedByUsage();
            } else {
                this.beneficiaires = await ratchouApp.models.payees.getAllSorted();
            }
            this.renderBeneficiaires();
        } catch (error) {
            console.error('Error loading beneficiaires:', error);
            this.showError('Erreur lors du chargement des bénéficiaires');
        }
    }

    /**
     * Render beneficiaires list
     */
    renderBeneficiaires(beneficiairesToRender = null) {
        const beneficiaryList = document.getElementById('beneficiaryList');
        const beneficiaires = beneficiairesToRender || this.beneficiaires;

        if (beneficiaires.length === 0) {
            const message = this.currentFilter ? 
                `Aucun bénéficiaire ne correspond au filtre "${this.currentFilter}".` : 
                'Aucun bénéficiaire trouvé.';
            beneficiaryList.innerHTML = `<div class="text-center py-4"><div class="text-muted">${message}</div></div>`;
            return;
        }

        // Beneficiaires are already sorted by loadBeneficiaires()
        const sortedBeneficiaires = [...beneficiaires];

        const beneficiairesHtml = sortedBeneficiaires.map(beneficiary => {
            return `
                <div class="card mb-2 beneficiary-card" style="cursor: pointer;" 
                     data-beneficiary-id="${beneficiary.id}" 
                     data-beneficiary-libelle="${this.escapeHtml(beneficiary.libelle)}" 
                     data-beneficiary-usage="${beneficiary.usage_count || 0}">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${this.escapeHtml(beneficiary.libelle)}</strong>
                                ${this.currentSortMode === 'usage' && (beneficiary.usage_count || 0) > 0 ? `<small class="text-muted ms-2">(${beneficiary.usage_count || 0})</small>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        beneficiaryList.innerHTML = beneficiairesHtml;
        
        // Add click listeners to all beneficiary cards
        this.setupBeneficiaryCardListeners();
    }

    /**
     * Setup click listeners for beneficiary cards
     */
    setupBeneficiaryCardListeners() {
        const beneficiaryCards = document.querySelectorAll('.beneficiary-card');
        beneficiaryCards.forEach(card => {
            card.addEventListener('click', () => {
                const beneficiaryId = card.dataset.beneficiaryId;
                const beneficiaryLibelle = card.dataset.beneficiaryLibelle;
                const usageCount = parseInt(card.dataset.beneficiaryUsage) || 0;
                
                this.editBeneficiary(beneficiaryId, beneficiaryLibelle, usageCount);
            });
        });
    }

    /**
     * Handle create beneficiary (from modal)
     */
    async handleCreateBeneficiaire() {
        const createButton = document.getElementById('createBeneficiaryBtn');
        const form = document.getElementById('addBeneficiaryForm');
        
        if (!createButton || !form) {
            console.error('Create button or form not found');
            this.showError('Erreur: éléments introuvables');
            return;
        }
        
        try {
            this.showButtonLoading(createButton);

            const formData = new FormData(form);
            const beneficiaryData = {
                libelle: formData.get('libelle')?.trim()
            };

            // Validation
            if (!beneficiaryData.libelle) {
                this.showError('Le libellé du bénéficiaire est requis');
                return;
            }

            // Check if beneficiary name already exists
            const existingBeneficiary = this.beneficiaires.find(ben => 
                ben.libelle.toLowerCase() === beneficiaryData.libelle.toLowerCase()
            );
            if (existingBeneficiary) {
                this.showError('Un bénéficiaire avec ce nom existe déjà');
                return;
            }

            const result = await ratchouApp.models.payees.create(beneficiaryData);

            if (result.success) {
                this.addModal.hide();
                this.showSuccess('Bénéficiaire créé avec succès');
                form.reset();
                await this.loadBeneficiaires();
            } else {
                this.showError(result.message || 'Erreur lors de la création du bénéficiaire');
            }

        } catch (error) {
            console.error('Error adding beneficiary:', error);
            this.showError('Erreur lors de la création du bénéficiaire');
        } finally {
            this.hideButtonLoading(createButton);
        }
    }

    /**
     * Edit beneficiary
     */
    editBeneficiary(id, libelle, usageCount) {
        document.getElementById('edit_id').value = id;
        document.getElementById('edit_libelle').value = libelle;
        document.getElementById('edit_usage_count').value = usageCount || 0;
        this.editModal.show();
    }

    /**
     * Handle delete beneficiary from edit modal
     */
    async handleDeleteBeneficiaryFromEdit() {
        const beneficiaryId = document.getElementById('edit_id').value;
        const beneficiaryLibelle = document.getElementById('edit_libelle').value;
        
        // Close edit modal first
        this.editModal.hide();
        
        // Call the delete function
        await this.deleteBeneficiary(beneficiaryId, beneficiaryLibelle);
    }

    /**
     * Delete beneficiary
     */
    async deleteBeneficiary(id, libelle) {
        try {
            console.log('Starting beneficiary deletion:', id, libelle);
            
            // Check if beneficiary has transactions
            console.log('Checking for transactions...');
            const transactions = await ratchouApp.models.transactions.getByPayee(id);
            console.log('Found transactions:', transactions.length);
            
            let confirmMessage = `Êtes-vous sûr de vouloir supprimer le bénéficiaire "${libelle}" ?`;
            
            if (transactions.length > 0) {
                confirmMessage += `\n\nCe bénéficiaire contient ${transactions.length} transaction(s).\n` +
                    `Les transactions ne seront pas supprimées mais deviendront "sans bénéficiaire".\n\n` +
                    `Continuer ?`;
            }
            
            if (!confirm(confirmMessage)) {
                console.log('Deletion cancelled by user');
                return;
            }

            this.showLoading();
            console.log('Proceeding with deletion and dissociation...');
            
            // Use the delete method that handles dissociation automatically
            const result = await ratchouApp.models.payees.delete(id);
            console.log('Delete result:', result);

            if (result.success) {
                this.showSuccess(result.message || 'Bénéficiaire supprimé avec succès');
                await this.loadBeneficiaires();
                console.log('Beneficiary deleted and list reloaded');
            } else {
                this.showError(result.message || 'Erreur lors de la suppression du bénéficiaire');
                console.log('Delete failed:', result.message);
            }

        } catch (error) {
            console.error('Error deleting beneficiary:', error);
            this.showError('Erreur lors de la suppression du bénéficiaire');
        } finally {
            console.log('Hiding loading overlay...');
            this.hideLoading();
        }
    }

    /**
     * Handle update beneficiary
     */
    async handleUpdateBeneficiaire() {
        const updateButton = document.getElementById('updateBeneficiaryBtn');
        
        if (!updateButton) {
            console.error('Update button not found');
            this.showError('Erreur: bouton de mise à jour introuvable');
            return;
        }
        
        try {
            this.showButtonLoading(updateButton);

            const beneficiaryId = document.getElementById('edit_id').value;
            const beneficiaryLibelle = document.getElementById('edit_libelle').value.trim();
            const usageCount = parseInt(document.getElementById('edit_usage_count').value) || 0;

            // Validation
            if (!beneficiaryLibelle) {
                this.showError('Le libellé du bénéficiaire est requis');
                return;
            }

            // Check if beneficiary name already exists (excluding current beneficiary)
            const existingBeneficiary = this.beneficiaires.find(ben => 
                ben.id !== beneficiaryId && ben.libelle.toLowerCase() === beneficiaryLibelle.toLowerCase()
            );
            if (existingBeneficiary) {
                this.showError('Un bénéficiaire avec ce nom existe déjà');
                return;
            }

            const updateData = {
                libelle: beneficiaryLibelle,
                usage_count: usageCount
            };

            const result = await ratchouApp.models.payees.update(beneficiaryId, updateData);

            if (result.success) {
                this.editModal.hide();
                this.showSuccess('Bénéficiaire mis à jour avec succès');
                await this.loadBeneficiaires();
            } else {
                this.showError(result.message || 'Erreur lors de la mise à jour du bénéficiaire');
            }

        } catch (error) {
            console.error('Error updating beneficiary:', error);
            this.showError('Erreur lors de la mise à jour du bénéficiaire');
        } finally {
            this.hideButtonLoading(updateButton);
        }
    }


    /**
     * Filter beneficiaires based on search term
     */
    filterBeneficiaires(searchTerm) {
        this.currentFilter = searchTerm.trim();
        
        if (!this.currentFilter) {
            this.renderBeneficiaires();
            return;
        }

        const filteredBeneficiaires = this.beneficiaires.filter(beneficiary => 
            beneficiary.libelle.toLowerCase().includes(this.currentFilter.toLowerCase())
        );

        this.renderBeneficiaires(filteredBeneficiaires);
    }

    /**
     * Clear the filter
     */
    clearFilter() {
        this.currentFilter = '';
        const filterInput = document.getElementById('beneficiaryFilter');
        if (filterInput) {
            filterInput.value = '';
        }
        this.renderBeneficiaires();
    }

    /**
     * Load sort mode from localStorage
     */
    loadSortMode() {
        const savedSortMode = localStorage.getItem('ratchou_payees_sort_mode');
        if (savedSortMode === 'usage' || savedSortMode === 'alphabetical') {
            this.currentSortMode = savedSortMode;
        }
        this.updateSortButton();
    }

    /**
     * Save sort mode to localStorage
     */
    saveSortMode() {
        localStorage.setItem('ratchou_payees_sort_mode', this.currentSortMode);
    }

    /**
     * Toggle between alphabetical and usage sort modes
     */
    async toggleSortMode() {
        this.currentSortMode = this.currentSortMode === 'alphabetical' ? 'usage' : 'alphabetical';
        this.saveSortMode();
        this.updateSortButton();
        await this.loadBeneficiaires();
    }

    /**
     * Update sort button appearance
     */
    updateSortButton() {
        const sortBtn = document.getElementById('sortToggleBtn');
        if (!sortBtn) return;

        if (this.currentSortMode === 'usage') {
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
let beneficiairesController;

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

        // Initialize beneficiaires controller
        beneficiairesController = new BeneficiairesController();
        await beneficiairesController.initialize();

    } catch (error) {
        console.error('Error initializing beneficiaires page:', error);
        alert('Erreur lors de l\'initialisation de la page');
    }
});