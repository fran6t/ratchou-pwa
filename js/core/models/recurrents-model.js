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
        return allExpenses.filter(expense => expense.is_active);
    }

    async getActiveByAccount(accountId) {
        const allExpenses = await this.getAll();
        return allExpenses.filter(expense => expense.is_active && expense.account_id === accountId);
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
                expenses = allExpenses.filter(expense => expense.is_active);
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

    /**
     * Calcule les occurrences dues pour une dépense récurrente
     * Algorithme défensif pour éviter les dérives de date JavaScript
     * Fréquence en MOIS : 1=mensuel, 3=trimestriel, 12=annuel
     * @param {Object} expense - Dépense récurrente
     * @returns {Array<Object>} Liste des occurrences { date, amount }
     */
    calculateDueOccurrences(expense) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const frequency = expense.frequency || 1;
        const occurrences = [];

        // Point de départ intelligent
        let startYear, startMonth, startDay;
        if (expense.last_execution) {
            const lastDate = new Date(expense.last_execution);
            startYear = lastDate.getFullYear();
            startMonth = lastDate.getMonth() + frequency; // Prochaine occurrence
            startDay = expense.day_of_month;
        } else {
            const startDate = new Date(expense.start_date);
            startYear = startDate.getFullYear();
            startMonth = startDate.getMonth();
            startDay = expense.day_of_month;
        }

        // Limite de sécurité : 5 ans max
        const maxPastDate = new Date(today);
        maxPastDate.setFullYear(maxPastDate.getFullYear() - 5);

        // Générer occurrences
        let currentYear = startYear;
        let currentMonth = startMonth;

        while (true) {
            // Construction défensive de la date (évite dérive setDate)
            const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const adjustedDay = Math.min(startDay, lastDayOfMonth);
            const currentDate = new Date(currentYear, currentMonth, adjustedDay);

            // Vérifications limites
            if (currentDate > today) break;
            if (currentDate < maxPastDate) {
                console.warn(`⚠️ Occurrence trop ancienne pour ${expense.libelle}, limitation à 5 ans`);
                currentMonth += frequency;
                if (currentMonth >= 12) {
                    currentYear += Math.floor(currentMonth / 12);
                    currentMonth = currentMonth % 12;
                }
                continue;
            }

            // Ajouter occurrence
            occurrences.push({
                date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
                amount: expense.amount
            });

            // Avancer à la prochaine période
            currentMonth += frequency;
            if (currentMonth >= 12) {
                currentYear += Math.floor(currentMonth / 12);
                currentMonth = currentMonth % 12;
            }
        }

        return occurrences;
    }

    /**
     * Calcule la prochaine date d'exécution (legacy - conservé pour compatibilité)
     */
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

    /**
     * Récupère tous les mouvements créés pour une dépense récurrente
     * Utilisé pour filtrage préventif (protection anti-doublon)
     * @param {string} recurringId - ID de la dépense récurrente
     * @returns {Promise<Array<Object>>} Liste des mouvements
     */
    async getMovementsByRecurringId(recurringId) {
        // Use wrapper's getAll method with index and query
        // Returns ALL movements (including deleted) to prevent recreating duplicates
        return await this.db.getAll('MOUVEMENTS', 'recurring_expense_id', recurringId);
    }

    /**
     * Crée un mouvement récurrent avec traçabilité
     * Format date strict : YYYY-MM-DDT00:00:00.000Z (toujours minuit UTC)
     * @param {Object} expense - Dépense récurrente
     * @param {string} date - Date du mouvement (YYYY-MM-DD)
     * @returns {Promise<Object>} Résultat de création
     */
    async createRecurringMovement(expense, date) {
        const transactionData = {
            amount: expense.amount,
            category_id: expense.category_id,
            payee_id: expense.payee_id,
            expense_type_id: expense.expense_type_id,
            description: `Dépense récurrente: ${expense.libelle}`,
            account_id: expense.account_id,
            date_mouvement: `${date}T00:00:00.000Z`,           // ⚠️ Format strict minuit UTC
            recurring_expense_id: expense.id                    // ⚠️ Traçabilité
        };

        const transactionsModel = new TransactionsModel(this.db);
        return await transactionsModel.create(transactionData);
        // Note: updated_at, rev, device_id ajoutés automatiquement par putWithMeta()
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

    /**
     * Traite toutes les dépenses récurrentes actives
     * Calcul optimisé : pas de boucle jour-par-jour
     * Protection anti-doublon : 100% applicative (filtrage préventif)
     * @returns {Promise<Object>} { success, created, skipped, errors }
     */
    async processAllRecurring() {
        try {
            const activeExpenses = await this.getActive();
            let totalCreated = 0, totalSkipped = 0, totalErrors = 0;

            console.log(`🔄 Processing ${activeExpenses.length} recurring expenses...`);

            for (const expense of activeExpenses) {
                // 1. Calculer occurrences dues
                const dueOccurrences = this.calculateDueOccurrences(expense);

                if (dueOccurrences.length === 0) {
                    console.log(`✅ ${expense.libelle}: Up to date`);
                    continue;
                }

                console.log(`📅 ${expense.libelle}: ${dueOccurrences.length} occurrences due`);

                // 2. PROTECTION ANTI-DOUBLON : Récupérer mouvements existants
                const existingMovements = await this.getMovementsByRecurringId(expense.id);
                const existingDates = new Set(
                    existingMovements.map(m => m.date_mouvement.split('T')[0])
                );

                // 3. Filtrer occurrences déjà créées
                const toCreate = dueOccurrences.filter(occ => !existingDates.has(occ.date));

                if (toCreate.length === 0) {
                    console.log(`⏭️  ${expense.libelle}: All occurrences already created`);
                    totalSkipped += dueOccurrences.length;
                    continue;
                }

                console.log(`📝 ${expense.libelle}: Creating ${toCreate.length} movements`);

                // 4. Créer mouvements manquants
                for (const occurrence of toCreate) {
                    try {
                        await this.createRecurringMovement(expense, occurrence.date);
                        totalCreated++;
                        console.log(`✅ Created: ${expense.libelle} on ${occurrence.date}`);
                    } catch (error) {
                        totalErrors++;
                        console.error(`❌ Error creating movement: ${expense.libelle}`, error);
                    }
                }

                // 5. Mettre à jour last_execution
                if (toCreate.length > 0) {
                    const latestDate = toCreate[toCreate.length - 1].date;
                    await this.update(expense.id, {
                        last_execution: latestDate
                    });
                }
            }

            console.log(`🎯 Summary: ${totalCreated} created, ${totalSkipped} skipped, ${totalErrors} errors`);

            return {
                success: true,
                created: totalCreated,
                skipped: totalSkipped,
                errors: totalErrors
            };
        } catch (error) {
            console.error('❌ Error processing recurring expenses:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'traitement dépenses récurrentes');
        }
    }

    /**
     * Legacy method - kept for compatibility
     */
    async processAll() {
        return await this.processAllRecurring();
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
        // category_id, payee_id, expense_type_id sont facultatifs
        data.libelle = data.libelle.trim();
        if (typeof data.amount !== 'number') throw new Error('Le montant doit être un nombre');
        if (data.amount !== Math.floor(data.amount)) data.amount = RatchouUtils.currency.toCents(data.amount);
        if (data.day_of_month < 1 || data.day_of_month > 31) throw new Error('Le jour du mois doit être entre 1 et 31');
        if (data.frequency === undefined) data.frequency = 1;
        if (data.is_active === undefined) data.is_active = 1;

        // Valider start_date (obligatoire pour v2.0)
        if (!data.start_date) {
            // Si absent, utiliser le début du mois actuel par défaut
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            data.start_date = startDate.toISOString().split('T')[0];
        }
    }

    validateUpdate(data) {
        super.validateUpdate(data);

        // Validation libellé
        if (data.libelle !== undefined) {
            if (!data.libelle || data.libelle.trim() === '')
                throw new Error('Le libellé ne peut pas être vide');
            data.libelle = data.libelle.trim();
        }

        // Validation montant
        if (data.amount !== undefined) {
            if (typeof data.amount !== 'number')
                throw new Error('Le montant doit être un nombre');
            if (data.amount !== Math.floor(data.amount))
                data.amount = RatchouUtils.currency.toCents(data.amount);
        }

        // Validation jour du mois
        if (data.day_of_month !== undefined) {
            if (data.day_of_month < 1 || data.day_of_month > 31)
                throw new Error('Le jour du mois doit être entre 1 et 31');
        }

        // ⚠️ FIX RISQUE 3 : Recalcul last_execution si champs critiques changés
        const criticalFieldsChanged =
            data.start_date !== undefined ||
            data.frequency !== undefined ||
            data.day_of_month !== undefined;

        if (criticalFieldsChanged) {
            // Si start_date est dans le futur, reset last_execution
            if (data.start_date) {
                const startDate = new Date(data.start_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (startDate > today) {
                    data.last_execution = null;
                    console.log(`🔄 Reset last_execution (start_date in future)`);
                }
            }

            // Si frequency/day_of_month changent et que last_execution existe,
            // on le laisse tel quel pour le moment (sera recalculé au prochain processAllRecurring)
            // Note: Une version plus avancée pourrait recalculer intelligemment ici
        }
    }

    transformForStorage(data) {
        const transformed = super.transformForStorage(data);

        // Auto-calcul de day_of_month depuis start_date si manquant ou incohérent
        // Garantit la cohérence start_date ↔ day_of_month
        if (transformed.start_date) {
            const startDate = new Date(transformed.start_date);
            const dayFromStartDate = startDate.getDate();

            // Recalculer day_of_month dans tous les cas pour garantir la cohérence
            // (même si day_of_month existe déjà, on utilise celui de start_date)
            transformed.day_of_month = dayFromStartDate;
        }

        return transformed;
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
            const defaultExpenseType = expenseTypes.find(t => t.is_default === 1);

            console.log('Found entities:', {
                salaryCategory: !!salaryCategory,
                insuranceCategory: !!insuranceCategory, 
                employerPayee: !!employerPayee,
                insurancePayee: !!insurancePayee,
                defaultExpenseType: !!defaultExpenseType
            });

            const defaults = [];

            // Date de début : début du mois actuel
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            const startDateString = startDate.toISOString().split('T')[0]; // YYYY-MM-DD

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
                    start_date: startDateString,
                    is_active: 1
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
                    start_date: startDateString,
                    is_active: 1
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