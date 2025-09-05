// PWA Installation Management for Ratchou
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.updateAvailable = false;
        this.registration = null;
        
        this.init();
    }

    async init() {
        if ('serviceWorker' in navigator) {
            try {
                // Register service worker
                const swPath = `${location.origin}/ratchou/sw.js`; // chemin fixe correct
                const scopePath = '/ratchou/';

                console.log(`[PWA] SW enregistré pour ${swPath} avec scope ${scopePath}`);
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
                window.location.reload();
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
        // Create install button container if it doesn't exist
        if (!document.getElementById('pwa-install-container')) {
            const installContainer = document.createElement('div');
            installContainer.id = 'pwa-install-container';
            installContainer.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-3';
            installContainer.style.zIndex = '1050';
            installContainer.style.display = 'none';
            
            installContainer.innerHTML = `
                <div class="card border-0 shadow-lg" style="min-width: 300px;">
                    <div class="card-body text-center p-3">
                        <div class="mb-2">
                            <img src="./assets/icons/icon-192.png" alt="Ratchou" width="48" height="48">
                        </div>
                        <h6 class="card-title mb-2">Installer Ratchou</h6>
                        <p class="card-text small text-muted mb-3">
                            Accédez rapidement à vos finances depuis votre écran d'accueil
                        </p>
                        <div class="d-flex gap-2 justify-content-center">
                            <button id="pwa-install-btn" class="btn btn-primary btn-sm">
                                <i class="bi bi-download"></i> Installer
                            </button>
                            <button id="pwa-install-close" class="btn btn-outline-secondary btn-sm">
                                Plus tard
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(installContainer);
            
            // Bind events
            document.getElementById('pwa-install-btn').addEventListener('click', () => {
                this.promptInstall();
            });
            
            document.getElementById('pwa-install-close').addEventListener('click', () => {
                this.hideInstallPrompt();
            });
        }

        // Create update notification container
        if (!document.getElementById('pwa-update-container')) {
            const isMobile = window.innerWidth <= 576;
            const updateContainer = document.createElement('div');
            updateContainer.id = 'pwa-update-container';
            
            if (isMobile) {
                // Classes for a bottom banner on mobile
                updateContainer.className = 'position-fixed bottom-0 start-0 w-100';
            } else {
                // Original classes for a top toast on desktop
                updateContainer.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
            }
            
            updateContainer.style.zIndex = '1055';
            updateContainer.style.display = 'none';
            
            const alertClasses = isMobile 
                ? 'alert alert-info alert-dismissible shadow-lg text-center mb-0' 
                : 'alert alert-info alert-dismissible shadow-lg';
            
            const alertStyles = isMobile 
                ? 'style="border-radius: 0; border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem;"' 
                : '';

            updateContainer.innerHTML = `
                <div class="${alertClasses}" role="alert" ${alertStyles}>
                    <i class="bi bi-arrow-clockwise me-2"></i>
                    <strong>Mise à jour disponible!</strong>
                    <button id="pwa-update-btn" class="btn btn-info btn-sm ms-2">
                        Mettre à jour
                    </button>
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
            
            document.body.appendChild(updateContainer);
            
            // Bind update event
            document.getElementById('pwa-update-btn').addEventListener('click', () => {
                this.applyUpdate();
            });
        }
    }

    showInstallPrompt() {
        if (this.isInstalled) return;
        
        const container = document.getElementById('pwa-install-container');
        if (container) {
            container.style.display = 'block';
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (container.style.display === 'block') {
                    this.hideInstallPrompt();
                }
            }, 10000);
        }
    }

    hideInstallPrompt() {
        const container = document.getElementById('pwa-install-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('[PWA] No install prompt available');
            return;
        }

        try {
            // Show the install prompt
            this.deferredPrompt.prompt();
            
            // Wait for user choice
            const result = await this.deferredPrompt.userChoice;
            console.log('[PWA] User choice:', result.outcome);
            
            if (result.outcome === 'accepted') {
                console.log('[PWA] User accepted install');
            } else {
                console.log('[PWA] User dismissed install');
            }
            
            this.deferredPrompt = null;
            this.hideInstallPrompt();
            
        } catch (error) {
            console.error('[PWA] Install prompt failed:', error);
        }
    }

    showUpdateNotification() {
        const container = document.getElementById('pwa-update-container');
        if (container) {
            container.style.display = 'block';
        }
    }

    applyUpdate() {
        if (!this.registration || !this.registration.waiting) {
            console.log('[PWA] No update waiting');
            return;
        }

        // Provide visual feedback
        const updateButton = document.getElementById('pwa-update-btn');
        if (updateButton) {
            updateButton.disabled = true;
            updateButton.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Mise à jour...
            `;
        }

        // Tell the waiting service worker to skip waiting
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // The 'controllerchange' event will fire when the new service worker has taken control.
        // We listen for that event to safely reload the page.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
        
        // As a fallback, reload after a short delay if controllerchange doesn't fire
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }

    showInstallSuccessMessage() {
        // Show a toast or temporary message
        const toast = document.createElement('div');
        toast.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
        toast.style.zIndex = '1060';
        toast.innerHTML = `
            <div class="alert alert-success alert-dismissible shadow-lg" role="alert">
                <i class="bi bi-check-circle me-2"></i>
                <strong>Ratchou installé avec succès!</strong>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
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