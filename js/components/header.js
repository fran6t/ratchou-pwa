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
    <nav class="navbar navbar-dark ratchou-header">
        <div class="container-fluid position-relative">
            <a class="navbar-brand" href="${logoLink === 'dashboard.html' && isInManageFolder ? dashboardLink : logoLink}">
                <img src="${assetsPath}img/Logo_Ratchou.webp" alt="Ratchou Logo">
            </a>`;
    
    if (showAccountInfo) {
        // Header avec informations de compte (dashboard) - centré
        headerHTML += `
            <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1">
                <div class="text-white-50">
                    <span class="account-name" style="cursor: pointer;" 
                          title="Changer de compte" 
                          data-bs-toggle="tooltip" 
                          data-bs-title="👆 Cliquez pour changer de compte"
                          data-bs-placement="left"
                          id="currentAccountName">
                        Chargement...
                    </span>
                </div>
                <div class="account-balance" 
                     data-bs-toggle="modal" 
                     data-bs-target="#balanceModal" 
                     title="💰 Cliquez pour corriger le solde"
                     data-tooltip-message="💰 Cliquez pour corriger le solde"
                     data-tooltip-placement="right"
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
    
    
    headerHTML += `
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
        position: fixed !important;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1040;
        background: #f8f8f8 !important;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
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
    
    .navbar-brand:hover img {
        transform: rotate(360deg);
        filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.6));
        animation: bounce 0.6s ease;
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
        color: #0c3d5c !important;
    }
    
    .account-balance:hover, .account-name:hover {
        transform: scale(1.05);
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
    }
    
    .account-balance { 
        font-size: 1.5rem; 
        font-weight: bold; 
        color: white;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .amount-positive { 
        color: #198754; 
        font-weight: bold; 
    }
    
    .amount-negative { 
        color: #dc3545; 
        font-weight: bold; 
    }
    
    
    /* Couleur du texte navbar pour le fond clair */
    .navbar-text {
        color: #0c3d5c !important;
        font-weight: 500;
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