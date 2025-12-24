/**
 * PWA Management Page
 * Gère l'affichage des informations PWA, la détection de plateforme et les guides d'installation
 */

class PWAPage {
    constructor() {
        this.isStandalone = false;
        this.platform = this.detectPlatform();
        this.initializePage();
    }

    /**
     * Détecte la plateforme utilisateur
     */
    detectPlatform() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;

        // Détection iOS
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            return {
                name: 'iOS',
                type: 'mobile',
                browser: /CriOS/.test(userAgent) ? 'Chrome' :
                        /FxiOS/.test(userAgent) ? 'Firefox' :
                        /OPiOS/.test(userAgent) ? 'Opera' : 'Safari',
                installMethod: 'ios-safari'
            };
        }

        // Détection Android
        if (/android/i.test(userAgent)) {
            return {
                name: 'Android',
                type: 'mobile',
                browser: /Chrome/.test(userAgent) ? 'Chrome' :
                        /Firefox/.test(userAgent) ? 'Firefox' :
                        /Opera/.test(userAgent) ? 'Opera' : 'Autre',
                installMethod: 'android-chrome'
            };
        }

        // Détection Desktop
        const isWindows = /Win/.test(navigator.platform);
        const isMac = /Mac/.test(navigator.platform);
        const isLinux = /Linux/.test(navigator.platform);

        let osName = 'Inconnu';
        if (isWindows) osName = 'Windows';
        else if (isMac) osName = 'macOS';
        else if (isLinux) osName = 'Linux';

        return {
            name: osName,
            type: 'desktop',
            browser: this.detectDesktopBrowser(),
            installMethod: 'desktop-browser'
        };
    }

    /**
     * Détecte le navigateur desktop
     */
    detectDesktopBrowser() {
        const userAgent = navigator.userAgent;

        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Edge')) return 'Edge';
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Opera')) return 'Opera';

        return 'Inconnu';
    }

    /**
     * Diagnostique pourquoi l'installation PWA n'est pas disponible
     */
    getPWAInstallDiagnostic() {
        const reasons = [];
        const suggestions = [];

        // Vérification du navigateur
        if (this.platform.browser === 'Firefox') {
            if (this.platform.type === 'desktop') {
                reasons.push('Firefox desktop ne supporte pas encore l\'installation PWA automatique');
                suggestions.push('Utilisez Firefox sur Android ou essayez Chrome/Edge');
                suggestions.push('Vous pouvez ajouter un raccourci via "Marque-pages" > "Ajouter à l\'écran d\'accueil"');
            } else {
                reasons.push('Firefox mobile nécessite une configuration manuelle');
                suggestions.push('Utilisez le menu Firefox > "Installer" si disponible');
            }
        } else if (this.platform.browser === 'Safari' && this.platform.type === 'desktop') {
            reasons.push('Safari desktop ne supporte pas l\'installation PWA automatique');
            suggestions.push('Utilisez Safari sur iOS pour installer l\'app');
            suggestions.push('Ou essayez Chrome/Edge sur desktop');
        }

        // Vérification du Service Worker
        if (!('serviceWorker' in navigator)) {
            reasons.push('Service Worker non supporté par ce navigateur');
            suggestions.push('Mettez à jour votre navigateur vers une version plus récente');
        }

        // Vérification de beforeinstallprompt
        if (!window.pwaInstaller?.deferredPrompt && this.platform.browser === 'Chrome') {
            reasons.push('Chrome n\'a pas encore proposé l\'installation (peut prendre quelques visites)');
            suggestions.push('Visitez l\'application plusieurs fois pour déclencher l\'installation');
        }

        // Vérification HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            reasons.push('PWA nécessite HTTPS pour l\'installation');
            suggestions.push('Accédez au site via HTTPS');
        }

        return {
            reasons,
            suggestions,
            canInstallManually: this.platform.browser === 'Chrome' || this.platform.browser === 'Edge' ||
                               (this.platform.browser === 'Safari' && this.platform.type === 'mobile')
        };
    }

    /**
     * Vérifie si l'application est en mode PWA
     */
    checkPWAStatus() {
        // Méthode principale de détection PWA
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone === true;

        // Vérification supplémentaire pour certains navigateurs
        if (!this.isStandalone && window.location.href.includes('/?homescreen=1')) {
            this.isStandalone = true;
        }

        return this.isStandalone;
    }

    /**
     * Obtient des informations sur le Service Worker
     */
    async getServiceWorkerInfo() {
        if (!('serviceWorker' in navigator)) {
            return { active: false, message: 'Non supporté' };
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                const isActive = registration.active !== null;
                const state = registration.active ? registration.active.state : 'inactif';
                return {
                    active: isActive,
                    message: isActive ? `Actif (${state})` : 'Enregistré mais inactif',
                    registration: registration
                };
            } else {
                return { active: false, message: 'Non enregistré' };
            }
        } catch (error) {
            return { active: false, message: 'Erreur de vérification' };
        }
    }

    /**
     * Estime l'utilisation du stockage
     */
    async getStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024 * 100) / 100;
                const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024);
                return `${usedMB} MB / ${quotaMB} MB`;
            } catch (error) {
                return 'Indisponible';
            }
        }
        return 'Non supporté';
    }

    /**
     * Initialise la page avec toutes les informations
     */
    async initializePage() {
        console.log('[PWA Debug] === PWA Page Initialization ===');
        console.log('[PWA Debug] Platform detected:', this.platform);
        console.log('[PWA Debug] User agent:', navigator.userAgent);

        // Vérification du statut PWA
        const isPWA = this.checkPWAStatus();
        console.log('[PWA Debug] Is standalone PWA:', isPWA);
        this.updatePWAStatus(isPWA);

        // Mise à jour des informations de plateforme
        this.updatePlatformInfo();

        // Mise à jour des informations système
        await this.updateSystemInfo();

        // Configuration de la zone d'installation
        console.log('[PWA Debug] Setting up install section...');
        this.setupInstallSection();

        // Gestion avancée du cache
        this.setupAdvancedCacheManagement();

        // Affichage du guide iOS si nécessaire
        this.handleiOSGuide();

        console.log('[PWA Debug] === Initialization Complete ===');
    }

    /**
     * Met à jour l'affichage du statut PWA
     */
    updatePWAStatus(isPWA) {
        // Status maintenant affiché via la notification PWA
        if (isPWA) {
            this.showPWANotification('✅ Application PWA installée et fonctionnelle !', 'success');
        }
    }

    /**
     * Met à jour les informations de plateforme
     */
    updatePlatformInfo() {
        // Info plateforme maintenant uniquement dans les informations système
        console.log('[PWA Debug] Platform info available in system information card');
    }

    /**
     * Met à jour les informations système
     */
    async updateSystemInfo() {
        // Version de l'application
        const appVersionElement = document.getElementById('appVersion');
        if (appVersionElement && window.ratchouApp && typeof window.ratchouApp.getVersion === 'function') {
            try {
                const version = await window.ratchouApp.getVersion();
                appVersionElement.textContent = version;
            } catch (error) {
                console.warn('Could not get app version:', error);
                appVersionElement.textContent = 'Non disponible';
            }
        }

        // Informations navigateur
        const browserElement = document.getElementById('browserInfo');
        if (browserElement) {
            browserElement.textContent = `${this.platform.browser} (${this.platform.name})`;
        }

        // Détails de plateforme
        const platformElement = document.getElementById('platformDetails');
        if (platformElement) {
            platformElement.textContent = `${this.platform.name} (${this.platform.type})`;
        }

        // Statut Service Worker
        const swInfo = await this.getServiceWorkerInfo();
        const swElement = document.getElementById('swStatus');
        if (swElement) {
            swElement.textContent = swInfo.message;
            swElement.className = swInfo.active ? 'text-success' : 'text-warning';
        }

        // Statut cache
        const cacheElement = document.getElementById('cacheStatus');
        if (cacheElement) {
            if (swInfo.active) {
                cacheElement.textContent = 'Disponible';
                cacheElement.className = 'text-success';
            } else {
                cacheElement.textContent = 'Indisponible';
                cacheElement.className = 'text-warning';
            }
        }

        // Informations de stockage
        const storageInfo = await this.getStorageInfo();
        const storageElement = document.getElementById('storageInfo');
        if (storageElement) {
            storageElement.textContent = storageInfo;
        }

        // Dernière mise à jour - ne pas afficher d'info approximative
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = '-';
        }
    }

    /**
     * Configure la gestion avancée du cache
     */
    setupAdvancedCacheManagement() {
        const clearCachesBtn = document.getElementById('clear-caches-btn');
        if (clearCachesBtn) {
            clearCachesBtn.addEventListener('click', () => this.clearPwaCaches());
        }

        const showCachedFilesBtn = document.getElementById('show-cached-files-btn');
        if (showCachedFilesBtn) {
            showCachedFilesBtn.addEventListener('click', () => this.displayCachedFiles());
        }
    }

    /**
     * Efface tous les caches PWA de l'application
     */
    async clearPwaCaches() {
        if (!confirm("Êtes-vous sûr de vouloir supprimer tous les caches de l'application ?\n\nCette action est irréversible et forcera le re-téléchargement de tous les fichiers au prochain chargement.")) {
            return;
        }

        const clearBtn = document.getElementById('clear-caches-btn');
        clearBtn.disabled = true;
        clearBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Effacement en cours...';

        try {
            const keys = await caches.keys();
            const ratchouKeys = keys.filter(key => key.startsWith('ratchou-'));

            if (ratchouKeys.length === 0) {
                this.showPWANotification('Aucun cache à effacer.', 'info');
                return;
            }

            await Promise.all(ratchouKeys.map(key => caches.delete(key)));

            this.showPWANotification('Tous les caches ont été effacés avec succès. Veuillez recharger la page.', 'success', true);

            // Mise à jour de l'affichage
            await this.updateSystemInfo();

        } catch (error) {
            console.error('Erreur lors de l\'effacement des caches :', error);
            this.showPWANotification('Erreur lors de l\'effacement des caches.', 'danger');
        } finally {
            clearBtn.disabled = false;
            clearBtn.innerHTML = '<i class="bi bi-trash"></i> Forcer l\'effacement de tous les caches';
        }
    }

    /**
     * Affiche les fichiers contenus dans les caches PWA
     */
    async displayCachedFiles() {
        const container = document.getElementById('cached-files-container');
        if (!container) return;

        const showBtn = document.getElementById('show-cached-files-btn');
        showBtn.disabled = true;
        showBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Lecture...';

        try {
            const keys = await caches.keys();
            const ratchouKeys = keys.filter(key => key.startsWith('ratchou-'));

            if (ratchouKeys.length === 0) {
                container.innerHTML = '<p class="text-muted">Aucun cache trouvé.</p>';
                return;
            }

            let html = '';
            for (const key of ratchouKeys) {
                const cache = await caches.open(key);
                const requests = await cache.keys();

                html += `
                    <h6 class="mt-3">${key} (${requests.length} fichiers)</h6>
                    <ul class="list-group list-group-sm">
                `;

                if (requests.length === 0) {
                    html += '<li class="list-group-item">Ce cache est vide.</li>';
                } else {
                    for (const request of requests) {
                        const response = await cache.match(request);
                        const date = response ? this.formatDate(response.headers.get('date')) : 'N/A';
                        html += `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                <span>${new URL(request.url).pathname}</span>
                                <span class="badge bg-secondary">${date}</span>
                            </li>
                        `;
                    }
                }
                html += '</ul>';
            }
            container.innerHTML = html;

        } catch (error) {
            console.error('Erreur lors de la lecture des fichiers en cache :', error);
            container.innerHTML = '<div class="alert alert-danger">Erreur lors de la lecture des caches.</div>';
        } finally {
            showBtn.disabled = false;
            showBtn.innerHTML = '<i class="bi bi-list-ul"></i> Lister les fichiers en cache';
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }



    /**
     * Configure la section d'installation selon la plateforme
     */
    setupInstallSection() {
        const installContent = document.getElementById('installContent');
        const installCard = document.getElementById('installCard');

        if (!installContent) return;

        if (this.isStandalone) {
            // Déjà installé - afficher dans la zone de notification dédiée
            this.showPWANotification('✅ Application déjà installée ! Ratchou fonctionne en mode PWA avec toutes les fonctionnalités natives.', 'success');

            installCard.className = 'card mb-4';
            installCard.querySelector('.card-header').className = 'card-header bg-success text-white';
            installCard.querySelector('h5').innerHTML = '✅ Installation PWA';

            installContent.innerHTML = `
                <p class="text-success mb-3">
                    <strong>🎉 Félicitations !</strong> L'application est correctement installée en mode PWA.
                </p>
                <div class="text-center">
                    <button class="btn btn-outline-primary" onclick="window.pwaPageInstance?.checkForUpdates()">
                        🔄 Vérifier les mises à jour
                    </button>
                </div>
            `;
        } else {
            // Pas encore installé
            this.generateInstallInstructions(installContent);
        }
    }

    /**
     * Génère les instructions d'installation selon la plateforme
     */
    generateInstallInstructions(container) {
        let content = '';

        switch (this.platform.installMethod) {
            case 'ios-safari':
                // Afficher les infos dans la zone de notification dédiée
                this.showPWANotification('🍎 Installation iOS : Vous devez utiliser Safari pour installer l\'application. Cliquez sur le guide pour les étapes détaillées.', 'warning');

                content = `
                    <p class="text-warning mb-3">
                        <strong>🍎 Installation iOS</strong><br>
                        Utilisation de Safari requise pour l'installation.
                    </p>
                    <div class="text-center">
                        <button class="btn btn-primary" onclick="document.getElementById('iosGuide').classList.remove('d-none')">
                            📱 Voir le guide d'installation iOS
                        </button>
                    </div>
                `;
                break;

            case 'android-chrome':
                // Afficher les infos dans la zone de notification dédiée
                this.showPWANotification('📱 Installation Android : Chrome peut proposer automatiquement l\'installation, ou utilisez le menu ⋮ > "Installer l\'application".', 'info');

                content = `
                    <p class="text-info mb-3">
                        <strong>📱 Installation Android</strong><br>
                        Chrome devrait proposer automatiquement l'installation.
                    </p>
                    <div class="text-center" id="androidInstallButton">
                        <!-- Le bouton d'installation sera ajouté par JavaScript si disponible -->
                        ${this.generateInstallDiagnosticHTML()}
                    </div>
                `;
                break;

            case 'desktop-browser':
                // Afficher les infos dans la zone de notification dédiée
                this.showPWANotification('🖥️ Installation disponible : Recherchez l\'icône d\'installation dans la barre d\'adresse ou le menu de votre navigateur.', 'info');

                content = `
                    <p class="text-info mb-3">
                        <strong>💻 Installation bureau</strong><br>
                        La plupart des navigateurs modernes supportent l'installation PWA.
                    </p>
                    <div class="text-center" id="desktopInstallButton">
                        <!-- Le bouton d'installation sera ajouté par JavaScript si disponible -->
                        ${this.generateInstallDiagnosticHTML()}
                    </div>
                `;
                break;

            default:
                // Afficher les infos dans la zone de notification dédiée
                this.showPWANotification('ℹ️ L\'installation automatique n\'est pas disponible sur cette plateforme.', 'secondary');

                content = `
                    <p class="text-muted mb-3">
                        <strong>ℹ️ Installation PWA</strong><br>
                        Plateforme non reconnue pour l'installation automatique.
                    </p>
                `;
        }

        container.innerHTML = content;

        // Essayer d'ajouter le bouton d'installation natif si disponible
        this.tryAddNativeInstallButton();
    }

    /**
     * Essaie d'ajouter le bouton d'installation natif avec retry logic
     */
    tryAddNativeInstallButton() {
        console.log('[PWA Debug] tryAddNativeInstallButton called');
        console.log('[PWA Debug] window.pwaInstaller:', !!window.pwaInstaller);
        console.log('[PWA Debug] deferredPrompt:', window.pwaInstaller?.deferredPrompt || 'not available');

        // Vérifier si PWAInstaller est disponible avec deferredPrompt
        if (window.pwaInstaller && window.pwaInstaller.deferredPrompt) {
            const buttonContainer = document.getElementById('androidInstallButton') ||
                                  document.getElementById('desktopInstallButton');

            if (buttonContainer) {
                console.log('[PWA Debug] Adding native install button');
                buttonContainer.innerHTML = `
                    <button class="btn btn-success" onclick="window.pwaInstaller.showInstallPrompt()">
                        📥 Installer Ratchou
                    </button>
                `;
                this.showPWANotification('📥 Installation PWA disponible ! Cliquez sur le bouton vert pour installer.', 'success');
            }
        } else {
            // Retry après quelques secondes si pas encore disponible
            console.log('[PWA Debug] Native install not ready, scheduling retry...');
            this.scheduleInstallButtonRetry();
        }
    }

    /**
     * Programme des tentatives périodiques pour le bouton d'installation
     */
    scheduleInstallButtonRetry() {
        let retryCount = 0;
        const maxRetries = 15; // 15 secondes max

        const retryInterval = setInterval(() => {
            retryCount++;
            console.log(`[PWA Debug] Install button retry ${retryCount}/${maxRetries}`);

            if (window.pwaInstaller && window.pwaInstaller.deferredPrompt) {
                console.log('[PWA Debug] deferredPrompt now available, adding button');
                clearInterval(retryInterval);
                this.tryAddNativeInstallButton();
            } else if (retryCount >= maxRetries) {
                console.log('[PWA Debug] Max retries reached, stopping');
                clearInterval(retryInterval);
                // Afficher un message d'info que l'installation automatique n'est pas disponible
                this.showPWANotification('ℹ️ Installation automatique non disponible. Utilisez le menu du navigateur.', 'info');
            }
        }, 1000);
    }

    /**
     * Gère l'affichage du guide iOS
     */
    handleiOSGuide() {
        if (this.platform.installMethod === 'ios-safari' && !this.isStandalone) {
            // Le guide iOS est déjà présent dans le HTML, on peut l'afficher directement
            // ou le laisser masqué jusqu'au clic sur le bouton
        }
    }

    /**
     * Méthode utilitaire pour vérifier les mises à jour
     */
    async checkForUpdates() {
        if (window.pwaInstaller) {
            this.showPWANotification('Vérification des mises à jour en cours...', 'info');
            await window.pwaInstaller.checkForUpdates();
            this.showPWANotification('Vérification des mises à jour terminée', 'success');
        } else {
            this.showPWANotification('Vérification des mises à jour non disponible', 'warning');
        }
    }

    /**
     * Affiche une notification dans la zone PWA dédiée
     */
    showPWANotification(message, type = 'info', persistent = false) {
        const notificationDiv = document.getElementById('pwaNotification');
        const notificationText = document.getElementById('pwaNotificationText');

        if (!notificationDiv || !notificationText) return;

        // Mettre à jour le contenu
        notificationText.textContent = message;

        // Appliquer les classes Bootstrap selon le type
        let alertClass = 'alert';
        switch(type) {
            case 'success':
                alertClass += ' alert-success';
                break;
            case 'warning':
                alertClass += ' alert-warning';
                break;
            case 'secondary':
                alertClass += ' alert-secondary';
                break;
            case 'info':
            default:
                alertClass += ' alert-info';
                break;
        }

        notificationDiv.className = `${alertClass} mb-4`;

        // Auto-masquer après 8 secondes pour les messages temporaires
        if (!persistent && (type === 'info' && !message.includes('installée'))) {
            setTimeout(() => {
                notificationDiv.classList.add('d-none');
            }, 8000);
        }
        // Les messages de succès "installée" et warning restent visibles
    }

    /**
     * Masque la notification PWA
     */
    hidePWANotification() {
        const notificationDiv = document.getElementById('pwaNotification');
        if (notificationDiv) {
            notificationDiv.classList.add('d-none');
        }
    }

    /**
     * Génère le HTML de diagnostic d'installation
     */
    generateInstallDiagnosticHTML() {
        const diagnostic = this.getPWAInstallDiagnostic();

        if (diagnostic.reasons.length === 0) {
            // Pas de problème spécifique détecté
            return `
                <button class="btn btn-outline-secondary">
                    🔍 Installation automatique non disponible actuellement
                </button>
            `;
        }

        // Construire l'affichage du diagnostic avec un style inline
        let html = `
            <div class="border-start border-warning border-3 ps-3 mb-3">
                <h6 class="text-warning mb-2">🔍 Diagnostic d'installation :</h6>
                <ul class="list-unstyled small text-muted mb-0">
        `;

        diagnostic.reasons.forEach(reason => {
            html += `<li class="mb-1">• ${reason}</li>`;
        });

        html += `</ul></div>`;

        if (diagnostic.suggestions.length > 0) {
            html += `
                <div class="border-start border-info border-3 ps-3 mb-3">
                    <h6 class="text-info mb-2">💡 Suggestions :</h6>
                    <ul class="list-unstyled small text-muted mb-0">
            `;

            diagnostic.suggestions.forEach(suggestion => {
                html += `<li class="mb-1">• ${suggestion}</li>`;
            });

            html += `</ul></div>`;
        }

        return html;
    }
}

// Export de la classe pour utilisation globale
window.PWAPage = PWAPage;