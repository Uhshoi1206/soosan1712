/**
 * Backup System for Soosan Motor CMS
 * Provides functionality to backup website content via GitHub API
 */

// Configuration
const CONFIG = {
    repo: 'Uhshoi1206/soosan1712',
    branch: 'main',
    contentPath: 'src/content',
    paths: {
        settings: ['src/content/settings'],
        products: ['src/content/products', 'src/content/categories'],
        blog: ['src/content/blog', 'src/content/blog-categories'],
        banners: ['src/content/banners'],
        content: ['src/content'], // All CMS content
        full: ['src', 'public', 'scripts', '.github'] // Full source code
    },
    // Root config files to include in full backup
    rootFiles: [
        'astro.config.mjs',
        'package.json',
        'package-lock.json',
        'tailwind.config.ts',
        'tsconfig.json',
        'tsconfig.astro.json',
        'postcss.config.js',
        'eslint.config.js',
        'netlify.toml',
        'components.json'
    ]
};

// State
let isBackupRunning = false;

// Logging utilities
function log(message, type = 'info') {
    const logContainer = document.getElementById('status-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLog() {
    document.getElementById('status-log').innerHTML = '';
}

function showProgress(show = true) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.classList.toggle('active', show);
}

function setProgress(percent) {
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

function setButtonLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        button.querySelector('.btn-text').innerHTML = '<span class="spinner"></span> Đang xử lý...';
    } else {
        button.disabled = false;
        const originalText = button.dataset.originalText || button.querySelector('.btn-text').textContent;
        button.querySelector('.btn-text').textContent = originalText;
    }
}

// Get GitHub token from localStorage (set by Sveltia CMS)
function getGitHubToken() {
    // Try Sveltia CMS token storage
    const sveltiaAuth = localStorage.getItem('sveltia-cms.auth');
    if (sveltiaAuth) {
        try {
            const auth = JSON.parse(sveltiaAuth);
            if (auth.token) return auth.token;
        } catch (e) { }
    }

    // Try Netlify CMS token storage
    const netlifyAuth = localStorage.getItem('netlify-cms-user');
    if (netlifyAuth) {
        try {
            const auth = JSON.parse(netlifyAuth);
            if (auth.token) return auth.token;
        } catch (e) { }
    }

    // Try direct token
    const directToken = localStorage.getItem('github-token');
    if (directToken) return directToken;

    // Check for manually saved token
    const manualToken = localStorage.getItem('backup-github-token');
    if (manualToken) return manualToken;

    // Search ALL localStorage keys for anything containing token data
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);

        if (!value) continue;

        try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
                // Check common token field names
                const tokenFields = ['token', 'access_token', 'backendToken', 'github_token', 'accessToken'];
                for (const field of tokenFields) {
                    if (parsed[field] && typeof parsed[field] === 'string' && parsed[field].length > 20) {
                        console.log(`Found token in localStorage["${key}"]["${field}"]`);
                        return parsed[field];
                    }
                }
                // Check nested 'user' or 'auth' objects
                for (const subKey of ['user', 'auth', 'data']) {
                    if (parsed[subKey] && typeof parsed[subKey] === 'object') {
                        for (const field of tokenFields) {
                            if (parsed[subKey][field] && typeof parsed[subKey][field] === 'string') {
                                console.log(`Found token in localStorage["${key}"]["${subKey}"]["${field}"]`);
                                return parsed[subKey][field];
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Check if raw value looks like a GitHub token
            if (value.startsWith('ghp_') || value.startsWith('gho_') || value.startsWith('github_pat_')) {
                return value;
            }
        }
    }

    return null;
}

// Prompt user to enter token manually
function promptForToken() {
    const token = prompt(
        'Không tìm thấy GitHub token tự động.\n\n' +
        'Để backup, bạn cần nhập Personal Access Token (PAT) của GitHub.\n\n' +
        'Cách lấy token:\n' +
        '1. Truy cập: github.com/settings/tokens\n' +
        '2. Chọn "Generate new token (classic)"\n' +
        '3. Đặt tên, chọn quyền "repo" (full control)\n' +
        '4. Copy token và paste vào đây\n\n' +
        'Nhập GitHub Token:'
    );

    if (token && token.trim()) {
        localStorage.setItem('backup-github-token', token.trim());
        return token.trim();
    }
    return null;
}

// Fetch directory contents recursively from GitHub
async function fetchDirectoryContents(path, token) {
    const url = `https://api.github.com/repos/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }

    return await response.json();
}

// Fetch file content from GitHub with retry
async function fetchFileContent(filePath, token, retries = 3) {
    // Use GitHub API content endpoint instead of raw download URL
    const url = `https://api.github.com/repos/${CONFIG.repo}/contents/${filePath}?ref=${CONFIG.branch}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 403) {
                // Rate limited, wait and retry
                const waitTime = attempt * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Decode base64 content
            if (data.content) {
                return decodeBase64(data.content);
            }

            throw new Error('No content in response');
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
}

// Decode base64 content (handles UTF-8)
function decodeBase64(base64String) {
    // Remove line breaks that GitHub adds
    const cleanBase64 = base64String.replace(/\n/g, '');

    // Decode base64 to binary
    const binaryString = atob(cleanBase64);

    // Convert binary to UTF-8 text
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return new TextDecoder('utf-8').decode(bytes);
}

// Recursively get all files in a directory
async function getAllFiles(path, token, files = []) {
    const contents = await fetchDirectoryContents(path, token);

    for (const item of contents) {
        if (item.type === 'file') {
            files.push({
                path: item.path,
                downloadUrl: item.download_url
            });
        } else if (item.type === 'dir') {
            await getAllFiles(item.path, token, files);
        }
    }

    return files;
}

// Create and download ZIP file
async function createAndDownloadZip(files, token, backupName) {
    const zip = new JSZip();
    const totalFiles = files.length;
    let processed = 0;

    log(`Đang tải ${totalFiles} files...`, 'info');
    showProgress(true);

    for (const file of files) {
        try {
            const content = await fetchFileContent(file.path, token);
            zip.file(file.path, content);
            processed++;
            setProgress((processed / totalFiles) * 100);

            if (processed % 10 === 0 || processed === totalFiles) {
                log(`Đã xử lý ${processed}/${totalFiles} files...`, 'info');
            }
        } catch (error) {
            log(`Lỗi khi tải ${file.path}: ${error.message}`, 'warning');
        }
    }

    log('Đang tạo file ZIP...', 'info');

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${backupName}-${timestamp}.zip`;

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
}

// Generic backup function
async function performBackup(pathsKey, backupName, buttonElement) {
    if (isBackupRunning) {
        log('Đang có backup đang chạy, vui lòng đợi...', 'warning');
        return;
    }

    const button = buttonElement || event.target.closest('button');
    button.dataset.originalText = button.querySelector('.btn-text').textContent;

    try {
        isBackupRunning = true;
        setButtonLoading(button, true);
        clearLog();

        log(`Bắt đầu backup ${backupName}...`, 'info');

        // Get token
        let token = getGitHubToken();
        if (!token) {
            log('⚠ Không tìm thấy token tự động, đang yêu cầu nhập thủ công...', 'warning');
            token = promptForToken();
            if (!token) {
                throw new Error('Không có GitHub token. Vui lòng nhập token để tiếp tục.');
            }
            log('✓ Đã nhận token thủ công', 'success');
        } else {
            log('✓ Đã xác thực token', 'success');
        }

        // Get paths to backup
        const paths = CONFIG.paths[pathsKey];
        let allFiles = [];

        for (const path of paths) {
            log(`Đang quét ${path}...`, 'info');
            try {
                const files = await getAllFiles(path, token);
                allFiles = allFiles.concat(files);
                log(`✓ Tìm thấy ${files.length} files trong ${path}`, 'success');
            } catch (error) {
                log(`⚠ Không thể đọc ${path}: ${error.message}`, 'warning');
            }
        }

        // For full backup, also include root config files
        if (pathsKey === 'full' && CONFIG.rootFiles) {
            log('Đang quét các file cấu hình gốc...', 'info');
            for (const filename of CONFIG.rootFiles) {
                allFiles.push({
                    path: filename,
                    downloadUrl: null
                });
            }
            log(`✓ Thêm ${CONFIG.rootFiles.length} file cấu hình`, 'success');
        }

        if (allFiles.length === 0) {
            throw new Error('Không tìm thấy file nào để backup');
        }

        log(`Tổng cộng ${allFiles.length} files cần backup`, 'info');

        // Create ZIP and download
        const filename = await createAndDownloadZip(allFiles, token, backupName);

        showProgress(false);
        setProgress(0);
        log(`✓ Backup hoàn tất! File: ${filename}`, 'success');

    } catch (error) {
        log(`✗ Lỗi: ${error.message}`, 'error');
        showProgress(false);
        setProgress(0);
    } finally {
        isBackupRunning = false;
        setButtonLoading(button, false);
    }
}

// Backup functions for each type
async function backupSettings() {
    await performBackup('settings', 'settings');
}

async function backupProducts() {
    await performBackup('products', 'products');
}

async function backupBlog() {
    await performBackup('blog', 'blog');
}

async function backupBanners() {
    await performBackup('banners', 'banners');
}

async function backupContent() {
    await performBackup('content', 'cms-content');
}

async function backupFull() {
    await performBackup('full', 'source-code');
}

// =====================================================
// RESTORE FUNCTIONALITY
// =====================================================

// State for restore
let restoreFiles = [];
let isRestoreRunning = false;

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processZipFile(file);
    }
}

// Setup drag and drop
function setupDragDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.zip')) {
            processZipFile(file);
        } else {
            log('Vui lòng chọn file ZIP', 'error');
        }
    });
}

// Process uploaded ZIP file
async function processZipFile(file) {
    try {
        clearLog();
        log(`Đang đọc file: ${file.name}...`, 'info');

        const zip = await JSZip.loadAsync(file);
        restoreFiles = [];

        // Extract file list
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                restoreFiles.push({
                    path: relativePath,
                    zipEntry: zipEntry
                });
            }
        });

        if (restoreFiles.length === 0) {
            log('File ZIP trống hoặc không có nội dung hợp lệ', 'error');
            return;
        }

        // Update UI
        document.getElementById('selected-file-info').textContent = `✓ ${file.name} (${formatFileSize(file.size)})`;

        // Show preview
        showRestorePreview();

        log(`✓ Đã đọc ${restoreFiles.length} files từ backup`, 'success');

    } catch (error) {
        log(`Lỗi đọc file ZIP: ${error.message}`, 'error');
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Show restore preview
function showRestorePreview() {
    const previewSection = document.getElementById('restore-preview');
    const statsContainer = document.getElementById('preview-stats');
    const filesContainer = document.getElementById('preview-files');

    // Categorize files
    const categories = {
        settings: [],
        products: [],
        blog: [],
        banners: [],
        other: []
    };

    restoreFiles.forEach(file => {
        if (file.path.includes('content/settings')) {
            categories.settings.push(file);
        } else if (file.path.includes('content/products') || file.path.includes('content/categories')) {
            categories.products.push(file);
        } else if (file.path.includes('content/blog')) {
            categories.blog.push(file);
        } else if (file.path.includes('content/banners')) {
            categories.banners.push(file);
        } else {
            categories.other.push(file);
        }
    });

    // Show stats
    statsContainer.innerHTML = `
        <div class="stat">Tổng: <strong>${restoreFiles.length}</strong> files</div>
        ${categories.settings.length ? `<div class="stat">⚙️ Settings: <strong>${categories.settings.length}</strong></div>` : ''}
        ${categories.products.length ? `<div class="stat">📦 Sản phẩm: <strong>${categories.products.length}</strong></div>` : ''}
        ${categories.blog.length ? `<div class="stat">📝 Bài viết: <strong>${categories.blog.length}</strong></div>` : ''}
        ${categories.banners.length ? `<div class="stat">🎨 Banners: <strong>${categories.banners.length}</strong></div>` : ''}
        ${categories.other.length ? `<div class="stat">📁 Khác: <strong>${categories.other.length}</strong></div>` : ''}
    `;

    // Show file list (limit to 50 for performance)
    const displayFiles = restoreFiles.slice(0, 50);
    filesContainer.innerHTML = displayFiles.map(f =>
        `<div class="file-item">${f.path}</div>`
    ).join('');

    if (restoreFiles.length > 50) {
        filesContainer.innerHTML += `<div class="file-item" style="color: var(--warning)">... và ${restoreFiles.length - 50} files khác</div>`;
    }

    previewSection.style.display = 'block';
}

// Cancel restore
function cancelRestore() {
    restoreFiles = [];
    document.getElementById('restore-preview').style.display = 'none';
    document.getElementById('selected-file-info').textContent = '';
    document.getElementById('restore-file').value = '';
    log('Đã hủy restore', 'info');
}

// Get file SHA (needed for updating existing files)
async function getFileSha(path, token) {
    try {
        const url = `https://api.github.com/repos/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch {
        return null;
    }
}

// Upload single file to GitHub
async function uploadFileToGitHub(path, content, token, sha = null) {
    const url = `https://api.github.com/repos/${CONFIG.repo}/contents/${path}`;

    // Encode content to base64
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    const body = {
        message: `[Restore] Update ${path}`,
        content: base64Content,
        branch: CONFIG.branch
    };

    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
}

// Perform restore
async function performRestore() {
    if (isRestoreRunning) {
        log('Đang có restore đang chạy, vui lòng đợi...', 'warning');
        return;
    }

    if (restoreFiles.length === 0) {
        log('Không có file nào để restore', 'error');
        return;
    }

    // Confirm
    if (!confirm(`Bạn có chắc muốn khôi phục ${restoreFiles.length} files?\n\nCác file hiện có sẽ bị GHI ĐÈ!`)) {
        return;
    }

    const button = document.getElementById('btn-restore');
    button.dataset.originalText = button.querySelector('.btn-text').textContent;

    try {
        isRestoreRunning = true;
        setButtonLoading(button, true);

        log('Bắt đầu restore...', 'info');

        // Get token
        let token = getGitHubToken();
        if (!token) {
            token = promptForToken();
            if (!token) {
                throw new Error('Không có GitHub token');
            }
        }
        log('✓ Đã xác thực token', 'success');

        showProgress(true);
        const total = restoreFiles.length;
        let success = 0;
        let failed = 0;

        for (let i = 0; i < restoreFiles.length; i++) {
            const file = restoreFiles[i];

            try {
                // Read file content from ZIP
                const content = await file.zipEntry.async('string');

                // Get existing file SHA (if exists)
                const sha = await getFileSha(file.path, token);

                // Upload to GitHub
                await uploadFileToGitHub(file.path, content, token, sha);

                success++;

                if ((i + 1) % 5 === 0 || i === total - 1) {
                    log(`Đã restore ${i + 1}/${total} files...`, 'info');
                }

            } catch (error) {
                failed++;
                log(`✗ Lỗi restore ${file.path}: ${error.message}`, 'warning');
            }

            setProgress(((i + 1) / total) * 100);

            // Rate limiting: small delay between requests
            if (i < restoreFiles.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        showProgress(false);
        setProgress(0);

        if (failed === 0) {
            log(`✓ Restore hoàn tất! ${success} files đã được khôi phục.`, 'success');
        } else {
            log(`⚠ Restore hoàn tất với ${failed} lỗi. ${success}/${total} files thành công.`, 'warning');
        }

        // Reset UI
        cancelRestore();

    } catch (error) {
        log(`✗ Lỗi: ${error.message}`, 'error');
        showProgress(false);
        setProgress(0);
    } finally {
        isRestoreRunning = false;
        setButtonLoading(button, false);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const accessDenied = document.getElementById('access-denied');
    const mainContent = document.getElementById('main-content');

    // Check token availability for access control
    const token = getGitHubToken();

    if (token) {
        // User has token - show main content
        if (mainContent) mainContent.classList.add('show');
        if (accessDenied) accessDenied.classList.remove('show');

        // Setup restore drag-drop
        setupDragDrop();

        log('Sẵn sàng thực hiện backup/restore. Chọn chức năng bên trên.', 'info');
        log('✓ Đã tìm thấy GitHub token', 'success');
    } else {
        // No token - show access denied
        if (accessDenied) accessDenied.classList.add('show');
        if (mainContent) mainContent.classList.remove('show');
    }
});
