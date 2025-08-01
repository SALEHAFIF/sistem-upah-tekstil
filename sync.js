// sync.js - GitHub Pages Integration
console.log('🔄 Loading GitHub sync system...');

// KONFIGURASI - Ganti dengan info GitHub Anda
const GITHUB_CONFIG = {
    username: '', // Akan diset nanti
    repo: 'sistem-upah-tekstil',
    token: '', // Akan diset nanti
    branch: 'main'
};

// STORAGE KEYS
const STORAGE_KEYS = {
    pabrik: 'tekstil_pabrik_data',
    ongkos: 'tekstil_ongkos_data', 
    karyawan: 'tekstil_karyawan_data',
    config: 'tekstil_github_config',
    lastSync: 'tekstil_last_sync'
};

// INITIALIZATION
async function initializeSystem() {
    console.log('🚀 Initializing Textile Wage System...');
    
    // Load GitHub config
    loadGitHubConfig();
    
    // Initialize IndexedDB
    await initializeIndexedDB();
    
    // Check sync status
    updateSyncIndicator();
    
    // Auto sync if online and configured
    if (navigator.onLine && isGitHubConfigured()) {
        console.log('📡 Auto-syncing data...');
        await loadFromCloud();
    }
    
    console.log('✅ System initialized successfully');
}

// GITHUB CONFIG MANAGEMENT
function loadGitHubConfig() {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.config);
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        GITHUB_CONFIG.username = config.username || '';
        GITHUB_CONFIG.token = config.token || '';
        console.log(`📂 Loaded GitHub config for: ${GITHUB_CONFIG.username}`);
    }
}

function saveGitHubConfig(username, token) {
    GITHUB_CONFIG.username = username;
    GITHUB_CONFIG.token = token;
    
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({
        username: username,
        token: token,
        configuredAt: new Date().toISOString()
    }));
    
    console.log(`💾 GitHub config saved for: ${username}`);
}

function isGitHubConfigured() {
    return GITHUB_CONFIG.username && GITHUB_CONFIG.token;
}

// LOCAL STORAGE FUNCTIONS
function loadPabrikData() {
    const data = localStorage.getItem(STORAGE_KEYS.pabrik);
    return data ? JSON.parse(data) : [];
}

function savePabrikData(data) {
    localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(data));
    console.log(`💾 Saved ${data.length} pabrik records locally`);
    queueSync('pabrik', data);
}

function loadOngkosData() {
    const data = localStorage.getItem(STORAGE_KEYS.ongkos);
    return data ? JSON.parse(data) : [];
}

function saveOngkosData(data) {
    localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(data));
    console.log(`💾 Saved ${data.length} ongkos records locally`);
    queueSync('ongkos', data);
}

function loadKaryawanData() {
    const data = localStorage.getItem(STORAGE_KEYS.karyawan);
    return data ? JSON.parse(data) : [];
}

function saveKaryawanData(data) {
    localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(data));
    console.log(`💾 Saved ${data.length} karyawan records locally`);
    queueSync('karyawan', data);
}

// INDEXEDDB FUNCTIONS (for offline capability)
let db;

function initializeIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TextileWageSystem', 1);
        
        request.onerror = () => {
            console.error('❌ IndexedDB error:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB initialized');
            resolve(db);
        };
        
        request.onupgradeneeded = () => {
            db = request.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('pabrik')) {
                db.createObjectStore('pabrik', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('ongkos')) {
                db.createObjectStore('ongkos', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('karyawan')) {
                db.createObjectStore('karyawan', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('sync_queue')) {
                db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
            }
            
            console.log('🏗️ IndexedDB schema created');
        };
    });
}

// SYNC QUEUE MANAGEMENT
const syncQueue = [];

function queueSync(dataType, data) {
    if (!navigator.onLine || !isGitHubConfigured()) {
        console.log(`📤 Queued ${dataType} for sync when online`);
        return;
    }
    
    // Debounce sync requests
    clearTimeout(window.syncTimeout);
    window.syncTimeout = setTimeout(async () => {
        await saveToCloud();
    }, 2000);
}

// GITHUB API FUNCTIONS
async function saveToCloud() {
    if (!isGitHubConfigured()) {
        console.log('⚠️ GitHub not configured, skipping cloud sync');
        return false;
    }
    
    if (!navigator.onLine) {
        console.log('📴 Offline, skipping cloud sync');
        return false;
    }
    
    updateSyncStatus('syncing', 'Syncing...');
    
    try {
        // Get all data
        const allData = {
            pabrik: loadPabrikData(),
            ongkos: loadOngkosData(),
            karyawan: loadKaryawanData(),
            lastUpdated: new Date().toISOString(),
            version: '1.0'
        };
        
        console.log('📤 Uploading data to GitHub...', {
            pabrik: allData.pabrik.length,
            ongkos: allData.ongkos.length,
            karyawan: allData.karyawan.length
        });
        
        // Upload to GitHub
        const success = await updateGitHubFile('data.json', allData);
        
        if (success) {
            localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
            updateSyncStatus('', 'Connected');
            console.log('✅ Data synced to cloud successfully');
            return true;
        } else {
            throw new Error('Failed to upload to GitHub');
        }
        
    } catch (error) {
        console.error('❌ Cloud sync failed:', error);
        updateSyncStatus('error', 'Sync failed');
        return false;
    }
}

async function loadFromCloud() {
    if (!isGitHubConfigured()) {
        console.log('⚠️ GitHub not configured, using local data');
        return false;
    }
    
    if (!navigator.onLine) {
        console.log('📴 Offline, using local data');
        return false;
    }
    
    updateSyncStatus('syncing', 'Loading...');
    
    try {
        console.log('📥 Downloading data from GitHub...');
        
        const cloudData = await getGitHubFile('data.json');
        
        if (cloudData) {
            // Update local storage
            if (cloudData.pabrik) {
                localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(cloudData.pabrik));
            }
            if (cloudData.ongkos) {
                localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(cloudData.ongkos));
            }
            if (cloudData.karyawan) {
                localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(cloudData.karyawan));
            }
            
            localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
            updateSyncStatus('', 'Connected');
            
            console.log('✅ Data loaded from cloud:', {
                pabrik: cloudData.pabrik?.length || 0,
                ongkos: cloudData.ongkos?.length || 0,
                karyawan: cloudData.karyawan?.length || 0
            });
            
            return true;
        }
        
    } catch (error) {
        console.error('❌ Failed to load from cloud:', error);
        updateSyncStatus('error', 'Load failed');
    }
    
    return false;
}

async function getGitHubFile(filename) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.status === 404) {
            console.log('📄 File not found on GitHub, will create new');
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const fileData = await response.json();
        const content = atob(fileData.content);
        return JSON.parse(content);
        
    } catch (error) {
        console.error('❌ Error getting GitHub file:', error);
        throw error;
    }
}

async function updateGitHubFile(filename, data) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    const content = btoa(JSON.stringify(data, null, 2));
    
    try {
        // First, try to get the current file to get its SHA
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
            console.log('📝 Creating new file (no existing SHA)');
        }
        
        // Create or update the file
        const payload = {
            message: `Update data - ${new Date().toISOString()}`,
            content: content,
            branch: GITHUB_CONFIG.branch
        };
        
        if (sha) {
            payload.sha = sha;
        }
        
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
        
        console.log('✅ File updated on GitHub successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error updating GitHub file:', error);
        throw error;
    }
}

// UI FUNCTIONS
function updateSyncStatus(status, message) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatus');
    
    if (indicator) {
        indicator.className = `sync-indicator ${status}`;
    }
    if (statusText) {
        statusText.textContent = message;
    }
}

function updateSyncIndicator() {
    const lastSync = localStorage.getItem(STORAGE_KEYS.lastSync);
    
    if (!isGitHubConfigured()) {
        updateSyncStatus('error', 'Not configured');
        return;
    }
    
    if (!navigator.onLine) {
        updateSyncStatus('error', 'Offline');
        return;
    }
    
    if (lastSync) {
        const syncTime = new Date(lastSync);
        const now = new Date();
        const diffMinutes = Math.floor((now - syncTime) / (1000 * 60));
        
        if (diffMinutes < 5) {
            updateSyncStatus('', 'Connected');
        } else {
            updateSyncStatus('syncing', `${diffMinutes}m ago`);
        }
    } else {
        updateSyncStatus('syncing', 'Never synced');
    }
}

// SETUP FUNCTIONS
function showGitHubSetup() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h2 style="margin-bottom: 20px; color: #2c3e50;">🔧 Setup GitHub Sync</h2>
                <p style="margin-bottom: 20px; color: #666;">Untuk mengaktifkan sinkronisasi otomatis, masukkan informasi GitHub Anda:</p>
                
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
                    <button onclick="closeGitHubSetup(false)" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer;">Batal</button>
                    <button onclick="saveGitHubSetup()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Simpan</button>
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
    closeGitHubSetup(true);
    
    // Immediately sync
    setTimeout(async () => {
        await saveToCloud();
        showAlert('GitHub sync berhasil dikonfigurasi!', 'success');
    }, 500);
}

function closeGitHubSetup(success) {
    const modal = document.getElementById('githubSetupModal');
    if (modal) {
        modal.remove();
    }
    
    if (success) {
        updateSyncIndicator();
    }
}

// EVENT LISTENERS
window.addEventListener('online', async () => {
    console.log('🌐 Connection restored');
    updateSyncIndicator();
    
    if (isGitHubConfigured()) {
        await loadFromCloud();
        await saveToCloud();
    }
});

window.addEventListener('offline', () => {
    console.log('📴 Connection lost');
    updateSyncStatus('error', 'Offline');
});

// Add setup button to sync status
document.addEventListener('DOMContentLoaded', () => {
    const syncStatus = document.querySelector('.sync-status');
    if (syncStatus && !isGitHubConfigured()) {
        syncStatus.style.cursor = 'pointer';
        syncStatus.title = 'Klik untuk setup GitHub sync';
        syncStatus.addEventListener('click', showGitHubSetup);
    }
});

// EXPORT/IMPORT FUNCTIONS
function exportAllData() {
    const allData = {
        pabrik: loadPabrikData(),
        ongkos: loadOngkosData(),
        karyawan: loadKaryawanData(),
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `tekstil_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showAlert('Data berhasil diekspor!', 'success');
}

function importAllData(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.pabrik) {
                savePabrikData(data.pabrik);
            }
            if (data.ongkos) {
                saveOngkosData(data.ongkos);
            }
            if (data.karyawan) {
                saveKaryawanData(data.karyawan);
            }
            
            showAlert('Data berhasil diimpor! Refresh halaman untuk melihat perubahan.', 'success');
            
            // Refresh UI
            setTimeout(() => {
                location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Import error:', error);
            showAlert('File tidak valid!', 'error');
        }
    };
    reader.readAsText(file);
}

console.log('✅ GitHub sync system loaded');