/**
 * Export Page Controller for Ratchou IndexedDB
 * Handles the dedicated export page
 */

class ExportController {
    constructor() {
        this.isInitialized = false;
        this.loadingOverlay = null;
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

        console.log('Export: Starting export process');
        
        // Get user choices
        const selectedFormat = document.querySelector('input[name="exportFormat"]:checked')?.value || 'zip';
        const selectedAction = document.querySelector('input[name="exportAction"]:checked')?.value || 'download';
        
        // Show progress
        this.showProgress();
        
        // Disable button
        this.exportBtn.disabled = true;
        this.exportBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Export en cours...`;

        try {
            let result;
            
            if (selectedFormat === 'zip') {
                result = await this.exportAsZip((percent, message) => {
                    this.updateProgress(percent, message);
                });
            } else {
                result = await this.exportAsJSON((percent, message) => {
                    this.updateProgress(percent, message);
                });
            }
            
            if (result.success) {
                // Show success
                // Show success modal
                this.showSuccess(result.fileName, selectedFormat);
                
                // Hide buttons since operation is complete
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
     * Export as ZIP format
     */
    async exportAsZip(onProgress) {
        try {
            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip n\'est pas chargé. Veuillez recharger la page.');
            }
            
            if (onProgress) onProgress(10, 'Collecte des données...');
            
            // Get export data
            const exportData = await window.ratchouApp.exportToJSON();
            
            if (onProgress) onProgress(30, 'Création de l\'archive ZIP...');
            
            // Create ZIP
            const zip = new JSZip();
            zip.file('ratchou-export.json', JSON.stringify(exportData, null, 2));
            
            // Add README
            const readmeContent = this.generateReadmeContent();
            zip.file('README.txt', readmeContent);
            
            if (onProgress) onProgress(60, 'Compression en cours...');
            
            // Generate ZIP with progress callback
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 9 }
            }, (metadata) => {
                if (onProgress) {
                    const progress = 60 + (metadata.percent * 0.3);
                    onProgress(Math.round(progress), 'Compression...');
                }
            });
            
            if (onProgress) onProgress(95, 'Préparation du téléchargement...');
            
            // Generate filename and download
            const fileName = this.generateExportFilename().replace('.json', '.zip');
            this.downloadFile(zipBlob, fileName);
            
            if (onProgress) onProgress(100, 'Export terminé !');
            
            // Record in metadata
            this.recordExportInMetadata();
            
            return { 
                success: true, 
                fileName, 
                file: new File([zipBlob], fileName, { type: 'application/zip' })
            };
            
        } catch (error) {
            console.error('ZIP export error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Export as JSON format
     */
    async exportAsJSON(onProgress) {
        try {
            if (onProgress) onProgress(20, 'Collecte des données...');
            
            // Get export data
            const exportData = await window.ratchouApp.exportToJSON();
            
            if (onProgress) onProgress(70, 'Création du fichier JSON...');
            
            // Create JSON blob
            const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            if (onProgress) onProgress(90, 'Préparation du téléchargement...');
            
            // Generate filename and download
            const fileName = this.generateExportFilename();
            this.downloadFile(jsonBlob, fileName);
            
            if (onProgress) onProgress(100, 'Export terminé !');
            
            // Record in metadata
            this.recordExportInMetadata();
            
            return { 
                success: true, 
                fileName,
                file: new File([jsonBlob], fileName, { type: 'application/json' })
            };
            
        } catch (error) {
            console.error('JSON export error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Download file helper
     */
    downloadFile(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate README content
     */
    generateReadmeContent() {
        return `# Export Ratchou

Date d'export : ${new Date().toLocaleString('fr-FR')}
Application : Ratchou - Gestion de Dépenses
Format : JSON compressé

## Contenu
- ratchou-export.json : Données complètes de l'application

## Utilisation
Pour restaurer ces données :
1. Ouvrir Ratchou sur le nouvel appareil
2. Menu > Paramètres > Importer des données  
3. Sélectionner ce fichier ZIP

## Support
Cette sauvegarde contient toutes vos données :
comptes, catégories, bénéficiaires, types de dépenses, 
transactions et dépenses récurrentes.
`;
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
    showSuccess(fileName, format) {
        const progressDiv = document.getElementById('exportProgress');
        if (progressDiv) progressDiv.style.display = 'none';
        
        // Update modal content
        const fileNameElement = document.getElementById('exportFileName');
        if (fileNameElement) {
            fileNameElement.textContent = fileName;
        }
        
        // Always show sharing options as they're useful for manual sharing too
        const sharingOptions = document.getElementById('sharingOptions');
        if (sharingOptions) {
            sharingOptions.style.display = 'block';
        }
        
        // Show the success modal
        const modal = new bootstrap.Modal(document.getElementById('exportSuccessModal'));
        modal.show();
        
        // Initialize success button to redirect to dashboard
        this.initializeSuccessButton();
        
        // Always initialize sharing buttons as they're useful
        this.initializeSharingButtons(fileName);
    }

    /**
     * Initialize success button to redirect to dashboard
     */
    initializeSuccessButton() {
        const successBtn = document.getElementById('exportSuccessBtn');
        if (successBtn) {
            // Remove existing event listeners by cloning the node
            successBtn.replaceWith(successBtn.cloneNode(true));
            const newSuccessBtn = document.getElementById('exportSuccessBtn');
            
            newSuccessBtn.addEventListener('click', () => {
                // Close modal first, then redirect
                const modal = bootstrap.Modal.getInstance(document.getElementById('exportSuccessModal'));
                if (modal) {
                    modal.hide();
                }
                
                // Use location.replace to avoid back button issues
                setTimeout(() => {
                    location.replace('../dashboard.html');
                }, 300); // Small delay to let modal close animation finish
            });
        }
    }

    /**
     * Initialize all sharing buttons in the success modal
     */
    initializeSharingButtons(fileName) {
        // Initialize Gmail button
        const gmailBtn = document.getElementById('shareViaGmailBtn');
        if (gmailBtn) {
            gmailBtn.replaceWith(gmailBtn.cloneNode(true));
            document.getElementById('shareViaGmailBtn').addEventListener('click', () => {
                this.shareViaGmail(fileName);
            });
        }

        // Initialize WhatsApp button  
        const whatsappBtn = document.getElementById('shareViaWhatsAppBtn');
        if (whatsappBtn) {
            whatsappBtn.replaceWith(whatsappBtn.cloneNode(true));
            document.getElementById('shareViaWhatsAppBtn').addEventListener('click', () => {
                this.shareViaWhatsApp(fileName);
            });
        }

        // Initialize Copy Instructions button
        const copyBtn = document.getElementById('copyInstructionsBtn');
        const copySuccess = document.getElementById('copySuccess');
        
        if (copyBtn) {
            copyBtn.replaceWith(copyBtn.cloneNode(true));
            const newCopyBtn = document.getElementById('copyInstructionsBtn');
            
            newCopyBtn.addEventListener('click', async () => {
                const instructions = this.generateImportInstructions(fileName);
                
                try {
                    await navigator.clipboard.writeText(instructions);
                    if (copySuccess) {
                        copySuccess.style.display = 'block';
                        setTimeout(() => {
                            if (copySuccess) copySuccess.style.display = 'none';
                        }, 3000);
                    }
                } catch (error) {
                    console.error('Clipboard failed:', error);
                    // Fallback: show instructions in alert
                    alert(`Instructions d'import:\n\n${instructions}`);
                }
            });
        }
    }

    /**
     * Generate import instructions text
     */
    generateImportInstructions(fileName) {
        return `📱 RATCHOU - Instructions d'importation

Bonjour ! Je vous envoie mes données Ratchou sauvegardées.

📄 Fichier joint : ${fileName}

🔧 Pour importer ces données :
1. Ouvrez Ratchou sur votre appareil
2. Allez dans le menu ☰ > Paramètres
3. Cliquez sur "Importer des données"
4. Sélectionnez le fichier joint
5. Confirmez l'importation

⚠️ ATTENTION : L'importation remplacera toutes vos données actuelles par celles de ce fichier.

ℹ️ Besoin d'aide ? Consultez la documentation dans l'application.`;
    }

    /**
     * Show error message
     */
    showError(message) {
        const progressDiv = document.getElementById('exportProgress');
        const resultDiv = document.getElementById('exportResult');
        
        if (progressDiv) progressDiv.style.display = 'none';
        
        if (resultDiv) {
            resultDiv.className = 'alert alert-danger';
            resultDiv.innerHTML = `
                <h6>❌ Erreur d'export</h6>
                <p class="mb-0">${message}</p>
            `;
            resultDiv.style.display = 'block';
        }
    }

    /**
     * Show share options
     */
    async showShareOptions(file, fileName) {
        try {
            // Try Web Share API first (mobile)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Export Ratchou',
                    text: 'Voici mes données Ratchou sauvegardées',
                    files: [file]
                });
                return;
            }
            
            // Fallback: show share options modal
            this.showShareOptionsModal(fileName);
            
        } catch (error) {
            console.log('Web Share failed, showing alternatives:', error);
            this.showShareOptionsModal(fileName);
        }
    }

    /**
     * Show share options modal for desktop
     */
    showShareOptionsModal(fileName) {
        const resultDiv = document.getElementById('exportResult');
        
        if (resultDiv) {
            resultDiv.innerHTML += `
                <div class="mt-3 p-3 bg-light border rounded">
                    <h6>📱 Options de partage</h6>
                    <p class="small text-muted mb-3">Choisissez comment partager votre fichier :</p>
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="exportController.shareViaGmail('${fileName}')">
                            📧 Partager par Gmail
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="exportController.shareViaWhatsApp('${fileName}')">
                            💬 Partager par WhatsApp
                        </button>
                        <button class="btn btn-outline-info btn-sm" onclick="exportController.copyShareInstructions('${fileName}')">
                            📋 Copier les instructions
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Share via Gmail
     */
    shareViaGmail(fileName) {
        const subject = encodeURIComponent('Export Ratchou - Mes données financières');
        const body = encodeURIComponent(`Bonjour,

Je t'envoie mes données Ratchou en pièce jointe.

Fichier : ${fileName}

Pour importer ces données :
1. Ouvrir Ratchou sur ton appareil
2. Menu > Paramètres > Importer des données
3. Sélectionner le fichier joint

Cordialement`);
        
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    }

    /**
     * Share via WhatsApp
     */
    shareViaWhatsApp(fileName) {
        const message = encodeURIComponent(`📦 Export Ratchou
        
J'ai exporté mes données Ratchou dans le fichier : ${fileName}

Pour les importer :
1. Ouvrir Ratchou
2. Menu > Paramètres > Importer
3. Sélectionner le fichier

Note : Le fichier doit être transféré séparément (email, drive, etc.)`);
        
        window.open(`https://wa.me/?text=${message}`, '_blank');
    }

    /**
     * Copy share instructions
     */
    async copyShareInstructions(fileName) {
        const instructions = `📦 Export Ratchou

Fichier : ${fileName}

Pour importer ces données :
1. Ouvrir Ratchou sur le nouvel appareil
2. Menu > Paramètres > Importer des données
3. Sélectionner ce fichier

Remarque : Ce fichier contient toutes vos données financières (comptes, transactions, etc.)`;

        try {
            await navigator.clipboard.writeText(instructions);
            alert('Instructions copiées dans le presse-papiers !');
        } catch (error) {
            console.error('Clipboard error:', error);
            // Fallback: show instructions in alert
            alert(instructions);
        }
    }

    /**
     * Generate filename with format: ratchou-{device_id}-{aaammjjhhmm}.json
     */
    generateExportFilename() {
        let deviceId = 'unknown';
        try {
            deviceId = (window.RatchouUtils && window.RatchouUtils.device && window.RatchouUtils.device.getCurrentDeviceId()) || 'unknown';
        } catch (error) {
            console.warn('Impossible de récupérer l\'ID de l\'appareil:', error);
        }
        const now = new Date();
        const dateTime = RatchouUtils.date.toLocalFileName(now); // AAAMMJJHHMM in French local time
        return `ratchou-${deviceId}-${dateTime}.json`;
    }

    /**
     * Record export in backup metadata
     */
    recordExportInMetadata() {
        try {
            if (window.backupReminder) {
                window.backupReminder.recordExport();
                console.log('✅ Export enregistré dans les métadonnées de sauvegarde');
            } else {
                console.warn('⚠️ BackupReminder non disponible - tentative de création...');
                // Fallback: créer manuellement les métadonnées
                const metadata = JSON.parse(localStorage.getItem('ratchou_backup_metadata') || '{}');
                const now = Date.now();
                const updated = {
                    ...metadata,
                    lastExportDate: now,
                    exportCount: (metadata.exportCount || 0) + 1,
                    reminderSnoozedUntil: null
                };
                localStorage.setItem('ratchou_backup_metadata', JSON.stringify(updated));
                console.log('✅ Métadonnées de sauvegarde enregistrées manuellement');
            }
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement des métadonnées:', error);
        }
    }


    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
        // Aussi masquer par l'attribut style inline qui peut être défini dans le HTML
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