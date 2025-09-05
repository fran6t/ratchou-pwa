/**
 * Settings Page Controller for Ratchou IndexedDB
 * Handles the settings/parameters page with all app information
 */

class SettingsController {
    constructor() {
        this.isInitialized = false;
        this.loadingOverlay = null;
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
    }

    /**
     * Setup resource buttons (website, help, share)
     */
    setupResourceButtons() {
        // Website button
        const websiteBtn = document.getElementById('websiteBtn');
        if (websiteBtn) {
            websiteBtn.addEventListener('click', this.openWebsite.bind(this));
        }

        // Help button
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', this.showHelp.bind(this));
        }

        // Share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', this.shareApp.bind(this));
        }
    }

    /**
     * Open website link
     */
    openWebsite() {
        // TODO: Replace with actual website URL
        this.showAlert('Site web - URL à configurer', 'info');
    }

    /**
     * Show help information
     */
    showHelp() {
        const helpText = `
📖 Aide Ratchou v2.0

🏠 Navigation :
• Footer fixe : 4 boutons de navigation rapide
• Menu hamburger : Accès à toutes les fonctions
• Retour logo : Toujours vers le tableau de bord

💰 Gestion :
• Comptes : Créer et gérer plusieurs comptes
• Mouvements : Ajouter recettes/dépenses
• Catégories : Organiser vos transactions
• Récurrents : Automatiser les dépenses fixes

📊 Outils :
• Projection : Visualiser vos finances futures
• Export : Sauvegarder vos données
• Import : Restaurer depuis une sauvegarde

🔒 Sécurité :
• Données 100% locales (IndexedDB)
• Code d'accès simple mais efficace
• Aucune transmission externe
        `;
        
        this.showAlert(helpText.trim(), 'info');
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