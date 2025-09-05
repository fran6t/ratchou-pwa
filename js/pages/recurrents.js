class RecurrentsController {
    constructor() {
        // Models
        this.recurrentsModel = ratchouApp.models.recurringExpenses;
        this.accountsModel = ratchouApp.models.accounts;
        this.categoriesModel = ratchouApp.models.categories;
        this.payeesModel = ratchouApp.models.payees;
        this.expenseTypesModel = ratchouApp.models.expenseTypes;

        // Main containers
        this.mainContent = document.getElementById('main-content');
        this.formContainer = document.getElementById('form-container');
        
        // Form elements
        this.recurrentForm = document.getElementById('recurrent-form');
        this.formTitle = document.getElementById('form-title');

        // Buttons
        this.addRecurrentBtn = document.getElementById('add-recurrent-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        this.deleteRecurrentBtn = document.getElementById('delete-recurrent-btn');

        // Data containers
        this.recurrentsList = document.getElementById('recurrents-list');
        this.totalsContainer = document.getElementById('totals');
        
        // Panels & Modals
        this.panelBackdrop = document.getElementById('panelBackdrop');

        // State
        this.recurrents = [];
        this.accounts = [];
        this.categories = [];
        this.payees = [];
        this.expenseTypes = [];
        this.currentPanelButton = null;
        this.currentPanelInput = null;
    }

    async initialize() {
        await this.loadComponents();
        this.setupEventListeners();
        await this.loadAllData();
        this.renderRecurrents();
        this.updateTotalCards();
        this.renderPanelsAndModals();
        this.renderForm();
    }

    async loadComponents() {
        await ComponentLoader.loadHeader({ title: '🔄 Récurrents' });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    setupEventListeners() {
        this.addRecurrentBtn.addEventListener('click', () => this.showForm());
        this.cancelBtn.addEventListener('click', () => this.hideForm());
        this.deleteRecurrentBtn.addEventListener('click', () => this.handleDeleteFromForm());
        this.recurrentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.panelBackdrop.addEventListener('click', () => this.closePanels());

        this.recurrentsList.addEventListener('click', (e) => {
            const recurrentCard = e.target.closest('.recurrent-card');
            if (recurrentCard) {
                this.handleEdit(recurrentCard.dataset.recurrentId);
            }
        });
    }

    async loadAllData() {
        [
            this.recurrents, this.accounts, this.categories, this.payees, this.expenseTypes
        ] = await Promise.all([
            this.recurrentsModel.getAllSorted(),
            this.accountsModel.getAll(),
            this.categoriesModel.getAll(),
            this.payeesModel.getAll(),
            this.expenseTypesModel.getAll()
        ]);
    }

    showForm(recurrent = null) {
        this.mainContent.style.display = 'none';
        this.formContainer.style.display = 'block';
        this.recurrentForm.reset();
        this.resetPanelButtons();
        
        if (recurrent) {
            this.formTitle.textContent = '🔄 Modifier la récurrence';
            this.deleteRecurrentBtn.style.display = 'inline-block';
            this.populateForm(recurrent);
        } else {
            this.formTitle.textContent = 'Ajout d\'une récurrence';
            this.deleteRecurrentBtn.style.display = 'none';
            document.getElementById('recurrent-id').value = '';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    hideForm() {
        this.formContainer.style.display = 'none';
        this.mainContent.style.display = 'block';
        this.closePanels();
    }

    populateForm(recurrent) {
        document.getElementById('recurrent-id').value = recurrent.id;
        document.getElementById('recurrent-libelle').value = recurrent.libelle;
        document.getElementById('recurrent-montant').value = RatchouUtils.currency.toEuros(recurrent.amount);
        document.getElementById('recurrent-jour').value = recurrent.day_of_month;
        document.getElementById('recurrent-frequence').value = recurrent.frequency;
        document.getElementById('recurrent-compte').value = recurrent.account_id;
        
        document.getElementById('categorie_id').value = recurrent.category_id;
        document.getElementById('beneficiaire_id').value = recurrent.payee_id || '';
        document.getElementById('type_depense_id').value = recurrent.expense_type_id || '';

        this.updateSelectionButton('categorie_id', recurrent.category_id, this.categories);
        this.updateSelectionButton('beneficiaire_id', recurrent.payee_id, this.payees);
        this.updateSelectionButton('type_depense_id', recurrent.expense_type_id, this.expenseTypes);
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        const formData = new FormData(this.recurrentForm);
        const data = {
            libelle: formData.get('libelle'),
            amount: RatchouUtils.currency.toCents(parseFloat(formData.get('montant'))),
            day_of_month: parseInt(formData.get('jour_mois')),
            frequency: parseInt(formData.get('frequence')),
            account_id: formData.get('compte_id'),
            category_id: formData.get('categorie_id'),
            payee_id: formData.get('beneficiaire_id') || null,
            expense_type_id: formData.get('type_depense_id') || null,
        };

        const id = formData.get('id');

        try {
            if (id) {
                await this.recurrentsModel.update(id, data);
            } else {
                data.is_active = true;
                await this.recurrentsModel.create(data);
            }
            this.hideForm();
            await this.refreshData();
        } catch (error) {
            console.error("Error saving recurrent expense:", error);
        }
    }

    async handleEdit(id) {
        const recurrent = this.recurrents.find(r => r.id === id);
        if (recurrent) this.showForm(recurrent);
    }

    async handleDeleteFromForm() {
        const recurrentId = document.getElementById('recurrent-id').value;
        if (recurrentId) {
            const recurrent = this.recurrents.find(r => r.id === recurrentId);
            const recurrentName = recurrent ? recurrent.libelle : 'cette récurrence';
            
            if (confirm(`Êtes-vous sûr de vouloir supprimer "${recurrentName}" ?`)) {
                await this.handleDelete(recurrentId);
                this.hideForm();
            }
        }
    }

    async handleDelete(id) {
        try {
            await this.recurrentsModel.delete(id);
            await this.refreshData();
        } catch (error) {
            console.error("Error deleting recurrent expense:", error);
        }
    }
    
    async refreshData() {
        [this.recurrents, this.categories, this.payees] = await Promise.all([
            this.recurrentsModel.getAllSorted(),
            this.categoriesModel.getAll(),
            this.payeesModel.getAll()
        ]);
        this.renderRecurrents();
        this.updateTotalCards();
        this.populateCategoriesPanel();
        this.populatePayeesPanel();
    }

    renderRecurrents() {
        if (this.recurrents.length === 0) {
            this.recurrentsList.innerHTML = '<div class="text-center text-muted p-4">Aucune dépense récurrente.</div>';
            return;
        }

        const accountsMap = new Map(this.accounts.map(a => [a.id, a.nom_compte]));
        const categoriesMap = new Map(this.categories.map(c => [c.id, c.libelle]));

        this.recurrentsList.innerHTML = this.recurrents.map(r => {
            const monthlyAmount = r.amount / r.frequency;
            const amountClass = monthlyAmount >= 0 ? 'text-success' : 'text-danger';
            const formattedAmount = RatchouUtils.currency.format(Math.abs(monthlyAmount));
            const sign = monthlyAmount >= 0 ? '+' : '-';

            return `
                <div class="card mb-2 recurrent-card ${!r.is_active ? 'opacity-50' : ''}" style="cursor: pointer;" data-recurrent-id="${r.id}">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <strong>${r.libelle}</strong>
                                <small class="d-block text-muted">
                                    ${accountsMap.get(r.account_id) || 'N/A'} | ${categoriesMap.get(r.category_id) || 'N/A'}
                                </small>
                            </div>
                            <div class="col text-end">
                                <strong class="${amountClass}">${sign} ${formattedAmount} / mois</strong>
                                <small class="d-block text-muted">Le ${r.day_of_month} de chaque mois</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateTotalCards() {
        let totalDepenses = 0;
        let totalRecettes = 0;
        let totalActifs = 0;

        this.recurrents.forEach(expense => {
            if (expense.is_active) {
                const monthlyAmount = expense.amount / expense.frequency;
                if (monthlyAmount < 0) {
                    totalDepenses += Math.abs(monthlyAmount);
                } else {
                    totalRecettes += monthlyAmount;
                }
                totalActifs++;
            }
        });

        const totalImpact = totalRecettes - totalDepenses;
        const impactClass = totalImpact >= 0 ? 'bg-success' : 'bg-danger';

        this.totalsContainer.innerHTML = `
            <div class="row g-3">
                <div class="col-md-3 col-6"><div class="card bg-danger text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Dépenses / mois</h6><h4 class="card-text mb-0">${RatchouUtils.currency.format(totalDepenses)}</h4></div></div></div>
                <div class="col-md-3 col-6"><div class="card bg-success text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Recettes / mois</h6><h4 class="card-text mb-0">${RatchouUtils.currency.format(totalRecettes)}</h4></div></div></div>
                <div class="col-md-3 col-6"><div class="card ${impactClass} text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Balance / mois</h6><h4 class="card-text mb-0">${RatchouUtils.currency.format(totalImpact)}</h4></div></div></div>
                <div class="col-md-3 col-6"><div class="card bg-secondary text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Total actifs</h6><h4 class="card-text mb-0">${totalActifs}</h4></div></div></div>
            </div>`;
    }

    // Panel Logic
    openPanel(panelId, inputId, button) {
        this.closePanels();
        this.currentPanelButton = button;
        this.currentPanelInput = inputId;
        const panel = document.getElementById(panelId);
        panel.classList.add('show');
        this.panelBackdrop.classList.add('show');

        const currentId = document.getElementById(inputId).value;
        panel.querySelectorAll('.list-group-item-action').forEach(item => {
            item.classList.toggle('active', item.dataset.id === currentId);
        });
    }

    closePanels() {
        document.querySelectorAll('.panel-slide').forEach(p => p.classList.remove('show'));
        this.panelBackdrop.classList.remove('show');
    }

    selectPanelItem(value, label, icon) {
        const input = document.getElementById(this.currentPanelInput);
        const currentValue = input.value;

        if (currentValue === value) {
            input.value = '';
            const originalText = this.currentPanelButton.dataset.originalText;
            this.currentPanelButton.innerHTML = `${icon} ${originalText}`;
        } else {
            input.value = value;
            this.currentPanelButton.innerHTML = `${icon} ${label}`;
        }
        this.closePanels();
    }
    
    updateSelectionButton(inputId, selectedId, dataArray) {
        const button = document.querySelector(`[data-input-target="${inputId}"]`);
        if (!button) return;
        const selectedItem = dataArray.find(item => item.id === selectedId);
        if (selectedItem) {
            const icon = button.dataset.icon || '';
            button.innerHTML = `${icon} ${selectedItem.libelle}`.trim();
        }
    }
    
    resetPanelButtons() {
        document.querySelectorAll('[data-panel-target]').forEach(button => {
            const originalText = button.dataset.originalText;
            const icon = button.dataset.icon || '';
            button.innerHTML = `${icon} ${originalText}`.trim();
        });
    }

    renderForm() {
        const createSelect = (id, name, label, options) => `
            <div class="col-sm-6 mb-3">
                <label for="${id}" class="form-label">${label}</label>
                <select class="form-select" id="${id}" name="${name}" required>
                    ${options.map(o => `<option value="${o.id}">${o.nom_compte || o.libelle}</option>`).join('')}
                </select>
            </div>`;

        const createPanelButton = (inputId, panelId, icon, text) => `
            <div class="col-sm-6 mb-3">
                <label class="form-label">${text}</label>
                <div class="d-flex border rounded">
                    <!-- <span class="px-3 py-2 bg-light border-end text-nowrap">${icon}</span> -->
                    <button type="button" class="btn btn-link text-start text-decoration-none flex-fill rounded-pill" 
                            data-panel-target="#${panelId}" data-input-target="${inputId}" 
                            data-icon="${icon}" data-original-text="Sélectionner...">
                        ${icon} Sélectionner...
                    </button>
                </div>
                <input type="hidden" id="${inputId}" name="${inputId}" required>
            </div>`;

        this.recurrentForm.innerHTML = `
            <input type="hidden" name="id" id="recurrent-id">
            <div class="row">
                <div class="col-12 mb-3"><label for="recurrent-libelle" class="form-label">Libellé</label><input type="text" class="form-control" id="recurrent-libelle" name="libelle" required></div>
                <div class="col-sm-6 mb-3"><label for="recurrent-montant" class="form-label">Montant</label><input type="number" step="0.01" class="form-control" id="recurrent-montant" name="montant" required><small class="form-text text-muted">Positif pour un revenu, négatif pour une dépense</small></div>
                <div class="col-sm-6 mb-3"><label for="recurrent-jour" class="form-label">Jour du mois</label><input type="number" class="form-control" id="recurrent-jour" name="jour_mois" min="1" max="31" required></div>
                <div class="col-sm-6 mb-3"><label for="recurrent-frequence" class="form-label">Fréquence</label><select class="form-select" id="recurrent-frequence" name="frequence" required><option value="1">Mensuel</option><option value="2">Bimestriel</option><option value="3">Trimestriel</option><option value="6">Semestriel</option><option value="12">Annuel</option></select></div>
                ${createSelect('recurrent-compte', 'compte_id', 'Compte', this.accounts)}
                ${createPanelButton('categorie_id', 'categoriePanel', '📂', 'Catégorie')}
                ${createPanelButton('beneficiaire_id', 'beneficiairePanel', '👥', 'Bénéficiaire')}
                ${createPanelButton('type_depense_id', 'typeDepensePanel', '💳', 'Type de dépense')}
            </div>`;
        
        this.recurrentForm.querySelectorAll('[data-panel-target]').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget;
                this.openPanel(target.dataset.panelTarget.substring(1), target.dataset.inputTarget, target);
            });
        });
    }

    renderPanelsAndModals() {
        document.getElementById('categoriePanel').innerHTML = this.createPanelHTML('categoriePanel', '📂 Catégories', 'categorieFilter', 'categorieList', true);
        document.getElementById('beneficiairePanel').innerHTML = this.createPanelHTML('beneficiairePanel', '👥 Bénéficiaires', 'beneficiaireFilter', 'beneficiaireList', true);
        document.getElementById('typeDepensePanel').innerHTML = this.createPanelHTML('typeDepensePanel', '💳 Types de paiement', null, 'typeDepenseList', false);
        
        this.populateCategoriesPanel();
        this.populatePayeesPanel();
        this.populateExpenseTypesPanel();

        document.getElementById('addCategoryModal').innerHTML = this.createAddModalHTML('addCategoryModal', '📂 Ajouter une catégorie', 'addCategoryForm', 'newCategoryName', 'Nom de la catégorie', true);
        document.getElementById('addPayeeModal').innerHTML = this.createAddModalHTML('addPayeeModal', '👥 Ajouter un bénéficiaire', 'addPayeeForm', 'newPayeeName', 'Nom du bénéficiaire', false);
        document.getElementById('deleteModal').innerHTML = this.createDeleteModalHTML();

        // Setup modal/panel event listeners
        document.getElementById('add-categorie').addEventListener('click', () => this.openAddCategoryModal());
        document.getElementById('add-beneficiaire').addEventListener('click', () => this.openAddPayeeModal());
        document.getElementById('categorieFilter').addEventListener('input', (e) => this.filterPanel(e.target.value, 'categorieList'));
        document.getElementById('beneficiaireFilter').addEventListener('input', (e) => this.filterPanel(e.target.value, 'beneficiaireList'));
        
        document.getElementById('addCategoryForm').addEventListener('submit', (e) => this.handleAddCategory(e));
        document.getElementById('addPayeeForm').addEventListener('submit', (e) => this.handleAddPayee(e));
        document.getElementById('deleteExpenseBtn').addEventListener('click', () => this.handleDelete(document.getElementById('delete_id').value));

        // Add focus logic
        document.getElementById('addCategoryModal').addEventListener('shown.bs.modal', () => document.getElementById('newCategoryName').focus());
        document.getElementById('addPayeeModal').addEventListener('shown.bs.modal', () => document.getElementById('newPayeeName').focus());
    }

    createPanelHTML(id, title, filterId, listId, hasAddButton) {
        return `
            <div class="panel-content">
                <div class="panel-header">
                    <h5>${title}</h5>
                    <div>
                        ${hasAddButton ? `<button class="btn btn-add" id="add-${id.replace('Panel','')}">+ Ajouter</button>` : ''}
                        <button class="btn-close-panel" onclick="controller.closePanels()"></button>
                    </div>
                </div>
                ${filterId ? `<div class="filter-section"><input type="text" class="form-control form-control-sm" id="${filterId}" placeholder="Filtrer..."></div>` : ''}
                <div class="panel-body"><div class="list-group" id="${listId}"></div></div>
            </div>`;
    }
    
    populateCategoriesPanel() { this.populatePanel('categorieList', this.categories, '📂', 'id', 'libelle'); }
    populatePayeesPanel() { this.populatePanel('beneficiaireList', this.payees, '👥', 'id', 'libelle'); }
    populateExpenseTypesPanel() { this.populatePanel('typeDepenseList', this.expenseTypes, '💳', 'id', 'libelle'); }

    populatePanel(listId, data, icon, valueField, textField) {
        const container = document.getElementById(listId);
        container.innerHTML = data.map(item => `
            <button type="button" class="list-group-item list-group-item-action" data-id="${item[valueField]}">
                ${icon} ${item[textField]}
            </button>`).join('');
        
        container.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                this.selectPanelItem(button.dataset.id, button.textContent.trim().substring(2), icon);
            });
        });
    }

    filterPanel(filterText, listId) {
        const filter = filterText.toLowerCase();
        document.querySelectorAll(`#${listId} .list-group-item`).forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(filter) ? '' : 'none';
        });
    }

    // Modal Logic
    openDeleteModal(id) {
        document.getElementById('delete_id').value = id;
        new bootstrap.Modal(document.getElementById('deleteModal')).show();
    }
    
    openAddCategoryModal() {
        new bootstrap.Modal(document.getElementById('addCategoryModal')).show();
    }

    openAddPayeeModal() {
        new bootstrap.Modal(document.getElementById('addPayeeModal')).show();
    }

    async handleAddCategory(e) {
        e.preventDefault();
        const name = document.getElementById('newCategoryName').value.trim();
        if (!name) return;
        const result = await this.categoriesModel.create({ libelle: name, is_mandatory: document.getElementById('newCategoryMandatory').checked });
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('addCategoryModal')).hide();
            document.getElementById('addCategoryForm').reset();
            await this.refreshData();
            this.selectPanelItem(result.data.id, result.data.libelle, '📂');
        }
    }

    async handleAddPayee(e) {
        e.preventDefault();
        const name = document.getElementById('newPayeeName').value.trim();
        if (!name) return;
        const result = await this.payeesModel.create({ libelle: name });

        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('addPayeeModal')).hide();
            document.getElementById('addPayeeForm').reset();
            await this.refreshData();
            this.selectPanelItem(result.data.id, result.data.libelle, '👥');
        }
    }

    createAddModalHTML(id, title, formId, inputId, label, hasCheckbox) {
        return `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">${title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <form id="${formId}">
                            <div class="mb-3"><label for="${inputId}" class="form-label">${label}</label><input type="text" class="form-control" id="${inputId}" required></div>
                            ${hasCheckbox ? '<div class="form-check"><input class="form-check-input" type="checkbox" id="newCategoryMandatory"><label class="form-check-label" for="newCategoryMandatory">Catégorie obligatoire</label></div>' : ''}
                        </form>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button><button type="submit" form="${formId}" class="btn btn-primary">Ajouter</button></div>
                </div>
            </div>`;
    }

    createDeleteModalHTML() {
        return `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Confirmer la suppression</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body"><p>Êtes-vous sûr de vouloir supprimer cette dépense récurrente ?</p><input type="hidden" id="delete_id"></div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button><button type="button" class="btn btn-danger" id="deleteExpenseBtn">Supprimer</button></div>
                </div>
            </div>`;
    }
}

let controller;
document.addEventListener('DOMContentLoaded', async () => {
    await ratchouApp.initialize();
    
    // Check authentication with guard system
    if (window.auth && typeof window.auth.guardPage === 'function') {
        if (!auth.guardPage('app')) {
            return; // User was redirected, stop initialization
        }
    } else if (!ratchouApp.isAuthenticated()) {
        location.replace('../index.html');
        return;
    }
    
    controller = new RecurrentsController();
    await controller.initialize();
});
