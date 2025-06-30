/**
 * HistoryPrivacy - Privacy-first consent and data control system
 * Implements GDPR/CCPA compliance with user data sovereignty
 */

// Privacy consent states
const CONSENT_STATES = {
    UNKNOWN: 'unknown',
    GRANTED: 'granted', 
    DENIED: 'denied',
    INCOGNITO: 'incognito'
};

// Privacy storage keys
const PRIVACY_KEYS = {
    CONSENT_STATE: 'whisper_hub_privacy_consent',
    CONSENT_TIMESTAMP: 'whisper_hub_privacy_timestamp',
    INCOGNITO_MODE: 'whisper_hub_incognito_mode'
};

class HistoryPrivacy {
    constructor() {
        this.consentState = CONSENT_STATES.UNKNOWN;
        this.incognitoMode = false;
        this.init();
    }

    /**
     * Initialize privacy system
     */
    init() {
        this.loadConsentState();
        this.loadIncognitoState();
        this.setupPrivacyControls();
    }

    /**
     * Check if user has granted consent for history storage
     */
    hasConsent() {
        return this.consentState === CONSENT_STATES.GRANTED && !this.incognitoMode;
    }

    /**
     * Check if user is in incognito mode
     */
    isIncognitoMode() {
        return this.incognitoMode;
    }

    /**
     * Get current consent state
     */
    getConsentState() {
        return {
            state: this.consentState,
            incognito: this.incognitoMode,
            timestamp: localStorage.getItem(PRIVACY_KEYS.CONSENT_TIMESTAMP),
            canStore: this.hasConsent()
        };
    }

    /**
     * Show first-time privacy consent modal
     */
    async showConsentModal(transcriptionData) {
        return new Promise((resolve) => {
            // Create modal HTML
            const modal = this.createConsentModal(transcriptionData);
            document.body.appendChild(modal);

            // Handle consent choices
            const handleChoice = (granted) => {
                this.setConsent(granted ? CONSENT_STATES.GRANTED : CONSENT_STATES.DENIED);
                document.body.removeChild(modal);
                resolve(granted);
            };

            // Bind event handlers
            modal.querySelector('.consent-grant').addEventListener('click', () => handleChoice(true));
            modal.querySelector('.consent-deny').addEventListener('click', () => handleChoice(false));
            modal.querySelector('.modal-close').addEventListener('click', () => handleChoice(false));

            // ESC key handling
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    handleChoice(false);
                }
            };
            document.addEventListener('keydown', escHandler);

            // Show modal with animation
            setTimeout(() => modal.classList.add('show'), 10);
        });
    }

    /**
     * Set user consent preference
     */
    setConsent(state) {
        this.consentState = state;
        localStorage.setItem(PRIVACY_KEYS.CONSENT_STATE, state);
        localStorage.setItem(PRIVACY_KEYS.CONSENT_TIMESTAMP, Date.now().toString());

        // Emit consent change event
        this.emitConsentChange();
    }

    /**
     * Toggle incognito mode
     */
    toggleIncognitoMode(enabled = null) {
        if (enabled === null) {
            this.incognitoMode = !this.incognitoMode;
        } else {
            this.incognitoMode = enabled;
        }

        if (this.incognitoMode) {
            sessionStorage.setItem(PRIVACY_KEYS.INCOGNITO_MODE, 'true');
        } else {
            sessionStorage.removeItem(PRIVACY_KEYS.INCOGNITO_MODE);
        }

        // Update UI
        this.updateIncognitoUI();
        this.emitConsentChange();
    }

    /**
     * Show privacy settings modal
     */
    showPrivacySettings() {
        const modal = this.createPrivacySettingsModal();
        document.body.appendChild(modal);

        // Handle settings changes
        const handleSave = () => {
            const formData = new FormData(modal.querySelector('.privacy-settings-form'));
            const newIncognito = formData.get('incognito') === 'on';
            const newConsent = formData.get('consent');

            this.toggleIncognitoMode(newIncognito);
            if (newConsent && newConsent !== this.consentState) {
                this.setConsent(newConsent);
            }

            document.body.removeChild(modal);
        };

        const handleClose = () => {
            document.body.removeChild(modal);
        };

        // Bind event handlers
        modal.querySelector('.settings-save').addEventListener('click', handleSave);
        modal.querySelector('.settings-cancel').addEventListener('click', handleClose);
        modal.querySelector('.modal-close').addEventListener('click', handleClose);

        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
    }

    /**
     * Show data export warning before clearing history
     */
    async showClearWarning() {
        return new Promise((resolve) => {
            const modal = this.createClearWarningModal();
            document.body.appendChild(modal);

            const handleChoice = (confirmed) => {
                document.body.removeChild(modal);
                resolve(confirmed);
            };

            // Bind event handlers
            modal.querySelector('.clear-confirm').addEventListener('click', () => handleChoice(true));
            modal.querySelector('.clear-cancel').addEventListener('click', () => handleChoice(false));
            modal.querySelector('.clear-export').addEventListener('click', () => {
                // Trigger export then ask again
                window.historyManager?.exportData('json');
                handleChoice(false);
            });

            // Show modal
            setTimeout(() => modal.classList.add('show'), 10);
        });
    }

    /**
     * Create privacy consent modal HTML
     */
    createConsentModal(transcriptionData) {
        const modal = document.createElement('div');
        modal.className = 'privacy-modal-overlay';
        modal.innerHTML = `
            <div class="privacy-modal">
                <div class="modal-header">
                    <h3>💾 Save Transcription to History?</h3>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="transcription-preview">
                        <h4>📄 ${transcriptionData.filename}</h4>
                        <p class="file-details">${transcriptionData.fileType} • ${this.formatFileSize(transcriptionData.fileSize)} • ${transcriptionData.characterCount} characters</p>
                        <div class="transcript-preview">${this.truncateText(transcriptionData.transcript, 150)}...</div>
                    </div>
                    
                    <div class="privacy-explanation">
                        <h4>🔒 Your Privacy is Protected</h4>
                        <div class="privacy-features">
                            <div class="privacy-feature">
                                <span class="feature-icon">🏠</span>
                                <div>
                                    <strong>Stored locally only</strong>
                                    <p>Your transcriptions never leave your device</p>
                                </div>
                            </div>
                            <div class="privacy-feature">
                                <span class="feature-icon">🗑️</span>
                                <div>
                                    <strong>You control your data</strong>
                                    <p>Delete individual items or clear all history anytime</p>
                                </div>
                            </div>
                            <div class="privacy-feature">
                                <span class="feature-icon">📤</span>
                                <div>
                                    <strong>Export your data</strong>
                                    <p>Download your history in multiple formats</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="storage-info">
                            <p><strong>Storage:</strong> Uses your browser's local storage (typically 5-10MB limit)</p>
                            <p><strong>Retention:</strong> Auto-cleanup after 30 days (configurable)</p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="consent-deny btn-secondary">📵 No, Don't Save</button>
                    <button class="consent-grant btn-primary">✅ Yes, Enable History</button>
                </div>
            </div>
        `;
        return modal;
    }

    /**
     * Create privacy settings modal HTML
     */
    createPrivacySettingsModal() {
        const currentState = this.getConsentState();
        const modal = document.createElement('div');
        modal.className = 'privacy-modal-overlay';
        modal.innerHTML = `
            <div class="privacy-modal settings-modal">
                <div class="modal-header">
                    <h3>⚙️ Privacy Settings</h3>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                
                <div class="modal-body">
                    <form class="privacy-settings-form">
                        <div class="setting-group">
                            <h4>🔒 Data Storage</h4>
                            <label class="setting-item">
                                <input type="radio" name="consent" value="${CONSENT_STATES.GRANTED}" 
                                       ${currentState.state === CONSENT_STATES.GRANTED ? 'checked' : ''}>
                                <div class="setting-content">
                                    <strong>Enable History</strong>
                                    <p>Save transcriptions to browser storage for easy access</p>
                                </div>
                            </label>
                            <label class="setting-item">
                                <input type="radio" name="consent" value="${CONSENT_STATES.DENIED}"
                                       ${currentState.state === CONSENT_STATES.DENIED ? 'checked' : ''}>
                                <div class="setting-content">
                                    <strong>Disable History</strong>
                                    <p>Don't save transcriptions (existing history preserved)</p>
                                </div>
                            </label>
                        </div>
                        
                        <div class="setting-group">
                            <h4>🕶️ Session Mode</h4>
                            <label class="setting-item toggle">
                                <input type="checkbox" name="incognito" ${currentState.incognito ? 'checked' : ''}>
                                <div class="setting-content">
                                    <strong>Incognito Mode</strong>
                                    <p>Temporarily disable history saving for this session</p>
                                </div>
                                <div class="toggle-switch"></div>
                            </label>
                        </div>
                        
                        <div class="privacy-reminders">
                            <h4>📋 Privacy Reminders</h4>
                            <ul>
                                <li>Your data never leaves this device</li>
                                <li>No server-side storage or tracking</li>
                                <li>You can export or delete your data anytime</li>
                                <li>Clearing browser data will remove your history</li>
                            </ul>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <button class="settings-cancel btn-secondary">Cancel</button>
                    <button class="settings-save btn-primary">Save Settings</button>
                </div>
            </div>
        `;
        return modal;
    }

    /**
     * Create clear warning modal HTML
     */
    createClearWarningModal() {
        const modal = document.createElement('div');
        modal.className = 'privacy-modal-overlay';
        modal.innerHTML = `
            <div class="privacy-modal warning-modal">
                <div class="modal-header">
                    <h3>⚠️ Clear All History?</h3>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="warning-content">
                        <p><strong>This will permanently delete all your transcription history.</strong></p>
                        <p>Consider exporting your data first to keep a backup.</p>
                        
                        <div class="data-info">
                            <div class="info-item">
                                <span class="info-icon">📊</span>
                                <span id="total-entries">Loading...</span>
                            </div>
                            <div class="info-item">
                                <span class="info-icon">💾</span>
                                <span id="storage-size">Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="clear-cancel btn-secondary">Cancel</button>
                    <button class="clear-export btn-tertiary">📤 Export First</button>
                    <button class="clear-confirm btn-danger">🗑️ Delete All</button>
                </div>
            </div>
        `;

        // Load storage stats
        setTimeout(async () => {
            if (window.historyStorage) {
                const info = await window.historyStorage.getStorageInfo();
                const entriesEl = modal.querySelector('#total-entries');
                const sizeEl = modal.querySelector('#storage-size');
                
                if (entriesEl) entriesEl.textContent = `${info.totalEntries} transcriptions`;
                if (sizeEl) sizeEl.textContent = `${info.totalMB} MB used`;
            }
        }, 10);

        return modal;
    }

    /**
     * Load consent state from storage
     */
    loadConsentState() {
        const stored = localStorage.getItem(PRIVACY_KEYS.CONSENT_STATE);
        this.consentState = stored || CONSENT_STATES.UNKNOWN;
    }

    /**
     * Load incognito state from session storage
     */
    loadIncognitoState() {
        this.incognitoMode = sessionStorage.getItem(PRIVACY_KEYS.INCOGNITO_MODE) === 'true';
    }

    /**
     * Setup privacy controls in the UI
     */
    setupPrivacyControls() {
        // Add incognito toggle to header
        this.createIncognitoToggle();
        
        // Update UI based on current state
        this.updateIncognitoUI();
    }

    /**
     * Create incognito mode toggle
     */
    createIncognitoToggle() {
        const headerArea = document.querySelector('.upload-area') || document.querySelector('body');
        
        if (!document.querySelector('.incognito-toggle')) {
            const toggle = document.createElement('div');
            toggle.className = 'incognito-toggle';
            toggle.innerHTML = `
                <label class="incognito-label">
                    <input type="checkbox" id="incognito-mode" ${this.incognitoMode ? 'checked' : ''}>
                    <span class="incognito-icon">🕶️</span>
                    <span class="incognito-text">Incognito Mode</span>
                </label>
            `;
            
            toggle.querySelector('#incognito-mode').addEventListener('change', (e) => {
                this.toggleIncognitoMode(e.target.checked);
            });

            headerArea.appendChild(toggle);
        }
    }

    /**
     * Update incognito UI state
     */
    updateIncognitoUI() {
        const toggle = document.querySelector('#incognito-mode');
        if (toggle) {
            toggle.checked = this.incognitoMode;
        }

        // Update body class for styling
        document.body.classList.toggle('incognito-mode', this.incognitoMode);
        
        // Update any privacy indicators
        const indicators = document.querySelectorAll('.privacy-indicator');
        indicators.forEach(indicator => {
            indicator.textContent = this.incognitoMode ? 
                '🕶️ Incognito Mode - History Disabled' : 
                '🔒 Your data stays on your device';
        });
    }

    /**
     * Emit consent change event
     */
    emitConsentChange() {
        const event = new CustomEvent('privacy:consent-changed', {
            detail: this.getConsentState()
        });
        document.dispatchEvent(event);
    }

    /**
     * Utility: Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Utility: Truncate text
     */
    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) : text;
    }
}

// Make class globally available
window.HistoryPrivacy = HistoryPrivacy;