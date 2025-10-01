/**
 * Sidebar Component - Composant de menu hamburger
 * Génère le menu latéral offcanvas avec toutes les fonctions de gestion
 */

/**
 * Génère le HTML du sidebar (menu hamburger)
 * @returns {string} HTML du sidebar
 */
export function generateSidebar() {
    // Déterminer le chemin des pages selon le dossier actuel
    const isInManageFolder = window.location.pathname.includes('/manage/');
    const managePath = isInManageFolder ? '' : 'manage/';
    
    return `
    <!-- Sidebar Menu -->
    <div class="offcanvas offcanvas-end" tabindex="-1" id="sideMenu">
        <div class="offcanvas-header bg-primary text-white">
            <h5 class="offcanvas-title">📋 Menu</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body p-0">
            <div class="list-group list-group-flush">
                <a href="${managePath}comptes.html" class="list-group-item list-group-item-action">
                    🏦 <strong>Comptes</strong>
                    <small class="d-block text-muted">Gérer les comptes bancaires</small>
                </a>
                <a href="${managePath}projection.html" class="list-group-item list-group-item-action">
                    📅 <strong>Projection financière</strong>
                    <small class="d-block text-muted">Prévision des finances</small>
                </a>
                <a href="${managePath}recurrents.html" class="list-group-item list-group-item-action">
                    🔄 <strong>Récurrents</strong>
                    <small class="d-block text-muted">Abonnements, loyers...</small>
                </a>
                <a href="${managePath}mouvements.html" class="list-group-item list-group-item-action">
                    💸 <strong>Mouvements</strong>
                    <small class="d-block text-muted">Rechercher et modifier</small>
                </a>
                <a href="${managePath}categories.html" class="list-group-item list-group-item-action">
                    📂 <strong>Catégories</strong>
                    <small class="d-block text-muted">Types de dépenses</small>
                </a>
                <a href="${managePath}beneficiaires.html" class="list-group-item list-group-item-action">
                    👥 <strong>Bénéficiaires</strong>
                    <small class="d-block text-muted">Magasins, services...</small>
                </a>
                <a href="${managePath}type_depenses.html" class="list-group-item list-group-item-action">
                    💳 <strong>Types de paiement</strong>
                    <small class="d-block text-muted">Carte, espèces, virement...</small>
                </a>
                <a href="${managePath}export.html" class="list-group-item list-group-item-action">
                    📤 <strong>Exporter les données</strong>
                    <small class="d-block text-muted">JSON ou ZIP compressé</small>
                </a>
                <div class="list-group-item list-group-item-action" style="cursor: pointer;" data-bs-toggle="modal" data-bs-target="#accessCodeModal">
                    🔐 <strong>Changer le code</strong>
                    <small class="d-block text-muted">Modifier le code d'accès</small>
                </div>
                <div class="list-group-item list-group-item-action" style="cursor: pointer;" id="logoutBtn">
                    🚪 <strong>Déconnexion</strong>
                    <small class="d-block text-muted">Quitter l'application</small>
                </div>
            </div>
        </div>
    </div>`;
}

/**
 * Initialise les événements du sidebar
 */
export async function initializeSidebarEvents() {
    // Export is now handled by the modal in modals.js
    // No need for direct export event handler anymore
    
    // Event listener pour la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (typeof ratchouApp !== 'undefined') {
                ratchouApp.logout();
            }
            location.replace('index.html');
        });
    }
}


/**
 * Utilitaire pour afficher des alertes (utilisée par les événements)
 */
function showAlert(message, type = 'info') {
    // Chercher un container d'alertes existant
    let alertContainer = document.getElementById('alertContainer');
    
    // Si pas de container, créer une alerte Bootstrap standard
    if (!alertContainer) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.style.position = 'fixed';
        alert.style.top = '20px';
        alert.style.right = '20px';
        alert.style.zIndex = '9999';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);
        
        // Auto-dismiss après 5 secondes
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
        
        return;
    }
    
    // Utiliser le container existant
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    alertContainer.innerHTML = alertHTML;
}