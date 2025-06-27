// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const submitBtn = document.getElementById('submit-btn');

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
    
    // Update upload area
    uploadArea.querySelector('.upload-text').textContent = 'File selected!';
    uploadArea.querySelector('.upload-subtext').textContent = fileType === 'video' ? 
        'Video will be converted to audio for transcription' : 
        'Click transcribe or drop a different file';
    uploadArea.querySelector('.upload-icon').textContent = icon + ' ✅';
}

function getFileType(filename) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return videoExtensions.includes(ext) ? 'video' : 'audio';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle form submission
document.querySelector('form').addEventListener('htmx:beforeRequest', () => {
    const file = fileInput.files[0];
    const fileType = file ? getFileType(file.name) : 'audio';
    
    submitBtn.disabled = true;
    submitBtn.textContent = fileType === 'video' ? '🔄 Converting & Transcribing...' : '🔄 Transcribing...';
    uploadArea.classList.add('uploading');
});

document.querySelector('form').addEventListener('htmx:afterRequest', () => {
    submitBtn.disabled = false;
    submitBtn.textContent = '🎯 Transcribe File';
    uploadArea.classList.remove('uploading');
});

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