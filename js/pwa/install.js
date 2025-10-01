// PWA Installation Management for Ratchou
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.updateAvailable = false;
        this.registration = null;
        this.countdownInterval = null;
        this.updateCountdownInterval = null;
        this.updateInProgress = false;

        this.init();
    }

    async init() {
        if ('serviceWorker' in navigator) {
            try {
                // --- Logique de chemin robuste et simplifiée ---
                // Le Service Worker est à la racine, on utilise un chemin absolu.
                // ⚠️ IMPORTANT : CHEMINS PWA (voir aussi sw.js ligne ~17)
                // DEV:  '/ratchou/sw.js' et '/ratchou/'
                // PROD: '/sw.js' et '/'
                const swPath = '/sw.js';
                const scopePath = '/';
                // --- Fin de la logique de chemin ---

                console.log(`[PWA] SW path: ${swPath}, scope: ${scopePath}`);
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
                console.log('[PWA] Mode:', isStandalone ? 'Standalone (PWA)' : 'Navigateur (onglet)');
                
                this.registration = await navigator.serviceWorker.register(swPath, {
                    scope: scopePath
                });
                
                console.log('[PWA] Service Worker registered:', this.registration.scope);
                
                // Handle service worker updates
                this.handleServiceWorkerUpdate();
                
                // Check if already installed
                this.checkInstallStatus();
                
                // Listen for install prompt
                this.setupInstallPrompt();
                
                // Create install UI if needed
                this.createInstallUI();
                
            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        } else {
            console.warn('[PWA] Service Workers not supported');
        }
    }

    handleServiceWorkerUpdate() {
        if (!this.registration) return;

        // Listen for new service worker
        this.registration.addEventListener('updatefound', () => {
            const newWorker = this.registration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available
                    this.updateAvailable = true;
                    this.showUpdateNotification();
                }
            });
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                // Use soft reload for better UX
                this.softReload('Service Worker mis à jour, rechargement...', 500);
            }
        });
    }

    checkInstallStatus() {
        // Check if running as PWA
        this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
        
        if (this.isInstalled) {
            console.log('[PWA] App is running as installed PWA');
            this.hideInstallPrompt();
        }
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[PWA] Install prompt triggered');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });

        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed successfully');
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.hideInstallPrompt();
            this.showInstallSuccessMessage();
        });
    }

    createInstallUI() {
        // Plus besoin de créer des conteneurs flottants
        // La zone PWA est maintenant intégrée dans le dashboard
        console.log('[PWA] Using integrated notification zone in dashboard');
    }

    showInstallPrompt() {
        if (this.isInstalled) return;

        // Afficher l'incitation à l'installation uniquement sur index.html
        const currentPage = window.location.pathname;
        const isIndexPage = currentPage.endsWith('index.html') || currentPage.endsWith('/ratchou/') || currentPage === '/ratchou' || currentPage.endsWith('/');

        if (!isIndexPage) {
            console.log('[PWA] Install prompt skipped - not on index page');
            return;
        }

        const zone = document.getElementById('pwa-notification-zone');
        if (zone) {
            zone.innerHTML = `
                <div class="mb-4 p-3 rounded" style="
                    border-left: 4px solid #0d6efd;
                    background: linear-gradient(135deg, #f8f9ff 0%, #e7f3ff 100%);
                    border: 1px solid #b8daff;
                ">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-info-circle-fill text-primary me-2"></i>
                                <strong>📱 Installer Ratchou</strong>
                                <small class="badge bg-secondary ms-2" id="pwa-countdown">15s</small>
                            </div>
                            <p class="mb-2 small text-muted">
                                Profitez d'un accès rapide par une icône sur votre écran d'accueil
                            </p>
                            <div class="d-flex gap-2">
                                <button id="pwa-install-btn" class="btn btn-primary btn-sm">
                                    <i class="bi bi-download"></i> Installer
                                </button>
                                <button id="pwa-install-close" class="btn btn-outline-secondary btn-sm">
                                    Plus tard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            zone.style.display = 'block';

            // Bind events
            document.getElementById('pwa-install-btn').addEventListener('click', () => {
                this.promptInstall();
            });

            document.getElementById('pwa-install-close').addEventListener('click', () => {
                this.hideInstallPrompt();
            });

            // Auto-hide with countdown after 15 seconds
            let countdown = 15;
            const countdownBadge = document.getElementById('pwa-countdown');

            this.countdownInterval = setInterval(() => {
                countdown--;
                if (countdownBadge) {
                    countdownBadge.textContent = countdown + 's';
                    if (countdown <= 5) {
                        countdownBadge.className = 'badge bg-warning ms-2';
                    }
                }

                if (countdown <= 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    if (zone.style.display === 'block' && zone.innerHTML.includes('Installer Ratchou')) {
                        this.hideInstallPrompt();
                    }
                }
            }, 1000);
        }
    }

    hideInstallPrompt() {
        // Clear countdown if running
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        const zone = document.getElementById('pwa-notification-zone');
        if (zone) {
            zone.style.display = 'none';
            zone.innerHTML = '';
        }
    }

    hideUpdateNotification() {
        // Clear update countdown if running
        if (this.updateCountdownInterval) {
            clearInterval(this.updateCountdownInterval);
            this.updateCountdownInterval = null;
        }

        const zone = document.getElementById('pwa-notification-zone');
        if (zone) {
            zone.style.display = 'none';
            zone.innerHTML = '';
        }
    }

    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('[PWA] No install prompt available');
            return;
        }

        try {
            // Provide immediate visual feedback
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.disabled = true;
                installBtn.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Préparation...
                `;
            }

            // Show the install prompt
            this.deferredPrompt.prompt();

            // Wait for user choice
            const result = await this.deferredPrompt.userChoice;
            console.log('[PWA] User choice:', result.outcome);

            if (result.outcome === 'accepted') {
                console.log('[PWA] User accepted install');
                // Show success feedback
                if (installBtn) {
                    installBtn.innerHTML = `
                        <i class="bi bi-check-circle me-1"></i>
                        Installation en cours...
                    `;
                }
                // Give user feedback before hiding
                setTimeout(() => {
                    this.hideInstallPrompt();
                }, 1500);
            } else {
                console.log('[PWA] User dismissed install');
                this.hideInstallPrompt();
            }

            this.deferredPrompt = null;

        } catch (error) {
            console.error('[PWA] Install prompt failed:', error);
            // Reset button on error
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.disabled = false;
                installBtn.innerHTML = `<i class="bi bi-download"></i> Installer`;
            }
        }
    }

    showUpdateNotification() {
        // Afficher les notifications de mise à jour uniquement sur index.html
        const currentPage = window.location.pathname;
        const isIndexPage = currentPage.endsWith('index.html') || currentPage.endsWith('/ratchou/') || currentPage === '/ratchou' || currentPage.endsWith('/');

        if (!isIndexPage) {
            console.log('[PWA] Update notification skipped - not on index page');
            return;
        }

        const zone = document.getElementById('pwa-notification-zone');
        if (zone) {
            zone.innerHTML = `
                <div class="mb-4 p-3 rounded" style="
                    border-left: 4px solid #17a2b8;
                    background: linear-gradient(135deg, #f0fdff 0%, #e3f8fd 100%);
                    border: 1px solid #b3dde6;
                ">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-arrow-clockwise me-2 text-info"></i>
                                <strong>🔄 Mise à jour disponible!</strong>
                                <small class="badge bg-info ms-2" id="pwa-update-countdown">15s</small>
                            </div>
                            <p class="mb-2 small text-muted">
                                Une nouvelle version de Ratchou est prête à être installée
                            </p>
                            <div class="d-flex gap-2">
                                <button id="pwa-update-btn" class="btn btn-info btn-sm">
                                    <i class="bi bi-arrow-clockwise"></i> Mettre à jour
                                </button>
                                <button id="pwa-update-close" class="btn btn-outline-secondary btn-sm">
                                    Plus tard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            zone.style.display = 'block';

            // Bind events
            document.getElementById('pwa-update-btn').addEventListener('click', () => {
                this.applyUpdate();
            });

            document.getElementById('pwa-update-close').addEventListener('click', () => {
                this.hideUpdateNotification();
            });

            // Décompte de 15 secondes avec changement de couleur à 5s
            let countdown = 15;
            const countdownBadge = document.getElementById('pwa-update-countdown');

            this.updateCountdownInterval = setInterval(() => {
                countdown--;
                if (countdownBadge) {
                    countdownBadge.textContent = countdown + 's';
                    if (countdown <= 5) {
                        countdownBadge.className = 'badge bg-warning ms-2';
                    }
                }

                if (countdown <= 0) {
                    clearInterval(this.updateCountdownInterval);
                    this.updateCountdownInterval = null;
                    // Après le décompte, on garde la notification mais on enlève le badge
                    if (countdownBadge) {
                        countdownBadge.style.display = 'none';
                    }
                }
            }, 1000);
        }
    }

    applyUpdate() {
        if (!this.registration || !this.registration.waiting) {
            console.log('[PWA] No update waiting');
            return;
        }

        // Clear any countdown still running
        if (this.updateCountdownInterval) {
            clearInterval(this.updateCountdownInterval);
            this.updateCountdownInterval = null;
        }

        // Provide immediate visual feedback
        const updateButton = document.getElementById('pwa-update-btn');
        const updateClose = document.getElementById('pwa-update-close');
        const countdownBadge = document.getElementById('pwa-update-countdown');

        if (updateButton) {
            updateButton.disabled = true;
            updateButton.innerHTML = `
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Préparation...
            `;
        }

        // Disable close button during update
        if (updateClose) {
            updateClose.disabled = true;
            updateClose.style.opacity = '0.5';
        }

        // Hide countdown badge
        if (countdownBadge) {
            countdownBadge.style.display = 'none';
        }

        // Mark update as in progress
        this.updateInProgress = true;
        console.log('[PWA] Demande de mise à jour utilisateur, envoi du signal au service worker...');

        // Tell the waiting service worker to skip waiting
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Update progress feedback
        let reloadExecuted = false;

        // Update feedback after a moment to show progress
        setTimeout(() => {
            if (updateButton && !reloadExecuted) {
                updateButton.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Installation en cours...
                `;
            }
        }, 800);

        // More feedback
        setTimeout(() => {
            if (updateButton && !reloadExecuted) {
                updateButton.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Application des changements...
                `;
            }
        }, 2000);

        // The 'controllerchange' event will fire when the new service worker has taken control.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!reloadExecuted) {
                reloadExecuted = true;
                console.log('[PWA] Service worker activé, préparation du rechargement...');

                // Show final message before reload
                if (updateButton) {
                    updateButton.innerHTML = `
                        <i class="bi bi-check-circle me-1"></i>
                        Mise à jour terminée!
                    `;
                }

                // Use soft reload with better UX
                setTimeout(() => {
                    this.softReload('Mise à jour appliquée, rechargement de l\'application...', 500);
                }, 1200);
            }
        });

        // Fallback timeout in case controllerchange doesn't fire quickly
        setTimeout(() => {
            if (!reloadExecuted && updateButton) {
                console.log('[PWA] Timeout atteint, rechargement forcé...');
                updateButton.innerHTML = `
                    <i class="bi bi-arrow-clockwise me-1"></i>
                    Finalisation...
                `;
                setTimeout(() => {
                    this.softReload('Finalisation de la mise à jour...', 300);
                }, 500);
            }
        }, 8000);
    }

    /**
     * Soft reload with user feedback to avoid crash impression
     */
    softReload(message = 'Mise à jour terminée, rechargement...', delay = 1000) {
        console.log('[PWA] Performing soft reload:', message);

        // Show loading overlay if available
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) {
                loadingMessage.textContent = message;
            }
        } else {
            // Create a temporary overlay if none exists
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 16px;
            `;
            overlay.innerHTML = `
                <div style="text-align: center;">
                    <div class="spinner-border text-light mb-3" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <div>${message}</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        setTimeout(() => {
            window.location.reload();
        }, delay);
    }

    showInstallSuccessMessage() {
        const zone = document.getElementById('pwa-notification-zone');
        if (zone) {
            zone.innerHTML = `
                <div class="mb-4 p-3 rounded" style="
                    border-left: 4px solid #28a745;
                    background: linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%);
                    border: 1px solid #b8e6b8;
                ">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-check-circle me-2 text-success"></i>
                                <strong>🎉 Ratchou installé avec succès!</strong>
                            </div>
                            <small class="text-muted">L'application est maintenant disponible sur votre écran d'accueil</small>
                        </div>
                        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="this.closest('#pwa-notification-zone').style.display='none'" aria-label="Fermer">
                            ×
                        </button>
                    </div>
                </div>
            `;
            zone.style.display = 'block';

            // Auto-hide after 5 seconds
            setTimeout(() => {
                if (zone && zone.innerHTML.includes('installé avec succès')) {
                    zone.style.display = 'none';
                    zone.innerHTML = '';
                }
            }, 5000);
        }
    }

    // Public method to manually trigger install check
    checkForInstallPrompt() {
        if (!this.isInstalled && this.deferredPrompt) {
            this.showInstallPrompt();
        }
    }

    // Public method to check for updates
    async checkForUpdates() {
        if (this.registration) {
            try {
                await this.registration.update();
            } catch (error) {
                console.error('[PWA] Failed to check for updates:', error);
            }
        }
    }
}

// Initialize PWA installer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwaInstaller = new PWAInstaller();
    });
} else {
    window.pwaInstaller = new PWAInstaller();
}

// Export for manual usage
window.PWAInstaller = PWAInstaller;