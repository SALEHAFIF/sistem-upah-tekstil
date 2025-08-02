// sync.js - Simplified Automatic GitHub Sync
console.log('🔄 Loading simplified automatic sync system...');

// KONFIGURASI
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

// SAFETY CONFIG
const SAFETY_CONFIG = {
    maxRetries: 5,
    retryDelay: 2000,
    backupBeforeSync: true,
    autoSyncInterval: 30000 // 30 detik
};

// INITIALIZATION
async function initializeSystem() {
    console.log('🚀 Initializing Simplified Textile Wage System...');
    
    // Load GitHub config
    loadGitHubConfig();
    
    // Initialize IndexedDB
    await initializeIndexedDB();
    
    // Check sync status
    updateSyncIndicator();
    
    // Auto sync if online and configured
    if (navigator.onLine && isGitHubConfigured()) {
        console.log('📡 Auto-loading data...');
        await loadFromCloud();
        
        // Start permanent auto-sync
        startPermanentAutoSync();
    }
    
    console.log('✅ Simplified system initialized successfully');
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

// LOCAL STORAGE FUNCTIONS WITH TIMESTAMP TRACKING
function loadPabrikData() {
    const data = localStorage.getItem(STORAGE_KEYS.pabrik);
    return data ? JSON.parse(data) : [];
}

function savePabrikData(data) {
    localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(data));
    localStorage.setItem('tekstil_last_modified', new Date().toISOString());
    console.log(`💾 Saved ${data.length} pabrik records locally`);
    queueSync('pabrik', data);
}

function loadOngkosData() {
    const data = localStorage.getItem(STORAGE_KEYS.ongkos);
    return data ? JSON.parse(data) : [];
}

function saveOngkosData(data) {
    localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(data));
    localStorage.setItem('tekstil_last_modified', new Date().toISOString());
    console.log(`💾 Saved ${data.length} ongkos records locally`);
    queueSync('ongkos', data);
}

function loadKaryawanData() {
    const data = localStorage.getItem(STORAGE_KEYS.karyawan);
    return data ? JSON.parse(data) : [];
}

function saveKaryawanData(data) {
    localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(data));
    localStorage.setItem('tekstil_last_modified', new Date().toISOString());
    console.log(`💾 Saved ${data.length} karyawan records locally`);
    queueSync('karyawan', data);
}

// INDEXEDDB FUNCTIONS
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

// PERMANENT AUTO-SYNC (always ON)
function startPermanentAutoSync() {
    // Auto-sync every 30 seconds - ALWAYS ON
    setInterval(async () => {
        if (navigator.onLine && isGitHubConfigured()) {
            console.log('🤖 Auto-sync running...');
            
            // Smart auto-load first
            await autoLoadLatestData();
            
            // Then sync any local changes
            const hasLocalChanges = checkForUnsyncedChanges();
            if (hasLocalChanges) {
                await saveToCloud();
            }
        }
    }, SAFETY_CONFIG.autoSyncInterval);
    
    console.log('🤖 Permanent auto-sync started (always ON)');
}

function checkForUnsyncedChanges() {
    const lastSync = localStorage.getItem('tekstil_last_sync_timestamp');
    const lastModified = localStorage.getItem('tekstil_last_modified');
    
    return !lastSync || !lastModified || new Date(lastModified) > new Date(lastSync);
}

// ENHANCED GITHUB API FUNCTIONS
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
            deviceId: getDeviceId(),
            version: '1.0'
        };
        
        console.log('📤 Uploading data to GitHub...', {
            pabrik: allData.pabrik.length,
            ongkos: allData.ongkos.length,
            karyawan: allData.karyawan.length
        });
        
        // Upload to GitHub with enhanced conflict handling
        const success = await updateGitHubFile('data.json', allData);
        
        if (success) {
            localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
            localStorage.setItem('tekstil_last_sync_timestamp', allData.lastUpdated);
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
            // Smart merge instead of overwrite
            await smartMergeCloudData(cloudData);
            
            localStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
            localStorage.setItem('tekstil_last_sync_timestamp', cloudData.lastUpdated || new Date().toISOString());
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

// ENHANCED updateGitHubFile with conflict resolution
async function updateGitHubFile(filename, data, retryCount = 0) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    
    try {
        // BACKUP before sync
        if (SAFETY_CONFIG.backupBeforeSync && retryCount === 0) {
            createLocalBackup(data);
        }
        
        // Get latest cloud data for merge
        let sha = null;
        let latestCloudData = null;
        
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
                latestCloudData = JSON.parse(atob(fileData.content));
                
                // SMART MERGE with cloud data if needed
                if (retryCount === 0 && latestCloudData) {
                    const mergedData = smartMergeWithValidation(latestCloudData, data);
                    
                    if (JSON.stringify(mergedData) !== JSON.stringify(data)) {
                        console.log('🔄 Smart merging with latest cloud data...');
                        showAlert('🔄 Menggabungkan dengan data terbaru...', 'info');
                        return await updateGitHubFile(filename, mergedData, 1);
                    }
                }
            }
        } catch (e) {
            console.log('📝 Creating new file');
        }
        
        // Validate data before upload
        const validatedData = validateDataIntegrity(data);
        const payload = {
            message: `Update data - ${new Date().toISOString()} - Device: ${getDeviceId()}`,
            content: btoa(JSON.stringify(validatedData, null, 2)),
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
            
            // RETRY for 409 conflict with exponential backoff
            if (response.status === 409 && retryCount < SAFETY_CONFIG.maxRetries) {
                const delay = SAFETY_CONFIG.retryDelay * Math.pow(2, retryCount);
                console.log(`⚠️ Conflict ${retryCount + 1}/${SAFETY_CONFIG.maxRetries}, retry in ${delay}ms...`);
                showAlert(`⚠️ Conflict detected, retrying... (${retryCount + 1}/${SAFETY_CONFIG.maxRetries})`, 'warning');
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return await updateGitHubFile(filename, data, retryCount + 1);
            }
            
            // FALLBACK: Save to backup if max retries reached
            if (retryCount >= SAFETY_CONFIG.maxRetries) {
                console.error('❌ Max retries reached, saving to backup');
                saveToFailureBackup(data);
                showAlert('❌ Sync gagal, data disimpan ke backup lokal', 'error');
                return false;
            }
            
            throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
        }
        
        console.log('✅ File updated successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error updating GitHub file:', error);
        
        if (retryCount < SAFETY_CONFIG.maxRetries) {
            return await updateGitHubFile(filename, data, retryCount + 1);
        } else {
            saveToFailureBackup(data);
            showAlert('❌ Sync gagal, data disimpan ke backup', 'error');
            throw error;
        }
    }
}

// SMART MERGE FUNCTIONS
function smartMergeWithValidation(cloudData, localData) {
    console.log('🔄 Smart merging with validation...', {
        cloud: {
            pabrik: (cloudData.pabrik || []).length,
            ongkos: (cloudData.ongkos || []).length,
            karyawan: (cloudData.karyawan || []).length,
            lastUpdated: cloudData.lastUpdated
        },
        local: {
            pabrik: (localData.pabrik || []).length,
            ongkos: (localData.ongkos || []).length,
            karyawan: (localData.karyawan || []).length,
            lastUpdated: localData.lastUpdated
        }
    });
    
    // Merge dengan ID + timestamp strategy
    const mergedPabrik = mergeByIdAndTimestamp(cloudData.pabrik || [], localData.pabrik || []);
    const mergedOngkos = mergeByIdAndTimestamp(cloudData.ongkos || [], localData.ongkos || []);
    const mergedKaryawan = mergeByIdAndTimestamp(cloudData.karyawan || [], localData.karyawan || []);
    
    return {
        pabrik: mergedPabrik,
        ongkos: mergedOngkos,
        karyawan: mergedKaryawan,
        lastUpdated: new Date().toISOString(),
        mergedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        version: '1.0'
    };
}

// MERGE by ID + Timestamp (the magic!)
function mergeByIdAndTimestamp(cloudArray, localArray) {
    const allItems = [...cloudArray, ...localArray];
    const itemMap = new Map();
    
    // Group by ID
    allItems.forEach(item => {
        if (!item.id) {
            console.warn('⚠️ Item without ID found:', item);
            return;
        }
        
        const id = item.id;
        if (!itemMap.has(id)) {
            itemMap.set(id, []);
        }
        itemMap.get(id).push(item);
    });
    
    // Untuk setiap ID, ambil yang timestamp terbaru
    const result = [];
    itemMap.forEach((items, id) => {
        if (items.length === 1) {
            result.push(items[0]);
        } else {
            // Multiple items with same ID, ambil yang terbaru
            const latest = items.reduce((latest, current) => {
                const latestTime = new Date(latest.updated_at || latest.created_at || '1970-01-01');
                const currentTime = new Date(current.updated_at || current.created_at || '1970-01-01');
                return currentTime > latestTime ? current : latest;
            });
            
            console.log(`🔄 ID ${id}: Found ${items.length} versions, using latest from ${latest.updated_at || latest.created_at}`);
            result.push(latest);
        }
    });
    
    return result.sort((a, b) => a.id - b.id); // Sort by ID
}

async function smartMergeCloudData(cloudData) {
    // Ambil data lokal
    const localPabrik = loadPabrikData();
    const localOngkos = loadOngkosData();
    const localKaryawan = loadKaryawanData();
    
    console.log('🔄 Smart merging cloud data...', {
        localPabrik: localPabrik.length,
        localOngkos: localOngkos.length,
        localKaryawan: localKaryawan.length,
        cloudPabrik: (cloudData.pabrik || []).length,
        cloudOngkos: (cloudData.ongkos || []).length,
        cloudKaryawan: (cloudData.karyawan || []).length
    });
    
    // Merge dengan ID + timestamp
    const mergedPabrik = mergeByIdAndTimestamp(cloudData.pabrik || [], localPabrik);
    const mergedOngkos = mergeByIdAndTimestamp(cloudData.ongkos || [], localOngkos);
    const mergedKaryawan = mergeByIdAndTimestamp(cloudData.karyawan || [], localKaryawan);
    
    // Simpan hasil merge
    localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(mergedPabrik));
    localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(mergedOngkos));
    localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(mergedKaryawan));
    localStorage.setItem('tekstil_last_sync_timestamp', cloudData.lastUpdated);
    
    console.log('✅ Smart merge completed:', {
        finalPabrik: mergedPabrik.length,
        finalOngkos: mergedOngkos.length,
        finalKaryawan: mergedKaryawan.length
    });
    
    // Refresh UI
    setTimeout(() => {
        if (typeof renderPabrikList === 'function') renderPabrikList();
        if (typeof renderOngkosList === 'function') renderOngkosList();
        if (typeof renderKaryawanList === 'function') renderKaryawanList();
        if (typeof updateKaryawanStats === 'function') updateKaryawanStats();
        if (typeof updateOngkosStats === 'function') updateOngkosStats();
    }, 100);
}

// AUTO-LOAD FUNCTIONS
async function autoLoadLatestData() {
    try {
        const cloudData = await getGitHubFile('data.json');
        if (cloudData) {
            const localTimestamp = localStorage.getItem('tekstil_last_sync_timestamp') || '1970-01-01';
            const cloudTimestamp = cloudData.lastUpdated || '1970-01-01';
            
            // Jika cloud lebih baru, auto-download dan merge
            if (new Date(cloudTimestamp) > new Date(localTimestamp)) {
                console.log('📥 Cloud data is newer, auto-downloading...');
                
                await smartMergeCloudData(cloudData);
                
                return true;
            }
        }
    } catch (error) {
        console.log('Auto-load failed, continuing with local data');
    }
    return false;
}

// VALIDATION functions
function validateDataIntegrity(data) {
    const validated = {
        pabrik: validateArray(data.pabrik || [], 'pabrik'),
        ongkos: validateArray(data.ongkos || [], 'ongkos'),
        karyawan: validateArray(data.karyawan || [], 'karyawan'),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        deviceId: data.deviceId || getDeviceId(),
        version: data.version || '1.0'
    };
    
    return validated;
}

function validateArray(array, type) {
    return array.filter(item => {
        // Basic validation
        if (!item.id) {
            console.warn(`⚠️ ${type} without ID removed:`, item);
            return false;
        }
        
        // Type-specific validation
        if (type === 'pabrik' && !item.nama) {
            console.warn(`⚠️ Pabrik without nama removed:`, item);
            return false;
        }
        
        if (type === 'ongkos' && (!item.proses || !item.jenis)) {
            console.warn(`⚠️ Ongkos without proses/jenis removed:`, item);
            return false;
        }
        
        if (type === 'karyawan' && (!item.nama || !item.nomor)) {
            console.warn(`⚠️ Karyawan without nama/nomor removed:`, item);
            return false;
        }
        
        return true;
    });
}

// BACKUP functions
function createLocalBackup(data) {
    const backup = {
        data: data,
        timestamp: new Date().toISOString(),
        deviceId: getDeviceId()
    };
    
    const backups = JSON.parse(localStorage.getItem('tekstil_backups') || '[]');
    backups.push(backup);
    
    // Keep only last 5 backups
    if (backups.length > 5) {
        backups.splice(0, backups.length - 5);
    }
    
    localStorage.setItem('tekstil_backups', JSON.stringify(backups));
    console.log('💾 Local backup created');
}

function saveToFailureBackup(data) {
    const failureBackup = {
        data: data,
        timestamp: new Date().toISOString(),
        deviceId: getDeviceId(),
        type: 'sync_failure'
    };
    
    localStorage.setItem('tekstil_failure_backup', JSON.stringify(failureBackup));
    console.log('🆘 Failure backup created');
}

function getDeviceId() {
    let deviceId = localStorage.getItem('tekstil_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tekstil_device_id', deviceId);
    }
    return deviceId;
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
            updateSyncStatus('', 'Auto-Sync ON');
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
                <h2 style="margin-bottom: 20px; color: #2c3e50;">🔧 Setup Automatic Sync</h2>
                
                <div style="background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
                    <strong>✨ AUTOMATIC SYNC:</strong><br>
                    • Data sync otomatis setiap 30 detik<br>
                    • Tidak perlu klik tombol manual<br>
                    • Smart conflict resolution<br>
                    • Backup otomatis untuk keamanan data
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
                    <button onclick="closeGitHubSetup(false)" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer;">Batal</button>
                    <button onclick="saveGitHubSetup()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Setup Automatic Sync</button>
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
    
    showAlert('✅ Automatic sync dikonfigurasi! Refresh halaman untuk mulai.', 'success');
    
    // Refresh halaman biar system reload dengan config baru
    setTimeout(() => {
        location.reload();
    }, 1500);
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
        // AUTO-LOAD data terbaru sebelum sync
        console.log('📥 Auto-loading latest data...');
        await autoLoadLatestData();
        
        // Baru sync data lokal
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
   
   // Auto-sync is now always ON - no user control needed
   console.log('✅ Simplified sync system ready');
});

// EXPORT/IMPORT FUNCTIONS
function exportAllData() {
   const allData = {
       pabrik: loadPabrikData(),
       ongkos: loadOngkosData(),
       karyawan: loadKaryawanData(),
       exportedAt: new Date().toISOString(),
       deviceId: getDeviceId(),
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

console.log('✅ Simplified automatic sync system loaded');
