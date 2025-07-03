/**
 * Action UI Generation
 * Handles modal and form HTML generation for custom actions
 */

class ActionUIGenerator {
    constructor() {
        this.securityUtils = window.SecurityUtils || this.createFallbackSecurity();
    }

    createFallbackSecurity() {
        return {
            escapeHtml: (text) => {
                if (typeof text !== 'string') return text;
                try {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                } catch (error) {
                    return String(text)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;');
                }
            }
        };
    }

    createActionModal(action = null, isEdit = false) {
        const title = isEdit ? 'Edit Custom Action' : 'Create Custom Action';
        const actionData = action || this.getDefaultAction();
        
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content action-modal">
                    <div class="modal-header">
                        <h3>${this.escapeHtml(title)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        ${this.createActionForm(actionData, isEdit)}
                    </div>
                    
                    <div class="modal-footer">
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                Cancel
                            </button>
                            <button type="button" class="btn btn-primary" onclick="actionUIGenerator.saveActionFromModal(${isEdit})">
                                ${isEdit ? 'Update Action' : 'Create Action'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return modalHTML;
    }

    createActionForm(action, isEdit = false) {
        const actionType = action.type || 'template';
        
        return `
            <form class="action-form" id="action-form">
                <input type="hidden" id="action-id" value="${isEdit ? this.escapeHtml(action.id || '') : ''}">
                
                <!-- Basic Information -->
                <div class="form-section">
                    <h4 class="section-title">Basic Information</h4>
                    
                    <div class="form-group">
                        <label for="action-name" class="form-label">Name *</label>
                        <input 
                            type="text" 
                            id="action-name" 
                            class="form-input" 
                            value="${this.escapeHtml(action.name || '')}"
                            placeholder="Enter action name"
                            maxlength="100"
                            required
                        >
                        <div class="form-hint">A descriptive name for your action</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="action-description" class="form-label">Description</label>
                        <textarea 
                            id="action-description" 
                            class="form-textarea" 
                            placeholder="Describe what this action does..."
                            maxlength="500"
                            rows="3"
                        >${this.escapeHtml(action.description || '')}</textarea>
                        <div class="form-hint">Optional description of the action's purpose</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="action-type" class="form-label">Action Type *</label>
                        <select id="action-type" class="form-select" onchange="actionUIGenerator.handleTypeChange()">
                            <option value="template" ${actionType === 'template' ? 'selected' : ''}>
                                Template Processing
                            </option>
                            <option value="openai" ${actionType === 'openai' ? 'selected' : ''}>
                                OpenAI Processing
                            </option>
                        </select>
                        <div class="form-hint">Choose how the action will process transcripts</div>
                    </div>
                </div>

                <!-- Template Section -->
                <div class="form-section template-section" ${actionType !== 'template' ? 'style="display:none"' : ''}>
                    <h4 class="section-title">Template Configuration</h4>
                    
                    <div class="form-group">
                        <label for="action-template" class="form-label">Template *</label>
                        <textarea 
                            id="action-template" 
                            class="form-textarea template-editor" 
                            placeholder="Enter your template using variables like {{.Transcript}}, {{.Filename}}, etc."
                            maxlength="10000"
                            rows="8"
                        >${this.escapeHtml(action.template || '')}</textarea>
                        <div class="form-hint">Use variables and functions to transform the transcript</div>
                    </div>
                    
                    <div class="template-examples">
                        <h5>Quick Templates:</h5>
                        <div class="example-buttons">
                            ${this.createExampleTemplateButtons()}
                        </div>
                    </div>
                    
                    <div class="variable-reference">
                        <h5>Available Variables:</h5>
                        <div class="variable-list">
                            ${this.createVariableList()}
                        </div>
                    </div>
                </div>

                <!-- OpenAI Section -->
                <div class="form-section openai-section" ${actionType !== 'openai' ? 'style="display:none"' : ''}>
                    <h4 class="section-title">OpenAI Configuration</h4>
                    
                    <div class="form-group">
                        <label for="action-prompt" class="form-label">Prompt *</label>
                        <textarea 
                            id="action-prompt" 
                            class="form-textarea prompt-editor" 
                            placeholder="Enter instructions for how AI should process the transcript..."
                            maxlength="5000"
                            rows="6"
                        >${this.escapeHtml(action.prompt || '')}</textarea>
                        <div class="form-hint">Clear instructions for AI processing</div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="action-model" class="form-label">Model</label>
                            <select id="action-model" class="form-select">
                                ${this.createModelOptions(action.model)}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="action-temperature" class="form-label">Temperature</label>
                            <input 
                                type="number" 
                                id="action-temperature" 
                                class="form-input" 
                                value="${action.temperature || 0.7}"
                                min="0" 
                                max="2" 
                                step="0.1"
                            >
                            <div class="form-hint">0 = focused, 2 = creative</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="action-max-tokens" class="form-label">Max Tokens</label>
                            <input 
                                type="number" 
                                id="action-max-tokens" 
                                class="form-input" 
                                value="${action.maxTokens || 1000}"
                                min="1" 
                                max="4000"
                            >
                            <div class="form-hint">Maximum response length</div>
                        </div>
                    </div>
                    
                    <div class="prompt-examples">
                        <h5>Example Prompts:</h5>
                        <div class="example-buttons">
                            ${this.createExamplePromptButtons()}
                        </div>
                    </div>
                </div>

                <!-- Advanced Options -->
                <div class="form-section advanced-section">
                    <h4 class="section-title">
                        <button type="button" class="section-toggle" onclick="actionUIGenerator.toggleAdvanced()">
                            Advanced Options <span class="toggle-icon">▼</span>
                        </button>
                    </h4>
                    <div class="advanced-content" style="display:none">
                        <div class="form-group">
                            <label for="action-category" class="form-label">Category</label>
                            <input 
                                type="text" 
                                id="action-category" 
                                class="form-input" 
                                value="${this.escapeHtml(action.category || 'general')}"
                                placeholder="e.g., meeting, interview, lecture"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="action-tags" class="form-label">Tags</label>
                            <input 
                                type="text" 
                                id="action-tags" 
                                class="form-input" 
                                value="${this.escapeHtml((action.tags || []).join(', '))}"
                                placeholder="comma, separated, tags"
                            >
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    createManageModal(actions = []) {
        const hasActions = actions.length > 0;
        
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content manage-modal">
                    <div class="modal-header">
                        <h3>Manage Custom Actions</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        ${hasActions ? this.createActionsList(actions) : this.createEmptyState()}
                    </div>
                    
                    <div class="modal-footer">
                        <div class="modal-actions">
                            <button type="button" class="btn btn-primary" onclick="actionUIGenerator.showCreateModal()">
                                Create New Action
                            </button>
                            ${hasActions ? `
                            <button type="button" class="btn btn-secondary" onclick="actionUIGenerator.showExportModal()">
                                Export Actions
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        return modalHTML;
    }

    createActionsList(actions) {
        const sortedActions = actions.sort((a, b) => 
            new Date(b.created) - new Date(a.created)
        );

        return `
            <div class="actions-list">
                <div class="list-header">
                    <div class="search-controls">
                        <input 
                            type="text" 
                            id="action-search" 
                            class="search-input" 
                            placeholder="Search actions..."
                            oninput="actionUIGenerator.filterActions(this.value)"
                        >
                        <select id="action-filter" class="filter-select" onchange="actionUIGenerator.filterActions()">
                            <option value="all">All Types</option>
                            <option value="template">Template</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>
                </div>
                
                <div class="actions-grid" id="actions-grid">
                    ${sortedActions.map(action => this.createActionCard(action)).join('')}
                </div>
            </div>
        `;
    }

    createActionCard(action) {
        const typeIcon = action.type === 'openai' ? '🤖' : '📝';
        const createdDate = new Date(action.created).toLocaleDateString();
        const lastUsed = action.lastUsed ? new Date(action.lastUsed).toLocaleDateString() : 'Never';
        
        return `
            <div class="action-card" data-type="${action.type}" data-action-id="${this.escapeHtml(action.id)}">
                <div class="card-header">
                    <div class="card-title">
                        <span class="type-icon">${typeIcon}</span>
                        <span class="action-name">${this.escapeHtml(action.name)}</span>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn preview-btn" onclick="actionUIGenerator.previewAction('${this.escapeHtml(action.id)}')" title="Preview">
                            👁️
                        </button>
                        <button class="action-btn edit-btn" onclick="actionUIGenerator.editAction('${this.escapeHtml(action.id)}')" title="Edit">
                            ✏️
                        </button>
                        <button class="action-btn duplicate-btn" onclick="actionUIGenerator.duplicateAction('${this.escapeHtml(action.id)}')" title="Duplicate">
                            📋
                        </button>
                        <button class="action-btn delete-btn" onclick="actionUIGenerator.deleteAction('${this.escapeHtml(action.id)}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="card-body">
                    ${action.description ? `
                    <div class="card-description">
                        ${this.escapeHtml(action.description)}
                    </div>
                    ` : ''}
                    
                    <div class="card-meta">
                        <div class="meta-item">
                            <span class="meta-label">Type:</span>
                            <span class="meta-value">${action.type === 'openai' ? 'OpenAI' : 'Template'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Created:</span>
                            <span class="meta-value">${createdDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Last Used:</span>
                            <span class="meta-value">${lastUsed}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Uses:</span>
                            <span class="meta-value">${action.usageCount || 0}</span>
                        </div>
                    </div>
                    
                    ${action.tags && action.tags.length > 0 ? `
                    <div class="card-tags">
                        ${action.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    createEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">⚡</div>
                <div class="empty-title">No custom actions created yet</div>
                <div class="empty-description">
                    Create your first custom action to automatically process transcriptions
                </div>
                <button class="btn btn-primary" onclick="actionUIGenerator.showCreateModal()">
                    Create Your First Action
                </button>
            </div>
        `;
    }

    createPreviewModal(action) {
        const typeLabel = action.type === 'openai' ? 'OpenAI Processing' : 'Template Processing';
        const content = action.type === 'openai' ? action.prompt : action.template;
        
        return `
            <div class="modal-overlay">
                <div class="modal-content preview-modal">
                    <div class="modal-header">
                        <h3>Preview: ${this.escapeHtml(action.name)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="preview-details">
                            <div class="detail-row">
                                <span class="label">Type:</span>
                                <span class="value">${typeLabel}</span>
                            </div>
                            ${action.description ? `
                            <div class="detail-row">
                                <span class="label">Description:</span>
                                <span class="value">${this.escapeHtml(action.description)}</span>
                            </div>
                            ` : ''}
                            ${action.type === 'openai' ? `
                            <div class="detail-row">
                                <span class="label">Model:</span>
                                <span class="value">${this.escapeHtml(action.model || 'gpt-3.5-turbo')}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Temperature:</span>
                                <span class="value">${action.temperature || 0.7}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="preview-content">
                            <h4>${action.type === 'openai' ? 'Prompt:' : 'Template:'}</h4>
                            <pre class="content-preview">${this.escapeHtml(content || 'No content')}</pre>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            Close
                        </button>
                        <button type="button" class="btn btn-primary" onclick="actionUIGenerator.editAction('${this.escapeHtml(action.id)}')">
                            Edit Action
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createExampleTemplateButtons() {
        const examples = [
            {
                name: 'Meeting Summary',
                template: '## Meeting Summary\nDate: {{.Date}}\nFile: {{.Filename}}\n\n### Key Points:\n{{.Transcript | summarize}}\n\n### Action Items:\n{{.Transcript | extractActions}}'
            },
            {
                name: 'Interview Notes',
                template: '# Interview: {{.Filename}}\n**Date:** {{.Date}}\n**Duration:** {{.Duration}}\n\n## Full Transcript:\n{{.Transcript}}\n\n## Key Insights:\n{{.Transcript | extractKeyPoints}}'
            },
            {
                name: 'Lecture Notes',
                template: '# {{.Filename}}\n*Recorded: {{.Date}}*\n\n## Main Content:\n{{.Transcript | format}}\n\n**Word Count:** {{.WordCount}} words\n**Reading Time:** ~{{.ReadingTime}} minutes'
            }
        ];

        return examples.map(example => `
            <button 
                type="button" 
                class="example-btn" 
                onclick="actionUIGenerator.useExampleTemplate('${this.escapeHtml(example.template)}')"
                title="${this.escapeHtml(example.template)}"
            >
                ${this.escapeHtml(example.name)}
            </button>
        `).join('');
    }

    createExamplePromptButtons() {
        const examples = [
            {
                name: 'Smart Summary',
                prompt: 'Analyze this meeting transcript and create a comprehensive summary with:\n\n1. **Key Decisions Made**\n2. **Action Items** (with responsible parties if mentioned)\n3. **Important Discussion Points**\n4. **Next Steps**\n\nFormat with clear headings and bullet points.'
            },
            {
                name: 'Action Items',
                prompt: 'Extract all action items, tasks, deadlines, and assignments from this transcript. For each item, identify:\n\n- The specific task or action required\n- Who is responsible (if mentioned)\n- Any deadlines or timeframes mentioned\n- Priority level (if indicated)\n\nFormat as a prioritized task list with checkboxes.'
            },
            {
                name: 'Key Insights',
                prompt: 'Identify the most important insights, conclusions, and strategic points from this transcript. Highlight any:\n\n- Key decisions or agreements\n- Important questions raised\n- Risks or concerns mentioned\n- Opportunities identified\n\nProvide a concise analysis suitable for leadership review.'
            }
        ];

        return examples.map(example => `
            <button 
                type="button" 
                class="example-btn" 
                onclick="actionUIGenerator.useExamplePrompt('${this.escapeHtml(example.prompt)}')"
                title="${this.escapeHtml(example.prompt.substring(0, 100))}..."
            >
                ${this.escapeHtml(example.name)}
            </button>
        `).join('');
    }

    createVariableList() {
        const variables = [
            { name: '{{.Transcript}}', desc: 'Full transcribed text' },
            { name: '{{.Filename}}', desc: 'Original file name' },
            { name: '{{.Date}}', desc: 'Current date/time' },
            { name: '{{.FileType}}', desc: 'File type (audio/video)' },
            { name: '{{.Duration}}', desc: 'File duration' },
            { name: '{{.WordCount}}', desc: 'Number of words' },
            { name: '{{.CharCount}}', desc: 'Character count' }
        ];

        return variables.map(variable => `
            <div class="variable-item" onclick="actionUIGenerator.insertVariable('${variable.name}')">
                <code class="variable-name">${variable.name}</code>
                <span class="variable-desc">${variable.desc}</span>
            </div>
        `).join('');
    }

    createModelOptions(selectedModel = 'gpt-3.5-turbo') {
        const models = [
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast, Cost-effective)' },
            { value: 'gpt-3.5-turbo-16k', label: 'GPT-3.5 Turbo 16K (Longer context)' },
            { value: 'gpt-4', label: 'GPT-4 (Most capable)' },
            { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo (Latest)' },
            { value: 'gpt-4o', label: 'GPT-4o (Multimodal)' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & affordable)' }
        ];

        return models.map(model => `
            <option value="${model.value}" ${selectedModel === model.value ? 'selected' : ''}>
                ${model.label}
            </option>
        `).join('');
    }

    getDefaultAction() {
        return {
            name: '',
            description: '',
            type: 'template',
            template: '',
            prompt: '',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 1000,
            category: 'general',
            tags: []
        };
    }

    escapeHtml(text) {
        return this.securityUtils.escapeHtml(text);
    }

    // UI Interaction Methods (to be implemented by the calling code)
    handleTypeChange() {
        const typeSelect = document.getElementById('action-type');
        const templateSection = document.querySelector('.template-section');
        const openaiSection = document.querySelector('.openai-section');
        
        if (typeSelect && templateSection && openaiSection) {
            const isTemplate = typeSelect.value === 'template';
            templateSection.style.display = isTemplate ? 'block' : 'none';
            openaiSection.style.display = isTemplate ? 'none' : 'block';
        }
    }

    toggleAdvanced() {
        const content = document.querySelector('.advanced-content');
        const icon = document.querySelector('.toggle-icon');
        
        if (content && icon) {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            icon.textContent = isVisible ? '▼' : '▲';
        }
    }

    useExampleTemplate(template) {
        const templateTextarea = document.getElementById('action-template');
        if (templateTextarea) {
            templateTextarea.value = template;
        }
    }

    useExamplePrompt(prompt) {
        const promptTextarea = document.getElementById('action-prompt');
        if (promptTextarea) {
            promptTextarea.value = prompt;
        }
    }

    insertVariable(variable) {
        const typeSelect = document.getElementById('action-type');
        const targetId = typeSelect && typeSelect.value === 'openai' ? 'action-prompt' : 'action-template';
        const textarea = document.getElementById(targetId);
        
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            
            textarea.value = text.substring(0, start) + variable + text.substring(end);
            textarea.focus();
            textarea.setSelectionRange(start + variable.length, start + variable.length);
        }
    }

    filterActions(searchTerm = '') {
        const searchInput = document.getElementById('action-search');
        const filterSelect = document.getElementById('action-filter');
        const actionCards = document.querySelectorAll('.action-card');
        
        const search = searchTerm || (searchInput ? searchInput.value.toLowerCase() : '');
        const typeFilter = filterSelect ? filterSelect.value : 'all';
        
        actionCards.forEach(card => {
            const actionName = card.querySelector('.action-name').textContent.toLowerCase();
            const actionType = card.dataset.type;
            
            const matchesSearch = !search || actionName.includes(search);
            const matchesType = typeFilter === 'all' || actionType === typeFilter;
            
            card.style.display = matchesSearch && matchesType ? 'block' : 'none';
        });
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionUIGenerator;
} else if (typeof window !== 'undefined') {
    window.ActionUIGenerator = ActionUIGenerator;
}