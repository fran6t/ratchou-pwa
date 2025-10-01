/**
 * Categories Management Controller
 * Handles all category-related operations in the categories management page
 */
class CategoriesController {
    constructor() {
        this.categories = [];
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
            await this.loadCategories();
        } catch (error) {
            console.error('Error initializing categories controller:', error);
            this.showError('Erreur lors de l\'initialisation de la page');
        }
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '📂 Catégories',
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
        // Create category button (in modal)
        document.getElementById('createCategoryBtn').addEventListener('click', () => {
            this.handleCreateCategory();
        });

        // Update category button
        document.getElementById('updateCategoryBtn').addEventListener('click', () => {
            this.handleUpdateCategory();
        });

        // Delete category button from edit modal
        document.getElementById('deleteCategoryFromEditBtn').addEventListener('click', () => {
            this.handleDeleteCategoryFromEdit();
        });

        // Filter functionality
        document.getElementById('categoryFilter').addEventListener('input', (e) => {
            this.filterCategories(e.target.value);
        });

        // Clear filter button
        document.getElementById('clearFilterBtn').addEventListener('click', () => {
            this.clearFilter();
        });

        // Sort toggle button
        const sortToggleBtn = document.getElementById('sortToggleBtn');
        if (sortToggleBtn) {
            sortToggleBtn.addEventListener('click', () => {
                this.toggleSortMode();
            });
        }

        // Modal cleanup
        document.getElementById('addModal').addEventListener('hidden.bs.modal', () => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.style.overflow = 'auto';
        });
        
        document.getElementById('editModal').addEventListener('hidden.bs.modal', () => {
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
     * Load all categories
     */
    async loadCategories() {
        try {
            if (this.currentSortMode === 'usage') {
                this.categories = await ratchouApp.models.categories.getAllSortedByUsage();
            } else {
                this.categories = await ratchouApp.models.categories.getAllSorted();
            }
            this.renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showError('Erreur lors du chargement des catégories');
        }
    }

    /**
     * Render categories list
     */
    renderCategories(categoriesToRender = null) {
        const categoriesList = document.getElementById('categoriesList');
        const categories = categoriesToRender || this.categories;

        if (categories.length === 0) {
            const message = this.currentFilter ? 
                `Aucune catégorie ne correspond au filtre "${this.currentFilter}".` : 
                'Aucune catégorie trouvée.';
            categoriesList.innerHTML = `<div class="text-muted">${message}</div>`;
            return;
        }

        // Categories are already sorted by loadCategories()
        const sortedCategories = [...categories];

        const categoriesHtml = sortedCategories.map(category => {
            return `
                <div class="card mb-2 category-card" style="cursor: pointer;" 
                     data-category-id="${category.id}" 
                     data-category-libelle="${this.escapeHtml(category.libelle)}" 
                     data-category-mandatory="${category.is_mandatory || false}"
                     data-category-usage="${category.usage_count || 0}">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${this.escapeHtml(category.libelle)}</strong>
                                ${this.currentSortMode === 'usage' && (category.usage_count || 0) > 0 ? `<small class="text-muted ms-2">(${category.usage_count || 0})</small>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        categoriesList.innerHTML = categoriesHtml;
        
        // Add click listeners to all category cards
        this.setupCategoryCardListeners();
    }

    /**
     * Setup click listeners for category cards
     */
    setupCategoryCardListeners() {
        const categoryCards = document.querySelectorAll('.category-card');
        categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const categoryId = card.dataset.categoryId;
                const categoryLibelle = card.dataset.categoryLibelle;
                const isMandatory = card.dataset.categoryMandatory === 'true';
                const usageCount = parseInt(card.dataset.categoryUsage) || 0;
                
                this.editCategory(categoryId, categoryLibelle, isMandatory, usageCount);
            });
        });
    }

    /**
     * Handle create category (from modal)
     */
    async handleCreateCategory() {
        const createButton = document.getElementById('createCategoryBtn');
        const form = document.getElementById('addCategoryForm');
        
        try {
            this.showButtonLoading(createButton);

            const formData = new FormData(form);
            const categoryData = {
                libelle: formData.get('libelle').trim(),
                is_mandatory: formData.has('depense_obligatoire')
            };

            // Validation
            if (!categoryData.libelle) {
                this.showError('Le libellé de la catégorie est requis');
                return;
            }

            // Check if category name already exists
            const existingCategory = this.categories.find(cat => 
                cat.libelle.toLowerCase() === categoryData.libelle.toLowerCase()
            );
            if (existingCategory) {
                this.showError('Une catégorie avec ce nom existe déjà');
                return;
            }

            const result = await ratchouApp.models.categories.create(categoryData);

            if (result.success) {
                this.addModal.hide();
                this.showSuccess('Catégorie créée avec succès');
                form.reset();
                await this.loadCategories();
            } else {
                this.showError(result.message || 'Erreur lors de la création de la catégorie');
            }

        } catch (error) {
            console.error('Error adding category:', error);
            this.showError('Erreur lors de la création de la catégorie');
        } finally {
            this.hideButtonLoading(createButton);
        }
    }

    /**
     * Edit category
     */
    editCategory(id, libelle, isMandatory, usageCount) {
        document.getElementById('edit_id').value = id;
        document.getElementById('edit_libelle').value = libelle;
        document.getElementById('edit_depense_obligatoire').checked = isMandatory;
        document.getElementById('edit_usage_count').value = usageCount || 0;
        this.editModal.show();
    }

    /**
     * Handle update category
     */
    async handleUpdateCategory() {
        const updateButton = document.getElementById('updateCategoryBtn');
        
        try {
            this.showButtonLoading(updateButton);

            const categoryId = document.getElementById('edit_id').value;
            const categoryLibelle = document.getElementById('edit_libelle').value.trim();
            const isMandatory = document.getElementById('edit_depense_obligatoire').checked;
            const usageCount = parseInt(document.getElementById('edit_usage_count').value) || 0;

            // Validation
            if (!categoryLibelle) {
                this.showError('Le libellé de la catégorie est requis');
                return;
            }

            // Check if category name already exists (excluding current category)
            const existingCategory = this.categories.find(cat => 
                cat.id !== categoryId && cat.libelle.toLowerCase() === categoryLibelle.toLowerCase()
            );
            if (existingCategory) {
                this.showError('Une catégorie avec ce nom existe déjà');
                return;
            }

            const updateData = {
                libelle: categoryLibelle,
                is_mandatory: isMandatory,
                usage_count: usageCount
            };

            const result = await ratchouApp.models.categories.update(categoryId, updateData);

            if (result.success) {
                this.editModal.hide();
                this.showSuccess('Catégorie mise à jour avec succès');
                await this.loadCategories();
            } else {
                this.showError(result.message || 'Erreur lors de la mise à jour de la catégorie');
            }

        } catch (error) {
            console.error('Error updating category:', error);
            this.showError('Erreur lors de la mise à jour de la catégorie');
        } finally {
            this.hideButtonLoading(updateButton);
        }
    }

    /**
     * Handle delete category from edit modal
     */
    async handleDeleteCategoryFromEdit() {
        const categoryId = document.getElementById('edit_id').value;
        const categoryLibelle = document.getElementById('edit_libelle').value;
        
        // Close edit modal first
        this.editModal.hide();
        
        // Call the delete function
        await this.deleteCategory(categoryId, categoryLibelle);
    }

    /**
     * Delete category
     */
    async deleteCategory(id, libelle) {
        try {
            console.log('Starting category deletion:', id, libelle);
            
            // Check if category has transactions
            console.log('Checking for transactions...');
            const transactions = await ratchouApp.models.transactions.getByCategory(id);
            console.log('Found transactions:', transactions.length);
            
            let confirmMessage = `Êtes-vous sûr de vouloir supprimer la catégorie "${libelle}" ?`;
            
            if (transactions.length > 0) {
                confirmMessage += `\n\nCette catégorie contient ${transactions.length} transaction(s).\n` +
                    `Les transactions ne seront pas supprimées mais deviendront "non catégorisées".\n\n` +
                    `Continuer ?`;
            }
            
            if (!confirm(confirmMessage)) {
                console.log('Deletion cancelled by user');
                return;
            }

            this.showLoading();
            console.log('Proceeding with deletion and dissociation...');
            
            // Use the delete method that handles dissociation automatically
            const result = await ratchouApp.models.categories.delete(id);
            console.log('Delete result:', result);

            if (result.success) {
                this.showSuccess(result.message || 'Catégorie supprimée avec succès');
                await this.loadCategories();
                console.log('Category deleted and list reloaded');
            } else {
                this.showError(result.message || 'Erreur lors de la suppression de la catégorie');
                console.log('Delete failed:', result.message);
            }

        } catch (error) {
            console.error('Error deleting category:', error);
            this.showError('Erreur lors de la suppression de la catégorie');
        } finally {
            console.log('Hiding loading overlay...');
            this.hideLoading();
        }
    }


    /**
     * Filter categories based on search term
     */
    filterCategories(searchTerm) {
        this.currentFilter = searchTerm.trim();
        
        if (!this.currentFilter) {
            this.renderCategories();
            return;
        }

        const filteredCategories = this.categories.filter(category => 
            category.libelle.toLowerCase().includes(this.currentFilter.toLowerCase())
        );

        this.renderCategories(filteredCategories);
    }

    /**
     * Clear the filter
     */
    clearFilter() {
        this.currentFilter = '';
        document.getElementById('categoryFilter').value = '';
        this.renderCategories();
    }

    /**
     * Load sort mode from localStorage
     */
    loadSortMode() {
        const savedSortMode = localStorage.getItem('ratchou_categories_sort_mode');
        if (savedSortMode === 'usage' || savedSortMode === 'alphabetical') {
            this.currentSortMode = savedSortMode;
        }
        this.updateSortButton();
    }

    /**
     * Save sort mode to localStorage
     */
    saveSortMode() {
        localStorage.setItem('ratchou_categories_sort_mode', this.currentSortMode);
    }

    /**
     * Toggle between alphabetical and usage sort modes
     */
    async toggleSortMode() {
        this.currentSortMode = this.currentSortMode === 'alphabetical' ? 'usage' : 'alphabetical';
        this.saveSortMode();
        this.updateSortButton();
        await this.loadCategories();
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
let categoriesController;

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

        // Initialize categories controller
        categoriesController = new CategoriesController();
        await categoriesController.initialize();

    } catch (error) {
        console.error('Error initializing categories page:', error);
        alert('Erreur lors de l\'initialisation de la page');
    }
});