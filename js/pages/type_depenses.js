/**
 * Type Depenses Management Controller
 * Handles all expense-types-related operations in the type_depenses management page
 */
class TypeDepensesController {
    constructor() {
        this.typeDepenses = [];
        this.currentFilter = '';
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
            await this.loadTypeDepenses();
        } catch (error) {
            console.error('Error initializing type depenses controller:', error);
            this.showError('Erreur lors de l\'initialisation de la page');
        }
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '💳 Types dépenses',
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
        // Create type button (in modal)
        const createBtn = document.getElementById('createTypeBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.handleCreateType();
            });
        }

        // Filter functionality
        const filterInput = document.getElementById('typeFilter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this.filterTypes(e.target.value);
            });
        }

        // Clear filter button
        const clearFilterBtn = document.getElementById('clearFilterBtn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                this.clearFilter();
            });
        }

        // Update type button - vérifier si l'élément existe
        const updateBtn = document.getElementById('updateTypeBtn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => {
                this.handleUpdateType();
            });
        }

        // Delete type button - vérifier si l'élément existe
        const deleteBtn = document.getElementById('deleteTypeBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.handleDeleteType();
            });
        }

        // Delete button in edit modal
        const deleteFromEditBtn = document.getElementById('deleteTypeFromEditBtn');
        if (deleteFromEditBtn) {
            deleteFromEditBtn.addEventListener('click', () => {
                this.handleDeleteFromEdit();
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

        // Event delegation for clickable type cards
        const typeList = document.getElementById('typeList');
        if (typeList) {
            typeList.addEventListener('click', (e) => {
                const typeCard = e.target.closest('.type-card');
                if (typeCard) {
                    const id = typeCard.dataset.id;
                    const libelle = typeCard.dataset.libelle;
                    const isDefault = typeCard.dataset.default === 'true';
                    this.editType(id, libelle, isDefault);
                }
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
     * Load all type depenses
     */
    async loadTypeDepenses() {
        try {
            this.typeDepenses = await ratchouApp.models.expenseTypes.getAll();
            this.renderTypeDepenses();
        } catch (error) {
            console.error('Error loading type depenses:', error);
            this.showError('Erreur lors du chargement des types de dépenses');
        }
    }

    /**
     * Render type depenses list
     */
    renderTypeDepenses(typesToRender = null) {
        const typeList = document.getElementById('typeList');
        const types = typesToRender || this.typeDepenses;

        if (types.length === 0) {
            const message = this.currentFilter ? 
                `Aucun type de dépense ne correspond au filtre "${this.currentFilter}".` : 
                'Aucun type de dépense trouvé.';
            typeList.innerHTML = `<div class="text-center py-4"><div class="text-muted">${message}</div></div>`;
            return;
        }

        // Sort types: default first, then alphabetically
        const sortedTypes = [...types].sort((a, b) => {
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            return a.libelle.localeCompare(b.libelle);
        });

        const typesHtml = sortedTypes.map(type => {
            return `
                <div class="card mb-2 type-card" style="cursor: pointer;" 
                     data-id="${type.id}" data-libelle="${this.escapeHtml(type.libelle)}" data-default="${type.is_default || false}">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${this.escapeHtml(type.libelle)}</strong>
                                ${type.is_default ? '<span class="badge bg-primary ms-2">Par défaut</span>' : ''}
                            </div>
                            <div>
                                <i class="bi bi-chevron-right text-muted"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        typeList.innerHTML = typesHtml;
    }

    /**
     * Handle create type (from modal)
     */
    async handleCreateType() {
        const createButton = document.getElementById('createTypeBtn');
        const form = document.getElementById('addTypeForm');
        
        if (!createButton || !form) {
            console.error('Create button or form not found');
            this.showError('Erreur: éléments introuvables');
            return;
        }
        
        try {
            this.showButtonLoading(createButton);

            const formData = new FormData(form);
            const typeData = {
                libelle: formData.get('libelle')?.trim(),
                is_default: formData.has('is_default')
            };

            // Validation
            if (!typeData.libelle) {
                this.showError('Le libellé du type est requis');
                return;
            }

            // Check if type name already exists
            const existingType = this.typeDepenses.find(type => 
                type.libelle.toLowerCase() === typeData.libelle.toLowerCase()
            );
            if (existingType) {
                this.showError('Un type avec ce nom existe déjà');
                return;
            }

            const result = await ratchouApp.models.expenseTypes.create(typeData);

            if (result.success) {
                this.addModal.hide();
                this.showSuccess('Type créé avec succès');
                form.reset();
                await this.loadTypeDepenses();
            } else {
                this.showError(result.message || 'Erreur lors de la création du type');
            }

        } catch (error) {
            console.error('Error adding type:', error);
            this.showError('Erreur lors de la création du type');
        } finally {
            this.hideButtonLoading(createButton);
        }
    }

    /**
     * Edit type
     */
    editType(id, libelle, isDefault) {
        document.getElementById('edit_id').value = id;
        document.getElementById('edit_libelle').value = this.decodeHtml(libelle);
        document.getElementById('edit_is_default').checked = isDefault;
        this.editModal.show();
    }

    /**
     * Delete type
     */
    async deleteType(id, libelle) {
        try {
            console.log('Starting expense type deletion:', id, libelle);
            
            // Check if this is the default type first
            const expenseType = await ratchouApp.models.expenseTypes.getById(id);
            if (expenseType && expenseType.is_default) {
                this.showError('Impossible de supprimer le type de paiement par défaut');
                return;
            }
            
            // Check if expense type has transactions
            console.log('Checking for transactions...');
            const transactions = await ratchouApp.models.transactions.getByExpenseType(id);
            console.log('Found transactions:', transactions.length);
            
            let confirmMessage = `Êtes-vous sûr de vouloir supprimer le type "${libelle}" ?`;
            
            if (transactions.length > 0) {
                confirmMessage += `\n\nCe type de paiement contient ${transactions.length} transaction(s).\n` +
                    `Les transactions ne seront pas supprimées mais deviendront "sans type".\n\n` +
                    `Continuer ?`;
            }
            
            if (!confirm(confirmMessage)) {
                console.log('Deletion cancelled by user');
                return;
            }

            this.showLoading();
            console.log('Proceeding with deletion and dissociation...');
            
            // Use the delete method that handles dissociation automatically
            const result = await ratchouApp.models.expenseTypes.delete(id);
            console.log('Delete result:', result);

            if (result.success) {
                this.showSuccess(result.message || 'Type supprimé avec succès');
                await this.loadTypeDepenses();
                console.log('Expense type deleted and list reloaded');
            } else {
                this.showError(result.message || 'Erreur lors de la suppression du type');
                console.log('Delete failed:', result.message);
            }

        } catch (error) {
            console.error('Error deleting expense type:', error);
            this.showError('Erreur lors de la suppression du type');
        } finally {
            console.log('Hiding loading overlay...');
            this.hideLoading();
        }
    }

    /**
     * Handle update type
     */
    async handleUpdateType() {
        const updateButton = document.getElementById('updateTypeBtn');
        
        if (!updateButton) {
            console.error('Update button not found');
            this.showError('Erreur: bouton de mise à jour introuvable');
            return;
        }
        
        try {
            this.showButtonLoading(updateButton);

            const typeId = document.getElementById('edit_id').value;
            const typeLibelle = document.getElementById('edit_libelle').value.trim();
            const isDefault = document.getElementById('edit_is_default').checked;

            // Validation
            if (!typeLibelle) {
                this.showError('Le libellé du type est requis');
                return;
            }

            // Check if type name already exists (excluding current type)
            const existingType = this.typeDepenses.find(type => 
                type.id !== typeId && type.libelle.toLowerCase() === typeLibelle.toLowerCase()
            );
            if (existingType) {
                this.showError('Un type avec ce nom existe déjà');
                return;
            }

            const updateData = {
                libelle: typeLibelle,
                is_default: isDefault
            };

            const result = await ratchouApp.models.expenseTypes.update(typeId, updateData);

            if (result.success) {
                this.editModal.hide();
                this.showSuccess('Type mis à jour avec succès');
                await this.loadTypeDepenses();
            } else {
                this.showError(result.message || 'Erreur lors de la mise à jour du type');
            }

        } catch (error) {
            console.error('Error updating type:', error);
            this.showError('Erreur lors de la mise à jour du type');
        } finally {
            this.hideButtonLoading(updateButton);
        }
    }

    /**
     * Handle delete type
     */
    async handleDeleteType() {
        const deleteButton = document.getElementById('deleteTypeBtn');
        
        if (!deleteButton) {
            console.error('Delete button not found');
            this.showError('Erreur: bouton de suppression introuvable');
            return;
        }
        
        try {
            this.showButtonLoading(deleteButton);

            const typeId = document.getElementById('delete_id').value;

            const result = await ratchouApp.models.expenseTypes.delete(typeId);

            if (result.success) {
                this.deleteModal.hide();
                this.showSuccess('Type supprimé avec succès');
                await this.loadTypeDepenses();
            } else {
                this.showError(result.message || 'Erreur lors de la suppression du type');
            }

        } catch (error) {
            console.error('Error deleting type:', error);
            this.showError('Erreur lors de la suppression du type');
        } finally {
            this.hideButtonLoading(deleteButton);
        }
    }

    /**
     * Handle delete from edit modal
     */
    async handleDeleteFromEdit() {
        const deleteButton = document.getElementById('deleteTypeFromEditBtn');
        
        if (!deleteButton) {
            console.error('Delete button not found');
            this.showError('Erreur: bouton de suppression introuvable');
            return;
        }
        
        try {
            const typeId = document.getElementById('edit_id').value;
            const typeLibelle = document.getElementById('edit_libelle').value;
            
            // Show confirmation dialog
            if (!confirm(`Êtes-vous sûr de vouloir supprimer le type "${typeLibelle}" ?`)) {
                return;
            }
            
            this.showButtonLoading(deleteButton);

            const result = await ratchouApp.models.expenseTypes.delete(typeId);

            if (result.success) {
                this.editModal.hide();
                this.showSuccess('Type supprimé avec succès');
                await this.loadTypeDepenses();
            } else {
                this.showError(result.message || 'Erreur lors de la suppression du type');
            }

        } catch (error) {
            console.error('Error deleting type:', error);
            this.showError('Erreur lors de la suppression du type');
        } finally {
            this.hideButtonLoading(deleteButton);
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

    /**
     * Filter types based on search term
     */
    filterTypes(searchTerm) {
        this.currentFilter = searchTerm.trim();
        
        if (!this.currentFilter) {
            this.renderTypeDepenses();
            return;
        }

        const filteredTypes = this.typeDepenses.filter(type => 
            type.libelle.toLowerCase().includes(this.currentFilter.toLowerCase())
        );

        this.renderTypeDepenses(filteredTypes);
    }

    /**
     * Clear the filter
     */
    clearFilter() {
        this.currentFilter = '';
        const filterInput = document.getElementById('typeFilter');
        if (filterInput) {
            filterInput.value = '';
        }
        this.renderTypeDepenses();
    }

    /**
     * Decode HTML entities
     */
    decodeHtml(text) {
        const map = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'"
        };
        return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, (m) => map[m]);
    }
}

// Global instance
let typeDepensesController;

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

        // Initialize type depenses controller
        typeDepensesController = new TypeDepensesController();
        await typeDepensesController.initialize();

    } catch (error) {
        console.error('Error initializing type depenses page:', error);
        alert('Erreur lors de l\'initialisation de la page');
    }
});