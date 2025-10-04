/**
 * Private Mode Detector for Ratchou
 * Détecte le mode navigation privée via test de persistance uniquement
 */

class PrivateModeDetector {
    constructor() {
        // Mode test - forcer la détection via URL
        this.FORCE_TEST_MODE = window.location.search.includes('test-private-mode');
        this.lastResult = false;
    }


    /**
     * Test de demande de persistance (refusé en mode privé)
     * Réutilise les résultats du système PWA si disponible
     */
    async testStoragePersistence() {
        try {
            if (!('storage' in navigator) || !('persist' in navigator.storage)) {
                return false; // API non supportée = mode normal probable
            }

            // Vérifier si déjà persistant
            const isPersistent = await navigator.storage.persisted();
            if (isPersistent) {
                return false; // Déjà persistant = mode normal
            }

            // Réutiliser le résultat du système PWA si disponible
            if (window.storagePersistence && window.storagePersistence.getPersistenceStatus) {
                const pwaResult = window.storagePersistence.getPersistenceStatus();
                if (pwaResult !== null) {
                    return !pwaResult; // PWA a déjà testé
                }
            }

            // Sinon, faire notre propre test
            const granted = await navigator.storage.persist();
            return !granted; // Refusé = mode privé

        } catch (error) {
            console.error('[PrivateMode] Erreur test persistance:', error);
            return false; // Erreur = supposer mode normal
        }
    }

    /**
     * Détection simplifiée du mode privé
     */
    async detectPrivateMode() {
        console.log('[PrivateMode] 🔍 Vérification mode privé...');

        // Test unique de persistance ou mode test forcé
        const persistenceRefused = await this.testStoragePersistence();
        const isPrivate = persistenceRefused || this.FORCE_TEST_MODE;

        console.log('[PrivateMode] Résultat:', {
            persistenceRefused,
            testMode: this.FORCE_TEST_MODE,
            isPrivate
        });

        if (this.FORCE_TEST_MODE) {
            console.warn('[PrivateMode] 🧪 MODE TEST ACTIVÉ');
        }

        this.lastResult = isPrivate;
        return isPrivate;
    }


    /**
     * Obtenir les détails de la dernière détection
     */
    getDetectionDetails() {
        return {
            isPrivate: this.lastResult,
            testMode: this.FORCE_TEST_MODE,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.split(' ')[0]
        };
    }
}

// Instance globale
window.privateModeDetector = new PrivateModeDetector();

// DÉTECTION IMMÉDIATE DÉSACTIVÉE - Plus de redirection automatique
// La détection reste disponible pour usage manuel si nécessaire
/*
(async function immediatePrivateModeCheck() {
    try {
        console.log('[PrivateMode] 🔍 Vérification immédiate au chargement...');

        // Attendre un peu que le DOM soit prêt
        await new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                setTimeout(resolve, 100); // Petit délai pour s'assurer que tout est chargé
            }
        });

        const isPrivate = await window.privateModeDetector.detectPrivateMode();

        if (isPrivate) {
            console.error('[PrivateMode] 🚫 MODE PRIVÉ DÉTECTÉ - REDIRECTION IMMÉDIATE');

            // Redirection immédiate
            const currentPath = window.location.pathname;
            const isInManageFolder = currentPath.includes('/manage/');
            const scope = RatchouUtils.getAppScope();
            const blockPageUrl = isInManageFolder ? '../persistence-required.html' : `${scope}persistence-required.html`;

            console.log(`[PrivateMode] ↪️ Redirection vers: ${blockPageUrl}`);

            // Arrêter complètement le chargement de la page
            window.stop && window.stop();

            // Redirection sans possibilité de retour
            window.location.replace(blockPageUrl);
        } else {
            console.log('[PrivateMode] ✅ Mode normal détecté - continue le chargement');
        }

    } catch (error) {
        console.error('[PrivateMode] ❌ Erreur détection immédiate:', error);
        console.warn('[PrivateMode] ⚠️ Continue le chargement malgré l\'erreur');
    }
})();
*/

// Export pour utilisation module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrivateModeDetector;
}