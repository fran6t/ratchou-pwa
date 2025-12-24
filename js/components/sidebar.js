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

    // Vérifier si le mode beta est activé
    const isBetaMode = typeof RatchouUtils !== 'undefined' &&
        RatchouUtils.featureFlags &&
        RatchouUtils.featureFlags.isEnabled(
            RatchouUtils.featureFlags.FLAGS.BETA_TESTER_MODE
        );

    return `
    <!-- Sidebar Menu -->
    <div class="offcanvas offcanvas-end" tabindex="-1" id="sideMenu">
        <div class="offcanvas-header bg-primary text-white">
            <h5 class="offcanvas-title">📋 Menu</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body p-0">
            <div class="list-group list-group-flush">
                <!-- Entrées principales -->
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
                ${isBetaMode ? `
                <a href="${managePath}sync-pairing.html" class="list-group-item list-group-item-action">
                    🔗 <strong>Synchronisation</strong>
                    <small class="d-block text-muted">Gérer les appareils</small>
                </a>
                ` : ''}

                <!-- Sous-menu Système (collapse) -->
                <div class="list-group-item list-group-item-action p-0">
                    <button class="btn btn-link w-100 text-start text-decoration-none ps-3 pe-3 pt-2 pb-2 d-flex justify-content-between align-items-center"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#systemSubmenu"
                            aria-expanded="false"
                            aria-controls="systemSubmenu"
                            id="systemMenuToggle">
                        <span>
                            ⚙️ <strong>Système</strong>
                            <small class="d-block text-muted">Configuration et gestion</small>
                        </span>
                        <i class="chevron-icon">▼</i>
                    </button>

                    <div class="collapse" id="systemSubmenu">
                        <div class="list-group list-group-flush">
                            <a href="${managePath}export.html" class="list-group-item list-group-item-action ps-5 border-0 bg-light">
                                📤 <strong>Exporter les données</strong>
                                <small class="d-block text-muted">JSON ou ZIP compressé</small>
                            </a>
                            <div class="list-group-item list-group-item-action ps-5 border-0 bg-light"
                                 style="cursor: pointer;"
                                 data-bs-toggle="modal"
                                 data-bs-target="#accessCodeModal">
                                🔐 <strong>Changer le code</strong>
                                <small class="d-block text-muted">Modifier le code d'accès</small>
                            </div>
                            <a href="${managePath}parametres.html" class="list-group-item list-group-item-action ps-5 border-0 bg-light">
                                ⚙️ <strong>Paramètres</strong>
                                <small class="d-block text-muted">Configuration de l'app</small>
                            </a>
                            <div class="list-group-item list-group-item-action ps-5 border-0 bg-light text-danger"
                                 style="cursor: pointer;"
                                 data-bs-toggle="modal"
                                 data-bs-target="#uninstallModal">
                                🗑️ <strong>Désinstaller</strong>
                                <small class="d-block text-muted">Supprimer toutes les données</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Déconnexion -->
                <div class="list-group-item list-group-item-action" style="cursor: pointer;" id="logoutBtn">
                    🚪 <strong>Déconnexion</strong>
                    <small class="d-block text-muted">Quitter l'application</small>
                </div>
            </div>
        </div>
    </div>

    <!-- Styles pour le sous-menu collapse -->
    <style>
        /* Animation du chevron */
        #systemMenuToggle .chevron-icon {
            transition: transform 0.3s ease;
            font-size: 0.8em;
            color: var(--bs-secondary);
        }

        #systemMenuToggle[aria-expanded="true"] .chevron-icon {
            transform: rotate(180deg);
        }

        /* Bouton du menu système */
        #systemMenuToggle {
            color: var(--bs-body-color) !important;
            background: none;
            border: none;
        }

        #systemMenuToggle:hover,
        #systemMenuToggle:focus {
            background-color: var(--bs-list-group-hover-bg);
        }

        /* Items du sous-menu */
        #systemSubmenu .list-group-item {
            transition: padding-left 0.2s ease;
        }

        #systemSubmenu .list-group-item:hover {
            padding-left: 2.5rem !important;
            background-color: var(--bs-tertiary-bg) !important;
        }

        /* Style sombre pour thème dark */
        [data-bs-theme="dark"] #systemSubmenu .bg-light {
            background-color: var(--bs-dark-bg-subtle) !important;
        }
    </style>`;
}

/**
 * Initialise les événements du sidebar
 */
export async function initializeSidebarEvents() {
    // Event listener pour la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (typeof ratchouApp !== 'undefined') {
                ratchouApp.logout();
            }
            // Détecter si on est dans le dossier manage/ pour ajuster le chemin
            const isInManageFolder = window.location.pathname.includes('/manage/');
            const indexPath = isInManageFolder ? '../index.html' : 'index.html';

            // Force a real page reload to properly close all connections
            window.location.href = indexPath;
        });
    }

    // Mémoriser l'état du collapse Système dans localStorage
    const systemSubmenu = document.getElementById('systemSubmenu');
    if (systemSubmenu) {
        // Restaurer l'état sauvegardé
        const savedState = RatchouUtils.storage.get('sidebar_system_menu_expanded', false);
        if (savedState) {
            const bsCollapse = new bootstrap.Collapse(systemSubmenu, { toggle: false });
            bsCollapse.show();
        }

        // Sauvegarder l'état lors des changements
        systemSubmenu.addEventListener('shown.bs.collapse', () => {
            RatchouUtils.storage.set('sidebar_system_menu_expanded', true);
        });

        systemSubmenu.addEventListener('hidden.bs.collapse', () => {
            RatchouUtils.storage.set('sidebar_system_menu_expanded', false);
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