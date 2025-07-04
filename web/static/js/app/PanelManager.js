/**
 * Panel Management
 * Handles panel state, navigation, and UI interactions
 */

class PanelManager {
    constructor() {
        this.state = {
            history: false,
            settings: false
        };
        
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    setupEventListeners() {
        // Panel toggle buttons
        const historyToggle = document.getElementById('history-toggle');
        const settingsToggle = document.getElementById('settings-toggle');
        
        if (historyToggle) {
            historyToggle.addEventListener('click', () => this.togglePanel('history'));
        }
        
        if (settingsToggle) {
            settingsToggle.addEventListener('click', () => this.togglePanel('settings'));
        }

        // Panel close buttons
        const closeHistory = document.getElementById('close-history');
        const closeSettings = document.getElementById('close-settings');
        
        if (closeHistory) {
            closeHistory.addEventListener('click', () => this.closePanel('history'));
        }
        
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.closePanel('settings'));
        }

        // Overlay click to close
        const overlay = document.getElementById('panel-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.closeAllPanels());
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+H for history
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                this.togglePanel('history');
            }
            
            // Escape to close panels
            if (e.key === 'Escape') {
                this.closeAllPanels();
            }
            
            // Ctrl+, for settings
            if (e.ctrlKey && e.key === ',') {
                e.preventDefault();
                this.togglePanel('settings');
            }
        });
    }

    togglePanel(panelName) {
        if (this.state[panelName]) {
            this.closePanel(panelName);
        } else {
            this.openPanel(panelName);
        }
    }

    openPanel(panelName) {
        // Close other panels first
        Object.keys(this.state).forEach(name => {
            if (name !== panelName && this.state[name]) {
                this.closePanel(name);
            }
        });

        this.state[panelName] = true;
        this.updatePanelUI(panelName, true);
        this.showOverlay();
        
        // Trigger panel opened event
        this.dispatchPanelEvent('opened', panelName);
    }

    closePanel(panelName) {
        this.state[panelName] = false;
        this.updatePanelUI(panelName, false);
        
        // Hide overlay if no panels are open
        if (!this.hasOpenPanels()) {
            this.hideOverlay();
        }
        
        // Trigger panel closed event
        this.dispatchPanelEvent('closed', panelName);
    }

    closeAllPanels() {
        Object.keys(this.state).forEach(panelName => {
            if (this.state[panelName]) {
                this.closePanel(panelName);
            }
        });
    }

    updatePanelUI(panelName, isOpen) {
        const panel = document.getElementById(`${panelName}-panel`);
        const toggle = document.getElementById(`${panelName}-toggle`);
        
        if (panel) {
            if (isOpen) {
                panel.classList.remove('collapsed');
                panel.classList.add('expanded');
            } else {
                panel.classList.remove('expanded');
                panel.classList.add('collapsed');
            }
        }
        
        if (toggle) {
            toggle.classList.toggle('active', isOpen);
        }
    }

    showOverlay() {
        const overlay = document.getElementById('panel-overlay');
        if (overlay) {
            overlay.classList.add('visible');
        }
    }

    hideOverlay() {
        const overlay = document.getElementById('panel-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    hasOpenPanels() {
        return Object.values(this.state).some(isOpen => isOpen);
    }

    isPanelOpen(panelName) {
        return this.state[panelName] || false;
    }

    getOpenPanels() {
        return Object.keys(this.state).filter(name => this.state[name]);
    }

    dispatchPanelEvent(eventType, panelName) {
        const event = new CustomEvent(`panel-${eventType}`, {
            detail: { panelName, state: this.state }
        });
        document.dispatchEvent(event);
    }

    // Accessibility methods
    focusPanel(panelName) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel && this.state[panelName]) {
            const focusable = panel.querySelector('input, button, select, textarea, [tabindex]');
            if (focusable) {
                focusable.focus();
            }
        }
    }

    setPanelTabIndex(panelName, enabled) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            const focusableElements = panel.querySelectorAll(
                'input, button, select, textarea, a[href], [tabindex]'
            );
            
            focusableElements.forEach(element => {
                if (enabled) {
                    element.removeAttribute('tabindex');
                } else {
                    element.setAttribute('tabindex', '-1');
                }
            });
        }
    }

    // Animation methods
    animatePanel(panelName, isOpening) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (!panel) return;

        const duration = 300;
        const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

        if (isOpening) {
            panel.style.transition = `transform ${duration}ms ${easing}`;
            panel.style.transform = 'translateX(-100%)';
            
            requestAnimationFrame(() => {
                panel.style.transform = 'translateX(0)';
            });
        } else {
            panel.style.transition = `transform ${duration}ms ${easing}`;
            panel.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                panel.style.transition = '';
                panel.style.transform = '';
            }, duration);
        }
    }

    // Panel content methods
    setPanelContent(panelName, content) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            const contentArea = panel.querySelector('.panel-content');
            if (contentArea) {
                if (typeof content === 'string') {
                    contentArea.innerHTML = content;
                } else if (content instanceof Element) {
                    contentArea.innerHTML = '';
                    contentArea.appendChild(content);
                }
            }
        }
    }

    getPanelContent(panelName) {
        const panel = document.getElementById(`${panelName}-panel`);
        if (panel) {
            const contentArea = panel.querySelector('.panel-content');
            return contentArea ? contentArea.innerHTML : '';
        }
        return '';
    }

    // State management
    saveState() {
        try {
            localStorage.setItem('panel_state', JSON.stringify(this.state));
        } catch (error) {
            console.warn('Failed to save panel state:', error.message);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('panel_state');
            if (saved) {
                const state = JSON.parse(saved);
                Object.keys(state).forEach(panelName => {
                    if (state[panelName]) {
                        this.openPanel(panelName);
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load panel state:', error.message);
        }
    }

    resetState() {
        this.closeAllPanels();
        this.state = {
            history: false,
            settings: false
        };
        localStorage.removeItem('panel_state');
    }

    // Responsive behavior
    handleResize() {
        const isMobile = window.innerWidth < 768;
        
        if (isMobile && this.hasOpenPanels()) {
            // On mobile, ensure panels take full width
            Object.keys(this.state).forEach(panelName => {
                if (this.state[panelName]) {
                    const panel = document.getElementById(`${panelName}-panel`);
                    if (panel) {
                        panel.classList.add('mobile-fullscreen');
                    }
                }
            });
        } else {
            // Remove mobile styles
            Object.keys(this.state).forEach(panelName => {
                const panel = document.getElementById(`${panelName}-panel`);
                if (panel) {
                    panel.classList.remove('mobile-fullscreen');
                }
            });
        }
    }

    // Initialize responsive behavior
    initResponsive() {
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize(); // Initial check
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PanelManager;
} else if (typeof window !== 'undefined') {
    window.PanelManager = PanelManager;
}