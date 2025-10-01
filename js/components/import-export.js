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
        
        // Get export data from app (all tables)
        const exportData = await window.ratchouApp.exportToJSON();
        
        updateProgress(30, 'Création de l\'archive ZIP...');
        
        // Create ZIP archive
        const zip = new JSZip();
        
        // Table name mapping for consistency with documentation
        const tableNameMapping = {
            'utilisateur': 'UTILISATEUR',
            'comptes': 'COMPTES',
            'categories': 'CATEGORIES',
            'beneficiaires': 'BENEFICIAIRES',
            'type_depenses': 'TYPE_DEPENSES',
            'mouvements': 'MOUVEMENTS',
            'recurrents': 'DEPENSES_FIXES'
        };

        // Create metadata file with proper table names
        const metadata = {
            exportDate: new Date().toISOString(),
            appVersion: window.ratchouApp.getVersion(),
            dbVersion: window.ratchouApp.db.version,
            tables: Object.values(tableNameMapping),
            schema: window.ratchouApp.db.getSchema()
        };
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        // Add each table as a separate JSON file
        for (const tableName in exportData.data) {
            const standardTableName = tableNameMapping[tableName] || tableName.toUpperCase();
            const fileName = `ratchou-export-${standardTableName.toLowerCase()}.json`;
            zip.file(fileName, JSON.stringify(exportData.data[tableName], null, 2));
        }
        
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

        return { success: true, fileName: fileName, blob: zipBlob };
        
    } catch (error) {
        console.error('Export ZIP error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Export application data as ZIP (simplified - only ZIP format supported)
 * @param {Function} onProgress - Progress callback function
 * @returns {Object} Result object with success status and fileName
 */
export async function exportDataWithFormat(format = 'zip', onProgress = null) {
    // Only ZIP format is supported now
    return await exportDataAsZip(onProgress);
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
        
        // Read and load ZIP file
        const zipContent = await readFileAsArrayBuffer(file);
        updateProgress(15, 'Décompression de l\'archive...');
        const zip = new JSZip();
        await zip.loadAsync(zipContent);
        
        // 1. --- VALIDATION DES METADONNEES ---
        updateProgress(25, 'Validation des métadonnées...');
        const metadataFile = zip.file('metadata.json');
        if (!metadataFile) {
            throw new Error('Fichier metadata.json manquant dans l\'archive. Ce n\'est pas une sauvegarde valide.');
        }
        const metadataContent = await metadataFile.async('text');
        const metadata = JSON.parse(metadataContent);

        if (!metadata.schema || !metadata.tables || !metadata.dbVersion) {
            throw new Error('Le fichier metadata.json est incomplet ou corrompu.');
        }

        // 2. --- VALIDATION DES DONNEES (PRE-CHECK) ---
        updateProgress(35, 'Vérification des données (pré-import)...');
        let allData = {};
        for (const tableName of metadata.tables) {
            const jsonFile = zip.file(`ratchou-export-${tableName.toLowerCase()}.json`);
            if (!jsonFile) {
                throw new Error(`Fichier de données manquant pour la table : ${tableName}`);
            }
            const tableContent = await jsonFile.async('text');
            const tableData = JSON.parse(tableContent);
            
            // Validate each record in the table against the schema
            const schema = metadata.schema[tableName];
            if (!schema) {
                throw new Error(`Schéma manquant pour la table ${tableName} dans metadata.json.`);
            }

            // Extract rows from the table data structure {count: X, rows: [...]}
            const records = tableData.rows || tableData;

            for (let i = 0; i < records.length; i++) {
                const record = records[i];
                const recordId = record.id || `(enregistrement ${i + 1})`;

                // Validation assouplie : on valide seulement les champs présents
                // Les champs manquants peuvent être auto-générés par l'application
                for (const fieldName in record) {
                    if (schema.fields && schema.fields[fieldName]) {
                        const fieldSchema = schema.fields[fieldName];
                        if (record[fieldName] !== undefined && typeof record[fieldName] !== fieldSchema.type) {
                            console.warn(`Type mismatch for ${fieldName} in ${tableName}: expected ${fieldSchema.type}, got ${typeof record[fieldName]}`);
                            // Ne pas échouer sur les types, juste avertir
                        }
                    }
                }

                // Validation minimale : vérifier seulement que les clés primaires sont présentes
                if (tableName === 'UTILISATEUR' && !record.code_acces) {
                    throw new Error(`Erreur dans ${tableName}.json : Le champ obligatoire 'code_acces' est manquant pour l'enregistrement ${recordId}.`);
                }
                if ((tableName === 'COMPTES' || tableName === 'CATEGORIES' || tableName === 'BENEFICIAIRES' ||
                     tableName === 'TYPE_DEPENSES' || tableName === 'MOUVEMENTS' || tableName === 'DEPENSES_FIXES')
                    && !record.id) {
                    throw new Error(`Erreur dans ${tableName}.json : Le champ obligatoire 'id' est manquant pour l'enregistrement ${recordId}.`);
                }
            }
            allData[tableName] = tableData;
        }

        // 3. --- CONFIRMATION UTILISATEUR ---
        updateProgress(60, 'En attente de confirmation...');
        const confirmation = window.confirm(
            "Validation réussie !\n\n" +
            "ATTENTION : L'importation va supprimer TOUTES les données actuelles et les remplacer par celles de cette sauvegarde.\n\n" +
            "Êtes-vous sûr de vouloir continuer ?"
        );

        if (!confirmation) {
            updateProgress(0, 'Importation annulée par l\'utilisateur.');
            return { success: false, message: 'Importation annulée.' };
        }

        // 4. --- IMPORTATION REELLE ---
        updateProgress(70, 'Phase 1: Réinitialisation de la structure...');
        await window.ratchouApp.initializeStructure();
        
        updateProgress(80, 'Phase 2: Import des données...');

        // Reconstitute the format expected by importFromJSON: {data: {...}}
        // Also map table names back to the internal format
        const tableNameMapping = {
            'UTILISATEUR': 'utilisateur',
            'COMPTES': 'comptes',
            'CATEGORIES': 'categories',
            'BENEFICIAIRES': 'beneficiaires',
            'TYPE_DEPENSES': 'type_depenses',
            'MOUVEMENTS': 'mouvements',
            'DEPENSES_FIXES': 'recurrents'
        };

        const formattedData = {
            data: {}
        };

        for (const tableName of metadata.tables) {
            const internalName = tableNameMapping[tableName] || tableName.toLowerCase();
            formattedData.data[internalName] = allData[tableName];
        }

        const result = await window.ratchouApp.importFromJSON(formattedData, deviceId, accessCode);
        
        if (!result.success) {
            throw new Error(result.message || 'Erreur lors de l\'import');
        }

        updateProgress(95, 'Connexion automatique...');
        const loginResult = await window.ratchouApp.login(accessCode, deviceId);
        if (!loginResult.success) {
            console.warn('Auto-login failed after import:', loginResult.message);
        } else {
            console.log('✅ Automatic login successful after import');
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
        
        updateProgress(30, 'Phase 1: Réinitialisation de la structure...');

        // Phase 1: Recreate database structure
        await window.ratchouApp.initializeStructure();
        updateProgress(70, 'Phase 2: Import des données...');
        
        // Import data
        const result = await window.ratchouApp.importFromJSON(jsonData, deviceId, accessCode);
        updateProgress(85, 'Finalisation...');

        if (!result.success) {
            throw new Error(result.message || 'Erreur lors de l\'import');
        }

        updateProgress(95, 'Connexion automatique...');

        // Automatically login with the provided credentials
        const loginResult = await window.ratchouApp.login(accessCode, deviceId);
        if (!loginResult.success) {
            console.warn('Auto-login failed after import:', loginResult.message);
            // Don't fail the import, just warn
        } else {
            console.log('✅ Automatic login successful after import');
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
        let cachesCleared = 0;
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                const ratchouCaches = cacheNames.filter(name => name.includes('ratchou') || name.includes('Ratchou'));
                await Promise.all(ratchouCaches.map(name => caches.delete(name)));
                cachesCleared = ratchouCaches.length;
                console.log(`[Uninstall] Cleared ${cachesCleared} cache(s):`, ratchouCaches);
            }
        } catch (cacheError) {
            console.warn('Error clearing caches:', cacheError);
            // Continue even if cache clearing fails
        }

        updateProgress(95, 'Désinscription du Service Worker...');

        // Unregister all service workers
        let swUnregistered = 0;
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(async (registration) => {
                    const unregistered = await registration.unregister();
                    if (unregistered) {
                        swUnregistered++;
                        console.log('[Uninstall] Service Worker unregistered:', registration.scope);
                    }
                }));
            }
        } catch (swError) {
            console.warn('Error unregistering service workers:', swError);
            // Continue even if SW unregistration fails
        }

        updateProgress(100, 'Désinstallation terminée');

        console.log(`[Uninstall] Complete cleanup summary:
- localStorage keys removed: ${keysToRemove.length}
- sessionStorage keys removed: ${sessionKeysToRemove.length}
- IndexedDB deleted: ratchou
- Caches cleared: ${cachesCleared}
- Service Workers unregistered: ${swUnregistered}`);

        return {
            success: true,
            message: 'Application désinstallée avec succès. Pour une désinstallation complète, vous pouvez également révoquer les permissions dans les paramètres de votre navigateur.',
            details: {
                localStorageCleared: keysToRemove.length,
                sessionStorageCleared: sessionKeysToRemove.length,
                cachesCleared,
                serviceWorkersUnregistered: swUnregistered
            }
        };
        
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