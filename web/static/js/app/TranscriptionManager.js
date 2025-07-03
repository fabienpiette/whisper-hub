/**
 * Transcription Management
 * Handles file upload, transcription workflow, and result processing
 */

class TranscriptionManager {
    constructor(fileUploader, settings) {
        this.fileUploader = fileUploader || new FileUploader();
        this.settings = settings;
        this.currentTranscription = null;
        this.processingState = 'idle'; // idle, uploading, transcribing, completed, error
        
        this.setupEventListeners();
        this.setupProgressTracking();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('transcribe-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmission();
            });
        }

        // File input change
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files[0]);
            });
        }

        // Start new transcription button
        const newBtn = document.querySelector('.start-new-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => {
                this.startNewTranscription();
            });
        }

        // Retry button (for error states)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('retry-btn')) {
                this.retryTranscription();
            }
        });
    }

    setupProgressTracking() {
        // Create progress tracking elements if they don't exist
        this.ensureProgressElements();
    }

    ensureProgressElements() {
        let progressContainer = document.getElementById('progress-container');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'progress-container';
            progressContainer.className = 'progress-container hidden';
            
            const uploadContainer = document.getElementById('upload-container');
            if (uploadContainer) {
                uploadContainer.appendChild(progressContainer);
            }
        }

        if (!progressContainer.innerHTML) {
            progressContainer.innerHTML = `
                <div class="progress-card">
                    <div class="progress-header">
                        <h3 class="progress-title">Processing Audio</h3>
                        <button class="cancel-btn" onclick="transcriptionManager.cancelTranscription()">Cancel</button>
                    </div>
                    <div class="progress-content">
                        <div class="progress-bar-container">
                            <div class="progress-bar">
                                <div class="progress-fill" id="progress-fill"></div>
                            </div>
                            <div class="progress-text" id="progress-text">0%</div>
                        </div>
                        <div class="progress-steps">
                            <div class="step" data-step="upload">
                                <div class="step-icon">📁</div>
                                <div class="step-label">Upload</div>
                            </div>
                            <div class="step" data-step="convert">
                                <div class="step-icon">🔄</div>
                                <div class="step-label">Convert</div>
                            </div>
                            <div class="step" data-step="transcribe">
                                <div class="step-icon">🎵</div>
                                <div class="step-label">Transcribe</div>
                            </div>
                            <div class="step" data-step="process">
                                <div class="step-icon">⚙️</div>
                                <div class="step-label">Process</div>
                            </div>
                        </div>
                        <div class="progress-details" id="progress-details">
                            Preparing file for upload...
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async handleFileSelection(file) {
        if (!file) return;

        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                this.showError(validation.error);
                return;
            }

            // Update UI
            this.fileUploader.showFilePreview(file);
            this.enableTranscribeButton();
            
            // Store selected file
            this.selectedFile = file;
            
        } catch (error) {
            console.error('File selection error:', error);
            this.showError('Failed to process selected file');
        }
    }

    async handleFormSubmission() {
        if (!this.selectedFile) {
            this.showError('Please select a file first');
            return;
        }

        if (this.processingState !== 'idle') {
            console.warn('Transcription already in progress');
            return;
        }

        try {
            await this.startTranscription();
        } catch (error) {
            console.error('Transcription failed:', error);
            this.handleTranscriptionError(error);
        }
    }

    async startTranscription() {
        this.processingState = 'uploading';
        this.showProgress(true);
        this.updateProgress(0, 'Preparing upload...');
        this.setActiveStep('upload');

        try {
            // Create form data
            const formData = this.createFormData();
            
            // Start upload with progress tracking
            const response = await this.uploadWithProgress(formData);
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            // Handle successful response
            await this.handleTranscriptionResponse(response);
            
        } catch (error) {
            this.handleTranscriptionError(error);
        }
    }

    createFormData() {
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        
        // Add selected post-action if any
        const actionSelect = document.getElementById('post_action');
        if (actionSelect && actionSelect.value) {
            formData.append('post_action', actionSelect.value);
        }

        // Add CSRF token if available
        if (window.SecurityUtils && window.SecurityUtils.generateCSRFToken) {
            const csrfToken = window.SecurityUtils.generateCSRFToken();
            formData.append('csrf_token', csrfToken);
        }

        return formData;
    }

    async uploadWithProgress(formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const uploadProgress = (e.loaded / e.total) * 25; // Upload is 25% of total
                    this.updateProgress(uploadProgress, 'Uploading file...');
                }
            });

            // Handle state changes
            xhr.addEventListener('readystatechange', () => {
                if (xhr.readyState === XMLHttpRequest.OPENED) {
                    this.updateProgress(5, 'Starting upload...');
                } else if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                    this.updateProgress(30, 'Upload complete, processing...');
                    this.setActiveStep('convert');
                } else if (xhr.readyState === XMLHttpRequest.LOADING) {
                    this.updateProgress(50, 'Converting audio...');
                    this.setActiveStep('transcribe');
                } else if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        this.updateProgress(90, 'Finalizing...');
                        this.setActiveStep('process');
                        resolve(xhr);
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timeout'));
            });

            // Configure request
            xhr.timeout = 300000; // 5 minutes
            xhr.open('POST', '/transcribe');
            xhr.send(formData);
        });
    }

    async handleTranscriptionResponse(response) {
        this.processingState = 'completed';
        this.updateProgress(100, 'Transcription complete!');
        
        // Get response text
        const responseText = await response.text();
        
        // Update result container
        const resultContainer = document.getElementById('result-container');
        if (resultContainer) {
            resultContainer.innerHTML = responseText;
        }

        // Hide progress and show result
        setTimeout(() => {
            this.showProgress(false);
            this.showResult(true);
            this.resetForm();
        }, 1000);

        // Save to history if enabled
        if (this.settings && this.settings.getSetting('historyEnabled')) {
            this.saveToHistory(responseText);
        }

        this.processingState = 'idle';
    }

    handleTranscriptionError(error) {
        this.processingState = 'error';
        
        console.error('Transcription error:', error);
        
        // Show error in progress area
        this.showProgressError(error.message);
        
        // Reset after delay
        setTimeout(() => {
            this.showProgress(false);
            this.processingState = 'idle';
        }, 5000);
    }

    validateFile(file) {
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        const allowedTypes = [
            'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv'
        ];

        if (!file) {
            return { valid: false, error: 'No file selected' };
        }

        if (file.size > maxSize) {
            return { valid: false, error: 'File size exceeds 2GB limit' };
        }

        if (!allowedTypes.some(type => file.type.startsWith(type.split('/')[0]))) {
            return { valid: false, error: 'Unsupported file type. Please select an audio or video file.' };
        }

        return { valid: true };
    }

    updateProgress(percentage, message) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressDetails = document.getElementById('progress-details');

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }

        if (progressDetails && message) {
            progressDetails.textContent = message;
        }
    }

    setActiveStep(stepName) {
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
            const isActive = step.dataset.step === stepName;
            step.classList.toggle('active', isActive);
            
            // Mark previous steps as completed
            const stepOrder = ['upload', 'convert', 'transcribe', 'process'];
            const currentIndex = stepOrder.indexOf(stepName);
            const stepIndex = stepOrder.indexOf(step.dataset.step);
            
            step.classList.toggle('completed', stepIndex < currentIndex);
        });
    }

    showProgress(show) {
        const progressContainer = document.getElementById('progress-container');
        const uploadContainer = document.getElementById('upload-container');

        if (progressContainer) {
            progressContainer.classList.toggle('hidden', !show);
        }

        if (uploadContainer) {
            uploadContainer.classList.toggle('processing', show);
        }
    }

    showProgressError(message) {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            const progressCard = progressContainer.querySelector('.progress-card');
            if (progressCard) {
                progressCard.classList.add('error');
                
                const title = progressCard.querySelector('.progress-title');
                if (title) title.textContent = 'Transcription Failed';
                
                const details = progressCard.querySelector('.progress-details');
                if (details) {
                    details.innerHTML = `
                        <div class="error-message">${message}</div>
                        <button class="retry-btn">Try Again</button>
                    `;
                }
            }
        }
    }

    showResult(show) {
        const resultContainer = document.getElementById('result-container');
        if (resultContainer) {
            resultContainer.classList.toggle('hidden', !show);
            if (show) {
                resultContainer.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    enableTranscribeButton() {
        const transcribeBtn = document.getElementById('transcribe-btn');
        if (transcribeBtn) {
            transcribeBtn.disabled = false;
            transcribeBtn.textContent = 'Transcribe';
        }
    }

    resetForm() {
        // Reset file input
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
        }

        // Hide file preview
        this.fileUploader.clearFile();

        // Disable transcribe button
        const transcribeBtn = document.getElementById('transcribe-btn');
        if (transcribeBtn) {
            transcribeBtn.disabled = true;
            transcribeBtn.textContent = 'Select File';
        }

        // Reset selected file
        this.selectedFile = null;

        // Reset progress elements
        const progressCard = document.querySelector('.progress-card');
        if (progressCard) {
            progressCard.classList.remove('error');
            
            const title = progressCard.querySelector('.progress-title');
            if (title) title.textContent = 'Processing Audio';
            
            const steps = progressCard.querySelectorAll('.step');
            steps.forEach(step => {
                step.classList.remove('active', 'completed');
            });
        }
    }

    startNewTranscription() {
        // Hide result
        this.showResult(false);
        
        // Reset form
        this.resetForm();
        
        // Focus file input
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    retryTranscription() {
        if (this.selectedFile) {
            this.startTranscription();
        } else {
            this.showError('No file selected for retry');
        }
    }

    cancelTranscription() {
        if (this.processingState === 'idle') return;

        const confirmed = confirm('Are you sure you want to cancel the transcription?');
        if (!confirmed) return;

        // Reset state
        this.processingState = 'idle';
        this.showProgress(false);
        
        this.showToast('Transcription cancelled', 'info');
    }

    saveToHistory(responseText) {
        try {
            // Extract transcript data from response HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(responseText, 'text/html');
            
            const transcriptElement = doc.querySelector('.transcript-content, #transcript-text');
            const transcript = transcriptElement ? transcriptElement.textContent : '';
            
            if (!transcript) return;

            // Create history entry
            const entry = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                filename: this.selectedFile.name,
                fileType: this.selectedFile.type,
                fileSize: this.selectedFile.size,
                transcript: transcript,
                wordCount: transcript.split(/\s+/).length,
                characterCount: transcript.length
            };

            // Save to storage
            if (window.HistoryStorage) {
                const storage = new HistoryStorage();
                storage.saveEntry(entry);
            }

        } catch (error) {
            console.warn('Failed to save to history:', error);
        }
    }

    generateId() {
        return 'transcript_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    // File processing utilities
    getFileDuration(file) {
        return new Promise((resolve) => {
            if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
                resolve(null);
                return;
            }

            const audio = document.createElement('audio');
            const video = document.createElement('video');
            const element = file.type.startsWith('audio/') ? audio : video;
            
            element.preload = 'metadata';
            element.onloadedmetadata = () => {
                resolve(element.duration);
                URL.revokeObjectURL(element.src);
            };
            element.onerror = () => {
                resolve(null);
                URL.revokeObjectURL(element.src);
            };
            
            element.src = URL.createObjectURL(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // State management
    getCurrentState() {
        return {
            processingState: this.processingState,
            selectedFile: this.selectedFile ? {
                name: this.selectedFile.name,
                size: this.selectedFile.size,
                type: this.selectedFile.type
            } : null,
            currentTranscription: this.currentTranscription
        };
    }

    getEstimatedProcessingTime(file) {
        // Rough estimation based on file size
        const sizeMB = file.size / (1024 * 1024);
        const baseTime = 10; // 10 seconds base
        const timePerMB = 2; // 2 seconds per MB
        
        return Math.round(baseTime + (sizeMB * timePerMB));
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TranscriptionManager;
} else if (typeof window !== 'undefined') {
    window.TranscriptionManager = TranscriptionManager;
}