/**
 * Header Component - Composant de navigation modulaire
 * Génère le bandeau de navigation avec logo, titre et menu hamburger
 */

/**
 * Génère le HTML du header
 * @param {string} title - Titre de la page à afficher
 * @param {boolean} showAccountInfo - Afficher les informations de compte
 * @param {string} logoLink - Lien du logo
 * @returns {string} HTML du header
 */
export function generateHeader(title = '', showAccountInfo = false, logoLink = 'dashboard.html') {
    // Pour les pages dans le dossier manage/, ajuster le chemin des assets
    const isInManageFolder = window.location.pathname.includes('/manage/');
    const assetsPath = isInManageFolder ? '../assets/' : 'assets/';
    const dashboardLink = isInManageFolder ? '../dashboard.html' : 'dashboard.html';
    
    // Structure de base du header
    let headerHTML = `
    <nav class="navbar ratchou-header">
        <div class="container-fluid position-relative">
            <a class="navbar-brand" href="${logoLink === 'dashboard.html' && isInManageFolder ? dashboardLink : logoLink}">
                <img src="${assetsPath}img/Logo_Ratchou.webp" alt="Ratchou Logo">
            </a>`;
    
    if (showAccountInfo) {
        // Header avec informations de compte (dashboard) - centré
        headerHTML += `
            <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1">
                <div class="text-muted">
                    <span class="account-name" style="cursor: pointer;"
                          id="currentAccountName">
                        Chargement...
                    </span>
                </div>
                <div class="account-balance"
                     data-bs-toggle="modal"
                     data-bs-target="#balanceModal"
                     id="currentAccountBalance">
                    0,00 €
                </div>
            </div>`;
    } else if (title) {
        // Header avec titre de page (pages de gestion) - centré
        headerHTML += `
            <div class="d-flex align-items-center justify-content-center flex-grow-1">
                <span class="navbar-text fs-4 fw-bold text-center">${title}</span>
            </div>`;
    }

    // Bouton hamburger en haut à droite
    headerHTML += `
            <button class="btn header-menu-btn"
                    data-bs-toggle="offcanvas"
                    data-bs-target="#sideMenu"
                    title="Menu">
                <i class="header-menu-icon">☰</i>
            </button>
        </div>
    </nav>`;
    
    return headerHTML;
}

/**
 * Styles CSS spécifiques au header (à injecter si nécessaire)
 */
export const headerStyles = `
<style>
    .ratchou-header {
        height: 110px;
        padding: 5px 0;
        position: fixed;
        inset: 0 0 auto 0;
        z-index: 1040;
        background: var(--bs-body-bg);
        box-shadow: 0 0.125rem 0.625rem rgba(0, 0, 0, 0.15);
    }
    
    /* Compensation pour le header fixe */
    body {
        padding-top: 110px;
    }
    
    .navbar-brand img {
        height: 100px;
        transition: all 0.4s ease;
        filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.3));
    }

    /* Dark theme logo effects */
    [data-bs-theme="dark"] .navbar-brand img {
        filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.1));
    }

    .navbar-brand:hover img {
        transform: rotate(360deg);
        filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.6));
        animation: bounce 0.6s ease;
    }

    [data-bs-theme="dark"] .navbar-brand:hover img {
        filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.2));
    }
    
    @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
            transform: translateY(0) rotate(360deg);
        }
        40% {
            transform: translateY(-10px) rotate(360deg);
        }
        60% {
            transform: translateY(-5px) rotate(360deg);
        }
    }
    
    .account-balance, .account-name { 
        cursor: pointer; 
        transition: all 0.3s ease;
    }
    
    .account-name {
        color: var(--bs-body-color);
        opacity: 0.8;
    }
    
    .account-balance:hover, .account-name:hover {
        transform: scale(1.05);
        text-shadow: 0 0 10px rgba(var(--bs-body-color-rgb), 0.6);
    }
    
    .account-balance {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--bs-body-color);
        text-shadow: 1px 1px 3px rgba(var(--bs-body-color-rgb), 0.1);
    }
    
    .amount-positive {
        color: var(--bs-success);
        font-weight: bold;
    }

    .amount-negative {
        color: var(--bs-danger);
        font-weight: bold;
    }
    
    
    /* Navbar text styling */
    .navbar-text {
        color: var(--bs-body-color);
        font-weight: 500;
    }

    /* Bouton hamburger dans le header */
    .header-menu-btn {
        background: rgba(var(--bs-body-color-rgb), 0.1);
        border: 1px solid rgba(var(--bs-body-color-rgb), 0.2);
        color: var(--bs-body-color);
        padding: 0.5rem;
        border-radius: 8px;
        transition: all 0.2s ease;
        min-width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .header-menu-btn:hover {
        background: rgba(var(--bs-body-color-rgb), 0.2);
        border-color: rgba(var(--bs-body-color-rgb), 0.4);
        color: var(--bs-body-color);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .header-menu-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .header-menu-icon {
        font-size: 1.25rem;
        font-weight: bold;
        line-height: 1;
    }

    /* Responsive : optimiser l'affichage sur mobile */
    @media (max-width: 576px) {
        .header-menu-btn {
            min-width: 45px;
            height: 45px;
            padding: 0.4rem;
        }

        .header-menu-icon {
            font-size: 1.1rem;
        }
    }

    /* Sur desktop, on peut garder le bouton - double accès c'est bien */
    @media (min-width: 768px) {
        .header-menu-btn {
            min-width: 55px;
            height: 55px;
        }
    }
    
    /* Optimisation pour les titres de pages */
    .navbar .d-flex.align-items-center {
        flex-wrap: nowrap;
        min-width: 0;
    }
    
    .navbar-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: none;
        flex: 1;
    }
    
</style>`;

/**
 * Initialise les événements du header si nécessaire
 */
export function initializeHeaderEvents() {
    // Les événements sont généralement gérés par les scripts de page
    // Cette fonction est disponible pour des événements spécifiques au header si besoin
}