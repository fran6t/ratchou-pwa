/**
 * Modals Component - Composant des modales communes
 * Génère les modales réutilisées sur plusieurs pages
 */

/**
 * Génère le HTML de toutes les modales communes
 * @returns {string} HTML des modales
 */
export function generateModals() {
    return `
    <!-- Access Code Change Modal -->
    <div class="modal fade" id="accessCodeModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">🔐 Changer le code d'accès</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="card border-warning mb-3">
                        <div class="card-header bg-warning text-dark text-center">
                            <i class="me-2">⚠️</i>Attention : Code irrécupérable
                        </div>
                        <div class="card-body">
                            <p class="card-text small">
                                Si vous oubliez votre nouveau code, il sera impossible de le récupérer. 
                                Vous devrez réinstaller l'application, ce qui effacera toutes vos données.
                            </p>
                        </div>
                    </div>
                    <form id="accessCodeForm">
                        <div class="mb-3">
                            <label for="currentCode" class="form-label">Code actuel</label>
                            <input type="password" class="form-control" id="currentCode" maxlength="4" required>
                        </div>
                        <div class="mb-3">
                            <label for="newCode" class="form-label">Nouveau code (4 chiffres)</label>
                            <input type="password" class="form-control" id="newCode" maxlength="4" pattern="[0-9]{4}" required>
                        </div>
                        <div class="mb-3">
                            <label for="confirmCode" class="form-label">Confirmer le nouveau code</label>
                            <input type="password" class="form-control" id="confirmCode" maxlength="4" pattern="[0-9]{4}" required>
                        </div>
                    </form>
                    <div class="form-check mt-4">
                        <input class="form-check-input" type="checkbox" id="confirmCodeChange">
                        <label class="form-check-label" for="confirmCodeChange">
                            Je comprends que je dois noter ce code en lieu sûr.
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                    <button type="button" class="btn btn-primary" id="changeCodeBtn" disabled>💾 Changer</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Uninstall Confirmation Modal -->
    <div class="modal fade" id="uninstallModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">🗑️ Désinstallation complète</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="card border-danger mb-3">
                        <div class="card-header bg-danger text-white">
                            <i class="me-2">🚨</i>ATTENTION : Action définitive et irréversible
                        </div>
                        <div class="card-body">
                            <p class="card-text">Cette action va supprimer <strong>définitivement</strong> toutes les données de l'application sur cet appareil.</p>
                        </div>
                    </div>
                    
                    <div class="card border-info mb-3">
                        <div class="card-header bg-info text-white">
                            <i class="me-2">💾</i>Recommandation importante
                        </div>
                        <div class="card-body">
                            <p class="card-text">Avant de procéder, nous vous recommandons fortement d'exporter vos données via le menu "Export".</p>
                            <div class="text-center">
                                <button type="button" class="btn btn-primary" id="exportBeforeUninstall">
                                    📤 Exporter mes données maintenant
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-check mt-4">
                        <input class="form-check-input" type="checkbox" id="confirmUninstall">
                        <label class="form-check-label fw-bold text-danger" for="confirmUninstall">
                            En cochant cette case je comprends que toutes mes données seront éffacées.
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                    <button type="button" class="btn btn-danger" id="confirmUninstallBtn" disabled>
                        🗑️ Désinstaller définitivement
                    </button>
                </div>
            </div>
        </div>
    </div>

    `;
}


/**
 * Initialise les événements des modales communes
 */
export function initializeModalEvents() {
    initializeAccessCodeModal();
    initializeUninstallModal();
}

/**
 * Initialise la modale de changement de code d'accès
 */
function initializeAccessCodeModal() {
    const changeCodeBtn = document.getElementById('changeCodeBtn');
    const accessCodeForm = document.getElementById('accessCodeForm');
    const confirmCheckbox = document.getElementById('confirmCodeChange');
    
    if (changeCodeBtn && accessCodeForm && confirmCheckbox) {
        confirmCheckbox.addEventListener('change', () => {
            changeCodeBtn.disabled = !confirmCheckbox.checked;
        });

        changeCodeBtn.addEventListener('click', async () => {
            const currentCode = document.getElementById('currentCode').value;
            const newCode = document.getElementById('newCode').value;
            const confirmCode = document.getElementById('confirmCode').value;
            
            // Validation
            if (!currentCode || !newCode || !confirmCode) {
                showModalAlert('Tous les champs sont requis', 'danger');
                return;
            }
            
            if (newCode !== confirmCode) {
                showModalAlert('Les nouveaux codes ne correspondent pas', 'danger');
                return;
            }
            
            if (!/^\\d{4}$/.test(newCode)) {
                showModalAlert('Le nouveau code doit contenir exactement 4 chiffres', 'danger');
                return;
            }
            
            try {
                changeCodeBtn.disabled = true;
                changeCodeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Changement...';
                
                if (typeof ratchouApp !== 'undefined') {
                    const result = await ratchouApp.changeAccessCode(currentCode, newCode);
                    if (result.success) {
                        showModalAlert('Code d\'accès modifié avec succès', 'success');
                        accessCodeForm.reset();
                        setTimeout(() => {
                            const modal = bootstrap.Modal.getInstance(document.getElementById('accessCodeModal'));
                            modal.hide();
                        }, 2000);
                    } else {
                        showModalAlert(result.message || 'Erreur lors du changement de code', 'danger');
                    }
                } else {
                    showModalAlert('Application non disponible', 'danger');
                }
            } catch (error) {
                console.error('Erreur changement code:', error);
                showModalAlert('Erreur lors du changement de code: ' + error.message, 'danger');
            } finally {
                changeCodeBtn.disabled = false;
                changeCodeBtn.innerHTML = 'Changer';
            }
        });
    }
}



/**
 * Initialise la modale de désinstallation
 */
function initializeUninstallModal() {
    const confirmCheckbox = document.getElementById('confirmUninstall');
    const confirmButton = document.getElementById('confirmUninstallBtn');
    const exportBeforeBtn = document.getElementById('exportBeforeUninstall');

    if (confirmCheckbox && confirmButton) {
        confirmCheckbox.addEventListener('change', () => {
            confirmButton.disabled = !confirmCheckbox.checked;
        });

        confirmButton.addEventListener('click', handleUninstall);
    }

    if (exportBeforeBtn) {
        exportBeforeBtn.addEventListener('click', redirectToExportPage);
    }
}

/**
 * Gère la logique de désinstallation
 */
async function handleUninstall() {
    try {
        // Show progress modal
        const progressHtml = `
            <div class="modal fade" id="uninstallProgressModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">🗑️ Désinstallation en cours</h5>
                        </div>
                        <div class="modal-body text-center">
                            <div class="progress mb-3">
                                <div class="progress-bar bg-danger" id="uninstallProgressBar" role="progressbar" style="width: 0%"></div>
                            </div>
                            <p id="uninstallProgressText">Initialisation...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', progressHtml);
        const progressModal = new bootstrap.Modal(document.getElementById('uninstallProgressModal'));
        progressModal.show();

        const confirmModal = bootstrap.Modal.getInstance(document.getElementById('uninstallModal'));
        if (confirmModal) {
            confirmModal.hide();
        }

        const { uninstallApp } = await import('./import-export.js');
        
        const result = await uninstallApp((percent, message) => {
            const progressBar = document.getElementById('uninstallProgressBar');
            const progressText = document.getElementById('uninstallProgressText');
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.textContent = message;
        });

        if (result.success) {
            const progressText = document.getElementById('uninstallProgressText');
            if (progressText) {
                progressText.innerHTML = `<div class="text-success"><h6>✅ Désinstallation terminée</h6><p>Redirection...</p></div>`;
            }
            setTimeout(() => {
                // Adjust path for redirection from anywhere
                const basePath = window.location.pathname.includes('/manage/') ? '../' : '';
                location.replace(basePath + 'index.html');
            }, 2000);

        } else {
            progressModal.hide();
            showModalAlert('Erreur de désinstallation: ' + result.message, 'danger');
        }

    } catch (error) {
        console.error('Uninstall error:', error);
        const progressModalEl = document.getElementById('uninstallProgressModal');
        if(progressModalEl) {
            const modal = bootstrap.Modal.getInstance(progressModalEl);
            if(modal) modal.hide();
        }
        showModalAlert('Erreur technique: ' + error.message, 'danger');
    }
}

/**
 * Redirige vers la page d'export
 */
function redirectToExportPage() {
    // Fermer la modale de désinstallation
    const uninstallModal = bootstrap.Modal.getInstance(document.getElementById('uninstallModal'));
    if (uninstallModal) {
        uninstallModal.hide();
    }
    
    // Rediriger vers la page d'export
    // Détecter si on est dans /manage/ ou à la racine pour ajuster le chemin
    const basePath = window.location.pathname.includes('/manage/') ? '' : 'manage/';
    location.replace(basePath + 'export.html');
}


/**
 * Utilitaire pour afficher des alertes dans les modales
 */
function showModalAlert(message, type = 'info') {
    // Créer une alerte temporaire dans la modale active
    const activeModal = document.querySelector('.modal.show .modal-body');
    if (activeModal) {
        // Supprimer les alertes existantes
        const existingAlerts = activeModal.querySelectorAll('.temp-alert');
        existingAlerts.forEach(alert => alert.remove());
        
        // Créer la nouvelle alerte
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} temp-alert`;
        alert.textContent = message;
        
        // Insérer au début du modal-body
        activeModal.insertBefore(alert, activeModal.firstChild);
        
        // Auto-suppression après 5 secondes
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }
}
