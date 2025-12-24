/**
 * SyncManager - Gère la synchronisation entre appareils
 * Version 1.3.0 Phase 3: Synchronisation complète
 *
 * Phase 1 (IMPLÉMENTÉE ✅):
 * - Chiffrement AES-256-GCM via SyncCrypto
 * - Communication HTTP via NetworkClient
 * - PUSH: Chiffrement et envoi de SYNC_QUEUE
 * - PULL: Réception et déchiffrement de messages
 *
 * Phase 2 (IMPLÉMENTÉE ✅):
 * - Pairing hybride (QR Code + code court)
 * - Bootstrap maître avec recovery key
 * - Gestion appareils (liste + révocation)
 *
 * Phase 3 (IMPLÉMENTÉE ✅):
 * - Cycle complet tick() avec PUSH/PULL orchestré
 * - Application des SYNC_RESPONSE (applyMergeResult)
 * - Résolution de conflits basée sur timestamps
 * - Retry/backoff exponentiel avec jitter
 * - Traçage SYNC_LOG + heartbeat
 *
 * Phases futures:
 * - Phase 4+: Transfert de maîtrise, versioning schéma, migrations
 *
 * Voir docs/sync-client-implementation.md pour spécifications complètes
 */
class SyncManager {
    // Bootstrap configuration constants (Phase 4)
    static BOOTSTRAP_BATCH_SIZE = 50;           // Records per batch
    static BOOTSTRAP_POLL_INTERVAL = 2000;      // 2 seconds between polls
    static BOOTSTRAP_MAX_ATTEMPTS = 60;         // 120 seconds total timeout
    static BOOTSTRAP_EXTENDED_ATTEMPTS = 15;    // 30s extra for missing batches
    static SCHEMA_VERSION = 2;                  // Current protocol version

    /**
     * Constructeur du SyncManager
     * @param {IndexedDBWrapper} db - Instance de la base de données
     * @param {Object} config - Configuration de synchronisation (SYNC_CONFIG)
     */
    constructor(db, config) {
        this.db = db;
        this.config = config;
        this.isRunning = false;
        this.pollInterval = null;

        // Phase 1: Références aux modules crypto et network
        this.crypto = window.SyncCrypto;
        this.network = window.NetworkClient;
        this.encryptionKey = null;  // Sera chargé depuis SYNC_CONFIG

        // Phase 3: Gestion des ticks et retry
        this.tickCount = 0;
        this.retryAttempt = 0;
        this.BASE_DELAY = 2000;      // 2 secondes
        this.MAX_DELAY = 60000;      // 60 secondes max

        // Gestion du rate limiting
        this.isRateLimited = false;
        this.rateLimitUntil = null;  // Timestamp de fin du blocage
    }

    /**
     * Démarre le SyncManager
     * Phase 1: Charge la clé de chiffrement depuis SYNC_CONFIG
     */
    async start() {
        console.log('🔄 SyncManager: Phase 1 - Initialisation...');

        // Charger la configuration de synchronisation
        const config = await this.db.get('SYNC_CONFIG', 'config');

        if (!config) {
            console.warn('⚠️ SYNC_CONFIG not found - sync disabled');
            console.log('ℹ️ App fonctionne en mode offline uniquement');
            return;
        }

        // Importer la clé de chiffrement si disponible
        if (config.encryption_key) {
            try {
                this.encryptionKey = await this.crypto.importKeyFromBase64(
                    config.encryption_key
                );
                console.log('🔐 Encryption key loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load encryption key:', error);
                console.warn('⚠️ Sync disabled - invalid encryption key');
                return;
            }
        } else {
            console.warn('⚠️ No encryption key in SYNC_CONFIG');
        }

        console.log('✅ SyncManager started with crypto + network modules');
        console.log(`📋 Device: ${config.device_id} | Role: ${config.role || 'unknown'}`);

        // TODO Phase 3: Démarrer polling automatique si configuré
    }

    /**
     * Cycle de synchronisation (tick)
     * Phase 3: Orchestre un cycle PUSH/PULL complet
     * @returns {Object} Résultat de la sync
     */
    async tick() {
        // 0. Vérifier si rate limited
        if (this.isRateLimited) {
            const now = Date.now();
            if (this.rateLimitUntil && now < this.rateLimitUntil) {
                const remaining = Math.ceil((this.rateLimitUntil - now) / 1000);
                console.log(`⏳ Rate limited - ${remaining}s restantes`);
                return {
                    success: false,
                    reason: 'rate_limited',
                    recordsPushed: 0,
                    recordsPulled: 0,
                    conflicts: 0
                };
            } else {
                // Déblocage automatique
                console.log('✅ Rate limit expiré - reprise');
                this.clearRateLimit();
            }
        }

        // 1. Vérifier connectivité
        if (!this.isOnline()) {
            console.log('⚠️ Offline, sync différée');
            return {
                success: false,
                reason: 'offline',
                recordsPushed: 0,
                recordsPulled: 0,
                conflicts: 0
            };
        }

        // 2. Vérifier configuration
        if (!this.config || !this.config.api_url) {
            console.log('⚠️ Sync non configurée');
            return {
                success: false,
                reason: 'not_configured',
                recordsPushed: 0,
                recordsPulled: 0,
                conflicts: 0
            };
        }

        const startTime = Date.now();

        try {
            // 3. PUSH : Envoyer changements locaux
            console.log('📤 PUSH - Envoi des changements locaux');
            const pushResult = await this.pushQueuedChanges();

            // 4. PULL : Récupérer messages entrants
            console.log('📥 PULL - Récupération des changements');
            const pullResult = await this.pullIncomingChanges();

            // 5. Heartbeat tous les 10 ticks (optionnel)
            if (this.tickCount % 10 === 0) {
                await this.sendHeartbeat();
            }

            this.tickCount++;
            this.retryAttempt = 0;  // Reset compteur d'erreurs

            const duration = Date.now() - startTime;

            // 6. Logger le sync
            await this.logSync('SYNC_SUCCESS', {
                duration,
                pushed: pushResult.pushed || 0,
                pulled: pullResult.pulled || 0,
                conflicts: pullResult.conflicts || 0
            });

            console.log(`✅ Sync tick completed in ${duration}ms`);

            return {
                success: true,
                recordsPushed: pushResult.pushed || 0,
                recordsPulled: pullResult.pulled || 0,
                conflicts: pullResult.conflicts || 0,
                duration
            };

        } catch (err) {
            console.error('❌ Erreur sync:', err);

            const duration = Date.now() - startTime;

            await this.logSync('SYNC_ERROR', {
                duration,
                error: err.message
            });

            this.handleSyncError(err);

            return {
                success: false,
                error: err.message,
                recordsPushed: 0,
                recordsPulled: 0,
                conflicts: 0
            };
        }
    }

    /**
     * Démarre le polling périodique
     * @param {number} intervalMs - Intervalle en millisecondes (défaut: 30 secondes)
     */
    startPeriodicSync(intervalMs = 30000) {
        if (this.isRunning) {
            console.log('⚠️ Sync périodique déjà en cours');
            return;
        }

        this.isRunning = true;
        this.pollInterval = setInterval(() => this.tick(), intervalMs);
        console.log(`🔄 Sync périodique démarrée (${intervalMs}ms) - mode stub`);

        // TODO v1.2.0: Implémenter polling intelligent avec backoff
    }

    /**
     * Arrête le polling périodique
     */
    stopPeriodicSync() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            this.isRunning = false;
            console.log('⏸️ Sync périodique arrêtée');
        }
    }

    /**
     * PUSH: Envoie les changements locaux vers le serveur
     * Phase 1: Chiffre et envoie la SYNC_QUEUE
     * @returns {Object} Résultat du push
     */
    async pushQueuedChanges() {
        // Vérifier que la clé de chiffrement est chargée
        if (!this.encryptionKey) {
            console.warn('⚠️ No encryption key - cannot push');
            return { success: false, pushed: 0, error: 'no_encryption_key' };
        }

        // Charger la configuration
        const config = await this.db.get('SYNC_CONFIG', 'config');
        if (!config || !config.device_id || !config.device_token) {
            console.warn('⚠️ Invalid SYNC_CONFIG - cannot push');
            return { success: false, pushed: 0, error: 'invalid_config' };
        }

        // Récupérer les entrées non synchronisées de la queue
        const pending = await this.db.getAll('SYNC_QUEUE', 'synced', 0);

        if (pending.length === 0) {
            console.log('📤 PUSH: No pending changes');
            return { success: true, pushed: 0 };
        }

        console.log(`📤 PUSH: ${pending.length} changes to sync`);

        try {
            // Chiffrer le payload
            const encrypted = await this.crypto.encrypt({
                type: 'SYNC_REQUEST',
                changes: pending,
                ts: Date.now(),
                schema_version: config.cluster_schema_version || 1
            }, this.encryptionKey);

            // Envoyer au serveur (master ou broadcast selon role)
            // Master s'envoie à lui-même → serveur broadcaste aux slaves
            // Slave envoie directement au master
            const targetDevice = config.role === 'slave' ? config.master_id : config.device_id;

            const result = await this.network.push(
                config.device_id,
                config.device_token,
                targetDevice,
                encrypted
            );

            // Marquer comme synchronisé si succès
            if (result.success) {
                for (const entry of pending) {
                    entry.synced = 1;
                    await this.db.put('SYNC_QUEUE', entry);
                }
                console.log(`✅ PUSH successful: ${pending.length} changes synced`);
            } else {
                console.error('❌ PUSH failed:', result.error || result.message);
            }

            return { success: result.success, pushed: pending.length };

        } catch (error) {
            console.error('❌ PUSH error:', error);
            return { success: false, pushed: 0, error: error.message };
        }
    }

    /**
     * PULL: Récupère les changements depuis le serveur
     * Phase 1: Récupère et déchiffre les messages
     * @returns {Object} Résultat du pull
     */
    async pullIncomingChanges() {
        // Vérifier que la clé de chiffrement est chargée
        if (!this.encryptionKey) {
            console.warn('⚠️ No encryption key - cannot pull');
            return { success: false, pulled: 0, error: 'no_encryption_key' };
        }

        // Charger la configuration
        const config = await this.db.get('SYNC_CONFIG', 'config');
        if (!config || !config.device_id || !config.device_token) {
            console.warn('⚠️ Invalid SYNC_CONFIG - cannot pull');
            return { success: false, pulled: 0, error: 'invalid_config' };
        }

        try {
            // Récupérer les messages depuis le serveur
            const result = await this.network.pull(
                config.device_id,
                config.device_token
            );

            if (!result.success) {
                console.error('❌ PULL failed:', result.error || result.message);
                return { success: false, pulled: 0, error: result.error };
            }

            if (!result.messages || result.messages.length === 0) {
                console.log('📥 PULL: No incoming messages');
                return { success: true, pulled: 0 };
            }

            console.log(`📥 PULL: ${result.messages.length} messages received`);

            // Déchiffrer et traiter chaque message
            let processed = 0;
            let pulled = 0;
            const errors = [];
            const metrics = { conflicts: 0 };

            for (const msg of result.messages) {
                try {
                    const decrypted = await this.crypto.decrypt(
                        msg.payload,
                        this.encryptionKey
                    );

                    console.log(`📨 Processing message from ${msg.from}: ${decrypted.type}`);

                    // Traiter SYNC_REQUEST (maître uniquement)
                    if (decrypted.type === 'SYNC_REQUEST') {
                        if (config.role === 'master') {
                            console.log(`  📊 Processing ${decrypted.changes?.length || 0} changes from slave`);
                            await this.processSyncRequest(decrypted, msg.from);
                            pulled++;
                        } else {
                            console.warn('  ⚠️ SYNC_REQUEST reçu mais cet appareil n\'est pas maître');
                        }
                    }
                    // Traiter SYNC_RESPONSE
                    else if (decrypted.type === 'SYNC_RESPONSE') {
                        const results = decrypted.results || [];
                        console.log(`  📊 Applying ${results.length} merge results`);

                        let applied = 0;
                        const conflicts = [];

                        for (const mergeResult of results) {
                            try {
                                await this.applyMergeResult(mergeResult);
                                applied++;

                                // Tracker les conflits
                                if (mergeResult.status === 'CONFLICT_MASTER' ||
                                    mergeResult.status === 'CONFLICT_EQUAL_MASTER') {
                                    conflicts.push(mergeResult);
                                }
                            } catch (error) {
                                console.error(`  ❌ Failed to apply result ${mergeResult.sync_id}:`, error);
                                errors.push({
                                    sync_id: mergeResult.sync_id,
                                    error: error.message
                                });
                            }
                        }

                        console.log(`  ✅ Applied ${applied}/${results.length} results, ${conflicts.length} conflicts resolved`);

                        // Ajouter aux métriques
                        pulled++;
                        metrics.conflicts += conflicts.length;
                    }
                    // Traiter CLUSTER_UPDATE
                    else if (decrypted.type === 'CLUSTER_UPDATE') {
                        console.log('  🔔 Cluster update received');
                        // TODO Phase 4: Gérer révocations, changements de maître, etc.
                        pulled++;
                    }
                    // Phase 4: Traiter BOOTSTRAP_BATCH (normalement géré par _pollBootstrapBatches)
                    else if (decrypted.type === 'BOOTSTRAP_BATCH') {
                        console.log(`  📦 Bootstrap batch ${decrypted.batch_number}/${decrypted.total_batches} (stage ${decrypted.stage})`);
                        // Note: Normalement géré par _pollBootstrapBatches, mais on acknowledge ici aussi
                        pulled++;
                    }
                    // Phase 4: Traiter BOOTSTRAP_COMPLETE
                    else if (decrypted.type === 'BOOTSTRAP_COMPLETE') {
                        console.log(`  ✅ Bootstrap complete signal for stage ${decrypted.stage} (${decrypted.total_records} records)`);
                        pulled++;
                    }
                    // Phase 4: Traiter BOOTSTRAP_ERROR
                    else if (decrypted.type === 'BOOTSTRAP_ERROR') {
                        console.error(`  ❌ Bootstrap error for stage ${decrypted.stage}: ${decrypted.error}`);
                        pulled++;
                    }
                    else {
                        console.warn(`  ⚠️ Unknown message type: ${decrypted.type}`);
                    }

                    processed++;

                } catch (error) {
                    console.error(`❌ Failed to process message ${msg.message_id}:`, error);
                    errors.push({ message_id: msg.message_id, error: error.message });
                }
            }

            console.log(`✅ PULL successful: ${processed}/${result.messages.length} messages processed`);

            if (errors.length > 0) {
                console.warn(`⚠️ ${errors.length} messages failed to process`);
            }

            return {
                success: true,
                pulled: pulled,
                total: result.messages.length,
                conflicts: metrics.conflicts,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('❌ PULL error:', error);
            return { success: false, pulled: 0, error: error.message };
        }
    }

    /**
     * Résout un conflit entre version locale et distante
     * Phase 3: Algorithme complet de résolution
     * Règles:
     * 1. DELETE gagne toujours
     * 2. Timestamps updated_at décident
     * 3. Égalité → maître gagne (si role=master)
     * @param {Object} local - Version locale du record
     * @param {Object} remote - Version distante du record
     * @returns {Object} Version gagnante après résolution
     */
    async handleConflict(local, remote) {
        console.log('⚔️ Résolution conflit:', {
            local_ts: local?.updated_at,
            remote_ts: remote?.updated_at
        });

        // Règle 1: DELETE explicite gagne toujours
        if (remote && (remote.is_deleted === 1 || !remote)) {
            console.log('  🗑️ DELETE wins (remote)');
            return { ...local, is_deleted: 1 };
        }

        if (local && (local.is_deleted === 1 || !local)) {
            console.log('  🗑️ DELETE wins (local)');
            return remote;
        }

        // Règle 2: Comparaison timestamps
        const localTime = local?.updated_at || 0;
        const remoteTime = remote?.updated_at || 0;

        // Sécurité: rejeter timestamps trop dans le futur (horloge décalée)
        const MAX_CLOCK_DRIFT = 5 * 60 * 1000; // 5 minutes
        if (remoteTime > Date.now() + MAX_CLOCK_DRIFT) {
            console.warn('  ⚠️ Remote timestamp trop dans le futur, rejeté');
            return local;
        }

        if (remoteTime > localTime) {
            console.log(`  ✅ Remote wins (${remoteTime} > ${localTime})`);
            return remote;
        } else if (remoteTime < localTime) {
            console.log(`  ✅ Local wins (${localTime} > ${remoteTime})`);
            return local;
        }

        // Règle 3: Égalité parfaite → maître gagne
        if (this.config && this.config.role === 'master') {
            console.log('  👑 Master wins (equal timestamps)');
            return local;
        } else {
            console.log('  👑 Master wins (equal timestamps, slave defers)');
            return remote;
        }
    }

    /**
     * Traite une requête de synchronisation d'un esclave (maître uniquement)
     * Phase 3: Traitement SYNC_REQUEST côté master
     * Phase 4: Détecte les requêtes de bootstrap initial et envoie toutes les données
     * @param {Object} data - Payload SYNC_REQUEST déchiffré
     * @param {string} fromDevice - ID de l'appareil esclave
     */
    async processSyncRequest(data, fromDevice) {
        if (!this.config || this.config.role !== 'master') {
            console.error('❌ processSyncRequest appelé mais cet appareil n\'est pas maître');
            return;
        }

        // NOUVEAU : Détecter requête de bootstrap initial
        if (data.initial_sync === true && data.stage) {
            console.log(`📦 BOOTSTRAP REQUEST de ${fromDevice}: stage ${data.stage}`);

            try {
                // Récupérer toutes les données pour ce stage
                const bootstrapData = await this.getAllDataForBootstrap(data.stage);
                console.log(`  📊 Collected ${bootstrapData.length} records for stage ${data.stage}`);

                // Phase 4: Créer messages bootstrap par lots
                await this._createBootstrapMessages(fromDevice, data.stage, bootstrapData);

                console.log(`✅ Bootstrap messages queued for ${fromDevice}: stage ${data.stage}`);

            } catch (error) {
                console.error(`❌ Bootstrap error for ${fromDevice}:`, error);

                // Envoyer message d'erreur au slave
                await this._sendBootstrapError(fromDevice, data.stage, error.message);
            }

            return;  // Terminer ici pour les requêtes de bootstrap
        }

        // EXISTANT : Traitement normal des changements
        console.log(`📊 Traitement SYNC_REQUEST de ${fromDevice} : ${data.changes?.length || 0} changements`);

        const results = [];

        // Traiter chaque changement
        for (const change of (data.changes || [])) {
            try {
                const result = await this.mergeChange(change);
                results.push(result);
            } catch (error) {
                console.error(`❌ Erreur mergeChange pour ${change.id}:`, error);
                results.push({
                    sync_id: change.id,
                    status: 'ERROR',
                    record_id: change.record_id,
                    error: error.message
                });
            }
        }

        console.log(`✅ ${results.length} changements traités, envoi SYNC_RESPONSE`);

        // Construire la réponse
        const response = {
            type: 'SYNC_RESPONSE',
            schema_version: data.schema_version || 1,
            results: results,
            ts: Date.now()
        };

        // Chiffrer et envoyer au slave
        try {
            const encrypted = await this.crypto.encrypt(response, this.encryptionKey);

            const pushResult = await this.network.push(
                this.config.device_id,
                this.config.device_token,
                fromDevice,  // Répondre à l'esclave
                encrypted
            );

            if (pushResult.success) {
                console.log(`📤 SYNC_RESPONSE envoyée à ${fromDevice}`);
            } else {
                console.error(`❌ Échec envoi SYNC_RESPONSE:`, pushResult.error);
            }
        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi SYNC_RESPONSE:`, error);
        }
    }

    /**
     * Fusionne un changement esclave avec la base de données maître
     * Phase 3: Résolution de conflits côté master
     * @param {Object} change - Changement de SYNC_QUEUE
     * @returns {Object} Résultat du merge
     */
    async mergeChange(change) {
        const storeName = change.store_name;
        const recordId = change.record_id;
        const incoming = change.data;

        // 1. DELETE explicite → gagne toujours
        if (change.operation === 'DELETE' || (incoming && incoming.is_deleted === 1)) {
            // Récupérer le mouvement avant suppression pour mettre à jour le solde
            const existingBeforeDelete = await this.db.get(storeName, recordId);

            await this.db.softDelete(storeName, recordId);

            console.log(`  🗑️ DELETE accepted: ${storeName}/${recordId}`);

            // Mettre à jour le solde du compte pour un mouvement supprimé
            if (storeName === 'MOUVEMENTS' && existingBeforeDelete && existingBeforeDelete.account_id && typeof existingBeforeDelete.amount === 'number') {
                await this._updateAccountBalanceForSync(existingBeforeDelete.account_id, -existingBeforeDelete.amount);
            }

            return {
                sync_id: change.id,
                status: 'DELETED',
                record_id: recordId,
                store_name: storeName
            };
        }

        // 2. Récupérer enregistrement existant
        const existing = await this.db.get(storeName, recordId);

        // 2a. CREATE (enregistrement inexistant)
        if (!existing) {
            await this.db.put(storeName, incoming);

            console.log(`  ✅ CREATE accepted: ${storeName}/${recordId}`);

            // Mettre à jour le solde du compte pour un nouveau mouvement
            if (storeName === 'MOUVEMENTS' && incoming.account_id && typeof incoming.amount === 'number') {
                await this._updateAccountBalanceForSync(incoming.account_id, incoming.amount);
            }

            return {
                sync_id: change.id,
                status: 'CREATED',
                record_id: recordId,
                store_name: storeName,
                winner: incoming
            };
        }

        // 2b. SÉCURITÉ : Rejeter timestamps trop dans le futur (horloge décalée)
        const MAX_CLOCK_DRIFT = 5 * 60 * 1000;  // 5 minutes
        const incomingTime = incoming.updated_at || 0;

        if (incomingTime > Date.now() + MAX_CLOCK_DRIFT) {
            console.warn(`  ⚠️ REJECTED: Future timestamp ${storeName}/${recordId}`);

            return {
                sync_id: change.id,
                status: 'REJECTED_FUTURE_TIMESTAMP',
                record_id: recordId,
                store_name: storeName,
                message: 'Horloge de l\'appareil trop en avance'
            };
        }

        // 3. UPDATE : comparaison timestamps
        const masterTime = existing.updated_at || 0;

        if (incomingTime > masterTime) {
            // Esclave gagne
            await this.db.put(storeName, incoming);

            console.log(`  ✅ UPDATE accepted (slave wins): ${storeName}/${recordId}`);

            // Mettre à jour le solde du compte pour un mouvement modifié
            if (storeName === 'MOUVEMENTS' && incoming.account_id && typeof incoming.amount === 'number') {
                const oldAmount = existing.amount || 0;
                const amountDiff = incoming.amount - oldAmount;
                if (amountDiff !== 0) {
                    await this._updateAccountBalanceForSync(incoming.account_id, amountDiff);
                }
            }

            return {
                sync_id: change.id,
                status: 'UPDATED',
                record_id: recordId,
                store_name: storeName,
                winner: incoming
            };
        } else if (incomingTime < masterTime) {
            // Maître gagne
            console.log(`  ⚔️ CONFLICT (master wins): ${storeName}/${recordId}`);

            return {
                sync_id: change.id,
                status: 'CONFLICT_MASTER',
                record_id: recordId,
                store_name: storeName,
                winner: existing
            };
        }

        // 4. Égalité parfaite → maître gagne (règle 3)
        console.log(`  ⚔️ EQUAL timestamps (master wins): ${storeName}/${recordId}`);

        return {
            sync_id: change.id,
            status: 'CONFLICT_EQUAL_MASTER',
            record_id: recordId,
            store_name: storeName,
            winner: existing
        };
    }

    /**
     * Obtient le nombre d'opérations en attente de sync
     * @returns {number} Nombre d'opérations pendantes
     */
    async getPendingCount() {
        try {
            const count = await this.db.count('SYNC_QUEUE', 'synced', 0);
            return count;
        } catch (error) {
            console.error('Erreur lors du comptage SYNC_QUEUE:', error);
            return 0;
        }
    }

    /**
     * Obtient les statistiques de synchronisation
     * @returns {Object} Statistiques complètes
     */
    async getStats() {
        try {
            const pending = await this.getPendingCount();
            const totalQueue = await this.db.count('SYNC_QUEUE');
            const logs = await this.db.count('SYNC_LOG');

            return {
                pending: pending,
                synced: totalQueue - pending,
                total: totalQueue,
                logs: logs,
                isRunning: this.isRunning,
                mode: 'offline-only (stub)'
            };
        } catch (error) {
            console.error('Erreur lors du calcul des stats:', error);
            return null;
        }
    }

    /**
     * Efface la queue de synchronisation
     * ATTENTION: Opération destructive, utiliser avec précaution
     * @returns {boolean} Succès de l'opération
     */
    async clearQueue() {
        try {
            await this.db.clear('SYNC_QUEUE');
            console.log('🗑️ SYNC_QUEUE effacée');
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'effacement de SYNC_QUEUE:', error);
            return false;
        }
    }

    /**
     * Efface les logs de synchronisation
     * @returns {boolean} Succès de l'opération
     */
    async clearLogs() {
        try {
            await this.db.clear('SYNC_LOG');
            console.log('🗑️ SYNC_LOG effacé');
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'effacement de SYNC_LOG:', error);
            return false;
        }
    }

    /**
     * Vérifie si l'appareil est en ligne
     * @returns {boolean} true si en ligne, false sinon
     */
    isOnline() {
        return navigator.onLine;
    }

    /**
     * Applique le résultat d'un merge côté serveur
     * Phase 3: Application des SYNC_RESPONSE
     * @param {Object} result - Résultat du merge (statut + winner)
     */
    async applyMergeResult(result) {
        const { sync_id, status, record_id, winner, store_name } = result;

        // Récupérer le store name depuis SYNC_QUEUE si pas dans result
        let storeName = store_name;
        if (!storeName && sync_id) {
            const queueEntry = await this.db.get('SYNC_QUEUE', sync_id);
            storeName = queueEntry?.store_name;
        }

        if (!storeName) {
            console.warn('⚠️ Store name manquant pour result:', sync_id);
            return;
        }

        console.log(`🔀 Applying merge result: ${status} for ${storeName}/${record_id}`);

        // Pour les mouvements, gérer la mise à jour du solde du compte
        let oldMovement = null;
        if (storeName === 'MOUVEMENTS' && (status === 'UPDATED' || status === 'DELETED' || status === 'CONFLICT_MASTER' || status === 'CONFLICT_EQUAL_MASTER')) {
            // Récupérer l'ancien mouvement pour calculer la différence
            oldMovement = await this.db.get('MOUVEMENTS', record_id);
        }

        switch (status) {
            case 'CREATED':
                // Changement accepté, appliquer la version gagnante
                if (winner) {
                    await this.db.put(storeName, winner);
                    console.log(`  ✅ Applied ${status}: ${storeName}/${record_id}`);

                    // Mettre à jour le solde du compte pour un nouveau mouvement
                    if (storeName === 'MOUVEMENTS' && winner.account_id && typeof winner.amount === 'number') {
                        await this._updateAccountBalanceForSync(winner.account_id, winner.amount);
                    }
                }
                break;

            case 'UPDATED':
                // Changement accepté, appliquer la version gagnante
                if (winner) {
                    await this.db.put(storeName, winner);
                    console.log(`  ✅ Applied ${status}: ${storeName}/${record_id}`);

                    // Mettre à jour le solde du compte pour un mouvement modifié
                    if (storeName === 'MOUVEMENTS' && winner.account_id && typeof winner.amount === 'number') {
                        const oldAmount = oldMovement ? oldMovement.amount : 0;
                        const amountDiff = winner.amount - oldAmount;
                        if (amountDiff !== 0) {
                            await this._updateAccountBalanceForSync(winner.account_id, amountDiff);
                        }
                    }
                }
                break;

            case 'DELETED':
                // Delete accepté
                await this.db.softDelete(storeName, record_id);
                console.log(`  🗑️ Applied DELETE: ${storeName}/${record_id}`);

                // Mettre à jour le solde du compte pour un mouvement supprimé
                if (storeName === 'MOUVEMENTS' && oldMovement && oldMovement.account_id && typeof oldMovement.amount === 'number') {
                    await this._updateAccountBalanceForSync(oldMovement.account_id, -oldMovement.amount);
                }
                break;

            case 'CONFLICT_MASTER':
            case 'CONFLICT_EQUAL_MASTER':
                // Maître a gagné, appliquer sa version
                if (winner) {
                    await this.db.put(storeName, winner);
                    console.log(`  ⚔️ Conflict resolved (master wins): ${storeName}/${record_id}`);

                    // Mettre à jour le solde du compte si le montant a changé
                    if (storeName === 'MOUVEMENTS' && winner.account_id && typeof winner.amount === 'number') {
                        const oldAmount = oldMovement ? oldMovement.amount : 0;
                        const amountDiff = winner.amount - oldAmount;
                        if (amountDiff !== 0) {
                            await this._updateAccountBalanceForSync(winner.account_id, amountDiff);
                        }
                    }
                }
                break;

            case 'NOT_FOUND':
                // Enregistrement introuvable côté maître → supprimer localement
                await this.db.delete(storeName, record_id);
                console.log(`  ❌ NOT_FOUND: deleted locally ${storeName}/${record_id}`);

                // Mettre à jour le solde du compte pour un mouvement supprimé
                if (storeName === 'MOUVEMENTS' && oldMovement && oldMovement.account_id && typeof oldMovement.amount === 'number') {
                    await this._updateAccountBalanceForSync(oldMovement.account_id, -oldMovement.amount);
                }
                break;

            case 'REJECTED_FUTURE_TIMESTAMP':
                // Horloge décalée → logger l'erreur, ne pas réessayer
                console.error(`❌ Horloge locale incorrecte pour ${storeName}/${record_id}`);
                break;

            default:
                console.warn(`⚠️ Statut inconnu: ${status}`);
        }

        // Supprimer l'entrée de SYNC_QUEUE (synchronisée)
        if (sync_id) {
            await this.db.delete('SYNC_QUEUE', sync_id);
            console.log(`  🗑️ Removed from SYNC_QUEUE: ${sync_id}`);
        }

        // Émettre événement pour rafraîchir l'UI si changement important
        if (status === 'CREATED' || status === 'UPDATED' || status === 'DELETED') {
            window.dispatchEvent(new CustomEvent('sync-data-changed', {
                detail: { storeName, recordId: record_id, status }
            }));
        }
    }

    /**
     * Met à jour le solde d'un compte lors de la synchronisation
     * @param {string} accountId - ID du compte
     * @param {number} amountDiff - Différence de montant à appliquer
     * @private
     */
    async _updateAccountBalanceForSync(accountId, amountDiff) {
        try {
            const account = await this.db.get('COMPTES', accountId);
            if (account) {
                const oldBalance = account.balance || 0;
                account.balance = oldBalance + amountDiff;
                await this.db.putWithMeta('COMPTES', account);
                console.log(`  💰 Balance updated for account ${accountId}: ${oldBalance} → ${account.balance} (${amountDiff > 0 ? '+' : ''}${amountDiff})`);
            } else {
                console.warn(`  ⚠️ Account ${accountId} not found, cannot update balance`);
            }
        } catch (error) {
            console.error(`  ❌ Error updating account balance for ${accountId}:`, error);
            // Ne pas propager l'erreur pour ne pas bloquer la sync
        }
    }

    /**
     * Enregistre une entrée dans SYNC_LOG
     * Phase 3: Traçage des syncs
     * @param {string} type - 'SYNC_SUCCESS', 'SYNC_ERROR', 'CONFLICT'
     * @param {Object} data - Données du log
     */
    async logSync(type, data) {
        try {
            await this.db.put('SYNC_LOG', {
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: type,
                duration: data.duration || null,
                items_pushed: data.pushed || 0,
                items_pulled: data.pulled || 0,
                conflicts: data.conflicts || 0,
                error: data.error || null,
                timestamp: Date.now()
            });

            console.log(`📝 Logged sync: ${type}`);
        } catch (err) {
            console.error('Failed to log sync:', err);
            // Ne pas propager l'erreur, c'est juste du logging
        }
    }

    /**
     * Envoie un heartbeat au serveur (tous les 10 ticks)
     * Phase 3: Maintien de connexion
     */
    async sendHeartbeat() {
        try {
            const result = await this.network.heartbeat(
                this.config.device_id,
                this.config.device_token
            );

            if (result.success) {
                console.log('💓 Heartbeat OK:', result.cluster_status);
            }
        } catch (err) {
            console.warn('💔 Heartbeat failed:', err.message);
            // Non-bloquant
        }
    }

    /**
     * Gère une erreur de synchronisation avec backoff
     * Phase 3: Retry intelligent
     * @param {Error} err
     */
    handleSyncError(err) {
        // Détecter rate limit (429 ou erreur 'rate_limit')
        if (err.httpStatus === 429 || err.error === 'rate_limit') {
            console.error('🚫 Rate limit atteint - arrêt sync');

            // Utiliser retryAfter si fourni par le serveur, sinon 15 minutes par défaut
            const durationMs = (err.retryAfter || 900) * 1000;
            this.setRateLimit(durationMs);
            this.retryAttempt = 0;
            return;
        }

        // Vérifier si l'erreur est retryable
        if (!this.isRetryable(err)) {
            console.error('❌ Erreur non retryable:', err);
            this.retryAttempt = 0;
            return;
        }

        // Incrémenter compteur
        this.retryAttempt++;

        // Calculer délai avec jitter
        const delay = this.computeJitterDelay(this.retryAttempt);

        console.log(`⏳ Retry ${this.retryAttempt} dans ${delay}ms`);

        // Planifier le prochain tick
        setTimeout(() => {
            this.tick();
        }, delay);
    }

    /**
     * Calcule un délai exponentiel avec jitter aléatoire
     * Phase 3: Backoff
     * @param {number} attempt - Numéro de tentative
     * @returns {number} Délai en ms
     */
    computeJitterDelay(attempt) {
        // Backoff exponentiel : BASE * 2^attempt
        const exponential = Math.min(
            this.MAX_DELAY,
            this.BASE_DELAY * Math.pow(2, attempt)
        );

        // Jitter : aléatoire entre exponential/2 et exponential
        const min = exponential / 2;
        const jitter = min + Math.random() * (exponential - min);

        return Math.floor(jitter);
    }

    /**
     * Détermine si une erreur est retryable
     * Phase 3: Logique retry
     * @param {Error} err
     * @returns {boolean}
     */
    isRetryable(err) {
        // Retry sur erreurs réseau, timeout, 5xx
        if (err.name === 'TypeError' || err.name === 'NetworkError') {
            return true;
        }

        // Retry sur 5xx (erreurs serveur)
        if (err.httpStatus && err.httpStatus >= 500 && err.httpStatus < 600) {
            return true;
        }

        // Pas de retry sur 4xx (erreurs logiques)
        return false;
    }

    /**
     * Active le mode rate limited
     * @param {number} durationMs - Durée du blocage en ms (défaut: 15 min)
     */
    setRateLimit(durationMs = 15 * 60 * 1000) {
        this.isRateLimited = true;
        this.rateLimitUntil = Date.now() + durationMs;

        const minutes = Math.ceil(durationMs / 60000);
        console.log(`🚫 Rate limit activé pour ${minutes} minutes`);

        // Émettre événement pour l'UI
        window.dispatchEvent(new CustomEvent('sync-rate-limited', {
            detail: {
                until: this.rateLimitUntil,
                durationMs: durationMs
            }
        }));
    }

    /**
     * Désactive le mode rate limited (déblocage manuel)
     */
    clearRateLimit() {
        const wasLimited = this.isRateLimited;
        this.isRateLimited = false;
        this.rateLimitUntil = null;

        if (wasLimited) {
            console.log('✅ Rate limit levé');
            window.dispatchEvent(new CustomEvent('sync-rate-limit-cleared'));
        }
    }

    /**
     * Obtient l'état du rate limit
     * @returns {Object|null} {until, remaining, remainingSeconds} ou null si pas limité
     */
    getRateLimitStatus() {
        if (!this.isRateLimited || !this.rateLimitUntil) {
            return null;
        }

        const now = Date.now();
        const remaining = Math.max(0, this.rateLimitUntil - now);

        return {
            until: this.rateLimitUntil,
            remaining: remaining,
            remainingSeconds: Math.ceil(remaining / 1000)
        };
    }

    /**
     * Synchronisation initiale complète (appelée après pairing)
     * Phase 4: Bootstrap - L'esclave demande toutes les données du maître
     *
     * Cette méthode (côté esclave) :
     * 1. Efface toutes les données locales (sauf config/auth)
     * 2. Demande les données de référence au maître (Stage 1)
     * 3. Demande les données transactionnelles au maître (Stage 2)
     * 4. Émet des événements de progression pour l'UI
     *
     * @returns {Promise<Object>} Résultat de la sync initiale
     */
    async requestInitialSync() {
        if (this.config.role !== 'slave') {
            throw new Error('requestInitialSync() ne peut être appelé que par un esclave');
        }

        console.log('🔄 BOOTSTRAP: Début de la synchronisation initiale complète...');

        try {
            // ÉTAPE 1 : Effacer les stores de données (garder config/auth/sync)
            const storesToClear = [
                'COMPTES',
                'CATEGORIES',
                'BENEFICIAIRES',
                'TYPE_DEPENSES',
                'MOUVEMENTS',
                'DEPENSES_FIXES'
            ];

            console.log('🗑️  Effacement des données locales...');
            for (let i = 0; i < storesToClear.length; i++) {
                const storeName = storesToClear[i];
                await this.db.clear(storeName);
                console.log(`  ✅ ${storeName} effacé`);

                // Émettre événement de progression
                window.dispatchEvent(new CustomEvent('sync-bootstrap-progress', {
                    detail: {
                        type: 'clearing',
                        store: storeName,
                        progress: `${i + 1}/${storesToClear.length}`
                    }
                }));
            }

            // ÉTAPE 2 : Bootstrap Stage 1 - Données de référence
            console.log('📥 BOOTSTRAP STAGE 1: Données de référence');
            const stage1Result = await this._bootstrapStage('REFERENCE');

            // Émettre événement de complétion Stage 1
            window.dispatchEvent(new CustomEvent('sync-bootstrap-progress', {
                detail: {
                    type: 'stage-complete',
                    stage: 'REFERENCE',
                    recordsReceived: stage1Result.recordsReceived
                }
            }));

            // ÉTAPE 3 : Bootstrap Stage 2 - Transactions
            console.log('📥 BOOTSTRAP STAGE 2: Transactions');
            const stage2Result = await this._bootstrapStage('TRANSACTIONAL');

            // Émettre événement de complétion Stage 2
            window.dispatchEvent(new CustomEvent('sync-bootstrap-progress', {
                detail: {
                    type: 'stage-complete',
                    stage: 'TRANSACTIONAL',
                    recordsReceived: stage2Result.recordsReceived
                }
            }));

            const totalRecords = stage1Result.recordsReceived + stage2Result.recordsReceived;
            console.log(`✅ BOOTSTRAP COMPLET: ${totalRecords} enregistrements importés`);

            // Émettre événement de complétion totale
            window.dispatchEvent(new CustomEvent('sync-bootstrap-progress', {
                detail: {
                    type: 'complete',
                    totalRecords: totalRecords
                }
            }));

            return {
                success: true,
                stages: ['REFERENCE', 'TRANSACTIONAL'],
                totalRecords: totalRecords
            };

        } catch (error) {
            console.error('❌ Erreur lors de la sync initiale:', error);

            // Émettre événement d'erreur
            window.dispatchEvent(new CustomEvent('sync-bootstrap-progress', {
                detail: {
                    type: 'error',
                    error: error.message
                }
            }));

            throw error;
        }
    }

    /**
     * Envoie une requête bootstrap pour un stage et attend la réponse
     * Phase 4: Bootstrap - Méthode interne
     *
     * @param {string} stage - 'REFERENCE' ou 'TRANSACTIONAL'
     * @returns {Promise<Object>} { success, recordsReceived }
     * @private
     */
    async _bootstrapStage(stage) {
        console.log(`📤 Sending bootstrap request for stage: ${stage}`);

        // Construire SYNC_REQUEST avec schema v2 pour activer batching
        const request = {
            type: 'SYNC_REQUEST',
            schema_version: SyncManager.SCHEMA_VERSION,  // v2 pour bootstrap par lots
            initial_sync: true,     // Flag indiquant un bootstrap
            stage: stage,           // 'REFERENCE' ou 'TRANSACTIONAL'
            changes: [],            // Pas de changements, juste demande de données
            ts: Date.now()
        };

        // Chiffrer et envoyer au maître
        const encrypted = await this.crypto.encrypt(request, this.encryptionKey);

        const pushResult = await this.network.push(
            this.config.device_id,
            this.config.device_token,
            this.config.master_id,
            encrypted
        );

        if (!pushResult.success) {
            throw new Error(`Failed to send bootstrap request: ${pushResult.error}`);
        }

        console.log(`✅ Bootstrap request sent for stage ${stage}`);

        // Phase 4: Polling par lots avec nouvelle méthode
        return await this._pollBootstrapBatches(stage);
    }

    /**
     * Poll le serveur pour récupérer les messages bootstrap par lots
     * Phase 4: Bootstrap - Appelé par l'esclave
     *
     * @param {string} stage - 'REFERENCE' ou 'TRANSACTIONAL'
     * @returns {Promise<Object>} { success, recordsReceived }
     * @private
     */
    async _pollBootstrapBatches(stage) {
        const POLL_INTERVAL = SyncManager.BOOTSTRAP_POLL_INTERVAL;
        const MAX_ATTEMPTS = SyncManager.BOOTSTRAP_MAX_ATTEMPTS;
        const EXTENDED_WAIT = SyncManager.BOOTSTRAP_EXTENDED_ATTEMPTS;

        let attempts = 0;
        let totalRecordsReceived = 0;
        let batchesReceived = new Set();
        let expectedBatches = null;
        let bootstrapComplete = false;
        let extendedAttempts = 0;

        console.log(`⏳ Starting bootstrap polling for stage ${stage} (timeout: ${MAX_ATTEMPTS * POLL_INTERVAL / 1000}s)`);

        while (attempts < MAX_ATTEMPTS && !bootstrapComplete) {
            // Attendre avant de poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            attempts++;

            console.log(`⏳ Bootstrap poll ${attempts}/${MAX_ATTEMPTS} for stage ${stage}`);

            try {
                // Pull messages depuis le serveur
                const pullResult = await this.network.pull(
                    this.config.device_id,
                    this.config.device_token
                );

                if (!pullResult.success) {
                    console.warn(`  ⚠️ Pull failed: ${pullResult.error}`);
                    continue;
                }

                if (!pullResult.messages || pullResult.messages.length === 0) {
                    console.log(`  📭 No messages in queue`);
                    continue;
                }

                console.log(`  📬 Received ${pullResult.messages.length} messages`);

                // Traiter chaque message
                for (const msg of pullResult.messages) {
                    try {
                        const decrypted = await this.crypto.decrypt(
                            msg.payload,
                            this.encryptionKey
                        );

                        // Handler BOOTSTRAP_BATCH
                        if (decrypted.type === 'BOOTSTRAP_BATCH' && decrypted.stage === stage) {
                            console.log(`  📦 Batch ${decrypted.batch_number}/${decrypted.total_batches} received (${decrypted.records.length} records)`);

                            // Tracking des batches attendus
                            if (expectedBatches === null) {
                                expectedBatches = decrypted.total_batches;
                                console.log(`  📊 Expecting ${expectedBatches} total batches`);
                            }

                            // Vérifier doublon
                            if (batchesReceived.has(decrypted.batch_number)) {
                                console.log(`  ⚠️ Duplicate batch ${decrypted.batch_number}, skipping`);
                                continue;
                            }

                            // Appliquer les enregistrements du batch
                            let applied = 0;
                            for (const result of decrypted.records) {
                                try {
                                    await this.applyMergeResult(result);
                                    applied++;
                                } catch (error) {
                                    console.error(`    ❌ Failed to apply record ${result.record_id}:`, error);
                                }
                            }

                            batchesReceived.add(decrypted.batch_number);
                            totalRecordsReceived += applied;

                            console.log(`  ✅ Applied ${applied}/${decrypted.records.length} records from batch ${decrypted.batch_number}`);

                            // Émettre événement de progression pour l'UI
                            window.dispatchEvent(new CustomEvent('sync-bootstrap-progress', {
                                detail: {
                                    type: 'batch-received',
                                    stage: stage,
                                    batch: decrypted.batch_number,
                                    totalBatches: decrypted.total_batches,
                                    recordsInBatch: applied,
                                    totalRecords: totalRecordsReceived
                                }
                            }));
                        }

                        // Handler BOOTSTRAP_COMPLETE
                        else if (decrypted.type === 'BOOTSTRAP_COMPLETE' && decrypted.stage === stage) {
                            console.log(`  ✅ BOOTSTRAP_COMPLETE signal received (${decrypted.total_records} records in ${decrypted.batches_sent} batches)`);

                            // Vérifier qu'on a bien reçu tous les batches
                            if (expectedBatches && batchesReceived.size < expectedBatches) {
                                const missing = this._findMissingBatches(batchesReceived, expectedBatches);
                                console.warn(`  ⚠️ Missing batches: received ${batchesReceived.size}/${expectedBatches}`);
                                console.warn(`  Missing batch numbers: ${missing}`);

                                // Donner du temps supplémentaire pour recevoir les batches manquants
                                if (extendedAttempts < EXTENDED_WAIT) {
                                    extendedAttempts++;
                                    console.log(`  ⏳ Waiting for missing batches (${extendedAttempts}/${EXTENDED_WAIT})`);
                                    continue;
                                } else {
                                    // Timeout sur les batches manquants
                                    throw new Error(`Bootstrap incomplete: received ${batchesReceived.size}/${expectedBatches} batches. Missing: ${missing}`);
                                }
                            }

                            // Tous les batches reçus
                            bootstrapComplete = true;
                        }

                        // Handler BOOTSTRAP_ERROR
                        else if (decrypted.type === 'BOOTSTRAP_ERROR' && decrypted.stage === stage) {
                            console.error(`  ❌ Bootstrap error from master: ${decrypted.error}`);
                            throw new Error(`Bootstrap failed: ${decrypted.error}`);
                        }

                    } catch (decryptError) {
                        console.error(`  ❌ Failed to process message:`, decryptError);
                    }
                }

            } catch (pullError) {
                console.warn(`  ⚠️ Error during pull (attempt ${attempts}):`, pullError.message);
                // Continuer à poll
            }
        }

        // Vérifier statut final
        if (!bootstrapComplete) {
            const received = batchesReceived.size;
            const expected = expectedBatches || '?';
            throw new Error(`Bootstrap timeout: received ${received}/${expected} batches after ${attempts * POLL_INTERVAL / 1000} seconds`);
        }

        console.log(`✅ Bootstrap stage ${stage} complete: ${totalRecordsReceived} records in ${batchesReceived.size} batches`);

        return {
            success: true,
            recordsReceived: totalRecordsReceived
        };
    }

    /**
     * Trouve les numéros de batches manquants
     * @private
     */
    _findMissingBatches(receivedSet, total) {
        const missing = [];
        for (let i = 1; i <= total; i++) {
            if (!receivedSet.has(i)) {
                missing.push(i);
            }
        }
        return missing.join(', ');
    }

    /**
     * Récupère toutes les données de tous les stores pour un stage donné
     * Phase 4: Bootstrap - Appelé par le maître
     *
     * @param {string} stage - 'REFERENCE' ou 'TRANSACTIONAL'
     * @returns {Promise<Array>} Liste de tous les enregistrements formatés comme changements
     */
    async getAllDataForBootstrap(stage) {
        let storesToExport = [];

        if (stage === 'REFERENCE') {
            // Stage 1 : Données de référence (doivent exister avant les transactions)
            storesToExport = ['COMPTES', 'CATEGORIES', 'BENEFICIAIRES', 'TYPE_DEPENSES'];
        } else if (stage === 'TRANSACTIONAL') {
            // Stage 2 : Données transactionnelles (dépendent des références)
            storesToExport = ['MOUVEMENTS', 'DEPENSES_FIXES'];
        } else {
            throw new Error(`Unknown bootstrap stage: ${stage}`);
        }

        const allData = [];
        let totalRecords = 0;

        console.log(`📦 BOOTSTRAP: Collecte des données pour stage ${stage}...`);

        for (const storeName of storesToExport) {
            try {
                // Récupérer tous les enregistrements du store
                const records = await this.db.getAll(storeName);

                // Filtrer les enregistrements supprimés (is_deleted = 1)
                const activeRecords = records.filter(r => !r.is_deleted || r.is_deleted === 0);

                console.log(`  📊 ${storeName}: ${activeRecords.length} enregistrements actifs`);
                totalRecords += activeRecords.length;

                // Formater chaque enregistrement comme un changement
                for (const record of activeRecords) {
                    allData.push({
                        id: `bootstrap_${storeName}_${record.id}`,
                        store_name: storeName,
                        record_id: record.id,
                        operation: 'CREATE',  // Bootstrap = création
                        data: record,
                        sync_updated_at: record.sync_updated_at || Date.now(),
                        created_at: Date.now()
                    });
                }
            } catch (error) {
                console.error(`❌ Erreur lecture ${storeName}:`, error);
                // Continuer avec les autres stores (mode gracieux)
            }
        }

        console.log(`✅ Total: ${totalRecords} enregistrements collectés pour stage ${stage}`);

        return allData;
    }

    /**
     * Crée des messages bootstrap par lots dans la queue serveur
     * Phase 4: Bootstrap - Appelé par le maître
     *
     * @param {string} slaveDeviceId - ID de l'appareil esclave cible
     * @param {string} stage - 'REFERENCE' ou 'TRANSACTIONAL'
     * @param {Array} allData - Tous les enregistrements à envoyer (depuis getAllDataForBootstrap)
     * @private
     */
    async _createBootstrapMessages(slaveDeviceId, stage, allData) {
        const BATCH_SIZE = SyncManager.BOOTSTRAP_BATCH_SIZE;
        const totalRecords = allData.length;
        const totalBatches = Math.ceil(totalRecords / BATCH_SIZE) || 1;

        console.log(`📦 Creating ${totalBatches} bootstrap batches (${totalRecords} records, stage ${stage})`);

        // Créer et envoyer chaque lot
        for (let i = 0; i < totalBatches; i++) {
            const batchNumber = i + 1;
            const start = i * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, totalRecords);
            const batchRecords = allData.slice(start, end);

            // Construire le message batch
            const message = {
                type: 'BOOTSTRAP_BATCH',
                schema_version: SyncManager.SCHEMA_VERSION,
                stage: stage,
                batch_number: batchNumber,
                total_batches: totalBatches,
                is_final: false,
                records: batchRecords.map(change => ({
                    sync_id: change.id,
                    status: 'CREATED',
                    record_id: change.record_id,
                    store_name: change.store_name,
                    data: change.data,
                    winner: change.data  // Pour compatibilité applyMergeResult
                })),
                ts: Date.now() + i  // Léger offset pour préserver l'ordre
            };

            // Chiffrer et envoyer au serveur
            const encrypted = await this.crypto.encrypt(message, this.encryptionKey);

            const pushResult = await this.network.push(
                this.config.device_id,
                this.config.device_token,
                slaveDeviceId,
                encrypted
            );

            if (!pushResult.success) {
                throw new Error(`Failed to queue batch ${batchNumber}/${totalBatches}: ${pushResult.error}`);
            }

            console.log(`  ✅ Batch ${batchNumber}/${totalBatches} queued (${batchRecords.length} records)`);
        }

        // Envoyer le signal de complétion
        const completeMessage = {
            type: 'BOOTSTRAP_COMPLETE',
            schema_version: SyncManager.SCHEMA_VERSION,
            stage: stage,
            total_records: totalRecords,
            batches_sent: totalBatches,
            ts: Date.now() + totalBatches
        };

        const encrypted = await this.crypto.encrypt(completeMessage, this.encryptionKey);

        await this.network.push(
            this.config.device_id,
            this.config.device_token,
            slaveDeviceId,
            encrypted
        );

        console.log(`✅ BOOTSTRAP_COMPLETE sent for stage ${stage} (${totalRecords} records in ${totalBatches} batches)`);
    }

    /**
     * Envoie un message d'erreur bootstrap au slave
     * Phase 4: Bootstrap - Appelé par le maître en cas d'échec
     *
     * @param {string} slaveDeviceId - ID de l'appareil esclave cible
     * @param {string} stage - 'REFERENCE' ou 'TRANSACTIONAL'
     * @param {string} errorMessage - Description de l'erreur
     * @private
     */
    async _sendBootstrapError(slaveDeviceId, stage, errorMessage) {
        const errorMsg = {
            type: 'BOOTSTRAP_ERROR',
            schema_version: SyncManager.SCHEMA_VERSION,
            stage: stage,
            error: errorMessage,
            ts: Date.now()
        };

        try {
            const encrypted = await this.crypto.encrypt(errorMsg, this.encryptionKey);

            await this.network.push(
                this.config.device_id,
                this.config.device_token,
                slaveDeviceId,
                encrypted
            );

            console.log(`📤 BOOTSTRAP_ERROR sent to ${slaveDeviceId}: ${errorMessage}`);
        } catch (error) {
            console.error(`❌ Failed to send BOOTSTRAP_ERROR:`, error);
        }
    }
}

// Export global pour utilisation dans l'application
window.SyncManager = SyncManager;
