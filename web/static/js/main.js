// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const submitBtn = document.getElementById('submit-btn');

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
        submitBtn.textContent = '🔄 Transcribing...';
    }
});

document.querySelector('form').addEventListener('htmx:afterRequest', () => {
    stopProgressAnimation();
    submitBtn.disabled = false;
    submitBtn.textContent = '🎯 Transcribe File';
    uploadArea.classList.remove('uploading', 'video', 'audio');
    submitBtn.classList.remove('video-processing', 'audio-processing');
});

// Enhanced progress animation for video conversion
let progressInterval;
let progressStage = 0;

function startProgressAnimation(baseText, estimateText) {
    const stages = [
        '🔄 Preparing video...',
        '🎬 Converting to audio...',
        '🎵 Optimizing audio...',
        '🤖 Transcribing...'
    ];
    
    progressStage = 0;
    submitBtn.textContent = stages[0];
    
    progressInterval = setInterval(() => {
        progressStage = (progressStage + 1) % stages.length;
        submitBtn.textContent = stages[progressStage];
        
        // Add estimated time on conversion stage
        if (progressStage === 1 && estimateText) {
            submitBtn.textContent += ` (${estimateText})`;
        }
    }, 2000);
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
        btn.style.background = '#28a745';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#28a745';
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
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed: ', err);
        }
        document.body.removeChild(textArea);
    });
}