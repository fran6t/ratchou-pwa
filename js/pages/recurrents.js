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
        this.currentAccount = null;
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

        // Get current account
        this.currentAccount = await ratchouApp.getCurrentAccount();

        this.setupEventListeners();
        await this.loadAllData();
        this.updateAccountDisplay();
        this.renderRecurrents();
        this.updateTotalCards();
        this.renderPanelsAndModals();
        this.renderForm();
    }

    async loadComponents() {
        await ComponentLoader.loadHeader({
            showAccountInfo: true,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    updateAccountDisplay() {
        if (!this.currentAccount) return;

        // Update header display
        const accountNameEl = document.getElementById('currentAccountName');
        const accountBalanceEl = document.getElementById('currentAccountBalance');

        if (accountNameEl) {
            accountNameEl.textContent = this.currentAccount.nom_compte;
        }

        if (accountBalanceEl) {
            const currency = this.currentAccount.currency || 'EUR';
            const balance = RatchouUtils.currency.formatWithCurrency(this.currentAccount.balance, currency);
            const balanceAmount = RatchouUtils.currency.fromStorageUnit(this.currentAccount.balance, currency);

            accountBalanceEl.textContent = balance;
            // Amélioration : ajouter la classe de couleur selon positif/négatif
            accountBalanceEl.classList.remove('amount-positive', 'amount-negative');
            accountBalanceEl.classList.add(balanceAmount >= 0 ? 'amount-positive' : 'amount-negative');
        }
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

        // Account selection from header
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
    }

    async loadAllData() {
        [
            this.recurrents, this.accounts, this.categories, this.payees, this.expenseTypes
        ] = await Promise.all([
            this.recurrentsModel.getActiveByAccount(this.currentAccount.id),
            this.accountsModel.getAll(),
            this.categoriesModel.getAll(),
            this.payeesModel.getAll(),
            this.expenseTypesModel.getAll()
        ]);

        // Sort recurrents by day of month and label
        this.recurrents.sort((a, b) => {
            return a.day_of_month - b.day_of_month || a.libelle.localeCompare(b.libelle);
        });
    }

    showForm(recurrent = null) {
        this.mainContent.style.display = 'none';
        this.formContainer.style.display = 'block';
        this.recurrentForm.reset();
        this.resetPanelButtons();
        
        if (recurrent) {
            this.deleteRecurrentBtn.style.display = 'inline-block';
            this.populateForm(recurrent);
        } else {
            this.deleteRecurrentBtn.style.display = 'none';
            document.getElementById('recurrent-id').value = '';
            // Reset remarque
            document.getElementById('remarqueText').value = '';
            const remarqueButton = document.querySelector('[data-bs-target="#remarqueModal"]');
            if (remarqueButton) {
                remarqueButton.innerHTML = '📝 Remarque';
            }
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
        const currency = this.currentAccount?.currency || 'EUR';
        document.getElementById('recurrent-montant').value = RatchouUtils.currency.fromStorageUnit(recurrent.amount, currency);
        document.getElementById('recurrent-start-date').value = recurrent.start_date || '';
        document.getElementById('recurrent-frequence').value = recurrent.frequency || 1;

        document.getElementById('categorie_id').value = recurrent.category_id;
        document.getElementById('beneficiaire_id').value = recurrent.payee_id || '';
        document.getElementById('type_depense_id').value = recurrent.expense_type_id || '';
        document.getElementById('description').value = recurrent.description || '';

        this.updateSelectionButton('categorie_id', recurrent.category_id, this.categories);
        this.updateSelectionButton('beneficiaire_id', recurrent.payee_id, this.payees);
        this.updateSelectionButton('type_depense_id', recurrent.expense_type_id, this.expenseTypes);

        // Update remarque modal and button
        document.getElementById('remarqueText').value = recurrent.description || '';
        const remarqueButton = document.querySelector('[data-bs-target="#remarqueModal"]');
        if (recurrent.description && recurrent.description.trim()) {
            remarqueButton.innerHTML = '📝 Remarque ✓';
        } else {
            remarqueButton.innerHTML = '📝 Remarque';
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        const formData = new FormData(this.recurrentForm);
        const currency = this.currentAccount?.currency || 'EUR';

        const startDate = formData.get('start_date');
        const startDateObj = new Date(startDate);
        const dayOfMonth = startDateObj.getDate(); // Extrait le jour (1-31)

        const data = {
            libelle: formData.get('libelle'),
            amount: RatchouUtils.currency.toStorageUnit(parseFloat(formData.get('montant')), currency),
            start_date: startDate,
            day_of_month: dayOfMonth,  // Calculé automatiquement depuis start_date
            frequency: parseInt(formData.get('frequence')),
            account_id: this.currentAccount.id,
            category_id: formData.get('categorie_id') || null,
            payee_id: formData.get('beneficiaire_id') || null,
            expense_type_id: formData.get('type_depense_id') || null,
            description: formData.get('description') || null,
        };

        const id = formData.get('id');

        try {
            if (id) {
                await this.recurrentsModel.update(id, data);
            } else {
                data.is_active = 1;
                await this.recurrentsModel.create(data);
            }
            this.hideForm();
            await this.refreshData();
        } catch (error) {
            console.error("Error saving recurrent expense:", error);
            alert('Erreur lors de l\'enregistrement: ' + error.message);
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
            this.recurrentsModel.getActiveByAccount(this.currentAccount.id),
            this.categoriesModel.getAll(),
            this.payeesModel.getAll()
        ]);

        // Sort recurrents by day of month and label
        this.recurrents.sort((a, b) => {
            return a.day_of_month - b.day_of_month || a.libelle.localeCompare(b.libelle);
        });

        this.renderRecurrents();
        this.updateTotalCards();
        this.populateCategoriesPanel();
        this.populatePayeesPanel();
    }

    renderRecurrents() {
        if (this.recurrents.length === 0) {
            this.recurrentsList.innerHTML = '<div class="text-center text-muted p-4">Aucune dépense récurrente pour ce compte.</div>';
            return;
        }

        const categoriesMap = new Map(this.categories.map(c => [c.id, c.libelle]));
        const currency = this.currentAccount?.currency || 'EUR';

        this.recurrentsList.innerHTML = this.recurrents.map(r => {
            const monthlyAmount = r.amount / r.frequency;
            const amountClass = monthlyAmount >= 0 ? 'text-success' : 'text-danger';
            const absAmount = Math.abs(monthlyAmount);
            const formattedAmount = RatchouUtils.currency.formatWithCurrency(absAmount, currency);
            const sign = monthlyAmount >= 0 ? '+' : '-';

            // Fréquence lisible
            const frequencyMap = {
                1: 'Mensuel',
                2: 'Bimestriel',
                3: 'Trimestriel',
                6: 'Semestriel',
                12: 'Annuel'
            };
            const frequencyLabel = frequencyMap[r.frequency] || `Tous les ${r.frequency} mois`;

            // Dernière exécution
            const lastExec = r.last_execution
                ? `Dernier traitement : ${new Date(r.last_execution).toLocaleDateString('fr-FR')}`
                : 'Jamais traité';

            return `
                <div class="card mb-2 recurrent-card ${!r.is_active ? 'opacity-50' : ''}" style="cursor: pointer;" data-recurrent-id="${r.id}">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col">
                                <strong>${r.libelle}</strong>
                                <small class="d-block text-muted">
                                    ${categoriesMap.get(r.category_id) || 'N/A'}
                                </small>
                                <small class="d-block text-muted">
                                    🔄 ${frequencyLabel} • Jour ${r.day_of_month} • ${lastExec}
                                </small>
                            </div>
                            <div class="col text-end">
                                <strong class="${amountClass}">${sign} ${formattedAmount} / mois</strong>
                                <small class="d-block text-muted">Début : ${new Date(r.start_date).toLocaleDateString('fr-FR')}</small>
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
        const currency = this.currentAccount?.currency || 'EUR';

        this.totalsContainer.innerHTML = `
            <div class="row g-3">
                <div class="col-md-3 col-6"><div class="card bg-danger text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Dépenses / mois</h6><h4 class="card-text mb-0">${RatchouUtils.currency.formatWithCurrency(totalDepenses, currency)}</h4></div></div></div>
                <div class="col-md-3 col-6"><div class="card bg-success text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Recettes / mois</h6><h4 class="card-text mb-0">${RatchouUtils.currency.formatWithCurrency(totalRecettes, currency)}</h4></div></div></div>
                <div class="col-md-3 col-6"><div class="card ${impactClass} text-white h-100"><div class="card-body text-center"><h6 class="card-title mb-1">Balance / mois</h6><h4 class="card-text mb-0">${RatchouUtils.currency.formatWithCurrency(totalImpact, currency)}</h4></div></div></div>
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
        this.recurrentForm.innerHTML = `
            <input type="hidden" name="id" id="recurrent-id">
            <div class="row">
                <div class="col-12 mb-3">
                    <label for="recurrent-libelle" class="form-label">Libellé</label>
                    <input type="text" class="form-control" id="recurrent-libelle" name="libelle" required>
                </div>
                <div class="col-12 mb-3">
                    <div class="input-group">
                        <span class="input-group-text">Montant</span>
                        <input type="number" step="any" class="form-control" id="recurrent-montant" name="montant" required>
                    </div>
                    <div class="form-text">Positif = recette, Négatif = dépense</div>
                </div>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" data-panel-target="#categoriePanel" data-input-target="categorie_id" data-icon="📂" data-original-text="Catégorie">📂 Catégorie</button>
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" data-panel-target="#beneficiairePanel" data-input-target="beneficiaire_id" data-icon="👥" data-original-text="Bénéficiaire">👥 Bénéficiaire</button>
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" data-panel-target="#typeDepensePanel" data-input-target="type_depense_id" data-icon="💳" data-original-text="Type">💳 Type</button>
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" data-bs-toggle="modal" data-bs-target="#remarqueModal">📝 Remarque</button>
                </div>
                <div class="col-sm-6 mb-3">
                    <div class="input-group">
                        <span class="input-group-text">Date de début</span>
                        <input type="date" class="form-control" id="recurrent-start-date" name="start_date" required>
                    </div>
                    <div class="form-text">💡 Le jour sélectionné déterminera le jour de récurrence dans chaque période</div>
                </div>
                <div class="col-sm-6 mb-3">
                    <div class="input-group">
                        <span class="input-group-text">Fréquence</span>
                        <select class="form-select" id="recurrent-frequence" name="frequence" required>
                            <option value="1">Mensuel</option>
                            <option value="2">Bimestriel</option>
                            <option value="3">Trimestriel</option>
                            <option value="6">Semestriel</option>
                            <option value="12">Annuel</option>
                        </select>
                    </div>
                </div>
                <input type="hidden" id="categorie_id" name="categorie_id">
                <input type="hidden" id="beneficiaire_id" name="beneficiaire_id">
                <input type="hidden" id="type_depense_id" name="type_depense_id">
                <input type="hidden" id="description" name="description">
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

        // Remarque modal event listeners
        document.getElementById('saveRemarque').addEventListener('click', () => this.handleSaveRemarque());

        // Add focus logic
        document.getElementById('addCategoryModal').addEventListener('shown.bs.modal', () => document.getElementById('newCategoryName').focus());
        document.getElementById('addPayeeModal').addEventListener('shown.bs.modal', () => document.getElementById('newPayeeName').focus());
        document.getElementById('remarqueModal').addEventListener('shown.bs.modal', () => document.getElementById('remarqueText').focus());
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

    handleSaveRemarque() {
        const remarqueText = document.getElementById('remarqueText').value.trim();
        document.getElementById('description').value = remarqueText;

        // Update button text to show if a remark is set
        const remarqueButton = document.querySelector('[data-bs-target="#remarqueModal"]');
        if (remarqueText) {
            remarqueButton.innerHTML = '📝 Remarque ✓';
        } else {
            remarqueButton.innerHTML = '📝 Remarque';
        }

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('remarqueModal')).hide();
    }

    async openAccountSelectModal() {
        try {
            await this.loadAccountsList();
            const accountSelectModal = new bootstrap.Modal(document.getElementById('accountSelectModal'));
            accountSelectModal.show();
        } catch (error) {
            console.error('Error opening account select modal:', error);
        }
    }

    async loadAccountsList() {
        try {
            const accountsList = document.getElementById('accountsList');

            accountsList.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <div class="mt-2 small text-muted">Mise à jour des soldes...</div>
                </div>
            `;

            const freshAccounts = await this.accountsModel.getAll();

            if (freshAccounts.length === 0) {
                accountsList.innerHTML = '<p class="text-muted text-center">Aucun compte disponible</p>';
                return;
            }

            const sortedAccounts = freshAccounts.sort((a, b) => {
                if (a.is_principal && !b.is_principal) return -1;
                if (!a.is_principal && b.is_principal) return 1;
                return a.nom_compte.localeCompare(b.nom_compte);
            });

            this.accounts = sortedAccounts;

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

    async selectAccount(accountId) {
        try {
            const account = await this.accountsModel.getById(accountId);
            if (!account) return;

            this.currentAccount = account;
            ratchouApp.setCurrentAccount(accountId);

            const accountIndex = this.accounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                this.accounts[accountIndex] = account;
            }

            this.updateAccountDisplay();

            const accountSelectModal = bootstrap.Modal.getInstance(document.getElementById('accountSelectModal'));
            if (accountSelectModal) {
                accountSelectModal.hide();
            }

            await this.refreshData();

        } catch (error) {
            console.error('Error selecting account:', error);
        }
    }

    /**
     * Setup balance correction modal
     */
    setupBalanceModal() {
        if (!this.currentAccount) {
            console.warn('⚠️ setupBalanceModal called but currentAccount is not defined');
            return;
        }

        const currentBalanceSpan = document.getElementById('currentBalance');
        const newBalanceInput = document.getElementById('newBalance');

        const currency = this.currentAccount.currency || 'EUR';
        const balanceInStorage = this.currentAccount.balance || 0;
        const currentBalance = RatchouUtils.currency.fromStorageUnit(balanceInStorage, currency);

        // Display current balance
        currentBalanceSpan.textContent = RatchouUtils.currency.formatWithCurrency(balanceInStorage, currency);

        // Set appropriate decimal places for the input
        const decimals = currency === 'BTC' ? 8 : 2;
        newBalanceInput.value = currentBalance.toFixed(decimals);
        newBalanceInput.step = currency === 'BTC' ? '0.00000001' : '0.01';
        newBalanceInput.focus();
        newBalanceInput.select();

        console.log(`💰 Balance modal setup: ${currency} ${currentBalance.toFixed(decimals)} (storage: ${balanceInStorage})`);
    }

    /**
     * Handle balance update
     */
    async handleBalanceUpdate() {
        try {
            const newBalanceInput = document.getElementById('newBalance');
            const newBalanceDisplayUnit = parseFloat(newBalanceInput.value);

            if (isNaN(newBalanceDisplayUnit)) {
                alert('Veuillez saisir un montant valide');
                return;
            }

            // Convert display unit to storage unit
            const currency = this.currentAccount.currency || 'EUR';
            const newBalanceStorage = RatchouUtils.currency.toStorageUnit(newBalanceDisplayUnit, currency);

            // Use correctBalance which expects storage units
            const result = await this.accountsModel.correctBalance(this.currentAccount.id, newBalanceStorage);

            if (result.success) {
                // Update local reference with new balance
                this.currentAccount.balance = newBalanceStorage;
                this.updateAccountDisplay();
                bootstrap.Modal.getInstance(document.getElementById('balanceModal')).hide();

                // Refresh data to reflect changes
                await this.refreshData();
            } else {
                alert('Erreur: ' + result.message);
            }

        } catch (error) {
            console.error('Error updating balance:', error);
            alert('Erreur de mise à jour: ' + error.message);
        }
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
