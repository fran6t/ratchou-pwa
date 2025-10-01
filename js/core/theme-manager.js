/**
 * Theme Manager - Gestion du dark mode pour Ratchou
 * Logique à 3 niveaux : Préférence utilisateur > Système > Light par défaut
 */

class ThemeManager {
    constructor() {
        this.storageKey = 'ratchou-theme';
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.currentTheme = null;
    }

    /**
     * Initialise le gestionnaire de thèmes
     */
    init() {
        // Appliquer le thème au démarrage
        this.applyTheme(this.getTheme());

        // Écouter les changements de préférence système
        this.mediaQuery.addEventListener('change', (e) => {
            // Ne réagir que si aucune préférence utilisateur explicite
            if (!localStorage.getItem(this.storageKey)) {
                this.applyTheme(this.getTheme());
            }
        });
    }

    /**
     * Détermine le thème à utiliser selon la logique à 3 niveaux
     * @returns {string} 'light' | 'dark'
     */
    getTheme() {
        // 1. Préférence utilisateur explicite
        const userTheme = localStorage.getItem(this.storageKey);
        if (userTheme && ['light', 'dark', 'auto'].includes(userTheme)) {
            if (userTheme === 'auto') {
                // Mode auto : utiliser la préférence système
                return this.mediaQuery.matches ? 'dark' : 'light';
            }
            return userTheme;
        }

        // 2. Préférence système si pas de choix explicite
        if (this.mediaQuery.matches) {
            return 'dark';
        }

        // 3. Light par défaut
        return 'light';
    }

    /**
     * Applique le thème à l'interface
     * @param {string} theme 'light' | 'dark'
     */
    applyTheme(theme) {
        const htmlElement = document.documentElement;

        if (theme === 'dark') {
            htmlElement.setAttribute('data-bs-theme', 'dark');
            htmlElement.classList.add('dark-theme');
        } else {
            htmlElement.setAttribute('data-bs-theme', 'light');
            htmlElement.classList.remove('dark-theme');
        }

        this.currentTheme = theme;

        // Émettre un événement personnalisé pour les composants qui en ont besoin
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }

    /**
     * Change le thème utilisateur et le sauvegarde
     * @param {string} theme 'light' | 'dark' | 'auto'
     */
    setTheme(theme) {
        if (!['light', 'dark', 'auto'].includes(theme)) {
            console.warn('Theme invalide:', theme);
            return;
        }

        // Sauvegarder la préférence
        localStorage.setItem(this.storageKey, theme);

        // Appliquer le thème
        const resolvedTheme = theme === 'auto'
            ? (this.mediaQuery.matches ? 'dark' : 'light')
            : theme;

        this.applyTheme(resolvedTheme);
    }

    /**
     * Récupère la préférence utilisateur actuelle
     * @returns {string} 'light' | 'dark' | 'auto'
     */
    getUserPreference() {
        return localStorage.getItem(this.storageKey) || 'auto';
    }

    /**
     * Bascule entre light et dark (pour bouton toggle simple)
     */
    toggle() {
        const currentTheme = this.getTheme();
        this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }

    /**
     * Retourne l'état actuel du thème
     * @returns {string} 'light' | 'dark'
     */
    getCurrentTheme() {
        return this.currentTheme || this.getTheme();
    }
}

// Instance globale
window.themeManager = new ThemeManager();

// Auto-initialisation si le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager.init();
    });
} else {
    window.themeManager.init();
}