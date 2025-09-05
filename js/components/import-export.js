/**
 * Import/Export Module
 * Centralizes import and export functionality
 */

/**
 * Generate filename with format: ratchou-{device_id}-{aaammjjhhmm}.json
 */
function generateExportFilename() {
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
 * Export application data as ZIP file
 * @param {Function} onProgress - Progress callback function
 * @returns {Object} Result object with success status and fileName
 */
export async function exportDataAsZip(onProgress = null) {
    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip n\'est pas chargé. Veuillez recharger la page.');
        }
        
        // Check if ratchouApp is available
        if (!window.ratchouApp || typeof window.ratchouApp.exportToJSON !== 'function') {
            throw new Error('Application non initialisée. Veuillez recharger la page.');
        }
        
        // Progress tracking
        const updateProgress = (percent, message) => {
            if (onProgress) onProgress(percent, message);
        };
        
        updateProgress(10, 'Collecte des données...');
        
        // Get export data from app
        const exportData = await window.ratchouApp.exportToJSON();
        
        updateProgress(30, 'Création de l\'archive ZIP...');
        
        // Create ZIP archive
        const zip = new JSZip();
        
        // Add the JSON file to the ZIP with a descriptive name
        const jsonFileName = 'ratchou-export.json';
        zip.file(jsonFileName, JSON.stringify(exportData, null, 2));
        
        // Add a readme file for user guidance
        const readmeContent = `# Export Ratchou
        
Date d'export : ${new Date().toLocaleString('fr-FR')}
Application : Ratchou - Gestion de Dépenses
Format : JSON compressé

## Contenu
- ${jsonFileName} : Données complètes de l'application

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
        
        zip.file('README.txt', readmeContent);
        
        updateProgress(60, 'Compression des données...');
        
        // Generate the ZIP file with maximum compression
        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 9  // Maximum compression
            }
        }, (metadata) => {
            // Progress callback from JSZip
            const progress = 60 + (metadata.percent * 0.3); // 60% to 90%
            updateProgress(Math.round(progress), 'Compression en cours...');
        });
        
        updateProgress(95, 'Préparation du téléchargement...');
        
        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = generateExportFilename().replace('.json', '.zip');
        a.download = fileName;
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateProgress(100, 'Export terminé !');
        
        // Record backup in metadata
        if (window.backupReminder) {
            window.backupReminder.recordExport();
            console.log('✅ Export ZIP enregistré dans les métadonnées de sauvegarde');
        } else {
            console.warn('⚠️ BackupReminder non disponible - tentative de création...');
            // Fallback: créer manuellement les métadonnées si le composant n'est pas disponible
            try {
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
            } catch (fallbackError) {
                console.error('Erreur lors de l\'enregistrement manuel des métadonnées:', fallbackError);
            }
        }
        
        return { success: true, fileName: fileName };
        
    } catch (error) {
        console.error('Export ZIP error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Export application data with format selection
 * @param {string} format - 'json' or 'zip'
 * @param {Function} onProgress - Progress callback function
 * @returns {Object} Result object with success status and fileName
 */
export async function exportDataWithFormat(format = 'zip', onProgress = null) {
    if (format === 'zip') {
        return await exportDataAsZip(onProgress);
    } else {
        return await exportData(onProgress);
    }
}

/**
 * Export application data to JSON file
 * @param {Function} onProgress - Progress callback function (optional)
 */
export async function exportData(onProgress = null) {
    try {
        // Check if ratchouApp is available
        if (!window.ratchouApp || typeof window.ratchouApp.exportToJSON !== 'function') {
            throw new Error('Application non initialisée. Veuillez recharger la page.');
        }
        
        // Get export data from app
        const exportData = await window.ratchouApp.exportToJSON();
        
        // Create download blob
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = generateExportFilename();
        a.download = fileName;
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Record backup in metadata
        if (window.backupReminder) {
            window.backupReminder.recordExport();
            console.log('✅ Export enregistré dans les métadonnées de sauvegarde');
        } else {
            console.warn('⚠️ BackupReminder non disponible - tentative de création...');
            // Fallback: créer manuellement les métadonnées si le composant n'est pas disponible
            try {
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
            } catch (fallbackError) {
                console.error('Erreur lors de l\'enregistrement manuel des métadonnées:', fallbackError);
            }
        }
        
        return { success: true, fileName: fileName };
        
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Import data from ZIP file
 * @param {File} file - The ZIP file to import
 * @param {Function} onProgress - Progress callback (optional)
 * @param {string} deviceId - The ID for the new device
 * @param {string} accessCode - The new access code for the user
 */
export async function importDataFromZip(file, onProgress = null, deviceId, accessCode) {
    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip n\'est pas chargé. Veuillez recharger la page.');
        }

        // Progress tracking
        const updateProgress = (percent, message) => {
            if (onProgress) onProgress(percent, message);
        };

        updateProgress(5, 'Lecture du fichier ZIP...');
        
        // Read ZIP file
        const zipContent = await readFileAsArrayBuffer(file);
        updateProgress(15, 'Décompression de l\'archive...');
        
        // Load and parse ZIP
        const zip = new JSZip();
        await zip.loadAsync(zipContent);
        
        updateProgress(25, 'Recherche du fichier de données...');
        
        // Look for the JSON file in the ZIP
        const jsonFile = zip.file('ratchou-export.json');
        if (!jsonFile) {
            throw new Error('Fichier de données non trouvé dans l\'archive ZIP (recherche: ratchou-export.json)');
        }
        
        updateProgress(35, 'Extraction des données...');
        
        // Extract JSON content
        const jsonContent = await jsonFile.async('text');
        
        updateProgress(45, 'Analyse des données...');
        
        // Parse JSON
        let jsonData;
        try {
            jsonData = JSON.parse(jsonContent);
        } catch (parseError) {
            throw new Error('Fichier JSON invalide dans l\'archive ZIP');
        }
        
        updateProgress(55, 'Suppression des données existantes...');
        
        // Clear existing data
        await window.ratchouApp.clearAllData();
        updateProgress(75, 'Import des données...');
        
        // Import data
        const result = await window.ratchouApp.importFromJSON(jsonData, deviceId, accessCode);
        updateProgress(95, 'Finalisation...');
        
        if (!result.success) {
            throw new Error(result.message || 'Erreur lors de l\'import');
        }
        
        updateProgress(100, 'Import terminé');
        return { success: true, message: 'Import réussi depuis le fichier ZIP !' };
        
    } catch (error) {
        console.error('Import ZIP error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Import data from JSON or ZIP file
 * @param {File} file - The file to import
 * @param {Function} onProgress - Progress callback (optional)
 * @param {string} deviceId - The ID for the new device
 * @param {string} accessCode - The new access code for the user
 */
export async function importData(file, onProgress = null, deviceId, accessCode) {
    try {
        if (!file) {
            throw new Error('Veuillez sélectionner un fichier');
        }
        if (!deviceId) {
            throw new Error('L\'identifiant de l\'appareil est manquant');
        }
        // accessCode is optional only if we don't have a file
        if (file && !accessCode) {
            // This case is handled by setup.js, but as a safeguard:
            throw new Error('Le code d\'accès est requis pour l\'importation');
        }

        // Detect file type and route to appropriate handler
        if (file.name.endsWith('.zip')) {
            return await importDataFromZip(file, onProgress, deviceId, accessCode);
        } else if (file.name.endsWith('.json')) {
            return await importDataFromJSON(file, onProgress, deviceId, accessCode);
        } else {
            throw new Error('Format de fichier non supporté. Seuls les fichiers JSON et ZIP sont acceptés.');
        }
        
    } catch (error) {
        console.error('Import error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Import data from JSON file (internal function)
 * @param {File} file - The JSON file to import
 * @param {Function} onProgress - Progress callback (optional)
 * @param {string} deviceId - The ID for the new device
 * @param {string} accessCode - The new access code for the user
 */
async function importDataFromJSON(file, onProgress = null, deviceId, accessCode) {
    try {
        // Progress tracking
        const updateProgress = (percent, message) => {
            if (onProgress) onProgress(percent, message);
        };

        updateProgress(10, 'Lecture du fichier JSON...');
        
        // Read file
        const fileContent = await readFile(file);
        updateProgress(30, 'Analyse du fichier...');
        
        // Parse JSON
        let jsonData;
        try {
            jsonData = JSON.parse(fileContent);
        } catch (parseError) {
            throw new Error('Fichier JSON invalide');
        }
        
        updateProgress(50, 'Suppression des données existantes...');
        
        // Clear existing data
        await window.ratchouApp.clearAllData();
        updateProgress(70, 'Import des données...');
        
        // Import data
        const result = await window.ratchouApp.importFromJSON(jsonData, deviceId, accessCode);
        updateProgress(90, 'Finalisation...');
        
        if (!result.success) {
            throw new Error(result.message || 'Erreur lors de l\'import');
        }
        
        updateProgress(100, 'Import terminé');
        return { success: true, message: 'Import réussi !' };
        
    } catch (error) {
        console.error('Import JSON error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * File reader helper
 * @param {File} file - File to read
 * @returns {Promise<string>} File content
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsText(file);
    });
}

/**
 * File reader helper for binary files (ZIP)
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>} File content as ArrayBuffer
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Show alert helper (assumes showAlert function exists globally)
 * @param {string} message 
 * @param {string} type 
 * @param {object} options 
 */
function showAlert(message, type, options = {}) {
    if (typeof window.showAlert === 'function') {
        window.showAlert(message, type, options);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

/**
 * Hide alert helper
 * @param {string} id 
 */
function hideAlert(id) {
    if (typeof window.hideAlert === 'function') {
        window.hideAlert(id);
    }
}

/**
 * Uninstall the application completely
 * @param {Function} onProgress - Progress callback (optional)
 */
export async function uninstallApp(onProgress = null) {
    try {
        // Progress tracking
        const updateProgress = (percent, message) => {
            if (onProgress) onProgress(percent, message);
        };

        updateProgress(10, 'Déconnexion de l\'utilisateur...');
        
        // Logout user first
        if (window.ratchouApp && window.ratchouApp.isAuthenticated()) {
            window.ratchouApp.logout();
        }
        
        updateProgress(30, 'Suppression des données de l\'application...');
        
        // Clear all application data
        if (window.ratchouApp && window.ratchouApp.clearAllData) {
            await window.ratchouApp.clearAllData();
        }
        
        updateProgress(50, 'Suppression des métadonnées locales...');
        
        // Clear all localStorage data related to Ratchou
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('ratchou_') || key.includes('ratchou') || key.includes('Ratchou'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        updateProgress(70, 'Suppression des données de session...');
        
        // Clear all sessionStorage data
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('ratchou_') || key.includes('ratchou') || key.includes('Ratchou'))) {
                sessionKeysToRemove.push(key);
            }
        }
        
        sessionKeysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });
        
        updateProgress(80, 'Fermeture de la base de données...');
        
        // Close and delete IndexedDB databases
        try {
            // Close existing connections
            if (window.ratchouApp && window.ratchouApp.db && window.ratchouApp.db.close) {
                await window.ratchouApp.db.close();
            }
            
            // Delete the database
            const deleteDBRequest = indexedDB.deleteDatabase('ratchou');
            await new Promise((resolve, reject) => {
                deleteDBRequest.onerror = () => reject(deleteDBRequest.error);
                deleteDBRequest.onsuccess = () => resolve();
                deleteDBRequest.onblocked = () => {
                    console.warn('Database deletion blocked, but continuing...');
                    resolve(); // Continue even if blocked
                };
            });
        } catch (dbError) {
            console.warn('Error deleting IndexedDB:', dbError);
            // Continue even if database deletion fails
        }
        
        updateProgress(90, 'Nettoyage des caches...');
        
        // Clear any browser caches if possible
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames
                        .filter(name => name.includes('ratchou') || name.includes('Ratchou'))
                        .map(name => caches.delete(name))
                );
            }
        } catch (cacheError) {
            console.warn('Error clearing caches:', cacheError);
            // Continue even if cache clearing fails
        }
        
        updateProgress(100, 'Désinstallation terminée');
        
        return { success: true, message: 'Application désinstallée avec succès' };
        
    } catch (error) {
        console.error('Uninstall error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Initialize import/export events
 * Note: Export button event is handled by sidebar.js
 * Note: Import button event is handled by modals.js
 */
export function initializeImportExportEvents() {
    // Events are now handled by their respective modules for better timing:
    // - Export button: handled by sidebar.js (after sidebar is loaded)
    // - Import button: handled by modals.js (after modals are loaded)
}