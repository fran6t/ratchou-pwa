// Storage Persistence Management for Ratchou PWA
class StoragePersistence {
    constructor() {
        // Singleton pattern: return existing instance if it exists
        if (StoragePersistence.instance) {
            console.log('[Storage] Returning existing instance');
            return StoragePersistence.instance;
        }

        this.isSupported = 'storage' in navigator && 'persist' in navigator.storage;
        this.isPersistent = false;
        this.storageInfo = null;
        this.warningThreshold = 0.8; // Warn when 80% full
        this.criticalThreshold = 0.9; // Critical when 90% full
        this.warningShown = false; // Flag to prevent duplicate warnings

        // Store singleton instance
        StoragePersistence.instance = this;

        this.init();
    }

    async init() {
        if (!this.isSupported) {
            console.warn('[Storage] Storage persistence not supported');
            return;
        }

        try {
            // Check current persistence status
            await this.checkPersistenceStatus();
            
            // Request persistence if not already persistent
            if (!this.isPersistent) {
                await this.requestPersistence();
            }
            
            // Get storage information
            await this.updateStorageInfo();
            
            // Create storage monitoring UI
            this.createStorageUI();
            
            // Set up periodic monitoring
            this.startMonitoring();
            
        } catch (error) {
            console.error('[Storage] Failed to initialize storage persistence:', error);
        }
    }

    async checkPersistenceStatus() {
        if (!this.isSupported) return false;

        try {
            this.isPersistent = await navigator.storage.persisted();
            console.log('[Storage] Persistence status:', this.isPersistent);
            return this.isPersistent;
        } catch (error) {
            console.error('[Storage] Failed to check persistence status:', error);
            return false;
        }
    }

    async requestPersistence() {
        if (!this.isSupported || this.isPersistent) return this.isPersistent;

        try {
            const granted = await navigator.storage.persist();
            this.isPersistent = granted;

            if (granted) {
                console.log('[Storage] Persistence granted!');
                // Toast removed - disclaimers in login form handle this now
            } else {
                console.log('[Storage] Persistence denied');
                // Toast removed - disclaimers in login form handle this now
            }

            return granted;
        } catch (error) {
            console.error('[Storage] Failed to request persistence:', error);
            return false;
        }
    }

    async updateStorageInfo() {
        if (!this.isSupported) return null;

        try {
            this.storageInfo = await navigator.storage.estimate();
            const usage = this.storageInfo.usage || 0;
            const quota = this.storageInfo.quota || 0;
            const usagePercent = quota > 0 ? usage / quota : 0;

            console.log(`[Storage] Usage: ${this.formatBytes(usage)} / ${this.formatBytes(quota)} (${(usagePercent * 100).toFixed(1)}%)`);
            
            // Update UI if exists
            this.updateStorageUI();
            
            // Check for warnings
            this.checkStorageWarnings(usagePercent);
            
            return this.storageInfo;
        } catch (error) {
            console.error('[Storage] Failed to get storage info:', error);
            return null;
        }
    }

    checkStorageWarnings(usagePercent) {
        if (usagePercent >= this.criticalThreshold) {
            this.showStorageWarning('critical');
        } else if (usagePercent >= this.warningThreshold) {
            this.showStorageWarning('warning');
        }
    }

    createStorageUI() {
        // Create storage status badge
        if (!document.getElementById('storage-status-badge')) {
            const badge = document.createElement('div');
            badge.id = 'storage-status-badge';
            badge.className = 'position-fixed bottom-0 end-0 m-3';
            badge.style.zIndex = '1040';
            badge.style.display = 'none';
            
            badge.innerHTML = `
                <div class="btn btn-outline-secondary btn-sm rounded-pill" style="pointer-events: none;">
                    <i class="bi bi-hdd me-1"></i>
                    <span id="storage-usage-text">--</span>
                </div>
            `;
            
            document.body.appendChild(badge);
        }

        // Create storage warning modal
        if (!document.getElementById('storage-warning-modal')) {
            const modal = document.createElement('div');
            modal.innerHTML = `
                <div class="modal fade" id="storage-warning-modal" tabindex="-1" aria-labelledby="storageWarningLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-warning text-dark">
                                <h5 class="modal-title" id="storageWarningLabel">
                                    <i class="bi bi-exclamation-triangle me-2"></i>Espace de stockage
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
                            </div>
                            <div class="modal-body">
                                <p id="storage-warning-message">L'espace de stockage disponible est limité.</p>
                                <div class="progress mb-3">
                                    <div id="storage-progress-bar" class="progress-bar" role="progressbar" 
                                         style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <div class="row text-center">
                                    <div class="col">
                                        <small class="text-muted">Utilisé</small><br>
                                        <span id="storage-used-display">--</span>
                                    </div>
                                    <div class="col">
                                        <small class="text-muted">Disponible</small><br>
                                        <span id="storage-quota-display">--</span>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <h6>Recommandations:</h6>
                                    <ul class="small">
                                        <li>Exportez et supprimez les anciennes transactions</li>
                                        <li>Videz le cache du navigateur si nécessaire</li>
                                        <li>Libérez de l'espace sur votre appareil</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Compris</button>
                                <button type="button" class="btn btn-warning" onclick="window.location.href='./manage/export.html'">
                                    <i class="bi bi-download me-1"></i>Exporter les données
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
    }

    updateStorageUI() {
        if (!this.storageInfo) return;

        const usage = this.storageInfo.usage || 0;
        const quota = this.storageInfo.quota || 0;
        const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

        // Update badge
        const badgeText = document.getElementById('storage-usage-text');
        const badge = document.getElementById('storage-status-badge');
        
        if (badgeText && badge) {
            badgeText.textContent = `${usagePercent.toFixed(0)}%`;
            
            // Show badge if usage is significant or approaching limits
            if (usagePercent > 20 || usagePercent >= this.warningThreshold * 100) {
                badge.style.display = 'block';
                
                // Update badge color based on usage
                const btn = badge.querySelector('.btn');
                btn.className = 'btn btn-sm rounded-pill';
                if (usagePercent >= this.criticalThreshold * 100) {
                    btn.classList.add('btn-danger');
                } else if (usagePercent >= this.warningThreshold * 100) {
                    btn.classList.add('btn-warning');
                } else {
                    btn.classList.add('btn-outline-secondary');
                }
            } else {
                badge.style.display = 'none';
            }
        }

        // Update modal content
        const progressBar = document.getElementById('storage-progress-bar');
        const usedDisplay = document.getElementById('storage-used-display');
        const quotaDisplay = document.getElementById('storage-quota-display');

        if (progressBar) {
            progressBar.style.width = `${usagePercent}%`;
            progressBar.setAttribute('aria-valuenow', usagePercent.toFixed(0));
            
            // Update progress bar color
            progressBar.className = 'progress-bar';
            if (usagePercent >= this.criticalThreshold * 100) {
                progressBar.classList.add('bg-danger');
            } else if (usagePercent >= this.warningThreshold * 100) {
                progressBar.classList.add('bg-warning');
            } else {
                progressBar.classList.add('bg-primary');
            }
        }

        if (usedDisplay) {
            usedDisplay.textContent = this.formatBytes(usage);
        }

        if (quotaDisplay) {
            quotaDisplay.textContent = this.formatBytes(quota);
        }
    }

    showStorageWarning(level = 'warning') {
        const modal = document.getElementById('storage-warning-modal');
        const messageEl = document.getElementById('storage-warning-message');
        
        if (!modal || !messageEl) return;

        const messages = {
            warning: 'L\'espace de stockage commence à être limité. Pensez à exporter vos données anciennes.',
            critical: 'L\'espace de stockage est presque plein! Exportez et supprimez des données pour éviter la perte d\'informations.'
        };

        messageEl.textContent = messages[level] || messages.warning;

        // Show the modal using Bootstrap
        if (window.bootstrap) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    showPersistenceSuccessMessage() {
        this.showToast('Stockage sécurisé!', 'Vos données ne seront pas supprimées automatiquement.', 'success');
    }

    showPersistenceWarningMessage() {
        // Éviter d'afficher plusieurs fois le même toast
        if (this.warningShown) {
            console.log('[Storage] Warning already shown, skipping duplicate');
            return;
        }
        this.warningShown = true;

        this.showToast(
            'Stockage non persistant',
            'Vos données pourraient être supprimées si l\'espace manque. Utilisez régulièrement l\'export.',
            'warning'
        );
    }

    showToast(title, message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
        toast.style.zIndex = '1060';
        
        const bgClass = {
            'success': 'alert-success',
            'warning': 'alert-warning',
            'error': 'alert-danger',
            'info': 'alert-info'
        }[type] || 'alert-info';

        const icon = {
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'x-circle',
            'info': 'info-circle'
        }[type] || 'info-circle';
        
        toast.innerHTML = `
            <div class="alert ${bgClass} alert-dismissible shadow-lg" role="alert">
                <i class="bi bi-${icon} me-2"></i>
                <strong>${title}</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 8000);
    }

    startMonitoring() {
        // Update storage info every 30 seconds
        setInterval(() => {
            this.updateStorageInfo();
        }, 30000);

        // Check persistence status every 5 minutes
        setInterval(() => {
            this.checkPersistenceStatus();
        }, 300000);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Public methods
    async getStorageInfo() {
        return await this.updateStorageInfo();
    }

    async requestPersist() {
        return await this.requestPersistence();
    }

    getPersistenceStatus() {
        return this.isPersistent;
    }

    isStorageSupported() {
        return this.isSupported;
    }

    // Method to manually trigger storage check
    checkStorage() {
        this.updateStorageInfo();
    }

    /**
     * Vérifier si l'utilisateur peut accéder à l'application
     * Retourne true si persistance accordée OU risques acceptés
     */
    canAccessApp() {
        // Vérifier si persistance accordée
        if (this.isPersistent) {
            return true;
        }

        // Vérifier si l'utilisateur a accepté les risques
        try {
            const risksAccepted = localStorage.getItem('ratchou_risks_accepted');
            if (risksAccepted) {
                const acceptance = JSON.parse(risksAccepted);
                return acceptance.accepted === true;
            }
        } catch (error) {
            console.warn('Erreur lecture acceptation risques:', error);
        }

        return false;
    }

    /**
     * Rediriger vers la page de validation si nécessaire
     * Retourne true si redirection effectuée, false si accès autorisé
     */
    async redirectIfNeeded() {
        // Vérifier d'abord la persistance
        await this.checkPersistenceStatus();

        // Vérifier si l'accès est autorisé
        if (this.canAccessApp()) {
            return false; // Pas de redirection, accès autorisé
        }

        // Redirection vers la page de validation
        const currentPath = window.location.pathname;
        const isInManageFolder = currentPath.includes('/manage/');
        const scope = RatchouUtils.getAppScope();
        const validationPageUrl = isInManageFolder ? '../persistence-required.html' : `${scope}persistence-required.html`;

        console.log('[Persistence] Redirection vers page de validation:', validationPageUrl);
        window.location.replace(validationPageUrl);
        return true; // Redirection effectuée
    }
}

// Storage persistence will be manually initialized by pages that need it
// No automatic initialization to avoid unwanted tests on every page

// Export for manual usage
window.StoragePersistence = StoragePersistence;