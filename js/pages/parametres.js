/**
 * Settings Page Controller for Ratchou IndexedDB
 * Handles the settings/parameters page with all app information
 */

class SettingsController {
    constructor() {
        this.isInitialized = false;
        this.loadingOverlay = null;

        // Easter egg state
        this.clickCount = 0;
        this.clickTimer = null;
        this.lastClickTime = 0;
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '⚙️ Paramètres',
            showAccountInfo: false,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadCommonModals();
        await ComponentLoader.loadFixedFooter();
    }

    /**
     * Initialize the settings page
     */
    async init() {
        try {
            console.log('Initializing settings page...');
            
            // Check authentication with guard system
            if (window.auth && typeof window.auth.guardPage === 'function') {
                if (!window.auth.guardPage('app')) {
                    return; // User was redirected, stop initialization
                }
            } else if (typeof ratchouApp !== 'undefined' && !ratchouApp.isAuthenticated()) {
                location.replace('../index.html');
                return;
            }
            
            // Load components first
            await this.loadComponents();
            
            // Initialize elements and events
            this.initializeElements();
            this.setupEventListeners();

            // Update version display
            await this.updateVersionDisplay();

            // Hide loading overlay
            this.hideLoading();
            
            this.isInitialized = true;
            console.log('Settings page initialized successfully');
            
        } catch (error) {
            console.error('Error initializing settings page:', error);
            this.showError('Erreur lors de l\'initialisation de la page des paramètres');
            this.hideLoading();
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Update current path in footer if needed
        const currentPath = window.location.pathname;
        if (currentPath.includes('/manage/')) {
            // Update all relative paths in the page for images, etc.
            const images = document.querySelectorAll('img[src^="../assets/"]');
            images.forEach(img => {
                // Paths are already correct in the HTML
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Resource buttons
        this.setupResourceButtons();

        // Theme management
        this.setupThemeControls();

        // Beta tester easter egg
        this.setupBetaTesterEasterEgg();
    }

    /**
     * Setup resource buttons (website, github, share)
     */
    setupResourceButtons() {
        // Website button
        const websiteBtn = document.getElementById('websiteBtn');
        if (websiteBtn) {
            websiteBtn.addEventListener('click', this.openWebsite.bind(this));
        }

        // GitHub button
        const githubBtn = document.getElementById('githubBtn');
        if (githubBtn) {
            githubBtn.addEventListener('click', this.openGitHub.bind(this));
        }

        // Share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', this.shareApp.bind(this));
        }
    }

    /**
     * Setup theme controls and sync with current theme
     */
    setupThemeControls() {
        // Get current theme preference
        const currentPreference = window.themeManager ? window.themeManager.getUserPreference() : 'auto';

        // Set the radio button based on current preference
        const themeRadio = document.querySelector(`input[name="theme-options"][value="${currentPreference}"]`);
        if (themeRadio) {
            themeRadio.checked = true;
        }

        // Add event listeners to theme radio buttons
        const themeRadios = document.querySelectorAll('input[name="theme-options"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked && window.themeManager) {
                    window.themeManager.setTheme(e.target.value);
                    this.showSuccess(`Thème "${this.getThemeDisplayName(e.target.value)}" appliqué avec succès !`);
                }
            });
        });
    }

    /**
     * Get display name for theme value
     */
    getThemeDisplayName(theme) {
        switch (theme) {
            case 'auto': return 'Automatique';
            case 'light': return 'Clair';
            case 'dark': return 'Sombre';
            default: return theme;
        }
    }

    /**
     * Setup easter egg for beta tester mode
     * 4 rapid clicks on version text activates/deactivates beta mode
     */
    setupBetaTesterEasterEgg() {
        const versionElement = document.getElementById('app-version-display');
        if (!versionElement) {
            console.warn('Version element not found for easter egg');
            return;
        }

        versionElement.style.cursor = 'pointer';
        versionElement.style.userSelect = 'none';

        versionElement.addEventListener('click', (e) => {
            const now = Date.now();
            const timeSinceLastClick = now - this.lastClickTime;

            // Reset si plus d'1 seconde depuis le dernier clic
            if (timeSinceLastClick > 1000) {
                this.clickCount = 0;
            }

            this.clickCount++;
            this.lastClickTime = now;

            // Animation visuelle de feedback
            versionElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                versionElement.style.transform = 'scale(1)';
            }, 100);

            // Si 4 clics rapides
            if (this.clickCount >= 4) {
                this.toggleBetaTesterMode();
                this.clickCount = 0;
            }

            // Reset après 1 seconde d'inactivité
            clearTimeout(this.clickTimer);
            this.clickTimer = setTimeout(() => {
                this.clickCount = 0;
            }, 1000);
        });

        console.log('Beta tester easter egg initialized');
    }

    /**
     * Toggle beta tester mode on/off
     */
    toggleBetaTesterMode() {
        if (typeof RatchouUtils === 'undefined' || !RatchouUtils.featureFlags) {
            console.error('RatchouUtils.featureFlags not available');
            return;
        }

        const newState = RatchouUtils.featureFlags.toggle(
            RatchouUtils.featureFlags.FLAGS.BETA_TESTER_MODE
        );

        // Vibration si supportée
        if ('vibrate' in navigator) {
            navigator.vibrate(200);
        }

        // Afficher toast avec le nouvel état
        const message = newState
            ? '🚀 Mode bêta-testeur activé !'
            : '✅ Mode bêta-testeur désactivé';

        RatchouUtils.ui.toast(message, newState ? 'info' : 'success', 3000);

        // Mettre à jour l'affichage du badge immédiatement
        this.updateVersionDisplay();

        console.log(`Beta tester mode: ${newState ? 'ON' : 'OFF'}`);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (typeof RatchouUtils !== 'undefined' && RatchouUtils.ui) {
            RatchouUtils.ui.toast(message, 'success');
        } else {
            console.log('Success:', message);
        }
    }

    /**
     * Open website link
     */
    openWebsite() {
        window.open('https://www.ratchou.fr', '_blank');
    }

    /**
     * Open GitHub repository
     */
    openGitHub() {
        window.open('https://github.com/fran6t/ratchou-pwa', '_blank');
    }

    /**
     * Share the app
     */
    async shareApp() {
        const shareData = {
            title: 'Ratchou - Gestion familiale des dépenses',
            text: 'Une super app pour gérer ses dépenses en famille, 100% privée et offline !',
            url: window.location.origin
        };

        // Use Web Share API if available
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                    this.fallbackShare(shareData);
                }
            }
        } else {
            this.fallbackShare(shareData);
        }
    }

    /**
     * Fallback share method
     */
    fallbackShare(shareData) {
        const shareText = `${shareData.title} : ${shareData.url}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                this.showAlert('Lien copié dans le presse-papier !', 'success');
            }).catch(() => {
                this.showAlert(`Recommandez Ratchou : ${shareText}`, 'info');
            });
        } else {
            this.showAlert(`Recommandez Ratchou : ${shareText}`, 'info');
        }
    }


    /**
     * Return to dashboard
     */
    returnToDashboard() {
        location.replace('../dashboard.html');
    }

    /**
     * Update version display with version from Service Worker and environment info
     */
    async updateVersionDisplay() {
        try {
            const versionElement = document.getElementById('app-version-display');
            if (!versionElement) {
                console.warn('Version display element not found');
                return;
            }

            // Get version info with environment
            const versionInfo = await RatchouUtils.version.getVersionWithEnvironment();

            // Check if beta tester mode is enabled
            const isBetaMode = RatchouUtils.featureFlags &&
                RatchouUtils.featureFlags.isEnabled(
                    RatchouUtils.featureFlags.FLAGS.BETA_TESTER_MODE
                );

            // Create version display with badges
            const envBadgeClass = `badge bg-${versionInfo.environment.color}`;
            const betaBadge = isBetaMode
                ? '<span class="badge bg-info badge-beta ms-2">BETA</span>'
                : '';

            const versionHTML = `
                Ratchou v${versionInfo.version}
                <span class="${envBadgeClass} ms-2">${versionInfo.environment.name}</span>${betaBadge}
            `;

            versionElement.innerHTML = versionHTML;
            console.log(`Version display updated: ${versionInfo.fullVersion}${isBetaMode ? ' [BETA MODE]' : ''}`);

        } catch (error) {
            console.error('Error updating version display:', error);
            // Fallback display
            const versionElement = document.getElementById('app-version-display');
            if (versionElement) {
                versionElement.textContent = 'Ratchou v?.?.?';
            }
        }
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.setProperty('display', 'flex', 'important');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.setProperty('display', 'none', 'important');
        }
    }

    /**
     * Show alert message
     */
    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;

        const alertId = 'alert_' + Date.now();
        const alertHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert" id="${alertId}">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        alertContainer.insertAdjacentHTML('beforeend', alertHTML);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showAlert(message, 'danger');
    }
}

// Initialize when DOM is ready
let settingsController;

async function initializeSettingsPage() {
    try {
        // Wait for ratchouApp to be available
        if (typeof ratchouApp === 'undefined') {
            console.log('Waiting for ratchouApp...');
            setTimeout(initializeSettingsPage, 100);
            return;
        }

        // Initialize app if needed
        if (!ratchouApp.isInitialized) {
            await ratchouApp.initialize();
        }

        // Create and initialize controller
        settingsController = new SettingsController();
        await settingsController.init();

    } catch (error) {
        console.error('Failed to initialize settings page:', error);
        
        // Show basic error message
        const body = document.body;
        if (body) {
            body.innerHTML = `
                <div class="container mt-5">
                    <div class="alert alert-danger" role="alert">
                        <h4 class="alert-heading">Erreur d'initialisation</h4>
                        <p>Impossible de charger la page des paramètres.</p>
                        <hr>
                        <p class="mb-0">
                            <a href="../dashboard.html" class="btn btn-primary">Retour au tableau de bord</a>
                        </p>
                    </div>
                </div>
            `;
        }
    }
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSettingsPage);
} else {
    initializeSettingsPage();
}

// Export for debugging
window.settingsController = () => settingsController;