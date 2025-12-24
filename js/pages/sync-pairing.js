/**
 * Sync Pairing Controller
 * Gère le pairing par fichier d'appairage et la gestion des appareils
 *
 * Phase 2 - Ratchou Synchronisation
 */
class SyncPairingController {
    constructor() {
        this.config = null;
        this.db = null;
        this.recoveryKeyModal = null;
        this.pairingConfirmModal = null;
        this.loadingOverlay = null;
        this.pendingPairingPayload = null; // Stocke le payload en attente de confirmation
    }

    /**
     * Initialise le contrôleur
     */
    async initialize() {
        try {
            await this.loadComponents();
            this.db = window.db;
            this.initializeElements();
            await this.checkApiUrl();
            await this.loadSyncConfig();
            this.setupEventListeners();
            this.initRateLimitHandling();
            this.updateUIBasedOnRole();
        } catch (error) {
            console.error('❌ Erreur initialisation:', error);
            this.showError('Erreur lors de l\'initialisation: ' + error.message);
        }
    }

    /**
     * Charge les composants (header, sidebar, modals)
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({
            title: '🔗 Synchronisation',
            showAccountInfo: false,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
    }

    /**
     * Initialise les éléments DOM et modales Bootstrap
     */
    initializeElements() {
        // Loading overlay
        this.loadingOverlay = document.getElementById('loadingOverlay');

        // Modals
        this.recoveryKeyModal = new bootstrap.Modal(
            document.getElementById('recoveryKeyModal'),
            { backdrop: 'static', keyboard: false }
        );

        this.pairingConfirmModal = new bootstrap.Modal(
            document.getElementById('pairingConfirmModal'),
            { backdrop: 'static', keyboard: false }
        );

        // Recovery key confirmation checkbox
        const recoveryKeyConfirm = document.getElementById('recoveryKeyConfirm');
        if (recoveryKeyConfirm) {
            recoveryKeyConfirm.addEventListener('change', (e) => {
                document.getElementById('closeRecoveryModal').disabled = !e.target.checked;
            });
        }
    }

    /**
     * Vérifie si l'API URL est configurée
     */
    async checkApiUrl() {
        const apiUrl = localStorage.getItem('ratchou_api_url');

        if (!apiUrl || apiUrl === '') {
            // Afficher formulaire de configuration
            document.getElementById('apiUrlConfig').style.display = 'block';
            document.getElementById('pairingAccordion').style.display = 'none';
        } else {
            // API URL configurée, afficher l'accordéon
            document.getElementById('apiUrlConfig').style.display = 'none';
            document.getElementById('pairingAccordion').style.display = 'block';
        }
    }

    /**
     * Charge la configuration de synchronisation depuis SYNC_CONFIG
     */
    async loadSyncConfig() {
        try {
            this.config = await this.db.get('SYNC_CONFIG', 'config');
            console.log('📋 SYNC_CONFIG loaded:', this.config ? `role=${this.config.role}` : 'null');
        } catch (error) {
            console.log('ℹ️ SYNC_CONFIG not found (fresh install)');
            this.config = null;
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // API URL config
        document.getElementById('saveApiUrlBtn')?.addEventListener('click', () => {
            this.handleSaveApiUrl();
        });

        // Pairing file generation
        document.getElementById('pairingFileForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleGeneratePairingFile();
        });

        // Recovery key actions
        document.getElementById('copyRecoveryKeyBtn')?.addEventListener('click', () => {
            this.copyRecoveryKey();
        });

        document.getElementById('downloadRecoveryKeyBtn')?.addEventListener('click', () => {
            this.downloadRecoveryKey();
        });

        document.getElementById('closeRecoveryModal')?.addEventListener('click', () => {
            this.recoveryKeyModal.hide();
            // Pairing display is already visible, no toggle needed
        });

        // Device list
        document.getElementById('refreshDeviceListBtn')?.addEventListener('click', () => {
            this.loadDeviceList();
        });

        // Pairing confirmation modal
        document.getElementById('confirmPairingBtn')?.addEventListener('click', () => {
            this.handlePairingConfirmation();
        });

        document.getElementById('cancelPairingBtn')?.addEventListener('click', () => {
            this.handlePairingCancellation();
        });
    }

    /**
     * Met à jour l'interface en fonction du rôle (master/slave/non configuré)
     */
    updateUIBasedOnRole() {
        if (!this.config) {
            // Pas configuré: affichage par défaut
            console.log('ℹ️ Pas de config sync - affichage par défaut');
            return;
        }

        if (this.config.role === 'master') {
            // Maître configuré: charger la liste des appareils
            console.log('👑 Appareil maître - chargement liste appareils');
            this.loadDeviceList();
        } else if (this.config.role === 'slave') {
            console.log('📱 Appareil esclave - affichage liste appareils');

            // Masquer la section de génération de fichier d'appairage
            const pairingFileGenerationSection = document.getElementById('pairingFileGenerationSection');
            if (pairingFileGenerationSection) {
                pairingFileGenerationSection.style.display = 'none';

                // Afficher un message explicatif dans l'accordion body du master
                const bootstrapMasterBody = document.getElementById('bootstrapMaster')?.querySelector('.accordion-body');
                if (bootstrapMasterBody) {
                    bootstrapMasterBody.innerHTML = `
                        <div class="alert alert-info">
                            <strong>ℹ️ Fonctionnalité indisponible</strong><br>
                            Cet appareil est configuré comme <strong>appareil secondaire (esclave)</strong>.<br>
                            La génération de fichiers d'appairage est réservée à l'appareil principal.
                        </div>
                    `;
                }
            }
            this.loadDeviceList();
        }
    }

    // ========== API URL CONFIGURATION ==========

    async testServerConnectivity(apiUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(`${apiUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            // Check if response is OK
            if (!response.ok) {
                return {
                    success: false,
                    error: 'http_error',
                    message: `Le serveur a répondu avec le code ${response.status}`
                };
            }

            // Parse JSON response
            const data = await response.json();

            // Check if status is "ok"
            if (data.status !== 'ok') {
                return {
                    success: false,
                    error: 'invalid_status',
                    message: `Le serveur ne retourne pas un status "ok" (reçu: ${data.status || 'undefined'})`
                };
            }

            return { success: true };

        } catch (error) {
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'timeout',
                    message: 'Le serveur ne répond pas (timeout après 10s)'
                };
            }

            return {
                success: false,
                error: 'network_error',
                message: `Impossible de contacter le serveur : ${error.message}`
            };
        }
    }

    async handleSaveApiUrl() {
        const apiUrl = document.getElementById('apiUrlInput').value.trim();

        // Validation HTTPS
        if (!apiUrl.startsWith('https://')) {
            this.showError('L\'URL doit commencer par https://');
            return;
        }

        // Validation format URL
        try {
            new URL(apiUrl);
        } catch (e) {
            this.showError('Format d\'URL invalide');
            return;
        }

        // Afficher spinner
        const saveBtn = document.getElementById('saveApiUrlBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Vérification...';

        try {
            // Tester la connectivité
            const testResult = await this.testServerConnectivity(apiUrl);

            if (!testResult.success) {
                this.showError(testResult.message);
                return;
            }

            // Sauvegarder
            localStorage.setItem('ratchou_api_url', apiUrl);
            this.showSuccess('URL enregistrée avec succès - Serveur accessible');

            // Si SYNC_CONFIG existe déjà, mettre à jour l'api_url
            if (this.config) {
                await this.db.put('SYNC_CONFIG', {
                    ...this.config,
                    api_url: apiUrl,
                    updated_at: Date.now()
                });
                await this.loadSyncConfig(); // Recharger la config
                console.log('✅ SYNC_CONFIG updated with API URL');
            }

            // Masquer formulaire, afficher accordéon
            document.getElementById('apiUrlConfig').style.display = 'none';
            document.getElementById('pairingAccordion').style.display = 'block';

            // Re-initialiser l'UI pour lancer le pairing si master
            this.updateUIBasedOnRole();

            // Si fresh install (pas de config), bootstrap automatiquement
            if (!this.config) {
                console.log('🚀 Fresh install détecté, bootstrap master automatique');
                // Petit délai pour feedback visuel
                setTimeout(async () => {
                    await this.handleBootstrapMaster();
                }, 500);
            }

        } catch (error) {
            this.showError(`Erreur lors de la vérification : ${error.message}`);
        } finally {
            // Restaurer bouton
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    // ========== BOOTSTRAP MASTER ==========

    async handleBootstrapMaster() {
        // Vérifier si déjà complètement configuré
        if (this.config && this.config.role === 'master' && this.config.encryption_key) {
            this.showError('Cet appareil est déjà configuré comme maître');
            return;
        }

        console.log('🚀 Démarrage bootstrap master...');

        try {
            // 1. Générer master_id (toujours un nouveau lors du bootstrap)
            const masterId = `master_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
            console.log('👑 Bootstrap master:', masterId);

            // 2. Générer clé de chiffrement
            const encryptionKey = await window.SyncCrypto.generateKey();
            const encryptionKeyBase64 = await window.SyncCrypto.exportKeyToBase64(encryptionKey);
            console.log('🔐 Encryption key generated');

            // 3. Récupérer API URL
            const apiUrl = localStorage.getItem('ratchou_api_url');

            // 4. Enregistrer sur le serveur
            const pairResult = await window.NetworkClient.pair({
                device_id: masterId,
                role: 'master',
                bootstrap: true
            });

            if (!pairResult.success) {
                throw new Error(pairResult.message || 'Échec du pairing avec le serveur');
            }

            console.log('✅ Server pairing successful');

            // 5. Stocker SYNC_CONFIG
            await this.db.put('SYNC_CONFIG', {
                id: 'config',
                device_id: masterId,
                master_id: masterId,
                role: 'master',
                api_url: apiUrl,
                device_token: pairResult.device_token,
                encryption_key: encryptionKeyBase64,
                cluster_schema_version: 1,
                created_at: Date.now(),
                updated_at: Date.now()
            });

            // Recharger config
            await this.loadSyncConfig();

            console.log('💾 SYNC_CONFIG saved');

            // 6. Générer recovery key
            await this.generateRecoveryKey();

        } catch (error) {
            console.error('❌ Bootstrap master failed:', error);
            this.showError('Échec du bootstrap: ' + error.message);
        }
    }

    async generateRecoveryKey() {
        const recoveryData = {
            v: 1,
            master_id: this.config.master_id,
            encryption_key: this.config.encryption_key,
            api_url: this.config.api_url,
            created_at: Date.now()
        };

        const encoded = btoa(JSON.stringify(recoveryData));
        const formatted = this.formatRecoveryKey(encoded);

        // Stocker dans SYNC_CONFIG
        await this.db.put('SYNC_CONFIG', {
            ...this.config,
            recovery_key: encoded
        });

        // Afficher dans modal
        document.getElementById('recoveryKeyDisplay').textContent = formatted;
        this.recoveryKeyModal.show();

        console.log('🔑 Recovery key generated');
    }

    formatRecoveryKey(base64) {
        const chunks = base64.match(/.{1,4}/g) || [];
        return 'RATCHOU-' + chunks.slice(0, 8).join('-');
    }

    copyRecoveryKey() {
        const key = document.getElementById('recoveryKeyDisplay').textContent;
        navigator.clipboard.writeText(key);
        this.showSuccess('Clé de récupération copiée');
    }

    downloadRecoveryKey() {
        const key = document.getElementById('recoveryKeyDisplay').textContent;
        const blob = new Blob([
            `Clé de récupération Ratchou\n\n`,
            `${key}\n\n`,
            `⚠️ Conservez cette clé en lieu sûr.\n`,
            `Elle est indispensable pour récupérer vos données.\n\n`,
            `Généré le : ${new Date().toLocaleString('fr-FR')}`
        ], { type: 'text/plain' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ratchou-recovery-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.showSuccess('Clé téléchargée');
    }

    // ========== PAIRING FILE GENERATION ==========

    async handleGeneratePairingFile() {
        const securityCode = document.getElementById('pairingSecurityCode').value;
        const deviceName = document.getElementById('pairingTargetDeviceName').value;
        const btn = document.getElementById('generatePairingFileBtn');

        // Validation des inputs
        if (!/^\d{4}$/.test(securityCode)) {
            this.showError('Le code de sécurité doit contenir 4 chiffres');
            return;
        }
        if (!deviceName || deviceName.trim() === '') {
            this.showError('Le nom de l\'appareil est requis');
            return;
        }

        // Vérifier que le module ImportExport est chargé
        if (!window.ImportExport || typeof window.ImportExport.exportPairingFile !== 'function') {
            this.showError('Le module d\'import/export n\'est pas encore chargé. Veuillez recharger la page.');
            console.error('❌ window.ImportExport non disponible');
            return;
        }

        // Afficher loading sur le bouton
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Génération...';

        try {
            // Appel de la fonction d'export avec callback de progression
            const result = await window.ImportExport.exportPairingFile(
                securityCode,
                deviceName,
                (percent, message) => {
                    console.log(`📦 ${percent}%: ${message}`);
                    // Optionnel : afficher la progression dans l'UI
                }
            );

            if (result.success) {
                this.showSuccess(`Fichier d'appairage généré : ${result.fileName}`);
                // Reset form
                document.getElementById('pairingFileForm').reset();
            } else {
                this.showError('Échec de la génération : ' + result.message);
            }
        } catch (error) {
            console.error('❌ Generate pairing file error:', error);
            this.showError('Erreur lors de la génération du fichier');
        } finally {
            // Restaurer le bouton
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    // ========== PAIRING CONFIRMATION ==========

    /**
     * Gère la confirmation du pairing (après acceptation de l'effacement)
     */
    async handlePairingConfirmation() {
        console.log('✅ Pairing confirmed by user');

        // Masquer la modale
        this.pairingConfirmModal.hide();

        // Vérifier qu'on a bien un payload en attente
        if (!this.pendingPairingPayload) {
            this.showError('Erreur: aucun payload en attente');
            return;
        }

        // Lancer le processus de pairing
        await this.completePairing(this.pendingPairingPayload);

        // Nettoyer le payload stocké
        this.pendingPairingPayload = null;
    }

    /**
     * Gère l'annulation du pairing
     */
    handlePairingCancellation() {
        console.log('❌ Pairing cancelled by user');

        // Masquer la modale
        this.pairingConfirmModal.hide();

        // Nettoyer le payload stocké
        this.pendingPairingPayload = null;

        // Feedback utilisateur
        this.showAlert('Opération annulée - Aucune modification effectuée', 'info');
    }

    // ========== COMPLETE PAIRING (COMMUN) ==========

    async completePairing(payload) {
        this.showLoading();

        try {
            // 1. Générer slave_id
            const slaveId = `slave_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
            console.log('📱 Slave ID:', slaveId);

            // 2. Enregistrer sur le serveur
            const result = await window.NetworkClient.pair({
                device_id: slaveId,
                master_id: payload.master_id,
                role: 'slave'
            });

            if (!result.success) {
                throw new Error(result.message || 'Échec du pairing avec le serveur');
            }

            console.log('✅ Server pairing successful');

            // 3. Stocker SYNC_CONFIG
            await this.db.put('SYNC_CONFIG', {
                id: 'config',
                device_id: slaveId,
                master_id: payload.master_id,
                role: 'slave',
                api_url: payload.api_url,
                device_token: result.device_token,
                encryption_key: payload.encryption_key,
                cluster_schema_version: 1,
                created_at: Date.now(),
                updated_at: Date.now()
            });

            console.log('💾 SYNC_CONFIG saved');

            // 4. Initialiser SyncManager
            const config = await this.db.get('SYNC_CONFIG', 'config');
            const syncManager = new SyncManager(this.db, config);
            await syncManager.start();

            console.log('🔄 SyncManager initialized');

            // 5. NOUVEAU : Lancer synchronisation initiale complète
            this.showLoading('Synchronisation initiale en cours...');

            // Écouter les événements de progression
            const progressHandler = (event) => {
                const { type, store, stage, progress, batch, totalBatches, totalRecords } = event.detail;

                if (type === 'clearing') {
                    this.showLoading(`Effacement : ${store} (${progress})`);
                } else if (type === 'batch-received') {
                    // NOUVEAU : Afficher progression par lots
                    const percent = Math.round((batch / totalBatches) * 100);
                    const stageLabel = stage === 'REFERENCE' ? 'références' : 'transactions';
                    this.showLoading(
                        `Réception ${stageLabel}: lot ${batch}/${totalBatches} (${totalRecords} enreg.) - ${percent}%`
                    );
                } else if (type === 'stage-complete') {
                    if (stage === 'REFERENCE') {
                        this.showLoading('Synchronisation 1/2 : Données de référence ✓');
                    } else if (stage === 'TRANSACTIONAL') {
                        this.showLoading('Synchronisation 2/2 : Transactions ✓');
                    }
                } else if (type === 'complete') {
                    this.showLoading('Finalisation...');
                }
            };

            window.addEventListener('sync-bootstrap-progress', progressHandler);

            try {
                await syncManager.requestInitialSync();
                console.log('✅ Initial sync complete');
            } finally {
                window.removeEventListener('sync-bootstrap-progress', progressHandler);
            }

            // 6. Rediriger vers dashboard
            this.showSuccess('Appareil associé et synchronisé avec succès !');

            setTimeout(() => {
                window.location.href = '../dashboard.html';
            }, 2000);

        } catch (error) {
            console.error('❌ Complete pairing failed:', error);
            this.showError('Échec du pairing: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // ========== DEVICE LIST ==========

    async loadDeviceList() {
        const container = document.getElementById('deviceListContainer');

        if (!this.config || !this.config.device_token) {
            container.innerHTML = '<p class="text-muted">Aucun appareil configuré</p>';
            return;
        }

        container.innerHTML = '<p class="text-muted">Chargement...</p>';

        try {
            const result = await window.NetworkClient.getDevices(
                this.config.device_id,
                this.config.device_token
            );

            if (!result.success || !result.devices) {
                throw new Error(result.message || 'Impossible de récupérer la liste');
            }

            this.renderDeviceList(result.devices);
        } catch (error) {
            console.error('❌ Load device list failed:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <strong>❌ Erreur</strong><br>
                    ${error.message || 'Impossible de récupérer la liste des appareils'}
                </div>
            `;
        }
    }

    renderDeviceList(devices) {
        const container = document.getElementById('deviceListContainer');

        if (devices.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun appareil associé</p>';
            return;
        }

        let html = '<div class="list-group">';

        for (const device of devices) {
            const isMaster = device.role === 'master';
            const isCurrentDevice = device.device_id === this.config.device_id;

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">
                                ${isMaster ? '👑' : '📱'}
                                ${device.device_name || device.device_id}
                                ${isCurrentDevice ? '<span class="badge bg-primary ms-2">Cet appareil</span>' : ''}
                            </h6>
                            <small class="text-muted">
                                ${device.role} • Dernière activité : ${this.formatDate(device.last_seen)}
                            </small>
                        </div>
                        <div>
                            ${!isCurrentDevice && this.config.role === 'master' ? `
                                <button class="btn btn-sm btn-outline-danger"
                                        onclick="syncPairingController.revokeDevice('${device.device_id}')">
                                    🗑️ Révoquer
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;

        console.log(`📋 ${devices.length} device(s) displayed`);
    }

    async revokeDevice(deviceId) {
        if (!confirm('Êtes-vous sûr de vouloir révoquer cet appareil ?\n\nL\'appareil révoqué ne pourra plus se synchroniser.')) {
            return;
        }

        try {
            const result = await window.NetworkClient.revoke(
                this.config.device_id,
                this.config.device_token,
                deviceId,
                'manual_revocation'
            );

            if (result.success) {
                this.showSuccess('Appareil révoqué avec succès');
                await this.loadDeviceList(); // Reload list
            } else {
                this.showError('Échec de la révocation: ' + result.message);
            }
        } catch (error) {
            console.error('❌ Revoke device failed:', error);
            this.showError('Erreur lors de la révocation');
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Jamais';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Il y a ${diffHours}h`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `Il y a ${diffDays}j`;

        return date.toLocaleDateString('fr-FR');
    }

    // ========== UI HELPERS ==========

    showLoading(message = 'Chargement...') {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';

            // Mettre à jour le message si l'élément existe
            const messageEl = document.getElementById('loadingMessage');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }

    showButtonLoading(button) {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Chargement...';
    }

    hideButtonLoading(button) {
        if (!button) return;
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showAlert(message, type) {
        const alertContainer = document.getElementById('alertContainer');
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        alertContainer.innerHTML = alertHtml;

        // Auto-dismiss après 5 secondes
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    // ========== RATE LIMIT HANDLING ==========

    /**
     * Initialise la gestion du rate limit
     */
    initRateLimitHandling() {
        let countdownInterval = null;

        // Écouter les événements de rate limit
        window.addEventListener('sync-rate-limited', (event) => {
            const alert = document.getElementById('rate-limit-alert');
            const countdown = document.getElementById('rate-limit-countdown');

            if (!alert || !countdown) return;

            alert.classList.remove('d-none');

            // Démarrer le countdown
            const updateCountdown = () => {
                const status = window.syncManager?.getRateLimitStatus();
                if (!status) {
                    if (countdownInterval) {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                    alert.classList.add('d-none');
                    return;
                }

                const minutes = Math.floor(status.remainingSeconds / 60);
                const seconds = status.remainingSeconds % 60;
                countdown.textContent = `${minutes}m ${seconds}s`;
            };

            updateCountdown();
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
            countdownInterval = setInterval(updateCountdown, 1000);
        });

        // Bouton de déblocage manuel
        document.getElementById('force-resume-sync')?.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir débloquer la synchronisation manuellement ?\n\nNote : Si vous n\'avez pas vidé la table des rate limits côté serveur, la synchronisation sera à nouveau bloquée.')) {
                window.syncManager?.clearRateLimit();

                // Masquer l'alert
                const alert = document.getElementById('rate-limit-alert');
                if (alert) {
                    alert.classList.add('d-none');
                }

                // Feedback
                this.showSuccess('Synchronisation débloquée. Un nouveau cycle va démarrer.');
            }
        });

        // Écouter le déblocage automatique
        window.addEventListener('sync-rate-limit-cleared', () => {
            const alert = document.getElementById('rate-limit-alert');
            if (alert) {
                alert.classList.add('d-none');
            }

            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
        });
    }
}

// Initialisation
const syncPairingController = new SyncPairingController();

document.addEventListener('DOMContentLoaded', async () => {
    await ratchouApp.initialize();
    await syncPairingController.initialize();
});
