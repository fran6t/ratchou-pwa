import { importData, exportDataWithFormat } from '../components/import-export.js';

class MainController {
    constructor() {
        // Containers
        this.loginContainer = document.getElementById('login-container');
        this.setupContainer = document.getElementById('setup-container');
        this.statusContainer = document.getElementById('status-container');

        // Login Form
        this.loginForm = document.getElementById('loginForm');
        this.accessCodeLoginInput = document.getElementById('accessCodeLogin');
        this.showSetupBtn = document.getElementById('showSetupBtn');
        this.loginError = document.getElementById('loginError');

        // Setup Form
        this.setupForm = document.getElementById('setupForm');
        this.accessCodeSetupInput = document.getElementById('accessCodeSetup');
        this.deviceIdInput = document.getElementById('deviceId');
        this.hasRestoreFileCheckbox = document.getElementById('hasRestoreFile');
        this.restoreFileContainer = document.getElementById('restoreFileContainer');
        this.importFileInput = document.getElementById('importFile');
        this.setupExecuteBtn = document.getElementById('setupExecuteBtn');
        this.showLoginBtn = document.getElementById('showLoginBtn');
        this.setupError = document.getElementById('setupError');
        
        // Status Area
        this.progressBar = this.statusContainer.querySelector('.progress-bar');
        this.statusMessage = document.getElementById('status-message');
        this.continueBtn = document.getElementById('continueBtn');
    }

    async init() {
        this.setupEventListeners();

        try {
            const databases = await indexedDB.databases();
            const dbExists = databases.some(db => db.name === 'ratchou');

            if (dbExists) {
                await window.ratchouApp.initialize();
                this.showLogin();
                // Display appropriate disclaimer based on usage count
                this.updateDisclaimerDisplay();
            } else {
                this.showSetup();
            }
        } catch (error) {
            // Fallback for browsers that don't support indexedDB.databases()
            console.warn("Could not check for existing databases, using fallback logic.");
            try {
                await window.ratchouApp.initialize();
                const userExists = await ratchouApp.auth.checkUserExists();
                if (userExists) {
                    this.showLogin();
                    // Display appropriate disclaimer based on usage count
                    this.updateDisclaimerDisplay();
                } else {
                    this.showSetup();
                }
            } catch (initError) {
                this.showError('setup', 'Erreur critique: Impossible d\'initialiser l\'application.');
            }
        }
    }

    setupEventListeners() {
        this.showSetupBtn.addEventListener('click', () => this.showSetup(true));
        this.showLoginBtn.addEventListener('click', () => this.showLogin());
        this.setupForm.addEventListener('submit', e => {
            e.preventDefault();
            this.handleSetup();
        });
        this.loginForm.addEventListener('submit', e => {
            e.preventDefault();
            this.handleLogin();
        });
        this.continueBtn.addEventListener('click', () => {
            window.location.replace('dashboard.html');
        });
        
        // Toggle restore file input
        this.hasRestoreFileCheckbox.addEventListener('change', () => {
            this.toggleRestoreFileInput();
        });
        
        // Auto-login when 4 digits are entered
        this.accessCodeLoginInput.addEventListener('input', () => {
            const code = this.accessCodeLoginInput.value;
            if (code.length === 4 && /^\d{4}$/.test(code)) {
                // Small delay to allow user to see the input
                setTimeout(() => this.handleLogin(), 300);
            }
        });
        
        // Auto-focus to device name when 4 digits are entered in setup
        this.accessCodeSetupInput.addEventListener('input', () => {
            const code = this.accessCodeSetupInput.value;
            if (code.length === 4 && /^\d{4}$/.test(code)) {
                // Move focus to device input
                this.deviceIdInput.focus();
            }
        });
    }

    showLogin() {
        this.setupContainer.classList.add('container-hidden');
        this.loginContainer.classList.remove('container-hidden');
        this.statusContainer.classList.add('container-hidden');
        this.showLoginBtn.classList.add('container-hidden');
        this.accessCodeLoginInput.focus();
    }

    showSetup(isRestore = false) {
        this.loginContainer.classList.add('container-hidden');
        this.setupContainer.classList.remove('container-hidden');
        this.statusContainer.classList.add('container-hidden');
        if (isRestore) {
            this.showLoginBtn.classList.remove('container-hidden');
        } else {
            this.showLoginBtn.classList.add('container-hidden');
        }
        this.accessCodeSetupInput.focus();
    }

    showError(form, message) {
        const errorEl = form === 'login' ? this.loginError : this.setupError;
        errorEl.textContent = message;
        errorEl.classList.remove('d-none');
    }

    hideErrors() {
        this.loginError.classList.add('d-none');
        this.setupError.classList.add('d-none');
    }
    
    updateProgress(percent, message) {
        this.statusContainer.classList.remove('container-hidden');
        this.progressBar.style.width = `${percent}%`;
        this.statusMessage.textContent = message;
    }

    toggleRestoreFileInput() {
        if (this.hasRestoreFileCheckbox.checked) {
            this.restoreFileContainer.classList.remove('d-none');
        } else {
            this.restoreFileContainer.classList.add('d-none');
            // Clear the file input when hiding
            this.importFileInput.value = '';
        }
    }

    async handleLogin() {
        this.hideErrors();
        const accessCode = this.accessCodeLoginInput.value;
        if (!/^\d{4}$/.test(accessCode)) {
            this.showError('login', 'Le code doit contenir 4 chiffres.');
            return;
        }
        
        // Show loading state on button
        const loginBtn = document.getElementById('loginBtn');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Connexion...';
        loginBtn.disabled = true;
        
        try {
            const result = await ratchouApp.login(accessCode);
            if (result.success) {
                // Increment usage count on successful login
                this.incrementUsageCount();

                // Check backup status before redirecting
                this.checkBackupStatusAfterLogin();
            } else {
                this.showError('login', 'Code d\'accès incorrect.');
                this.accessCodeLoginInput.value = '';
                this.accessCodeLoginInput.focus();
            }
        } finally {
            // Reset button state
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }

    async handleSetup() {
        this.hideErrors();
        const accessCode = this.accessCodeSetupInput.value;
        const deviceId = this.deviceIdInput.value.trim();
        const file = this.importFileInput.files[0];

        if (!/^\d{4}$/.test(accessCode)) {
            this.showError('setup', 'Le code d\'accès doit faire 4 chiffres.');
            return;
        }
        if (!deviceId) {
            this.showError('setup', 'Le nom de l\'appareil est requis.');
            return;
        }

        try {
            // Hide form and show progress
            this.setupContainer.classList.add('container-hidden');
            this.updateProgress(5, 'Préparation...');

            // --- CRITICAL STEP ---
            // Set the device ID in storage so all subsequent DB operations can use it.
            RatchouUtils.device.setDeviceId(deviceId);

            await window.ratchouApp.initialize({ skipDefaults: true });

            if (file) {
                const result = await importData(file, (p, m) => this.updateProgress(p, m), deviceId, accessCode);
                if (!result.success) throw new Error(result.message);
            } else {
                this.updateProgress(20, 'Création du nouvel utilisateur...');
                await window.ratchouApp.db.put('UTILISATEUR', { code_acces: accessCode, device_id: deviceId });
                this.updateProgress(50, 'Création des données par défaut...');
                await window.ratchouApp.initializeWithDefaults();
            }

            // Automatically log in to create the session
            this.updateProgress(95, 'Création de la session...');
            const loginResult = await ratchouApp.login(accessCode);
            if (!loginResult.success) {
                throw new Error("Impossible de créer la session après la configuration.");
            }

            this.updateProgress(100, 'Configuration terminée !');
            this.progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
            this.progressBar.classList.add('bg-success');
            
            // Show the continue button
            this.continueBtn.classList.remove('container-hidden');

        } catch (error) {
            this.showError('setup', `Erreur: ${error.message}`);
            this.showSetup(true); // Re-show setup form on error
        }
    }

    /**
     * Check backup status after successful login and show reminder if needed
     */
    checkBackupStatusAfterLogin() {
        try {
            // Check if backup reminder is available
            if (!window.backupReminder) {
                console.warn('Backup reminder not available, redirecting to dashboard');
                window.location.replace('dashboard.html');
                return;
            }

            const alertInfo = window.backupReminder.checkBackupStatus();
            
            if (alertInfo) {
                // Hide login form and show backup reminder
                this.loginContainer.classList.add('container-hidden');
                this.setupContainer.classList.add('container-hidden');
                
                // Create a simple container for the alert
                const alertContainer = document.createElement('div');
                alertContainer.className = 'container mt-4';
                alertContainer.innerHTML = `
                    <div class="row justify-content-center">
                        <div class="col-md-8">
                            <div class="text-center mb-3">
                                <h4>Connexion réussie</h4>
                                <p class="text-muted">Vérification de la sauvegarde...</p>
                            </div>
                        </div>
                    </div>
                `;
                
                // Insert after the main card
                const mainCard = document.querySelector('.main-card');
                mainCard.parentNode.insertBefore(alertContainer, mainCard.nextSibling);
                
                // Show backup reminder with auto-redirect
                window.backupReminder.showBackupReminder(
                    alertContainer,
                    alertInfo,
                    async () => {
                        try {
                            await exportDataWithFormat('zip');
                            // Redirect after successful export
                            setTimeout(() => {
                                window.location.replace('dashboard.html');
                            }, 1500);
                        } catch (error) {
                            console.error('Export error:', error);
                            // Redirect anyway after error
                            setTimeout(() => {
                                window.location.replace('dashboard.html');
                            }, 1000);
                        }
                    }
                );
                
                // Auto-redirect to dashboard after 15 seconds if no action
                setTimeout(() => {
                    window.location.replace('dashboard.html');
                }, 15000);
                
            } else {
                // No backup reminder needed, redirect directly
                window.location.replace('dashboard.html');
            }
            
        } catch (error) {
            console.error('Error checking backup status:', error);
            // Fallback: redirect to dashboard anyway
            window.location.replace('dashboard.html');
        }
    }

    /**
     * Get current usage count from localStorage
     */
    getUsageCount() {
        try {
            const count = localStorage.getItem('ratchou_usage_count');
            return count ? parseInt(count, 10) : 0;
        } catch (error) {
            console.error('Error reading usage count:', error);
            return 0;
        }
    }

    /**
     * Increment usage count and store in localStorage
     */
    incrementUsageCount() {
        try {
            const currentCount = this.getUsageCount();
            const newCount = currentCount + 1;
            localStorage.setItem('ratchou_usage_count', newCount.toString());
            console.log(`[Usage] Usage count incremented: ${newCount}`);
            return newCount;
        } catch (error) {
            console.error('Error incrementing usage count:', error);
            return 0;
        }
    }

    /**
     * Update disclaimer display based on usage count
     * - Usage < 3: Show private mode warning
     * - Usage % 10 === 0 and >= 10: Show export reminder
     * - Otherwise: Hide both
     */
    updateDisclaimerDisplay() {
        const usageCount = this.getUsageCount();
        const privateModeDisclaimer = document.getElementById('private-mode-disclaimer');
        const exportReminderDisclaimer = document.getElementById('export-reminder-disclaimer');

        if (!privateModeDisclaimer || !exportReminderDisclaimer) {
            console.warn('[Disclaimer] Disclaimer elements not found');
            return;
        }

        // Hide both initially
        privateModeDisclaimer.classList.add('d-none');
        exportReminderDisclaimer.classList.add('d-none');

        if (usageCount < 3) {
            // Show private mode warning for first 3 uses
            privateModeDisclaimer.classList.remove('d-none');
            console.log(`[Disclaimer] Showing private mode warning (usage: ${usageCount})`);
        } else if (usageCount >= 10 && usageCount % 10 === 0) {
            // Show export reminder every 10 uses (10, 20, 30, etc.)
            exportReminderDisclaimer.classList.remove('d-none');
            console.log(`[Disclaimer] Showing export reminder (usage: ${usageCount})`);
        } else {
            console.log(`[Disclaimer] No disclaimer shown (usage: ${usageCount})`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MainController().init();
});
