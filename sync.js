// sync.js - Excel-Like File Management with Smart Cloud Check
console.log('🔄 Loading Excel-like sync system with smart cloud check...');

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

// INITIALIZATION WITH SMART CLOUD CHECK
async function initializeSystem() {
    console.log('🚀 Initializing Excel-like System with Smart Cloud Check...');
    
    loadGitHubConfig();
    loadFileStatus();
    
    const hasLocalData = hasExistingLocalData();
    
    if (hasLocalData && isGitHubConfigured() && navigator.onLine) {
        // ADA LOCAL DATA + ONLINE → CHECK CLOUD UPDATE
        console.log('🌐 Checking cloud for updates...');
        await smartCloudCheck();
    } else if (hasLocalData) {
        // ADA LOCAL DATA + OFFLINE → Load local saja
        console.log('📂 Loading local data (offline)');
        autoLoadLocalData();
    } else {
        console.log('📭 No local data found');
    }
    
    updateFileStatusUI();
    console.log('✅ Smart system ready');
}

// SMART CLOUD CHECK
// REPLACE ENTIRE smartCloudCheck() function
async function smartCloudCheck() {
    try {
        updateSyncStatus('syncing', 'Checking updates...');
        
        const cloudData = await getGitHubFile('data.json');
        
        if (!cloudData) {
            // No cloud file → pakai local
            console.log('☁️ No cloud file found, using local');
            autoLoadLocalData();
            updateSyncStatus('', 'Local data (no cloud)');
            return;
        }
        
        // Store cloud data for content comparison
        window.tempCloudDataForComparison = cloudData;
        
        // Compare timestamps
        const cloudTime = new Date(cloudData.lastUpdated || '1970-01-01');
        const localSyncTime = localStorage.getItem('tekstil_last_sync_timestamp');
        const localTime = new Date(localSyncTime || '1970-01-01');
        
        console.log('🕐 Timestamp comparison:', {
            cloud: cloudData.lastUpdated,
            local: localSyncTime,
            cloudNewer: cloudTime > localTime
        });
        
        if (cloudTime > localTime) {
            // CLOUD LEBIH BARU → Check data breakdown
            const localBreakdown = {
                pabrik: loadPabrikData().length,
                ongkos: loadOngkosData().length,
                karyawan: loadKaryawanData().length
            };
            
            const cloudBreakdown = {
                pabrik: (cloudData.pabrik?.length || 0),
                ongkos: (cloudData.ongkos?.length || 0),
                karyawan: (cloudData.karyawan?.length || 0)
            };
            
            const cloudTotal = cloudBreakdown.pabrik + cloudBreakdown.ongkos + cloudBreakdown.karyawan;
            const localTotal = localBreakdown.pabrik + localBreakdown.ongkos + localBreakdown.karyawan;
            const hasLocalChanges = checkDataStatus() === 'dirty';
            
            console.log('🔄 Cloud is newer:', { 
                cloudBreakdown, 
                localBreakdown, 
                hasLocalChanges 
            });
            
            // DEEP CONTENT COMPARISON (not just count!)
            const isDataIdentical = isContentIdentical();
            
            if (isDataIdentical && !hasLocalChanges) {
                // Same content, just update timestamp
                console.log('📊 Content identical, updating timestamp only');
                localStorage.setItem('tekstil_last_sync_timestamp', cloudData.lastUpdated);
                autoLoadLocalData();
                return;
            }
            
            if (hasLocalChanges) {
                // ADA LOCAL CHANGES + CLOUD UPDATE → CONFLICT!
                console.log('⚠️ Conflict detected!');
                showUpdateConflictDialog(cloudData, cloudTotal, localTotal);
            } else {
                // NO LOCAL CHANGES → Auto-update dari cloud
                console.log('📥 Auto-updating from cloud');
                loadCloudData(cloudData);
                showAlert(`📥 Data terupdate otomatis (${cloudTotal} records dari cloud)`, 'info');
            }
        } else {
            // LOCAL SAMA/LEBIH BARU → Pakai local
            console.log('💻 Local data is current');
            autoLoadLocalData();
        }
        
        // Clean up temp data
        window.tempCloudDataForComparison = null;
        
    } catch (error) {
        console.log('⚠️ Cloud check failed:', error.message);
        autoLoadLocalData();
        updateSyncStatus('error', 'Cloud check failed');
        window.tempCloudDataForComparison = null;
    }
}

function showUpdateConflictDialog(cloudData, cloudTotal, localTotal) {
    // CALCULATE BREAKDOWN
    const cloudBreakdown = {
        pabrik: (cloudData.pabrik?.length || 0),
        ongkos: (cloudData.ongkos?.length || 0),
        karyawan: (cloudData.karyawan?.length || 0)
    };
    
    const localBreakdown = {
        pabrik: loadPabrikData().length,
        ongkos: loadOngkosData().length,
        karyawan: loadKaryawanData().length
    };
    
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <h2 style="margin-bottom: 20px; color: #e74c3c; text-align: center;">⚠️ CONFLICT DETECTED!</h2>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
                    <strong>Ada perubahan dari device lain!</strong><br><br>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div>
                            <strong>☁️ CLOUD (lebih baru):</strong><br>
                            📍 Pabrik: ${cloudBreakdown.pabrik}<br>
                            💰 Ongkos: ${cloudBreakdown.ongkos}<br>
                            👥 Karyawan: ${cloudBreakdown.karyawan}<br>
                            <strong>Total: ${cloudTotal} records</strong>
                        </div>
                        <div>
                            <strong>💻 LOCAL (ada changes):</strong><br>
                            📍 Pabrik: ${localBreakdown.pabrik}<br>
                            💰 Ongkos: ${localBreakdown.ongkos}<br>
                            👥 Karyawan: ${localBreakdown.karyawan}<br>
                            <strong>Total: ${localTotal} records</strong>
                        </div>
                    </div>
                </div>
                
                <p style="margin-bottom: 20px; color: #666; text-align: center;"><strong>Pilih tindakan:</strong></p>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="resolveConflict('cloud')" style="padding: 12px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        📥 Pakai Data Cloud (${cloudTotal} records)
                    </button>
                    <button onclick="resolveConflict('local')" style="padding: 12px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        💻 Pakai Data Local (${localTotal} records)
                    </button>
                    <button onclick="resolveConflict('manual')" style="padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        🤔 Biarkan Manual (decide nanti)
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.id = 'conflictModal';
    document.body.appendChild(modal);
    
    // Store cloud data for conflict resolution
    window.pendingCloudData = cloudData;
}

function resolveConflict(choice) {
    const modal = document.getElementById('conflictModal');
    const cloudData = window.pendingCloudData;
    
    if (choice === 'cloud') {
        // Pakai cloud data
        loadCloudData(cloudData);
        showAlert('📥 Data cloud berhasil dimuat', 'success');
    } else if (choice === 'local') {
        // Pakai local data, set dirty untuk overwrite cloud nanti
        autoLoadLocalData();
        setDataStatus('dirty');
        showAlert('💻 Menggunakan data local - jangan lupa save untuk overwrite cloud!', 'warning');
    } else {
        // Manual - biarkan user decide nanti
        autoLoadLocalData();
        showAlert('🤔 Menggunakan data local - klik Open untuk download cloud', 'info');
    }
    
    if (modal) modal.remove();
    window.pendingCloudData = null;
}

function autoLoadLocalData() {
    fileStatus.isOpen = true;
    fileStatus.hasUnsavedChanges = checkDataStatus() === 'dirty';
    refreshAllUI();
    
    if (fileStatus.hasUnsavedChanges) {
        showAlert('⚠️ Ada data belum disimpan dari session sebelumnya!', 'warning');
    }
}

function loadCloudData(cloudData) {
    localStorage.setItem(STORAGE_KEYS.pabrik, JSON.stringify(cloudData.pabrik || []));
    localStorage.setItem(STORAGE_KEYS.ongkos, JSON.stringify(cloudData.ongkos || []));
    localStorage.setItem(STORAGE_KEYS.karyawan, JSON.stringify(cloudData.karyawan || []));
    localStorage.setItem('tekstil_last_sync_timestamp', cloudData.lastUpdated);
    
    fileStatus.isOpen = true;
    fileStatus.hasUnsavedChanges = false;
    setDataStatus('clean');
    refreshAllUI();
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


// ADD THIS HELPER FUNCTION (tambah setelah function getTotalLocalRecords)
function isContentIdentical() {
    try {
        const localPabrik = loadPabrikData();
        const localOngkos = loadOngkosData();
        const localKaryawan = loadKaryawanData();
        
        const cloudData = window.tempCloudDataForComparison;
        if (!cloudData) return false;
        
        const cloudPabrik = cloudData.pabrik || [];
        const cloudOngkos = cloudData.ongkos || [];
        const cloudKaryawan = cloudData.karyawan || [];
        
        // DEEP COMPARISON: Compare actual content, not just count
        const pabrikIdentical = JSON.stringify(localPabrik.sort((a,b) => a.id - b.id)) === 
                                JSON.stringify(cloudPabrik.sort((a,b) => a.id - b.id));
        
        const ongkosIdentical = JSON.stringify(localOngkos.sort((a,b) => a.id - b.id)) === 
                               JSON.stringify(cloudOngkos.sort((a,b) => a.id - b.id));
        
        const karyawanIdentical = JSON.stringify(localKaryawan.sort((a,b) => a.id - b.id)) === 
                                 JSON.stringify(cloudKaryawan.sort((a,b) => a.id - b.id));
        
        console.log('🔍 Deep content comparison:', {
            pabrikIdentical,
            ongkosIdentical, 
            karyawanIdentical,
            localPabrikIds: localPabrik.map(p => p.id).sort(),
            cloudPabrikIds: cloudPabrik.map(p => p.id).sort()
        });
        
        return pabrikIdentical && ongkosIdentical && karyawanIdentical;
        
    } catch (error) {
        console.error('❌ Content comparison failed:', error);
        return false;
    }
}

// ENHANCED EXCEL-LIKE FILE OPERATIONS
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
            `⚠️ PERINGATAN DATA BELUM DISIMPAN!\n\n` +
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
    // REPLACE bagian advanced comparison di openFile()
    } else if (hasLocalData && localStatus === 'clean') {
        // SMART CHECK: Deep content comparison dengan cloud
        updateSyncStatus('syncing', 'Comparing with cloud...');
        
        try {
            const cloudData = await getGitHubFile('data.json');
            
            if (cloudData) {
                // Store for content comparison
                window.tempCloudDataForComparison = cloudData;
                
                const localBreakdown = {
                    pabrik: loadPabrikData().length,
                    ongkos: loadOngkosData().length,
                    karyawan: loadKaryawanData().length
                };
                
                const cloudBreakdown = {
                    pabrik: (cloudData.pabrik?.length || 0),
                    ongkos: (cloudData.ongkos?.length || 0),
                    karyawan: (cloudData.karyawan?.length || 0)
                };
                
                // DEEP CONTENT COMPARISON
                const isDataIdentical = isContentIdentical();
                
                if (isDataIdentical) {
                    // IDENTICAL CONTENT - just use local
                    fileStatus.isOpen = true;
                    fileStatus.hasUnsavedChanges = false;
                    updateFileStatusUI();
                    refreshAllUI();
                    updateSyncStatus('', 'Data current');
                    showAlert('📂 Data local sudah sama dengan cloud', 'info');
                    window.tempCloudDataForComparison = null;
                    return;
                }
                
                // DIFFERENT CONTENT - show detailed comparison
                const localTotal = localBreakdown.pabrik + localBreakdown.ongkos + localBreakdown.karyawan;
                const cloudTotal = cloudBreakdown.pabrik + cloudBreakdown.ongkos + cloudBreakdown.karyawan;
                
                // Get sample data names for better info
                const localPabrikNames = loadPabrikData().slice(0,3).map(p => p.nama).join(', ');
                const cloudPabrikNames = (cloudData.pabrik || []).slice(0,3).map(p => p.nama).join(', ');
                
                const userChoice = confirm(
                    `📊 DATA BERBEDA TERDETEKSI!\n\n` +
                    `LOCAL:\n` +
                    `📍 Pabrik: ${localBreakdown.pabrik} (${localPabrikNames}${localBreakdown.pabrik > 3 ? '...' : ''})\n` +
                    `💰 Ongkos: ${localBreakdown.ongkos}\n` +
                    `👥 Karyawan: ${localBreakdown.karyawan}\n` +
                    `Total: ${localTotal} records\n\n` +
                    `CLOUD:\n` +
                    `📍 Pabrik: ${cloudBreakdown.pabrik} (${cloudPabrikNames}${cloudBreakdown.pabrik > 3 ? '...' : ''})\n` +
                    `💰 Ongkos: ${cloudBreakdown.ongkos}\n` +
                    `👥 Karyawan: ${cloudBreakdown.karyawan}\n` +
                    `Total: ${cloudTotal} records\n\n` +
                    `• OK = Download data cloud\n` +
                    `• Cancel = Tetap pakai data local\n\n` +
                    `Download data terbaru?`
                );
                
                if (!userChoice) {
                    fileStatus.isOpen = true;
                    fileStatus.hasUnsavedChanges = false;
                    updateFileStatusUI();
                    refreshAllUI();
                    updateSyncStatus('', 'Using local');
                    showAlert('📂 Menggunakan data local yang tersimpan', 'info');
                    window.tempCloudDataForComparison = null;
                    return;
                }
                
                // Clean up
                window.tempCloudDataForComparison = null;
            }
        } catch (error) {
            console.log('Cloud check failed, proceeding with download...');
            window.tempCloudDataForComparison = null;
        }
    }
    
    // DOWNLOAD FROM CLOUD
    updateSyncStatus('syncing', 'Opening...');
    
    try {
        console.log('📂 Opening file from GitHub...');
        const cloudData = await getGitHubFile('data.json');
        
        if (cloudData) {
            loadCloudData(cloudData);
            updateSyncStatus('', 'File opened');
            
            const cloudTotal = (cloudData.pabrik?.length || 0) + 
                             (cloudData.ongkos?.length || 0) + 
                             (cloudData.karyawan?.length || 0);
            
            showAlert(`📂 File berhasil dibuka! ${cloudTotal} records dari cloud.`, 'success');
            
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
    
    // DISABLE SAVE BUTTON
    const saveButton = document.querySelector('button[onclick="saveFile()"]');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '💾 Saving...';
        saveButton.style.opacity = '0.6';
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
        
        // LARGE FILE WARNING
        const estimatedSize = JSON.stringify(allData).length;
        const sizeKB = Math.round(estimatedSize / 1024);
        const totalRecords = allData.pabrik.length + allData.ongkos.length + allData.karyawan.length;
        
        if (estimatedSize > 1000000) { // >1MB
            showAlert(`📦 File besar (${sizeKB}KB) terdeteksi! Jangan tutup browser sampai selesai save.`, 'warning');
        }
        
        console.log('💾 Saving file to GitHub...', {
            pabrik: allData.pabrik.length,
            ongkos: allData.ongkos.length,
            karyawan: allData.karyawan.length,
            totalRecords: totalRecords,
            size: `${sizeKB}KB`
        });
        
        const success = await updateGitHubFile('data.json', allData);
        
        if (success) {
            fileStatus.hasUnsavedChanges = false;
            fileStatus.lastSaved = new Date().toISOString();
            localStorage.setItem('tekstil_last_sync_timestamp', allData.lastUpdated);
            setDataStatus('clean');
            
            updateSyncStatus('', 'Saved');
            showAlert(`💾 SAVE BERHASIL! ${totalRecords} records (${sizeKB}KB) tersimpan di cloud. Aman tutup browser.`, 'success');
            console.log('✅ File saved successfully');
        }
        
    } catch (error) {
        console.error('❌ Failed to save file:', error);
        updateSyncStatus('error', 'Save failed');
        
        if (error.name === 'AbortError') {
            showAlert('❌ Save timeout! Koneksi lambat. Data aman di local, coba lagi.', 'error');
        } else {
            showAlert('❌ Gagal menyimpan file! Data masih aman di local. Coba lagi.', 'error');
        }
    } finally {
        // RE-ENABLE SAVE BUTTON
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = '💾 Save';
            saveButton.style.opacity = '1';
        }
    }
}

// GITHUB API FUNCTIONS
async function getGitHubFile(filename) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    
    // TIMEOUT PROTECTION
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Error getting GitHub file:', error);
        throw error;
    }
}

async function updateGitHubFile(filename, data) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filename}`;
    
    // Get current file SHA
    let sha = null;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for SHA
        
        const currentFile = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (currentFile.ok) {
            const fileData = await currentFile.json();
            sha = fileData.sha;
        }
    } catch (e) {
        console.log('📝 Creating new file or SHA fetch failed');
    }
    
    const payload = {
        message: `Save data - ${new Date().toISOString()}`,
        content: btoa(JSON.stringify(data, null, 2)),
        branch: GITHUB_CONFIG.branch
    };
    
    if (sha) payload.sha = sha;
    
    // MAIN UPLOAD WITH TIMEOUT
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for upload
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
        }
        
        return true;
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Error updating GitHub file:', error);
        throw error;
    }
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

// SETUP DIALOG
function showGitHubSetup() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h2 style="margin-bottom: 20px; color: #2c3e50;">🔧 Setup File Sync</h2>
                
                <div style="background: #e3f2fd; border: 1px solid #bbdefb; color: #1565c0; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
                    <strong>🎯 SMART SYNC FEATURES:</strong><br>
                    • Auto-detect cloud updates saat startup<br>
                    • Conflict resolution dialog<br>  
                    • Data aman dari browser crash<br>
                    • Multi-device coordination
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
    showAlert('✅ Setup berhasil! System akan check cloud updates otomatis.', 'success');
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

console.log('✅ Smart Excel-like sync system with cloud check loaded');




