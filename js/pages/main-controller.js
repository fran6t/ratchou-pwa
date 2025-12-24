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
        this.loginError = document.getElementById('loginError');
        this.loginResetCheckbox = document.getElementById('loginResetCheckbox');
        this.loginFileCheckbox = document.getElementById('loginFileCheckbox');
        this.loginFileContainer = document.getElementById('loginFileContainer');
        this.loginImportFile = document.getElementById('loginImportFile');
        this.loginSecurityCodeContainer = document.getElementById('loginSecurityCodeContainer');
        this.loginSecurityCode = document.getElementById('loginSecurityCode');
        this.loginWarning = document.getElementById('loginWarning');
        this.loginBtnText = document.getElementById('loginBtnText');

        // Setup Form
        this.setupForm = document.getElementById('setupForm');
        this.accessCodeSetupInput = document.getElementById('accessCodeSetup');
        this.deviceIdInput = document.getElementById('deviceId');
        this.setupFileCheckbox = document.getElementById('setupFileCheckbox');
        this.setupFileContainer = document.getElementById('setupFileContainer');
        this.setupImportFile = document.getElementById('setupImportFile');
        this.setupSecurityCodeContainer = document.getElementById('setupSecurityCodeContainer');
        this.setupSecurityCode = document.getElementById('setupSecurityCode');
        this.setupExecuteBtn = document.getElementById('setupExecuteBtn');
        this.showLoginBtn = document.getElementById('showLoginBtn');
        this.setupError = document.getElementById('setupError');

        // Status Area
        this.progressBar = this.statusContainer.querySelector('.progress-bar');
        this.statusMessage = document.getElementById('status-message');
        this.continueBtn = document.getElementById('continueBtn');
    }

    /**
     * Détecte automatiquement le type de fichier (pairing ou restauration)
     * @param {File} file - Fichier uploadé
     * @returns {Promise<'pairing'|'restore'|'unknown'>}
     */
    async detectFileType(file) {
        try {
            if (file.name.endsWith('.json')) {
                // Fichier JSON simple = restauration
                return 'restore';
            }

            if (file.name.endsWith('.zip')) {
                const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
                const zip = await JSZip.loadAsync(file);

                // Lire metadata.json
                const metadataFile = zip.file('metadata.json');
                if (!metadataFile) {
                    return 'unknown';
                }

                const metadata = JSON.parse(await metadataFile.async('text'));

                // Détecter si c'est un fichier d'appairage
                return metadata.isPairingFile ? 'pairing' : 'restore';
            }

            return 'unknown';
        } catch (error) {
            console.error('Erreur détection type fichier:', error);
            return 'unknown';
        }
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
        // Formulaires
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

        // === LOGIN CHECKBOXES ===

        // Toggle mutuel entre reset et fichier
        this.loginResetCheckbox.addEventListener('change', () => {
            if (this.loginResetCheckbox.checked) {
                this.loginFileCheckbox.checked = false;
            }
            this.toggleLoginOptions();
        });

        this.loginFileCheckbox.addEventListener('change', () => {
            if (this.loginFileCheckbox.checked) {
                this.loginResetCheckbox.checked = false;
            }
            this.toggleLoginOptions();
        });

        // Détection automatique du type de fichier login
        this.loginImportFile.addEventListener('change', async (e) => {
            await this.handleLoginFileSelection(e.target.files[0]);
        });

        // === SETUP CHECKBOX ===

        this.setupFileCheckbox.addEventListener('change', () => {
            this.toggleSetupFileInputs();
        });

        // Détection automatique du type de fichier setup
        this.setupImportFile.addEventListener('change', async (e) => {
            await this.handleSetupFileSelection(e.target.files[0]);
        });

        // === AUTO-LOGIN & AUTO-FOCUS ===

        // Auto-login désactivé si checkbox cochée
        this.accessCodeLoginInput.addEventListener('input', () => {
            const code = this.accessCodeLoginInput.value;
            const hasOptions = this.loginResetCheckbox.checked || this.loginFileCheckbox.checked;

            if (code.length === 4 && /^\d{4}$/.test(code) && !hasOptions) {
                setTimeout(() => this.handleLogin(), 300);
            }
        });

        // Auto-focus to device name when 4 digits are entered in setup
        this.accessCodeSetupInput.addEventListener('input', () => {
            const code = this.accessCodeSetupInput.value;
            if (code.length === 4 && /^\d{4}$/.test(code)) {
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

    /**
     * Gère la sélection de fichier dans le login avec détection automatique
     */
    async handleLoginFileSelection(file) {
        if (!file) {
            this.loginSecurityCodeContainer.classList.add('d-none');
            this.loginSecurityCode.value = '';
            return;
        }

        const fileType = await this.detectFileType(file);

        if (fileType === 'pairing') {
            // Afficher le champ code de sécurité
            this.loginSecurityCodeContainer.classList.remove('d-none');
            this.loginSecurityCode.focus();
        } else {
            // Masquer le champ code de sécurité
            this.loginSecurityCodeContainer.classList.add('d-none');
            this.loginSecurityCode.value = '';
        }
    }

    /**
     * Gère la sélection de fichier dans le setup avec détection automatique
     */
    async handleSetupFileSelection(file) {
        if (!file) {
            this.setupSecurityCodeContainer.classList.add('d-none');
            this.setupSecurityCode.value = '';
            return;
        }

        const fileType = await this.detectFileType(file);

        if (fileType === 'pairing') {
            this.setupSecurityCodeContainer.classList.remove('d-none');
            this.setupSecurityCode.focus();
        } else {
            this.setupSecurityCodeContainer.classList.add('d-none');
            this.setupSecurityCode.value = '';
        }
    }

    /**
     * Gère l'affichage des options de login selon les checkboxes
     */
    toggleLoginOptions() {
        const resetChecked = this.loginResetCheckbox.checked;
        const fileChecked = this.loginFileCheckbox.checked;
        const anyChecked = resetChecked || fileChecked;

        // Afficher input fichier si checkbox fichier cochée
        if (fileChecked) {
            this.loginFileContainer.classList.remove('d-none');
        } else {
            this.loginFileContainer.classList.add('d-none');
            this.loginImportFile.value = '';
            this.loginSecurityCodeContainer.classList.add('d-none');
            this.loginSecurityCode.value = '';
        }

        // Afficher avertissement si opération destructive
        if (anyChecked) {
            this.loginWarning.classList.remove('d-none');
        } else {
            this.loginWarning.classList.add('d-none');
        }

        // Adapter texte du bouton
        if (resetChecked) {
            this.loginBtnText.textContent = 'Réinitialiser';
        } else if (fileChecked) {
            this.loginBtnText.textContent = 'Restaurer / Installer';
        } else {
            this.loginBtnText.textContent = 'Se connecter';
        }
    }

    /**
     * Gère l'affichage des champs setup selon checkbox
     */
    toggleSetupFileInputs() {
        const fileChecked = this.setupFileCheckbox.checked;

        if (fileChecked) {
            this.setupFileContainer.classList.remove('d-none');
        } else {
            this.setupFileContainer.classList.add('d-none');
            this.setupImportFile.value = '';
            this.setupSecurityCodeContainer.classList.add('d-none');
            this.setupSecurityCode.value = '';
        }
    }

    /**
     * Valide le code d'accès sans créer de session
     */
    async validateAccessCode(accessCode) {
        try {
            const userData = await window.ratchouApp.db.get('UTILISATEUR', accessCode);
            return !!userData;
        } catch (error) {
            return false;
        }
    }

    /**
     * Gère le login avec routing selon les options sélectionnées
     */
    async handleLogin() {
        this.hideErrors();
        const accessCode = this.accessCodeLoginInput.value;

        // Validation code d'accès
        if (!/^\d{4}$/.test(accessCode)) {
            this.showError('login', 'Le code doit contenir 4 chiffres.');
            return;
        }

        try {
            // ÉTAPE 1 : Valider le code d'accès
            const isValid = await this.validateAccessCode(accessCode);
            if (!isValid) {
                this.showError('login', 'Code d\'accès incorrect.');
                this.accessCodeLoginInput.value = '';
                this.accessCodeLoginInput.focus();
                return;
            }

            // ÉTAPE 2 : Router selon l'opération
            const resetChecked = this.loginResetCheckbox.checked;
            const fileChecked = this.loginFileCheckbox.checked;

            if (resetChecked) {
                // CAS 2b : Réinitialisation complète
                await this.handleResetApp(accessCode);
            } else if (fileChecked) {
                // CAS 2c/2d : Restauration ou Appairage (détection auto)
                await this.handleFileImportFromLogin(accessCode);
            } else {
                // CAS 2a : Connexion normale
                await this.handleNormalLogin(accessCode);
            }

        } catch (error) {
            console.error('Login error:', error);
            this.showError('login', error.message || 'Une erreur est survenue');
        }
    }

    /**
     * CAS 2a : Connexion normale
     */
    async handleNormalLogin(accessCode) {
        const loginBtn = document.getElementById('loginBtn');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Connexion...';
        loginBtn.disabled = true;

        try {
            const result = await window.ratchouApp.login(accessCode);
            if (result.success) {
                this.incrementUsageCount();
                this.checkBackupStatusAfterLogin();
            } else {
                throw new Error('Échec de connexion');
            }
        } finally {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    }

    /**
     * CAS 2b : Réinitialisation complète
     */
    async handleResetApp(accessCode) {
        const confirm = window.confirm(
            "⚠️ Réinitialisation complète\n\n" +
            "Cette opération va supprimer TOUTES vos données.\n" +
            "Cette action est IRRÉVERSIBLE.\n\n" +
            "Continuer ?"
        );

        if (!confirm) return;

        this.loginContainer.classList.add('container-hidden');
        this.updateProgress(5, 'Réinitialisation...');

        try {
            const { uninstallApp } = await import('../components/import-export.js');
            const result = await uninstallApp((p, m) => this.updateProgress(p, m));

            if (!result.success) {
                throw new Error(result.message);
            }

            this.updateProgress(100, 'Réinitialisation terminée !');
            this.progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
            this.progressBar.classList.add('bg-success');
            this.statusMessage.innerHTML = 'La page va se recharger...';

            setTimeout(() => window.location.reload(), 3000);

        } catch (error) {
            console.error('Reset error:', error);
            this.showError('login', error.message);
            this.showLogin();
        }
    }

    /**
     * CAS 2c/2d : Router vers restore ou pairing selon détection
     */
    async handleFileImportFromLogin(accessCode) {
        const file = this.loginImportFile.files[0];

        if (!file) {
            this.showError('login', 'Veuillez sélectionner un fichier.');
            return;
        }

        // Détecter le type de fichier
        const fileType = await this.detectFileType(file);

        if (fileType === 'pairing') {
            // CAS 2d : Appairage
            await this.handlePairingFromLogin(accessCode, file);
        } else if (fileType === 'restore') {
            // CAS 2c : Restauration
            await this.handleRestoreFromLogin(accessCode, file);
        } else {
            this.showError('login', 'Type de fichier non reconnu.');
        }
    }

    /**
     * CAS 2d : Installation fichier d'appairage
     */
    async handlePairingFromLogin(accessCode, file) {
        const securityCode = this.loginSecurityCode.value;

        // Validation code de sécurité
        if (!/^\d{4}$/.test(securityCode)) {
            this.showError('login', 'Le code de sécurité doit faire 4 chiffres.');
            return;
        }

        // Confirmation
        const confirm = window.confirm(
            "⚠️ Installation fichier d'appairage\n\n" +
            "Cette opération va :\n" +
            "• Supprimer toutes vos données actuelles\n" +
            "• Importer les données du maître\n" +
            "• Configurer la synchronisation\n\n" +
            "Continuer ?"
        );

        if (!confirm) return;

        // Import
        this.loginContainer.classList.add('container-hidden');
        this.updateProgress(5, 'Installation en cours...');

        try {
            const userData = await window.ratchouApp.db.get('UTILISATEUR', accessCode);
            const deviceId = userData?.device_id || RatchouUtils.device.generateDeviceId();

            const { importPairingFile } = await import('../components/import-export.js');
            const result = await importPairingFile(
                file,
                securityCode,
                (p, m) => this.updateProgress(p, m),
                deviceId,
                accessCode
            );

            if (!result.success) {
                throw new Error(result.message);
            }

            this.updateProgress(100, 'Installation terminée !');
            this.progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
            this.progressBar.classList.add('bg-success');
            this.statusMessage.innerHTML = 'Synchronisation configurée.<br>Redirection...';

            setTimeout(() => window.location.replace('dashboard.html'), 2000);

        } catch (error) {
            console.error('Pairing error:', error);
            this.showError('login', error.message);
            this.showLogin();
        }
    }

    /**
     * CAS 2c : Restauration depuis sauvegarde
     */
    async handleRestoreFromLogin(accessCode, file) {
        // Confirmation
        const confirm = window.confirm(
            "⚠️ Restauration depuis sauvegarde\n\n" +
            "Cette opération va :\n" +
            "• Supprimer toutes vos données actuelles\n" +
            "• Importer les données du fichier\n\n" +
            "Continuer ?"
        );

        if (!confirm) return;

        // Import
        this.loginContainer.classList.add('container-hidden');
        this.updateProgress(5, 'Restauration en cours...');

        try {
            const userData = await window.ratchouApp.db.get('UTILISATEUR', accessCode);
            const deviceId = userData?.device_id || RatchouUtils.device.generateDeviceId();

            const { importData } = await import('../components/import-export.js');
            const result = await importData(
                file,
                (p, m) => this.updateProgress(p, m),
                deviceId,
                accessCode
            );

            if (!result.success) {
                throw new Error(result.message);
            }

            this.updateProgress(100, 'Restauration terminée !');
            this.progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
            this.progressBar.classList.add('bg-success');
            this.statusMessage.innerHTML = 'Données restaurées.<br>Redirection...';

            setTimeout(() => window.location.replace('dashboard.html'), 2000);

        } catch (error) {
            console.error('Restore error:', error);
            this.showError('login', error.message);
            this.showLogin();
        }
    }

    async handleSetup() {
        this.hideErrors();
        const accessCode = this.accessCodeSetupInput.value;
        const deviceId = this.deviceIdInput.value.trim();
        const file = this.setupImportFile.files[0];

        // Validation
        if (!/^\d{4}$/.test(accessCode)) {
            this.showError('setup', 'Le code d\'accès doit faire 4 chiffres.');
            return;
        }
        if (!deviceId) {
            this.showError('setup', 'Le nom de l\'appareil est requis.');
            return;
        }

        // Détection automatique du type de fichier
        const fileType = file ? await this.detectFileType(file) : null;
        const securityCode = fileType === 'pairing' ? this.setupSecurityCode.value : null;

        // Validation code sécurité si pairing détecté
        if (fileType === 'pairing' && !/^\d{4}$/.test(securityCode)) {
            this.showError('setup', 'Le code de sécurité doit faire 4 chiffres.');
            return;
        }

        try {
            // Hide form and show progress
            this.setupContainer.classList.add('container-hidden');
            this.updateProgress(5, 'Préparation...');

            // --- CRITICAL STEP ---
            // Set the device ID in storage so all subsequent DB operations can use it.
            RatchouUtils.device.setDeviceId(deviceId);

            if (fileType === 'pairing') {
                // CAS 1c : Import pairing file
                // Initialize RatchouApp first (required for initializeStructure() call in importPairingFile)
                this.updateProgress(10, 'Initialisation de l\'application...');
                await window.ratchouApp.initialize({ skipDefaults: true });

                const { importPairingFile } = await import('../components/import-export.js');
                const result = await importPairingFile(
                    file,
                    securityCode,
                    (p, m) => this.updateProgress(p, m),
                    deviceId,
                    accessCode
                );
                if (!result.success) throw new Error(result.message);
            } else if (fileType === 'restore') {
                // CAS 1b : Regular restore
                // Initialize RatchouApp first (required for initializeStructure() call in importData)
                this.updateProgress(10, 'Initialisation de l\'application...');
                await window.ratchouApp.initialize({ skipDefaults: true });

                const result = await importData(file, (p, m) => this.updateProgress(p, m), deviceId, accessCode);
                if (!result.success) throw new Error(result.message);
            } else if (file) {
                // Fichier non reconnu
                throw new Error('Type de fichier non reconnu');
            } else {
                // CAS 1a : For new user setup without import
                await window.ratchouApp.initialize({ skipDefaults: true });
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
