/**
 * Fixed Footer Component - Navigation fixe en bas d'écran pour PWA
 * Optimisé pour mobile avec support des Safe Areas iOS/Android
 */

/**
 * Génère le HTML du footer fixe
 * @returns {string} HTML du footer fixe
 */
export function generateFixedFooter() {
    return `
    <div class="fixed-footer" id="fixedFooter">
        <div class="fixed-footer-content">
            <button class="footer-btn" data-action="home" title="Accueil">
                <i class="footer-icon">🏠</i>
                <span class="footer-label">Accueil</span>
            </button>
            
            <button class="footer-btn" data-action="menu" title="Menu">
                <i class="footer-icon">☰</i>
                <span class="footer-label">Menu</span>
            </button>
            
            <button class="footer-btn" data-action="export" title="Export">
                <i class="footer-icon">📤</i>
                <span class="footer-label">Export</span>
            </button>
            
            <button class="footer-btn text-danger" data-action="uninstall" title="Désinstaller">
                <i class="footer-icon">🗑️</i>
                <span class="footer-label">Désinstaller</span>
            </button>
            
            <button class="footer-btn" data-action="settings" title="Paramètres">
                <i class="footer-icon">⚙️</i>
                <span class="footer-label">Paramètres</span>
            </button>
        </div>
    </div>`;
}

/**
 * Styles CSS pour le footer fixe
 */
export const fixedFooterStyles = `
<style>
    /* Footer fixe principal */
    .fixed-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);
        z-index: 1035;
        transition: transform 0.3s ease, opacity 0.3s ease;
        
        /* Support des Safe Areas iOS/Android */
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
    }
    
    /* Contenu du footer */
    .fixed-footer-content {
        display: flex;
        align-items: center;
        justify-content: space-around;
        height: 60px;
        padding: 0 8px;
    }
    
    /* Boutons du footer */
    .footer-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        min-height: 44px;
        padding: 4px 8px;
        background: none;
        border: none;
        border-radius: 8px;
        color: #6c757d;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        flex: 1;
        max-width: 80px;
    }
    
    .footer-btn:hover,
    .footer-btn:focus {
        color: #0d6efd;
        background-color: rgba(13, 110, 253, 0.1);
        outline: none;
        transform: scale(1.05);
    }
    
    .footer-btn:active {
        transform: scale(0.95);
    }
    
    /* Icônes */
    .footer-icon {
        font-size: 18px;
        margin-bottom: 2px;
        display: block;
        line-height: 1;
    }
    
    /* Labels */
    .footer-label {
        font-size: 10px;
        font-weight: 500;
        line-height: 1;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }
    
    /* État actif pour le bouton courant */
    .footer-btn.active {
        color: #0d6efd;
        background-color: rgba(13, 110, 253, 0.15);
    }
    
    .footer-btn.active .footer-icon {
        transform: scale(1.1);
    }
    
    /* Compensation pour le body quand le footer est affiché */
    body.has-fixed-footer {
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
    }
    
    /* Animation d'entrée */
    .fixed-footer.slide-in {
        animation: slideInUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    @keyframes slideInUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    /* Footer visible sur tous les appareils */
    
    /* Optimisation pour très petits écrans */
    @media (max-width: 360px) {
        .footer-btn {
            min-width: 40px;
            padding: 2px 4px;
        }
        
        .footer-icon {
            font-size: 16px;
        }
        
        .footer-label {
            font-size: 9px;
        }
    }
    
    /* Optimisation pour écrans très hauts (iPhone Pro Max, etc.) */
    @media (min-height: 800px) and (max-width: 480px) {
        .fixed-footer {
            height: 65px;
        }
        
        .fixed-footer-content {
            height: 65px;
        }
        
        body.has-fixed-footer {
            padding-bottom: calc(65px + env(safe-area-inset-bottom));
        }
    }
    
    /* Mode sombre (si implémenté plus tard) */
    @media (prefers-color-scheme: dark) {
        .fixed-footer {
            background: rgba(33, 37, 41, 0.95);
            border-top-color: rgba(255, 255, 255, 0.1);
            box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.3);
        }
        
        .footer-btn {
            color: #adb5bd;
        }
        
        .footer-btn:hover,
        .footer-btn:focus {
            color: #0d6efd;
            background-color: rgba(13, 110, 253, 0.2);
        }
        
        .footer-btn.active {
            color: #0d6efd;
            background-color: rgba(13, 110, 253, 0.3);
        }
    }
    
    /* Masquer si l'utilisateur a désactivé le footer */
    body.fixed-footer-disabled .fixed-footer {
        display: none !important;
    }
    
    body.fixed-footer-disabled {
        padding-bottom: 0 !important;
    }
    
    /* Support des gestes iOS (swipe indicator) */
    @supports (-webkit-touch-callout: none) {
        .fixed-footer {
            padding-bottom: max(env(safe-area-inset-bottom), 12px);
        }
    }
    
    /* Feedback tactile pour les appareils supportant les vibrations */
    .footer-btn.haptic-feedback {
        position: relative;
    }
    
    .footer-btn.haptic-feedback::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background: rgba(13, 110, 253, 0.3);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        opacity: 0;
        transition: all 0.2s ease;
    }
    
    .footer-btn.haptic-feedback:active::after {
        width: 40px;
        height: 40px;
        opacity: 1;
    }
</style>`;

/**
 * Initialise le footer fixe et ses événements
 */
export function initializeFixedFooter() {
    const footer = document.getElementById('fixedFooter');
    if (!footer) return;
    
    // Vérifier si le footer doit être affiché
    if (!shouldShowFixedFooter()) {
        footer.style.display = 'none';
        document.body.classList.remove('has-fixed-footer');
        return;
    }
    
    // Appliquer les classes CSS
    document.body.classList.add('has-fixed-footer');
    footer.classList.add('slide-in');
    
    // Configurer les boutons actifs selon la page
    setActiveFooterButton();
    
    // Ajouter les event listeners
    setupFooterEventListeners();
    
    // Gérer le redimensionnement de fenêtre
    handleWindowResize();
    
    console.log('Fixed footer initialized');
}

/**
 * Détermine si le footer fixe doit être affiché
 */
function shouldShowFixedFooter() {
    // Afficher sur tous les appareils
    return true;
}

/**
 * Configure les event listeners du footer
 */
function setupFooterEventListeners() {
    const footerButtons = document.querySelectorAll('.footer-btn');
    
    footerButtons.forEach(button => {
        button.addEventListener('click', handleFooterAction);
        button.addEventListener('touchstart', addHapticFeedback, { passive: true });
    });
}

/**
 * Gère les actions des boutons du footer
 */
function handleFooterAction(event) {
    const action = event.currentTarget.getAttribute('data-action');
    const button = event.currentTarget;
    
    // Feedback visuel
    button.classList.add('haptic-feedback');
    setTimeout(() => button.classList.remove('haptic-feedback'), 200);
    
    // Vibration légère sur mobile (si supportée)
    if ('vibrate' in navigator) {
        navigator.vibrate(10);
    }
    
    switch (action) {
        case 'home':
            navigateHome();
            break;
        case 'menu':
            toggleSideMenu();
            break;
        case 'export':
            showExportOptions();
            break;
        case 'settings':
            navigateToSettings();
            break;
        case 'uninstall':
            handleUninstallAction();
            break;
    }
    
    // Mettre à jour le bouton actif
    updateActiveButton(button);
}

/**
 * Navigation vers l'accueil
 */
function navigateHome() {
    // Vérifier si on est déjà sur le dashboard
    if (window.location.pathname.includes('dashboard.html') || window.location.pathname.endsWith('/')) {
        // Scroll vers le haut si on est déjà sur le dashboard
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    
    // Navigation vers le dashboard
    const isInManageFolder = window.location.pathname.includes('/manage/');
    const dashboardPath = isInManageFolder ? '../dashboard.html' : 'dashboard.html';
    
    window.location.href = dashboardPath;
}

/**
 * Toggle du menu latéral
 */
function toggleSideMenu() {
    // Utiliser l'API Bootstrap pour ouvrir le sidebar
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu) {
        const offcanvas = new bootstrap.Offcanvas(sideMenu);
        offcanvas.show();
    }
}

/**
 * Affiche les options d'export
 */
function showExportOptions() {
    // Navigation vers la page d'export
    const isInManageFolder = window.location.pathname.includes('/manage/');
    const exportPath = isInManageFolder ? 'export.html' : 'manage/export.html';
    
    window.location.href = exportPath;
}

/**
 * Crée une modale d'export rapide
 */
function createQuickExportModal() {
    const modalHTML = `
        <div class="modal fade" id="quickExportModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">📤 Export rapide</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="quickExportJSON()">
                                💾 Exporter en JSON
                            </button>
                            <button class="btn btn-outline-primary" onclick="quickBackup()">
                                🔒 Sauvegarde complète
                            </button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Ajouter au DOM si pas déjà présent
    if (!document.getElementById('quickExportModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('quickExportModal'));
    modal.show();
}

/**
 * Navigation vers la page Paramètres
 */
function navigateToSettings() {
    // Détecter si on est dans le dossier manage/
    const isInManageFolder = window.location.pathname.includes('/manage/');
    const settingsPath = isInManageFolder ? 'parametres.html' : 'manage/parametres.html';
    
    // Navigation vers la page paramètres
    window.location.href = settingsPath;
}

/**
 * Gère l'action de désinstallation
 */
function handleUninstallAction() {
    const uninstallModal = document.getElementById('uninstallModal');
    if (uninstallModal) {
        const modal = new bootstrap.Modal(uninstallModal);
        modal.show();
    } else {
        console.error('La modale de désinstallation n\'a pas été trouvée.');
        alert('Erreur : Impossible d\'ouvrir la fenêtre de désinstallation.');
    }
}

/**
 * Met à jour le bouton actif
 */
function updateActiveButton(activeButton) {
    // Retirer la classe active de tous les boutons
    document.querySelectorAll('.footer-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Ajouter la classe active au bouton cliqué
    if (activeButton) {
        activeButton.classList.add('active');
        
        // Retirer après un délai
        setTimeout(() => {
            activeButton.classList.remove('active');
        }, 1000);
    }
}

/**
 * Définit le bouton actif selon la page courante
 */
function setActiveFooterButton() {
    const currentPath = window.location.pathname;
    let activeAction = '';
    
    if (currentPath.includes('dashboard.html') || currentPath.endsWith('/')) {
        activeAction = 'home';
    }
    
    if (activeAction) {
        const activeButton = document.querySelector(`.footer-btn[data-action="${activeAction}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
}

/**
 * Ajoute un feedback haptique
 */
function addHapticFeedback(event) {
    const button = event.currentTarget;
    button.classList.add('haptic-feedback');
}

/**
 * Gère le redimensionnement de fenêtre
 */
function handleWindowResize() {
    window.addEventListener('resize', () => {
        const footer = document.getElementById('fixedFooter');
        if (!footer) return;
        
        if (shouldShowFixedFooter()) {
            footer.style.display = 'block';
            document.body.classList.add('has-fixed-footer');
        } else {
            footer.style.display = 'none';
            document.body.classList.remove('has-fixed-footer');
        }
    });
}


// Fonctions globales pour les actions d'export rapide
window.quickExportJSON = async function() {
    try {
        if (typeof ratchouApp !== 'undefined' && ratchouApp.exportToJSON) {
            const data = await ratchouApp.exportToJSON();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ratchou_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Fermer la modale
            const modal = bootstrap.Modal.getInstance(document.getElementById('quickExportModal'));
            if (modal) modal.hide();
        }
    } catch (error) {
        console.error('Erreur export:', error);
        alert('Erreur lors de l\'export');
    }
};

window.quickBackup = function() {
    // Utiliser la fonction d'export existante ou fallback
    if (typeof window.quickExportJSON === 'function') {
        window.quickExportJSON();
    }
};

