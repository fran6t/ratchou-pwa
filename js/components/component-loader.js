/**
 * Component Loader - Système de chargement dynamique des composants
 * Permet de charger et injecter des composants HTML réutilisables
 */
class ComponentLoader {
    
    /**
     * Charge le composant header (navigation)
     * @param {Object} options - Configuration du header
     * @param {string} options.title - Titre de la page
     * @param {boolean} options.showAccountInfo - Afficher les infos de compte
     * @param {string} options.logoLink - Lien du logo (par défaut: dashboard.html)
     */
    static async loadHeader(options = {}) {
        const {
            title = '',
            showAccountInfo = false,
            logoLink = '../dashboard.html'
        } = options;

        const headerModule = await import('./header.js');
        const headerHTML = headerModule.generateHeader(title, showAccountInfo, logoLink);
        
        // Injecter les styles du header s'ils ne sont pas déjà présents
        if (!document.querySelector('#header-styles')) {
            const styleElement = document.createElement('div');
            styleElement.id = 'header-styles';
            styleElement.innerHTML = headerModule.headerStyles;
            document.head.appendChild(styleElement.firstElementChild);
        }
        
        // Injecter le header au début du body
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    /**
     * Charge le composant sidebar (menu hamburger)
     */
    static async loadSidebar() {
        const sidebarModule = await import('./sidebar.js');
        const sidebarHTML = sidebarModule.generateSidebar();
        
        // Injecter le sidebar après le contenu principal
        document.body.insertAdjacentHTML('beforeend', sidebarHTML);
        
        // Initialiser les événements du sidebar
        sidebarModule.initializeSidebarEvents();
    }

    /**
     * Charge les modales communes
     */
    static async loadCommonModals() {
        const modalsModule = await import('./modals.js');
        const modalsHTML = modalsModule.generateModals();
        
        // Injecter les modales à la fin du body
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
        
        // Initialiser les événements après un court délai pour garantir que le DOM est prêt
        setTimeout(() => {
            modalsModule.initializeModalEvents();
        }, 0);
    }


    /**
     * Charge le composant footer fixe (navigation mobile PWA)
     */
    static async loadFixedFooter() {
        const fixedFooterModule = await import('./fixed-footer.js');
        const fixedFooterHTML = fixedFooterModule.generateFixedFooter();
        
        // Injecter les styles du footer fixe s'ils ne sont pas déjà présents
        if (!document.querySelector('#fixed-footer-styles')) {
            const styleElement = document.createElement('div');
            styleElement.id = 'fixed-footer-styles';
            styleElement.innerHTML = fixedFooterModule.fixedFooterStyles;
            document.head.appendChild(styleElement.firstElementChild);
        }
        
        // Injecter le footer fixe à la fin du body
        document.body.insertAdjacentHTML('beforeend', fixedFooterHTML);
        
        // Initialiser les événements du footer fixe
        if (fixedFooterModule.initializeFixedFooter) {
            fixedFooterModule.initializeFixedFooter();
        }
    }

    /**
     * Charge le système import/export
     */
    static async loadImportExport() {
        const importExportModule = await import('./import-export.js');
        
        // Initialiser les événements import/export
        importExportModule.initializeImportExportEvents();
    }

    /**
     * Charge tous les composants communs d'une page
     * @param {Object} headerOptions - Options pour le header
     * @param {boolean} loadFixedFooter - Charger le footer fixe (défaut: true)
     */
    static async loadAll(headerOptions = {}, loadFixedFooter = true) {
        await this.loadHeader(headerOptions);
        await this.loadSidebar();
        await this.loadCommonModals();
        await this.loadImportExport();
        
        // Charger le footer fixe si demandé
        if (loadFixedFooter) {
            await this.loadFixedFooter();
        }
    }

    /**
     * Utilitaire pour charger les composants avec gestion d'erreurs
     * @param {Function} loaderFunction - Fonction de chargement
     * @param {string} componentName - Nom du composant pour les erreurs
     */
    static async safeLoad(loaderFunction, componentName) {
        try {
            await loaderFunction();
        } catch (error) {
            console.error(`Erreur lors du chargement du composant ${componentName}:`, error);
            // Continuer le chargement des autres composants même en cas d'erreur
        }
    }

    /**
     * Méthode générique pour charger un composant par nom
     * @param {string} componentName - Nom du composant ('header', 'sidebar', etc.)
     * @param {Object} options - Options pour le composant
     */
    static async loadComponent(componentName, options = {}) {
        switch (componentName.toLowerCase()) {
            case 'header':
                return await this.safeLoad(() => this.loadHeader(options), 'header');
            case 'sidebar':
                return await this.safeLoad(() => this.loadSidebar(), 'sidebar');
            case 'fixed-footer':
                return await this.safeLoad(() => this.loadFixedFooter(), 'fixed-footer');
            case 'modals':
                return await this.safeLoad(() => this.loadCommonModals(), 'modals');
            case 'import-export':
                return await this.safeLoad(() => this.loadImportExport(), 'import-export');
            default:
                console.warn(`Composant inconnu: ${componentName}`);
        }
    }
}

// Rendre disponible globalement
window.ComponentLoader = ComponentLoader;