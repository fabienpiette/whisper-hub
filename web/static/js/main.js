// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const submitBtn = document.getElementById('submit-btn');

// Initialize button state
submitBtn.disabled = true;

// File size limits (in bytes)
const FILE_LIMITS = {
    audio: 100 * 1024 * 1024, // 100MB
    video: 2 * 1024 * 1024 * 1024 // 2GB
};

// Estimated conversion times (seconds per MB)
const CONVERSION_ESTIMATES = {
    video: 0.5, // ~30 seconds per minute of video
    audio: 0.1  // Faster for audio processing
};

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        showFileInfo(files[0]);
    }
});

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        showFileInfo(e.target.files[0]);
    }
});

function showFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.add('show');
    
    // Determine file type for appropriate messaging
    const fileType = getFileType(file.name);
    const icon = fileType === 'video' ? '🎬' : '🎵';
    
    // Validate file size and show appropriate feedback
    const sizeValidation = validateFileSize(file.size, fileType);
    const timeEstimate = getTimeEstimate(file.size, fileType);
    
    // Update upload area with enhanced feedback
    uploadArea.querySelector('.upload-text').textContent = sizeValidation.valid ? 'File selected!' : '⚠️ File too large!';
    
    let subtextContent = '';
    if (!sizeValidation.valid) {
        subtextContent = sizeValidation.message;
        uploadArea.querySelector('.upload-icon').textContent = '❌';
        submitBtn.disabled = true;
    } else {
        if (fileType === 'video') {
            const formatTip = getFormatRecommendation(file.name);
            subtextContent = `Video will be converted to audio${timeEstimate ? ` (~${timeEstimate})` : ''}${formatTip ? ` • ${formatTip}` : ''}`;
        } else {
            subtextContent = `Ready to transcribe${timeEstimate ? ` (~${timeEstimate})` : ''} • Click transcribe or drop a different file`;
        }
        uploadArea.querySelector('.upload-icon').textContent = icon + ' ✅';
        submitBtn.disabled = false;
    }
    
    uploadArea.querySelector('.upload-subtext').textContent = subtextContent;
    
    // Add visual styling based on file type and validation
    uploadArea.className = `upload-area ${fileType} ${sizeValidation.valid ? 'valid' : 'invalid'}`;
    
    // Update file info styling
    fileInfo.className = `file-info show ${fileType} ${sizeValidation.valid ? 'valid' : 'invalid'}`;
}

function getFileType(filename) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return videoExtensions.includes(ext) ? 'video' : 'audio';
}

function validateFileSize(size, fileType) {
    const limit = FILE_LIMITS[fileType];
    if (size > limit) {
        return {
            valid: false,
            message: `File exceeds ${formatFileSize(limit)} limit for ${fileType} files. Please choose a smaller file.`
        };
    }
    return { valid: true };
}

function getTimeEstimate(size, fileType) {
    const sizeInMB = size / (1024 * 1024);
    const estimatedSeconds = sizeInMB * CONVERSION_ESTIMATES[fileType];
    
    if (estimatedSeconds < 10) return null; // Don't show estimate for very fast operations
    
    if (estimatedSeconds < 60) {
        return `${Math.round(estimatedSeconds)}s`;
    } else if (estimatedSeconds < 3600) {
        return `${Math.round(estimatedSeconds / 60)}m`;
    } else {
        const hours = Math.floor(estimatedSeconds / 3600);
        const minutes = Math.round((estimatedSeconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

function getFormatRecommendation(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const fastFormats = ['.mp4', '.webm', '.mov'];
    const slowFormats = ['.avi', '.mkv', '.flv', '.wmv'];
    
    if (slowFormats.includes(ext)) {
        return 'Tip: MP4/WebM files convert faster';
    }
    if (fastFormats.includes(ext)) {
        return 'Optimized format detected';
    }
    return null;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle form submission with enhanced progress tracking
document.querySelector('form').addEventListener('htmx:beforeRequest', () => {
    const file = fileInput.files[0];
    const fileType = file ? getFileType(file.name) : 'audio';
    const timeEstimate = getTimeEstimate(file.size, fileType);
    
    submitBtn.disabled = true;
    uploadArea.classList.add('uploading', fileType);
    submitBtn.classList.add(`${fileType}-processing`);
    
    if (fileType === 'video') {
        // Enhanced progress for video conversion
        startProgressAnimation('🔄 Converting & Transcribing...', timeEstimate);
    } else {
        // Simple progress for audio files
        submitBtn.textContent = '📤 Uploading & transcribing...';
    }
});

document.querySelector('form').addEventListener('htmx:afterRequest', (event) => {
    stopProgressAnimation();
    // Only enable if a valid file is selected
    const hasValidFile = fileInput.files.length > 0 && !uploadArea.classList.contains('invalid');
    submitBtn.disabled = !hasValidFile;
    submitBtn.textContent = '🎯 Transcribe File';
    uploadArea.classList.remove('uploading', 'video', 'audio');
    submitBtn.classList.remove('video-processing', 'audio-processing');
    
    // Check for successful transcription and handle history
    if (event.detail.xhr.status === 200) {
        handleTranscriptionSuccess(event.detail.xhr.responseText);
    }
});

// Handle HTMX errors specifically
document.querySelector('form').addEventListener('htmx:responseError', () => {
    stopProgressAnimation();
    // Reset button state on error
    const hasValidFile = fileInput.files.length > 0 && !uploadArea.classList.contains('invalid');
    submitBtn.disabled = !hasValidFile;
    submitBtn.textContent = '🎯 Transcribe File';
    uploadArea.classList.remove('uploading', 'video', 'audio');
    submitBtn.classList.remove('video-processing', 'audio-processing');
});

// Enhanced progress animation matching backend flow
let progressInterval;
let progressStage = 0;

function startProgressAnimation(baseText, estimateText) {
    const stages = [
        '📤 Uploading file...',
        '🔍 Validating video...',
        '🎬 Converting to audio...',
        '🤖 Transcribing audio...'
    ];
    
    progressStage = 0;
    submitBtn.textContent = stages[0];
    
    progressInterval = setInterval(() => {
        if (progressStage < stages.length - 1) {
            progressStage++;
            submitBtn.textContent = stages[progressStage];
            
            // Add estimated time on conversion stage (stage 2)
            if (progressStage === 2 && estimateText) {
                submitBtn.textContent += ` (${estimateText})`;
            }
        }
        // Stay on final stage instead of cycling
    }, 2500);
}

function stopProgressAnimation() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

// Copy transcript functionality
function copyTranscript() {
    const transcript = document.getElementById('transcript').textContent;
    navigator.clipboard.writeText(transcript).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.transform = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = transcript;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.transform = '';
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }
        document.body.removeChild(textArea);
    });
}

// Download transcript functionality
function downloadTranscript(originalFilename) {
    const transcript = document.getElementById('transcript').textContent;
    
    // Create a clean filename for the transcript
    const baseName = originalFilename.replace(/\.[^/.]+$/, ""); // Remove extension
    const cleanName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_'); // Replace special chars
    const filename = `${cleanName}_transcript.txt`;
    
    // Create blob and download
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    // Create temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    // Visual feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Downloaded!';
    btn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        btn.style.transform = '';
    }, 2000);
}

// History Integration
let historyManager = null;

/**
 * Initialize history system when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check if history is enabled from server config
        const config = await fetch('/api/history/config').then(r => r.json()).catch(() => ({ enabled: false }));
        
        if (config.enabled && window.HistoryManager) {
            historyManager = new HistoryManager(config);
            await historyManager.init();
            
            // Initialize UI
            const historyUI = new HistoryUI(historyManager);
            historyManager.setUI(historyUI);
            
            // Make globally available for debugging
            window.historyManager = historyManager;
            
            console.log('History system initialized successfully');
        }
    } catch (error) {
        console.warn('History system initialization failed:', error);
    }
});

/**
 * Handle successful transcription and extract history metadata
 */
function handleTranscriptionSuccess(responseHTML) {
    if (!historyManager) return;
    
    try {
        // Parse the response HTML to extract history metadata
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseHTML, 'text/html');
        const successDiv = doc.querySelector('.success[data-history-metadata]');
        
        if (successDiv) {
            const metadataJson = successDiv.getAttribute('data-history-metadata');
            if (metadataJson) {
                const metadata = JSON.parse(metadataJson);
                
                // Extract transcript from the response
                const transcriptDiv = doc.querySelector('#transcript');
                const transcript = transcriptDiv ? transcriptDiv.textContent : '';
                
                // Get current file info
                const file = fileInput.files[0];
                if (file && transcript) {
                    const transcriptionData = {
                        filename: file.name,
                        fileType: metadata.file_type,
                        fileSize: metadata.file_size,
                        duration: metadata.duration,
                        transcript: transcript,
                        processingTime: metadata.processing_time || 0,
                        timestamp: new Date(metadata.timestamp).getTime()
                    };
                    
                    // Add to history
                    historyManager.addTranscription(transcriptionData);
                }
            }
        }
    } catch (error) {
        console.error('Failed to process transcription for history:', error);
    }
}