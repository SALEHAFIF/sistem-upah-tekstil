// sync.js - Excel-Like File Management with Smart Detection
console.log('🔄 Loading Excel-like sync system with smart detection...');

// KONFIGURASI
const GITHUB_CONFIG = {
    username: '',
    repo: 'sistem-upah-tekstil',
    token: '',
    branch: 'main'
};

// STORAGE KEYS
const STORAGE_KEYS = {
    pabrik: 'tekstil_pabrik_data',
    ongkos: 'tekstil_ongkos_data', 
    karyawan: 'tekstil_karyawan_data',
    config: 'tekstil_github_config',
    fileStatus: 'tekstil_file_status'
};

// FILE STATUS TRACKING
let fileStatus = {
    isOpen: false,
    hasUnsavedChanges: false,
    filename: 'data.json',
    lastOpened: null,
    lastSaved: null
};

// INITIALIZATION WITH SMART DETECTION
async function initializeSystem() {
    console.log('🚀 Initializing Excel-like System with Smart Detection...');
    
    loadGitHubConfig();
    loadFileStatus();
    
    // SMART DETECTION: Check existing local data
    const hasLocalData = hasExistingLocalData();
    
    if (hasLocalData) {
        console.log('📂 Found existing local data');
        
        // Auto-open file dengan data local
        fileStatus.isOpen = true;
        fileStatus.hasUnsavedChanges = checkDataStatus() === 'dirty';
        
        if (fileStatus.hasUnsavedChanges) {
            showAlert('⚠️ Ada data belum disimpan dari session sebelumnya!', 'warning');
        } else {
            showAlert('📂 File dimuat dari local storage', 'info');
        }
        
        // Load UI with existing data
        refreshAllUI();
    } else {
        console.log('📭 No local data found');
    }
    
    updateFileStatusUI();
    console.log('✅ Excel-like system ready');
}

// GITHUB CONFIG
function loadGitHubConfig() {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.config);
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        GITHUB_CONFIG.username = config.username || '';
        GITHUB_CONFIG.token = config.token || '';
        console.log(`📂 Loaded config for: ${GITHUB_CONFIG.username}`);
    }
}

function saveGitHubConfig(username, token) {
    GITHUB_CONFIG.username = username;
    GITHUB_CONFIG.token = token;
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({
        username, token, configuredAt: new Date().toISOString()
    }));
    console.log(`💾 Config saved for: ${username}`);
}

function isGitHubConfigured() {
    return GITHUB_CONFIG.username && GITHUB_CONFIG.token;
}

// SMART DATA DETECTION
function hasExistingLocalData() {
    return loadPabrikData().length > 0 || 
           loadOngkosData().length > 0 || 
           loadKaryawanData().length > 0;
}

function getTotalLocalRecords() {
    return loadPabrikData().length + 
           loadOngkosData().length + 
           loadKaryawanData().length;
}

// FILE STATUS MANAGEMENT
function loadFileStatus() {
    const saved = localStorage.getItem(STORAGE_KEYS.fileStatus);
    if (saved) {
        fileStatus = { ...fileStatus, ...JSON.parse(saved) };
    }
}

function saveFileStatus() {
    localStorage.setItem(STORAGE_KEYS.fileStatus, JSON.stringify(fileStatus));
}

function checkDataStatus() {
    return localStorage.getItem('tekstil_data_status') || 'clean';
}

function setDataStatus(status) {
    localStorage.setItem('tekstil_data_status', status);
    fileStatus.hasUnsavedChanges = (status === 'dirty');
    saveFileStatus();
    updateFileStatusUI();
}

// LOCAL STORAGE FUNCTIONS WITH CHANGE TRACKING
function loadPabrikData() {
    const data = localStorage.getItem(STORAGE_KEYS.pabrik);
    return data ? JSON.parse(data) : [];
}

function savePabrikData(data) {
    localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(data));
    setDataStatus('dirty');
    console.log(`💾 Saved ${data.length} pabrik records locally`);
}

function loadOngkosData() {
    const data = localStorage.getItem(STORAGE_KEYS.ongkos);
    return data ? JSON.parse(data) : [];
}

function saveOngkosData(data) {
    localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(data));
    setDataStatus('dirty');
    console.log(`💾 Saved ${data.length} ongkos records locally`);
}

function loadKaryawanData() {
    const data = localStorage.getItem(STORAGE_KEYS.karyawan);
    return data ? JSON.parse(data) : [];
}

function saveKaryawanData(data) {
    localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(data));
    setDataStatus('dirty');
    console.log(`💾 Saved ${data.length} karyawan records locally`);
}

// SMART EXCEL-LIKE FILE OPERATIONS
async function openFile() {
    if (!isGitHubConfigured()) {
        showGitHubSetup();
        return;
    }
    
    // SMART CHECK: Ada data local atau tidak?
    const hasLocalData = hasExistingLocalData();
    const localStatus = checkDataStatus();
    const totalRecords = getTotalLocalRecords();
    
    if (hasLocalData && localStatus === 'dirty') {
        // ADA DATA UNSAVED - WARNING USER!
        const userChoice = confirm(
            `⚠️ PERINGATAN DATA LOCAL!\n\n` +
            `Ada ${totalRecords} data belum disimpan di local storage.\n\n` +
            `Pilihan:\n` +
            `• OK = Buka file dari cloud (data local akan hilang)\n` +
            `• Cancel = Tetap pakai data local (bisa save nanti)\n\n` +
            `Apa yang ingin Anda lakukan?`
        );
        
        if (!userChoice) {
            // User pilih tetap pakai data local
            fileStatus.isOpen = true;
            fileStatus.hasUnsavedChanges = true;
            updateFileStatusUI();
            refreshAllUI();
            showAlert('📂 Tetap menggunakan data local. Jangan lupa save!', 'warning');
            return;
        } else {
            // User pilih replace dengan cloud data
            showAlert('⚠️ Data local akan diganti dengan data cloud...', 'warning');
        }
    } else if (hasLocalData && localStatus === 'clean') {
        // Ada data tapi sudah clean - tanya user mau refresh atau tidak
        const userChoice = confirm(
            `📂 REFRESH FILE\n\n` +
            `Ada ${totalRecords} data tersimpan di local.\n\n` +
            `• OK = Download versi terbaru dari cloud\n` +
            `• Cancel = Tetap pakai data local\n\n` +
            `Download data terbaru?`
        );
        
        if (!userChoice) {
            fileStatus.isOpen = true;
            fileStatus.hasUnsavedChanges = false;
            updateFileStatusUI();
            refreshAllUI();
            showAlert('📂 Menggunakan data local yang tersimpan', 'info');
            return;
        }
    }
    
    // DOWNLOAD FROM CLOUD
    updateSyncStatus('syncing', 'Opening...');
    
    try {
        console.log('📂 Opening file from GitHub...');
        const cloudData = await getGitHubFile('data.json');
        
        if (cloudData) {
            // Load data to localStorage
            localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(cloudData.pabrik || []));
            localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(cloudData.ongkos || []));
            localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(cloudData.karyawan || []));
            
            fileStatus.isOpen = true;
            fileStatus.hasUnsavedChanges = false;
            fileStatus.lastOpened = new Date().toISOString();
            setDataStatus('clean');
            
            // Refresh UI
            refreshAllUI();
            
            updateSyncStatus('', 'File opened');
            showAlert('📂 File berhasil dibuka dari cloud!', 'success');
            
            console.log('✅ File opened from cloud:', {
                pabrik: (cloudData.pabrik || []).length,
                ongkos: (cloudData.ongkos || []).length,
                karyawan: (cloudData.karyawan || []).length
            });
            
        } else {
            // No file exists, create new
            localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify([]));
            
            fileStatus.isOpen = true;
            fileStatus.hasUnsavedChanges = false;
            setDataStatus('clean');
            refreshAllUI();
            
            updateSyncStatus('', 'New file');
            showAlert('📄 File baru dibuat - siap untuk input data', 'info');
        }
        
    } catch (error) {
        console.error('❌ Failed to open file:', error);
        updateSyncStatus('error', 'Open failed');
        showAlert('❌ Gagal membuka file dari cloud!', 'error');
    }
}

async function saveFile() {
    if (!isGitHubConfigured()) {
        showAlert('❌ Setup GitHub sync terlebih dahulu!', 'error');
        return;
    }
    
    if (!fileStatus.hasUnsavedChanges) {
        showAlert('ℹ️ Tidak ada perubahan untuk disimpan', 'info');
        return;
    }
    
    updateSyncStatus('syncing', 'Saving...');
    
    try {
        const allData = {
            pabrik: loadPabrikData(),
            ongkos: loadOngkosData(),
            karyawan: loadKaryawanData(),
            lastUpdated: new Date().toISOString(),
            version: '1.0'
        };
        
        console.log('💾 Saving file to GitHub...', {
            pabrik: allData.pabrik.length,
            ongkos: allData.ongkos.length,
            karyawan: allData.karyawan.length
        });
        
        const success = await updateGitHubFile('data.json', allData);
        
        if (success) {
            fileStatus.hasUnsavedChanges = false;
            fileStatus.lastSaved = new Date().toISOString();
            setDataStatus('clean');
            
            updateSyncStatus('', 'Saved');
            showAlert('💾 File berhasil disimpan ke cloud!', 'success');
            console.log('✅ File saved successfully');
        }
        
    } catch (error) {
        console.error('❌ Failed to save file:', error);
        updateSyncStatus('error', 'Save failed');
        showAlert('❌ Gagal menyimpan file! Data masih aman di local.', 'error');
    }
}

// NEW FILE FUNCTION
function newFile() {
    const hasLocalData = hasExistingLocalData();
    const localStatus = checkDataStatus();
    
    if (hasLocalData && localStatus === 'dirty') {
        const confirmed = confirm(
            `⚠️ PERINGATAN!\n\n` +
            `Ada ${getTotalLocalRecords()} data belum disimpan.\n\n` +
            `Yakin ingin membuat file baru? Data akan hilang!`
        );
        
        if (!confirmed) return;
    }
    
    // Clear all data
    localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify([]));
    
    fileStatus.isOpen = true;
    fileStatus.hasUnsavedChanges = false;
    setDataStatus('clean');
    
    refreshAllUI();
    updateSyncStatus('', 'New file');
    showAlert('📄 File baru dibuat - mulai fresh!', 'success');
}

// GITHUB API FUNCTIONS (unchanged)
async function getGitHubFile(filename) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (response.status === 404) {
        console.log('📄 File not found, will create new');
        return null;
    }
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const fileData = await response.json();
    const content = atob(fileData.content);
    return JSON.parse(content);
}

async function updateGitHubFile(filename, data) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    
    // Get current file SHA
    let sha = null;
    try {
        const currentFile = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (currentFile.ok) {
            const fileData = await currentFile.json();
            sha = fileData.sha;
        }
    } catch (e) {
        console.log('📝 Creating new file');
    }
    
    const payload = {
        message: `Save data - ${new Date().toISOString()}`,
        content: btoa(JSON.stringify(data, null, 2)),
        branch: GITHUB_CONFIG.branch
    };
    
    if (sha) payload.sha = sha;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
    }
    
    return true;
}

// UI FUNCTIONS
function updateSyncStatus(status, message) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatus');
    
    if (indicator) indicator.className = `sync-indicator ${status}`;
    if (statusText) statusText.textContent = message;
}

function updateFileStatusUI() {
    updateSyncStatus('', getFileStatusText());
    updateWindowTitle();
}

function getFileStatusText() {
    if (!fileStatus.isOpen) return 'No file open';
    if (fileStatus.hasUnsavedChanges) return 'Unsaved changes*';
    return 'Saved';
}

function updateWindowTitle() {
    const unsavedMark = fileStatus.hasUnsavedChanges ? '*' : '';
    document.title = `Sistem Upah Tekstil - ${fileStatus.filename}${unsavedMark}`;
}

function refreshAllUI() {
    setTimeout(() => {
        if (typeof renderPabrikList === 'function') renderPabrikList();
        if (typeof renderOngkosList === 'function') renderOngkosList();
        if (typeof renderKaryawanList === 'function') renderKaryawanList();
        if (typeof updateKaryawanStats === 'function') updateKaryawanStats();
        if (typeof updateOngkosStats === 'function') updateOngkosStats();
        if (typeof loadPabrikCheckboxesOngkos === 'function') loadPabrikCheckboxesOngkos();
        if (typeof loadOngkosFilterOptions === 'function') loadOngkosFilterOptions();
        if (typeof loadKaryawanDropdownOptions === 'function') loadKaryawanDropdownOptions();
    }, 100);
}

// SETUP DIALOG (unchanged but updated text)
function showGitHubSetup() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h2 style="margin-bottom: 20px; color: #2c3e50;">🔧 Setup File Sync</h2>
                
                <div style="background: #e3f2fd; border: 1px solid #bbdefb; color: #1565c0; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
                    <strong>📁 SMART FILE MANAGEMENT:</strong><br>
                    • Auto-detect local data saat startup<br>
                    • Warning sebelum overwrite data<br>  
                    • Data aman dari browser crash<br>
                    • Excel-like Open/Save workflow
                </div>
                
                <p style="margin-bottom: 20px; color: #666;">Masukkan informasi GitHub Anda:</p>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Username GitHub:</label>
                    <input type="text" id="githubUsername" placeholder="contoh: johndoe" style="width: 100%; padding: 10px; border: 2px solid #e9ecef; border-radius: 5px;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Personal Access Token:</label>
                    <input type="password" id="githubToken" placeholder="ghp_xxxxxxxxxxxx" style="width: 100%; padding: 10px; border: 2px solid #e9ecef; border-radius: 5px;">
                    <small style="color: #666;">Token dengan akses 'repo' diperlukan</small>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: end;">
                    <button onclick="closeGitHubSetup()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer;">Batal</button>
                    <button onclick="saveGitHubSetup()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Setup Sync</button>
                </div>
            </div>
        </div>
    `;
    modal.id = 'githubSetupModal';
    document.body.appendChild(modal);
}

function saveGitHubSetup() {
    const username = document.getElementById('githubUsername').value.trim();
    const token = document.getElementById('githubToken').value.trim();
    
    if (!username || !token) {
        alert('Username dan token harus diisi!');
        return;
    }
    
    saveGitHubConfig(username, token);
    closeGitHubSetup();
    showAlert('✅ Setup berhasil! Klik "Open" untuk memulai.', 'success');
    updateFileStatusUI();
}

function closeGitHubSetup() {
    const modal = document.getElementById('githubSetupModal');
    if (modal) modal.remove();
}

// ENHANCED INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initializeSystem();
});

// UTILITY FUNCTIONS
function showAlert(message, type = 'success') {
    // This function should exist in dashboard.html
    if (typeof window.showAlert === 'function') {
        window.showAlert(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

console.log('✅ Smart Excel-like sync system loaded');
