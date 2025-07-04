/**
 * Action Storage Management
 * Handles persistence and encryption of custom actions
 */

class ActionStorage {
    constructor() {
        this.storageKey = 'whisper-custom-actions';
        this.encryptionKey = this.getOrCreateEncryptionKey();
        this.maxActions = 100;
        this.cache = new Map();
        this.lastSync = 0;
    }

    getOrCreateEncryptionKey() {
        const keyName = 'action-encryption-key';
        let key = localStorage.getItem(keyName);
        
        if (!key) {
            key = this.generateEncryptionKey();
            localStorage.setItem(keyName, key);
        }
        
        return key;
    }

    generateEncryptionKey() {
        if (window.SecurityUtils && window.SecurityUtils.generateCSRFToken) {
            return window.SecurityUtils.generateCSRFToken();
        }
        
        // Fallback
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    async saveAction(action) {
        try {
            // Validate action
            const validation = this.validateAction(action);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Prepare action for storage
            const actionToSave = this.prepareActionForStorage(action);
            
            // Get existing actions
            const actions = await this.getAllActions();
            
            // Check if updating existing action
            const existingIndex = actions.findIndex(a => a.id === actionToSave.id);
            
            if (existingIndex >= 0) {
                actions[existingIndex] = actionToSave;
            } else {
                // Check storage limits
                if (actions.length >= this.maxActions) {
                    throw new Error(`Maximum number of actions (${this.maxActions}) reached`);
                }
                
                actions.push(actionToSave);
            }

            // Save to storage
            await this.saveAllActions(actions);
            
            // Update cache
            this.cache.set(actionToSave.id, actionToSave);
            
            return actionToSave.id;
            
        } catch (error) {
            console.error('Failed to save action:', error);
            throw error;
        }
    }

    async getAction(actionId) {
        try {
            // Check cache first
            if (this.cache.has(actionId)) {
                return { ...this.cache.get(actionId) };
            }

            // Load from storage
            const actions = await this.getAllActions();
            const action = actions.find(a => a.id === actionId);
            
            if (action) {
                this.cache.set(actionId, action);
                return { ...action };
            }
            
            return null;
            
        } catch (error) {
            console.error('Failed to get action:', error);
            return null;
        }
    }

    async getAllActions() {
        try {
            // Check if cache is recent enough
            const now = Date.now();
            if (this.cache.size > 0 && (now - this.lastSync) < 5000) {
                return Array.from(this.cache.values());
            }

            // Load from storage
            const stored = localStorage.getItem(this.storageKey);
            let actions = [];
            
            if (stored) {
                if (this.isEncryptionEnabled()) {
                    const decrypted = await this.decryptData(stored);
                    actions = JSON.parse(decrypted);
                } else {
                    actions = JSON.parse(stored);
                }
            }

            // Validate and clean actions
            actions = actions.filter(action => this.validateAction(action).valid);
            
            // Update cache
            this.cache.clear();
            actions.forEach(action => {
                this.cache.set(action.id, action);
            });
            this.lastSync = now;
            
            return actions;
            
        } catch (error) {
            console.error('Failed to load actions:', error);
            return [];
        }
    }

    async deleteAction(actionId) {
        try {
            const actions = await this.getAllActions();
            const filteredActions = actions.filter(a => a.id !== actionId);
            
            if (filteredActions.length === actions.length) {
                throw new Error('Action not found');
            }

            await this.saveAllActions(filteredActions);
            
            // Update cache
            this.cache.delete(actionId);
            
            return true;
            
        } catch (error) {
            console.error('Failed to delete action:', error);
            throw error;
        }
    }

    async duplicateAction(actionId) {
        try {
            const action = await this.getAction(actionId);
            if (!action) {
                throw new Error('Action not found');
            }

            // Create duplicate with new ID and name
            const duplicate = {
                ...action,
                id: this.generateActionId(),
                name: `${action.name} (Copy)`,
                created: new Date().toISOString(),
                lastUsed: null
            };

            return await this.saveAction(duplicate);
            
        } catch (error) {
            console.error('Failed to duplicate action:', error);
            throw error;
        }
    }

    async clearAllActions() {
        try {
            localStorage.removeItem(this.storageKey);
            this.cache.clear();
            this.lastSync = 0;
            return true;
            
        } catch (error) {
            console.error('Failed to clear actions:', error);
            throw error;
        }
    }

    async saveAllActions(actions) {
        try {
            let dataToStore;
            
            if (this.isEncryptionEnabled()) {
                const encrypted = await this.encryptData(JSON.stringify(actions));
                dataToStore = encrypted;
            } else {
                dataToStore = JSON.stringify(actions);
            }
            
            localStorage.setItem(this.storageKey, dataToStore);
            this.lastSync = Date.now();
            
        } catch (error) {
            console.error('Failed to save actions:', error);
            throw error;
        }
    }

    prepareActionForStorage(action) {
        const now = new Date().toISOString();
        
        return {
            id: action.id || this.generateActionId(),
            name: action.name || 'Untitled Action',
            description: action.description || '',
            type: action.type || 'template',
            template: action.template || '',
            prompt: action.prompt || '',
            model: action.model || 'gpt-3.5-turbo',
            temperature: action.temperature || 0.7,
            maxTokens: action.maxTokens || 1000,
            variables: action.variables || [],
            created: action.created || now,
            lastUsed: action.lastUsed || null,
            usageCount: action.usageCount || 0,
            tags: action.tags || [],
            category: action.category || 'general',
            isActive: action.isActive !== false // default to true
        };
    }

    validateAction(action) {
        if (!action || typeof action !== 'object') {
            return { valid: false, error: 'Action must be an object' };
        }

        if (!action.name || typeof action.name !== 'string' || action.name.trim().length === 0) {
            return { valid: false, error: 'Action name is required' };
        }

        if (action.name.length > 100) {
            return { valid: false, error: 'Action name must be 100 characters or less' };
        }

        if (!action.type || !['template', 'openai'].includes(action.type)) {
            return { valid: false, error: 'Action type must be "template" or "openai"' };
        }

        if (action.type === 'template' && (!action.template || typeof action.template !== 'string')) {
            return { valid: false, error: 'Template actions must have a template' };
        }

        if (action.type === 'openai' && (!action.prompt || typeof action.prompt !== 'string')) {
            return { valid: false, error: 'OpenAI actions must have a prompt' };
        }

        if (action.description && action.description.length > 500) {
            return { valid: false, error: 'Description must be 500 characters or less' };
        }

        if (action.template && action.template.length > 10000) {
            return { valid: false, error: 'Template must be 10,000 characters or less' };
        }

        if (action.prompt && action.prompt.length > 5000) {
            return { valid: false, error: 'Prompt must be 5,000 characters or less' };
        }

        if (action.temperature !== undefined && (typeof action.temperature !== 'number' || action.temperature < 0 || action.temperature > 2)) {
            return { valid: false, error: 'Temperature must be a number between 0 and 2' };
        }

        if (action.maxTokens !== undefined && (typeof action.maxTokens !== 'number' || action.maxTokens < 1 || action.maxTokens > 4000)) {
            return { valid: false, error: 'Max tokens must be a number between 1 and 4000' };
        }

        return { valid: true };
    }

    generateActionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `action_${timestamp}_${random}`;
    }

    async updateActionUsage(actionId) {
        try {
            const action = await this.getAction(actionId);
            if (!action) return;

            action.lastUsed = new Date().toISOString();
            action.usageCount = (action.usageCount || 0) + 1;

            await this.saveAction(action);
            
        } catch (error) {
            console.error('Failed to update action usage:', error);
        }
    }

    async searchActions(query, options = {}) {
        try {
            const actions = await this.getAllActions();
            
            if (!query || query.trim().length === 0) {
                return this.sortActions(actions, options.sortBy, options.sortOrder);
            }

            const searchTerm = query.toLowerCase();
            const filtered = actions.filter(action => {
                return action.name.toLowerCase().includes(searchTerm) ||
                       action.description.toLowerCase().includes(searchTerm) ||
                       (action.tags && action.tags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
                       action.category.toLowerCase().includes(searchTerm);
            });

            return this.sortActions(filtered, options.sortBy, options.sortOrder);
            
        } catch (error) {
            console.error('Failed to search actions:', error);
            return [];
        }
    }

    sortActions(actions, sortBy = 'created', sortOrder = 'desc') {
        const multiplier = sortOrder === 'desc' ? -1 : 1;
        
        return actions.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'created':
                    comparison = new Date(a.created) - new Date(b.created);
                    break;
                case 'lastUsed':
                    const aDate = a.lastUsed ? new Date(a.lastUsed) : new Date(0);
                    const bDate = b.lastUsed ? new Date(b.lastUsed) : new Date(0);
                    comparison = aDate - bDate;
                    break;
                case 'usageCount':
                    comparison = (a.usageCount || 0) - (b.usageCount || 0);
                    break;
                case 'type':
                    comparison = a.type.localeCompare(b.type);
                    break;
                default:
                    comparison = new Date(a.created) - new Date(b.created);
            }
            
            return comparison * multiplier;
        });
    }

    async exportActions(format = 'json') {
        try {
            const actions = await this.getAllActions();
            
            switch (format.toLowerCase()) {
                case 'json':
                    return {
                        data: JSON.stringify({
                            version: '1.0',
                            exported: new Date().toISOString(),
                            actions: actions
                        }, null, 2),
                        filename: `whisper-actions-${new Date().toISOString().slice(0, 10)}.json`,
                        mimeType: 'application/json'
                    };
                    
                case 'csv':
                    const csvData = this.convertToCSV(actions);
                    return {
                        data: csvData,
                        filename: `whisper-actions-${new Date().toISOString().slice(0, 10)}.csv`,
                        mimeType: 'text/csv'
                    };
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
            
        } catch (error) {
            console.error('Failed to export actions:', error);
            throw error;
        }
    }

    convertToCSV(actions) {
        const headers = ['ID', 'Name', 'Description', 'Type', 'Created', 'Last Used', 'Usage Count'];
        const rows = actions.map(action => [
            action.id,
            `"${action.name.replace(/"/g, '""')}"`,
            `"${(action.description || '').replace(/"/g, '""')}"`,
            action.type,
            action.created,
            action.lastUsed || '',
            action.usageCount || 0
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    async importActions(data, options = {}) {
        try {
            let importData;
            
            if (typeof data === 'string') {
                importData = JSON.parse(data);
            } else {
                importData = data;
            }

            // Validate import data structure
            if (!importData.actions || !Array.isArray(importData.actions)) {
                throw new Error('Invalid import data structure');
            }

            const existingActions = await this.getAllActions();
            const imported = [];
            const errors = [];

            for (const actionData of importData.actions) {
                try {
                    // Check for ID conflicts
                    if (options.replaceExisting || !existingActions.find(a => a.id === actionData.id)) {
                        const actionId = await this.saveAction(actionData);
                        imported.push(actionId);
                    } else if (options.skipConflicts) {
                        // Skip this action
                        continue;
                    } else {
                        errors.push(`Action with ID ${actionData.id} already exists`);
                    }
                } catch (error) {
                    errors.push(`Failed to import action ${actionData.name}: ${error.message}`);
                }
            }

            return {
                imported: imported.length,
                errors: errors,
                total: importData.actions.length
            };
            
        } catch (error) {
            console.error('Failed to import actions:', error);
            throw error;
        }
    }

    isEncryptionEnabled() {
        return window.SecurityUtils && window.SecurityUtils.encryptData;
    }

    async encryptData(data) {
        if (window.SecurityUtils && window.SecurityUtils.encryptData) {
            return await window.SecurityUtils.encryptData(data, this.encryptionKey);
        }
        return data;
    }

    async decryptData(data) {
        if (window.SecurityUtils && window.SecurityUtils.decryptData) {
            return await window.SecurityUtils.decryptData(data, this.encryptionKey);
        }
        return data;
    }

    getStorageStats() {
        const actions = this.cache.size > 0 ? Array.from(this.cache.values()) : [];
        const totalSize = JSON.stringify(actions).length;
        
        return {
            totalActions: actions.length,
            maxActions: this.maxActions,
            storageUsed: totalSize,
            storageKey: this.storageKey,
            encryptionEnabled: this.isEncryptionEnabled(),
            cacheSize: this.cache.size,
            lastSync: this.lastSync
        };
    }

    clearCache() {
        this.cache.clear();
        this.lastSync = 0;
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionStorage;
} else if (typeof window !== 'undefined') {
    window.ActionStorage = ActionStorage;
}