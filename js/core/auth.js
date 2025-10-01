/**
 * Authentication System for Ratchou IndexedDB
 * Manages access code verification and session persistence
 */

class RatchouAuth {
    constructor(db) {
        this.db = db;
        this.storageKey = 'auth_session';
        this.session = null;
    }

    /**
     * Verify access code and establish session
     */
    async login(accessCode) {
        try {
            RatchouUtils.debug.log('Attempting login with access code');
            
            // Validate access code format
            if (!RatchouUtils.validate.accessCode(accessCode)) {
                return RatchouUtils.error.validation('Le code doit contenir exactement 4 chiffres');
            }

            // Get stored access code from database
            const userData = await this.db.get('UTILISATEUR', accessCode);
            
            if (!userData) {
                return RatchouUtils.error.validation('Code d\'accès incorrect');
            }

            // Create session with hashed access code for security
            const hashedCode = await RatchouUtils.crypto.hashAccessCode(accessCode);
            this.session = {
                isAuthenticated: true,
                accessCode: hashedCode,  // Hashed for localStorage security
                loginTime: RatchouUtils.date.now(),
                lastActivity: RatchouUtils.date.now()
            };

            // Store session in localStorage
            RatchouUtils.storage.set(this.storageKey, this.session);

            RatchouUtils.debug.log('Login successful');
            
            return RatchouUtils.error.success('Connexion réussie', this.session);
            
        } catch (error) {
            console.error('Login error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'connexion');
        }
    }

    /**
     * Logout and clear session
     */
    logout() {
        try {
            RatchouUtils.debug.log('Logging out');
            
            this.session = null;
            RatchouUtils.storage.remove(this.storageKey);
            
            return RatchouUtils.error.success('Déconnexion réussie');
            
        } catch (error) {
            console.error('Logout error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'déconnexion');
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        try {
            // Check if session exists in memory
            if (this.session && this.session.isAuthenticated) {
                return true;
            }

            // Check stored session
            const storedSession = RatchouUtils.storage.get(this.storageKey);
            if (storedSession && storedSession.isAuthenticated) {
                this.session = storedSession;
                return true;
            }

            return false;
            
        } catch (error) {
            console.error('Authentication check error:', error);
            return false;
        }
    }

    /**
     * Get current session info
     */
    getSession() {
        if (this.isAuthenticated()) {
            return this.session;
        }
        return null;
    }

    /**
     * Update last activity timestamp
     */
    updateActivity() {
        if (this.session) {
            this.session.lastActivity = RatchouUtils.date.now();
            RatchouUtils.storage.set(this.storageKey, this.session);
        }
    }

    /**
     * Change access code
     */
    async changeAccessCode(currentCode, newCode) {
        try {
            RatchouUtils.debug.log('Changing access code');
            
            // Validate current code by comparing hashes
            const currentHashedCode = await RatchouUtils.crypto.hashAccessCode(currentCode);
            if (!this.isAuthenticated() || this.session.accessCode !== currentHashedCode) {
                return RatchouUtils.error.validation('Code actuel incorrect');
            }

            // Validate new code format
            if (!RatchouUtils.validate.accessCode(newCode)) {
                return RatchouUtils.error.validation('Le nouveau code doit contenir exactement 4 chiffres');
            }

            // Get old user data to preserve device_id
            const oldUserData = await this.db.get('UTILISATEUR', currentCode);
            const deviceId = oldUserData ? oldUserData.device_id : RatchouUtils.device.generateDeviceId();

            // Remove old user record
            await this.db.delete('UTILISATEUR', currentCode);

            // Create new user record
            const newUserData = { code_acces: newCode, device_id: deviceId };
            await this.db.put('UTILISATE-UR', newUserData);

            // Update current session with new hashed code
            const newHashedCode = await RatchouUtils.crypto.hashAccessCode(newCode);
            this.session.accessCode = newHashedCode;
            RatchouUtils.storage.set(this.storageKey, this.session);

            return RatchouUtils.error.success('Code d\'accès modifié avec succès');
            
        } catch (error) {
            console.error('Change access code error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'modification code accès');
        }
    }

    /**
     * Initialize authentication system (create default user if none exists)
     */
    async initialize() {
        try {
            RatchouUtils.debug.log('Initializing auth system');
            
            // Check if any user exists
            const userCount = await this.db.count('UTILISATEUR');
            
            if (userCount === 0) {
                // On a fresh install, the setup page is now responsible for creating the first user.
                // This logic is kept intentionally simple.
                RatchouUtils.debug.log('Auth initialized on a fresh database. Awaiting setup.');
                return RatchouUtils.error.success('Système d\'authentification prêt pour la configuration.');
            }
            
            return RatchouUtils.error.success('Système d\'authentification initialisé');
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            return RatchouUtils.error.handleIndexedDBError(error, 'initialisation authentification');
        }
    }

    /**
     * Check if any user exists (for first-run detection)
     */
    async checkUserExists() {
        try {
            const allUsers = await this.db.getAll('UTILISATEUR');
            return allUsers && allUsers.length > 0;
        } catch (error) {
            console.error('Error checking if users exist:', error);
            return false;
        }
    }

    /**
     * Check if default access code is still in use
     */
    async isDefaultCodeActive() {
        try {
            const defaultUser = await this.db.get('UTILISATEUR', '1234');
            return defaultUser !== null;
        } catch (error) {
            console.error('Error checking default code:', error);
            return false;
        }
    }

    /**
     * Get current access code (for authenticated users only)
     */
    async getCurrentAccessCode() {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }
        
        return this.session.accessCode;
    }

    /**
     * Session timeout check (optional - for security)
     */
    isSessionExpired(timeoutMinutes = 480) { // 8 hours default
        if (!this.session || !this.session.lastActivity) {
            return true;
        }
        
        const lastActivity = new Date(this.session.lastActivity);
        const now = new Date();
        const diffMinutes = (now - lastActivity) / (1000 * 60);
        
        return diffMinutes > timeoutMinutes;
    }

    /**
     * Force logout if session expired
     */
    checkSessionTimeout() {
        if (this.isAuthenticated() && this.isSessionExpired()) {
            this.logout();
            return true; // Session was expired and user logged out
        }
        return false;
    }

    /**
     * Require authentication (middleware-like function)
     */
    requireAuth() {
        if (this.checkSessionTimeout()) {
            throw new Error('Session expired. Please login again.');
        }
        
        if (!this.isAuthenticated()) {
            throw new Error('Authentication required. Please login.');
        }
        
        // Update activity
        this.updateActivity();
        
        return true;
    }

}

// Export for use in other modules
window.RatchouAuth = RatchouAuth;

// Global auth utilities for centralized session management
window.auth = window.auth || {};

/**
 * Quick authentication check without initializing full RatchouAuth
 */
auth.isAuthenticated = function () {
    try {
        // First check if ratchouApp is available and initialized
        if (window.ratchouApp && typeof ratchouApp.isAuthenticated === 'function') {
            return !!ratchouApp.isAuthenticated();
        }
        
        // Fallback to localStorage check
        const sess = localStorage.getItem('auth_session');
        if (!sess) return false;
        
        const session = JSON.parse(sess);
        
        // Check if session has expiration and if it's still valid
        if (session.expiresAt) {
            return Date.now() < session.expiresAt;
        }
        
        // Session exists and is marked as authenticated
        return !!session.isAuthenticated;
    } catch (error) {
        console.warn('Error checking authentication status:', error);
        return false;
    }
};

/**
 * Centralized page guard system
 * @param {string} kind - 'login' for login page, 'app' for application pages
 * @returns {boolean} - true if page access is allowed, false if redirected
 */
auth.guardPage = function (kind) {
    const authed = auth.isAuthenticated();
    
    if (kind === 'login' && authed) {
        // User is authenticated but on login page - redirect to dashboard
        if (!location.pathname.endsWith('dashboard.html')) {
            console.log('Authenticated user on login page - redirecting to dashboard');
            location.replace('dashboard.html');
        }
        return false; // Page access denied (redirected)
    }
    
    if (kind === 'app' && !authed) {
        // User is not authenticated but on app page - redirect to login
        if (!location.pathname.endsWith('index.html')) {
            console.log('Unauthenticated user on app page - redirecting to login');
            location.replace('index.html');
        }
        return false; // Page access denied (redirected)
    }
    
    return true; // Page access allowed
};