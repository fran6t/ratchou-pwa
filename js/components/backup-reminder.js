/**
 * Backup Reminder Component
 * Manages backup metadata and alerts for IndexedDB data protection
 */

class BackupReminder {
    constructor() {
        this.STORAGE_KEY = 'ratchou_backup_metadata';
        this.THRESHOLDS = {
            REMINDER: 7,    // days - yellow alert
            ALERT: 15,      // days - orange alert  
            URGENT: 30      // days - red alert
        };
    }

    /**
     * Get backup metadata from localStorage
     * @returns {object} Metadata object
     */
    getBackupMetadata() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) {
                return this.createDefaultMetadata();
            }
            return JSON.parse(stored);
        } catch (error) {
            console.warn('Error reading backup metadata:', error);
            return this.createDefaultMetadata();
        }
    }

    /**
     * Create default metadata structure
     * @returns {object} Default metadata
     */
    createDefaultMetadata() {
        return {
            lastExportDate: null,
            exportCount: 0,
            lastDataModification: Date.now(),
            reminderSnoozedUntil: null
        };
    }

    /**
     * Update backup metadata
     * @param {object} updates - Partial metadata updates
     */
    updateBackupMetadata(updates) {
        try {
            const current = this.getBackupMetadata();
            const updated = { ...current, ...updates };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
            console.log('Backup metadata updated:', updates);
        } catch (error) {
            console.error('Error updating backup metadata:', error);
        }
    }

    /**
     * Record successful export
     */
    recordExport() {
        const now = Date.now();
        this.updateBackupMetadata({
            lastExportDate: now,
            exportCount: (this.getBackupMetadata().exportCount || 0) + 1,
            reminderSnoozedUntil: null // Reset snooze after actual backup
        });
    }

    /**
     * Record data modification (for important operations)
     */
    recordDataModification() {
        this.updateBackupMetadata({
            lastDataModification: Date.now()
        });
    }

    /**
     * Snooze reminder for specified days
     * @param {number} days - Days to snooze
     */
    snoozeReminder(days = 3) {
        const snoozeUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
        this.updateBackupMetadata({
            reminderSnoozedUntil: snoozeUntil
        });
    }

    /**
     * Check if backup reminder should be shown
     * @returns {object} Alert info or null
     */
    checkBackupStatus() {
        const metadata = this.getBackupMetadata();
        const now = Date.now();

        // Check if reminder is snoozed
        if (metadata.reminderSnoozedUntil && now < metadata.reminderSnoozedUntil) {
            return null; // Snoozed, no alert
        }

        // If never exported, check based on data modification
        const referenceDate = metadata.lastExportDate || metadata.lastDataModification;
        if (!referenceDate) {
            return null; // No reference point
        }

        const daysSince = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
        
        if (daysSince >= this.THRESHOLDS.URGENT) {
            return {
                level: 'urgent',
                daysSince: daysSince,
                type: 'danger',
                title: 'Sauvegarde urgente requise !',
                message: `Aucune sauvegarde depuis ${daysSince} jours. Vos données risquent d'être perdues.`
            };
        } else if (daysSince >= this.THRESHOLDS.ALERT) {
            return {
                level: 'alert',
                daysSince: daysSince,
                type: 'warning',
                title: 'Sauvegarde recommandée',
                message: `Dernière sauvegarde il y a ${daysSince} jours. Une sauvegarde est recommandée.`
            };
        } else if (daysSince >= this.THRESHOLDS.REMINDER) {
            return {
                level: 'reminder',
                daysSince: daysSince,
                type: 'info',
                title: 'Pensez à sauvegarder',
                message: `Dernière sauvegarde il y a ${daysSince} jours.`
            };
        }

        return null; // No alert needed
    }

    /**
     * Show backup reminder banner
     * @param {HTMLElement} container - Container to show the alert in
     * @param {object} alertInfo - Alert information from checkBackupStatus
     * @param {function} onExport - Callback for export action
     */
    showBackupReminder(container, alertInfo, onExport) {
        if (!alertInfo) return;

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${alertInfo.type} alert-dismissible fade show mt-3`;
        alertDiv.setAttribute('role', 'alert');
        
        const snoozeText = alertInfo.level === 'urgent' ? 'Plus tard (1 jour)' : 'Plus tard (3 jours)';
        const snoozeDays = alertInfo.level === 'urgent' ? 1 : 3;

        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">
                    <h6 class="alert-heading mb-1">
                        <i class="bi bi-shield-exclamation me-2"></i>${alertInfo.title}
                    </h6>
                    <small>${alertInfo.message}</small>
                </div>
                <div class="ms-3">
                    <button type="button" class="btn btn-outline-${alertInfo.type} btn-sm me-2" id="exportNowBtn">
                        <i class="bi bi-download me-1"></i>Exporter maintenant
                    </button>
                    <button type="button" class="btn btn-link btn-sm text-${alertInfo.type}" id="snoozeBtn">
                        ${snoozeText}
                    </button>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Add event listeners
        const exportBtn = alertDiv.querySelector('#exportNowBtn');
        const snoozeBtn = alertDiv.querySelector('#snoozeBtn');

        exportBtn.addEventListener('click', () => {
            alertDiv.remove();
            if (onExport && typeof onExport === 'function') {
                onExport();
            }
        });

        snoozeBtn.addEventListener('click', () => {
            this.snoozeReminder(snoozeDays);
            alertDiv.remove();
        });

        // Insert at the beginning of container
        container.insertBefore(alertDiv, container.firstChild);

        // Auto-hide non-urgent alerts after 10 seconds
        if (alertInfo.level !== 'urgent') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.classList.remove('show');
                    setTimeout(() => alertDiv.remove(), 150);
                }
            }, 10000);
        }
    }

    /**
     * Initialize backup reminder (call after login)
     * @param {HTMLElement} container - Container for alerts
     * @param {function} onExport - Export callback
     */
    async initializeAfterLogin(container, onExport) {
        try {
            const alertInfo = this.checkBackupStatus();
            if (alertInfo) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    this.showBackupReminder(container, alertInfo, onExport);
                }, 500);
            }
        } catch (error) {
            console.error('Error initializing backup reminder:', error);
        }
    }

    /**
     * Get backup statistics for display
     * @returns {object} Statistics
     */
    getBackupStats() {
        const metadata = this.getBackupMetadata();
        const result = {
            hasEverExported: Boolean(metadata.lastExportDate),
            exportCount: metadata.exportCount || 0,
            lastExportDate: metadata.lastExportDate,
            daysSinceLastExport: null,
            isReminderSnoozed: Boolean(metadata.reminderSnoozedUntil && Date.now() < metadata.reminderSnoozedUntil)
        };

        if (metadata.lastExportDate) {
            result.daysSinceLastExport = Math.floor((Date.now() - metadata.lastExportDate) / (1000 * 60 * 60 * 24));
        }

        return result;
    }
}

// Export for use in other modules
window.BackupReminder = BackupReminder;

// Create global instance
window.backupReminder = new BackupReminder();