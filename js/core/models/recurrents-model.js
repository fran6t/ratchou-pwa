/**
 * Recurring Expenses Model for Ratchou IndexedDB
 * Manages recurring transactions with automatic generation logic
 */

class RecurringExpensesModel extends BaseModel {
    constructor(db) {
        super(db, 'DEPENSES_FIXES');
    }

    async getActive() {
        const allExpenses = await this.getAll();
        return allExpenses.filter(expense => expense.is_active === true);
    }

    async getActiveByAccount(accountId) {
        const allExpenses = await this.getAll();
        return allExpenses.filter(expense => expense.is_active === true && expense.account_id === accountId);
    }

    async getByCategory(categoryId) {
        try {
            // Get all recurring expenses and filter by category
            const allExpenses = await this.getAll();
            return allExpenses.filter(expense => expense.category_id === categoryId && !expense.is_deleted);
        } catch (error) {
            console.error('Error getting recurring expenses by category:', error);
            throw error;
        }
    }

    async getByPayee(payeeId) {
        try {
            // Get all recurring expenses and filter by payee
            const allExpenses = await this.getAll();
            return allExpenses.filter(expense => expense.payee_id === payeeId && !expense.is_deleted);
        } catch (error) {
            console.error('Error getting recurring expenses by payee:', error);
            throw error;
        }
    }

    async getByExpenseType(expenseTypeId) {
        try {
            // Get all recurring expenses and filter by expense type
            const allExpenses = await this.getAll();
            return allExpenses.filter(expense => expense.expense_type_id === expenseTypeId && !expense.is_deleted);
        } catch (error) {
            console.error('Error getting recurring expenses by expense type:', error);
            throw error;
        }
    }

    async getAllSorted() {
        const expenses = await this.getAll();
        return expenses.sort((a, b) => {
            if (a.is_active && !b.is_active) return -1;
            if (!a.is_active && b.is_active) return 1;
            return a.day_of_month - b.day_of_month || a.libelle.localeCompare(b.libelle);
        });
    }

    async toggleActive(id, isActive) {
        return await this.update(id, { is_active: isActive });
    }

    async getUpcoming(accountId = null, limit = 10) {
        try {
            let expenses;
            if (accountId) {
                expenses = await this.getActiveByAccount(accountId);
            } else {
                const allExpenses = await this.getAll();
                expenses = allExpenses.filter(expense => expense.is_active === true);
            }

            const upcoming = [];
            const today = new Date();

            for (const expense of expenses) {
                const nextDate = this.calculateNextDate(expense);
                if (nextDate) {
                    const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
                    upcoming.push({
                        ...expense,
                        next_date: nextDate.toISOString().split('T')[0],
                        days_until: daysUntil,
                        formatted_date: RatchouUtils.date.format(nextDate.toISOString())
                    });
                }
            }

            upcoming.sort((a, b) => new Date(a.next_date) - new Date(b.next_date));
            return upcoming.slice(0, limit);
        } catch (error) {
            console.error('Error getting upcoming recurring expenses:', error);
            throw error;
        }
    }

    calculateNextDate(expense) {
        const today = new Date();
        const targetDay = expense.day_of_month;
        const frequency = expense.frequency || 1;
        const nextDate = new Date();
        nextDate.setDate(targetDay);
        nextDate.setHours(0, 0, 0, 0);
        if (nextDate <= today) {
            nextDate.setMonth(nextDate.getMonth() + frequency);
        }
        if (nextDate.getDate() !== targetDay) {
            nextDate.setDate(0);
        }
        return nextDate;
    }

    shouldProcessToday(expense) {
        if (!expense.is_active) return false;
        const today = new Date();
        const lastExecution = expense.last_execution ? new Date(expense.last_execution) : null;
        if (!lastExecution) {
            const startMonth = expense.start_month || today.getMonth() + 1;
            const startDate = new Date();
            startDate.setMonth(startMonth - 1);
            startDate.setDate(expense.day_of_month);
            return today >= startDate;
        }
        const nextExecution = new Date(lastExecution);
        nextExecution.setMonth(nextExecution.getMonth() + expense.frequency);
        return today >= nextExecution;
    }

    async processAll() {
        try {
            const allExpenses = await this.getAll();
            const activeExpenses = allExpenses.filter(expense => expense.is_active === true);
            const processed = [];
            for (const expense of activeExpenses) {
                if (this.shouldProcessToday(expense)) {
                    const result = await this.generateTransaction(expense);
                    if (result.success) {
                        processed.push(expense);
                    }
                }
            }
            return { success: true, message: `${processed.length} dépenses récurrentes traitées`, data: { count: processed.length, processed } };
        } catch (error) {
            console.error('Error processing recurring expenses:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'traitement dépenses récurrentes');
        }
    }

    async generateTransaction(expense) {
        try {
            const transactionData = {
                amount: expense.amount,
                category_id: expense.category_id,
                payee_id: expense.payee_id,
                expense_type_id: expense.expense_type_id,
                description: `Dépense récurrente: ${expense.libelle}`,
                account_id: expense.account_id,
                date_mouvement: RatchouUtils.date.now()
            };
            const transactionsModel = new TransactionsModel(this.db);
            const result = await transactionsModel.create(transactionData);
            if (result.success) {
                await this.update(expense.id, { last_execution: RatchouUtils.date.now() });
            }
            return result;
        } catch (error) {
            console.error('Error generating transaction from recurring expense:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'génération transaction');
        }
    }

    validateCreate(data) {
        super.validateCreate(data);
        RatchouUtils.validate.required(data.libelle, 'libelle');
        RatchouUtils.validate.required(data.amount, 'amount');
        RatchouUtils.validate.required(data.day_of_month, 'day_of_month');
        RatchouUtils.validate.required(data.account_id, 'account_id');
        RatchouUtils.validate.required(data.category_id, 'category_id');
        data.libelle = data.libelle.trim();
        if (typeof data.amount !== 'number') throw new Error('Le montant doit être un nombre');
        if (data.amount !== Math.floor(data.amount)) data.amount = RatchouUtils.currency.toCents(data.amount);
        if (data.day_of_month < 1 || data.day_of_month > 31) throw new Error('Le jour du mois doit être entre 1 et 31');
        if (data.frequency === undefined) data.frequency = 1;
        if (data.is_active === undefined) data.is_active = true;
    }

    validateUpdate(data) {
        super.validateUpdate(data);
        if (data.libelle !== undefined) {
            if (!data.libelle || data.libelle.trim() === '') throw new Error('Le libellé ne peut pas être vide');
            data.libelle = data.libelle.trim();
        }
        if (data.amount !== undefined) {
            if (typeof data.amount !== 'number') throw new Error('Le montant doit être un nombre');
            if (data.amount !== Math.floor(data.amount)) data.amount = RatchouUtils.currency.toCents(data.amount);
        }
        if (data.day_of_month !== undefined) {
            if (data.day_of_month < 1 || data.day_of_month > 31) throw new Error('Le jour du mois doit être entre 1 et 31');
        }
    }

    async getEnriched(expenses = null) {
        if (!expenses) expenses = await this.getAllSorted();
        const enriched = [];
        for (const expense of expenses) {
            const account = await this.db.get('COMPTES', expense.account_id);
            const category = await this.db.get('CATEGORIES', expense.category_id);
            const payee = expense.payee_id ? await this.db.get('BENEFICIAIRES', expense.payee_id) : null;
            const expenseType = expense.expense_type_id ? await this.db.get('TYPE_DEPENSES', expense.expense_type_id) : null;
            enriched.push({
                ...expense,
                account_name: account?.nom_compte || 'Compte supprimé',
                category_name: category?.libelle || 'Catégorie supprimée',
                payee_name: payee?.libelle || 'Sans bénéficiaire',
                expense_type_name: expenseType?.libelle || 'Sans type'
            });
        }
        return enriched;
    }

    async importFromSQLite(sqliteRecurring) {
        const transformed = sqliteRecurring.map(RatchouUtils.transform.recurringExpense);
        return await this.bulkImport(transformed);
    }

    async createDefaults(principalAccount) {
        if (!principalAccount) {
            console.warn('No principal account provided, cannot create default recurring expenses');
            return RatchouUtils.error.validation('Compte principal non fourni');
        }

        try {
            // Récupération des données nécessaires avec les nouvelles méthodes
            const categories = await this.db.getAllActive('CATEGORIES');
            const payees = await this.db.getAllActive('BENEFICIAIRES');
            const expenseTypes = await this.db.getAllActive('TYPE_DEPENSES');

            console.log('Categories found:', categories.length);
            console.log('Payees found:', payees.length);
            console.log('Expense types found:', expenseTypes.length);

            const salaryCategory = categories.find(c => c.libelle && c.libelle.toLowerCase().includes('revenus'));
            const insuranceCategory = categories.find(c => c.libelle && c.libelle.toLowerCase().includes('assurance'));
            const employerPayee = payees.find(p => p.libelle && p.libelle.toLowerCase().includes('employeur'));
            const insurancePayee = payees.find(p => p.libelle && p.libelle.toLowerCase().includes('assurance'));
            const defaultExpenseType = expenseTypes.find(t => t.is_default === true);

            console.log('Found entities:', {
                salaryCategory: !!salaryCategory,
                insuranceCategory: !!insuranceCategory, 
                employerPayee: !!employerPayee,
                insurancePayee: !!insurancePayee,
                defaultExpenseType: !!defaultExpenseType
            });

            const defaults = [];
            
            // Salaire (revenus positifs)
            if (principalAccount && salaryCategory && employerPayee && defaultExpenseType) {
                defaults.push({
                    libelle: 'SALAIRE',
                    amount: RatchouUtils.currency.toCents(1500.00), // Conversion en centimes
                    account_id: principalAccount.id,
                    category_id: salaryCategory.id,
                    payee_id: employerPayee.id,
                    expense_type_id: defaultExpenseType.id,
                    day_of_month: 28,
                    frequency: 1,
                    is_active: true
                });
            }
            
            // Assurance maison (dépense négative)
            if (principalAccount && insuranceCategory && insurancePayee && defaultExpenseType) {
                defaults.push({
                    libelle: 'ASSURANCE MAISON',
                    amount: RatchouUtils.currency.toCents(-48.00), // Conversion en centimes
                    account_id: principalAccount.id,
                    category_id: insuranceCategory.id,
                    payee_id: insurancePayee.id,
                    expense_type_id: defaultExpenseType.id,
                    day_of_month: 5,
                    frequency: 1,
                    is_active: true
                });
            }

            console.log('Defaults to create:', defaults.length);

            if (defaults.length === 0) {
                console.warn('No default recurring expenses could be created due to missing required entities');
                return RatchouUtils.error.validation('Impossible de créer les dépenses par défaut : entités requises manquantes');
            }

            // Création des dépenses fixes avec les nouvelles méthodes
            const promises = defaults.map(async item => {
                const itemToInsert = {
                    ...item,
                    id: RatchouUtils.generateUUID(),
                    last_execution: null
                };
                this.validateCreate(itemToInsert);
                return await this.db.putWithMeta(this.storeName, itemToInsert);
            });

            await Promise.all(promises);

            console.log(`Created ${defaults.length} default recurring expenses`);
            return RatchouUtils.error.success(`${defaults.length} dépenses fixes par défaut créées`);
            
        } catch (error) {
            console.error('Error creating default recurring expenses:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'création des dépenses fixes par défaut');
        }
    }
}

window.RecurringExpensesModel = RecurringExpensesModel;