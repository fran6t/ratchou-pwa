/**
 * Export Page Controller for Ratchou IndexedDB
 * Handles the dedicated export page
 */

// Import the centralized export function
import { exportDataWithFormat } from '../components/import-export.js';

class ExportController {
    constructor() {
        this.isInitialized = false;
        this.loadingOverlay = null;
        this.exportedBlob = null;
        this.exportedFileName = null;
    }

    /**
     * Load all UI components
     */
    async loadComponents() {
        await ComponentLoader.loadHeader({ 
            title: '📤 Export des données',
            showAccountInfo: false,
            logoLink: '../dashboard.html'
        });
        await ComponentLoader.loadSidebar();
        await ComponentLoader.loadFixedFooter();
    }

    /**
     * Initialize the export page
     */
    async init() {
        try {
            console.log('Initializing export page...');
            
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
            this.hideLoadingOverlay();
            
            this.isInitialized = true;
            console.log('Export page initialized successfully');
            
        } catch (error) {
            console.error('Error initializing export page:', error);
            this.hideLoadingOverlay();
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.exportBtn = document.getElementById('exportBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.alertContainer = document.getElementById('alertContainer');
        this.exportContent = document.getElementById('exportContent');
        
        if (!this.exportContent) {
            console.error('Export: exportContent element not found');
            this.exportContent = document.querySelector('#exportContent');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', this.handleExport.bind(this));
        }
    }

    /**
     * Handle export button click
     */
    async handleExport() {
        if (!this.exportBtn) {
            console.error("Export: Required elements not found");
            return;
        }

        console.log('Export: Starting ZIP export process using centralized module');

        // Show progress
        this.showProgress();

        // Disable button
        this.exportBtn.disabled = true;
        this.exportBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Export en cours...`;

        try {
            // Call the centralized export function (always ZIP format)
            const result = await exportDataWithFormat('zip', (percent, message) => {
                this.updateProgress(percent, message);
            });

            if (result.success) {
                // Store blob and fileName for sharing
                this.exportedBlob = result.blob;
                this.exportedFileName = result.fileName;

                this.showSuccess(result.fileName);
                this.exportBtn.style.display = 'none';
                if (this.cancelBtn) {
                    this.cancelBtn.style.display = 'none';
                }
            } else {
                throw new Error(result.message || 'Erreur inconnue lors de l\'export');
            }

        } catch (error) {
            console.error('Export error:', error);
            this.showError(error.message);
            
            // Re-enable button for retry
            this.exportBtn.disabled = false;
            this.exportBtn.innerHTML = '💾 Réessayer';
        }
    }

    /**
     * Show progress
     */
    showProgress() {
        const progressDiv = document.getElementById('exportProgress');
        const resultDiv = document.getElementById('exportResult');
        
        if (progressDiv) progressDiv.style.display = 'block';
        if (resultDiv) resultDiv.style.display = 'none';
    }

    /**
     * Update progress
     */
    updateProgress(percent, message) {
        const progressText = document.getElementById('exportProgressText');
        const progressBar = document.getElementById('exportProgressBar');
        
        if (progressText) progressText.textContent = message;
        if (progressBar) progressBar.style.width = percent + '%';
    }

    /**
     * Show success message
     */
    showSuccess(fileName) {
        const progressDiv = document.getElementById('exportProgress');
        if (progressDiv) progressDiv.style.display = 'none';

        const modal = new bootstrap.Modal(document.getElementById('exportSuccessModal'));
        modal.show();

        this.initializeSuccessButton();
    }

    /**
     * Initialize success button to redirect to dashboard
     */
    initializeSuccessButton() {
        const successBtn = document.getElementById('exportSuccessBtn');
        if (successBtn) {
            successBtn.replaceWith(successBtn.cloneNode(true));
            const newSuccessBtn = document.getElementById('exportSuccessBtn');
            
            newSuccessBtn.addEventListener('click', () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('exportSuccessModal'));
                if (modal) {
                    modal.hide();
                }
                setTimeout(() => {
                    location.replace('../dashboard.html');
                }, 300);
            });
        }
    }


    /**
     * Show error message
     */
    showError(message) {
        const progressDiv = document.getElementById('exportProgress');
        const resultDiv = document.getElementById('exportResult');
        
        if (progressDiv) progressDiv.style.display = 'none';
        
        if (resultDiv) {
            result.className = 'alert alert-danger';
            resultDiv.innerHTML = `
                <h6>❌ Erreur d'export</h6>
                <p class="mb-0">${message}</p>
            `;
            resultDiv.style.display = 'block';
        }
    }


    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none !important';
            overlay.classList.add('d-none');
        }
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
        }
    }
}

// Initialize when DOM is ready
let exportController;

async function initializeExportPage() {
    try {
        // Wait for ratchouApp to be available
        if (typeof ratchouApp === 'undefined') {
            console.log('Waiting for ratchouApp...');
            setTimeout(initializeExportPage, 100);
            return;
        }

        // Initialize app if needed
        if (!ratchouApp.isInitialized) {
            await ratchouApp.initialize();
        }

        // Create and initialize controller
        exportController = new ExportController();
        await exportController.init();

    } catch (error) {
        console.error('Failed to initialize export page:', error);
        
        // Show basic error message
        const body = document.body;
        if (body) {
            body.innerHTML = `
                <div class="container mt-5">
                    <div class="alert alert-danger" role="alert">
                        <h4 class="alert-heading">Erreur d'initialisation</h4>
                        <p>Impossible de charger la page d'export.</p>
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

// Start initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeExportPage);