let isPaused = false;
let isStopped = false;
let startTime;
const matchedFiles = [];
let objectURLs = [];

const statusText = document.getElementById('status');
const gallery = document.getElementById('results-gallery');
const folderInput = document.getElementById('folder-upload');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const thresholdLabel = document.getElementById('threshold-val');

sensitivitySlider.oninput = () => thresholdLabel.innerText = parseFloat(sensitivitySlider.value).toFixed(2);

async function init() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('./models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('./models');
        statusText.innerText = "✅ AI Ready. Upload Selfie.";
        document.getElementById('stat-health').innerText = "STABLE";
    } catch (e) {
        statusText.innerText = "❌ Models Missing!";
    }
}

document.getElementById('selfie-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (detection) {
        window.userDescriptor = detection.descriptor;
        statusText.innerText = "✅ Face Profile Created. Select Folder.";
        folderInput.disabled = false;
    }
});

folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    resetScan();
    startTime = performance.now();
    isStopped = false;
    
    const matcher = new faceapi.FaceMatcher(window.userDescriptor, parseFloat(sensitivitySlider.value));
    document.getElementById('progress-section').style.display = 'block';
    document.getElementById('total-count').innerText = files.length;
    statusText.innerText = "🚀 Scan in Progress...";

    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
        // --- STOP LOGIC ---
        if (isStopped) break;

        // --- PAUSE LOGIC ---
        if (isPaused) {
            await new Promise(res => {
                const check = setInterval(() => {
                    if (!isPaused || isStopped) { clearInterval(check); res(); }
                }, 100);
            });
        }
        
        // Re-check stop after pause
        if (isStopped) break;

        try {
            const img = await faceapi.bufferToImage(files[i]);
            const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
            const match = detections.some(d => matcher.findBestMatch(d.descriptor).label !== 'unknown');

            if (match) {
                matchedFiles.push(files[i]);
                if (!document.getElementById('privacy-mode').checked) renderCard(files[i]);
                updateUI();
            }
        } catch (err) { console.error("Skip file"); }

        processedCount = i + 1;
        updateDashboard(processedCount, files.length);
    }
    
    showFinalReport(processedCount);
});

function renderCard(file) {
    const url = URL.createObjectURL(file);
    objectURLs.push(url);
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `<img src="${url}"><button class="remove-btn">×</button>`;
    card.querySelector('.remove-btn').onclick = () => {
        matchedFiles.splice(matchedFiles.indexOf(file), 1);
        card.remove();
        updateUI();
    };
    gallery.appendChild(card);
}

function updateDashboard(current, total) {
    const elapsed = (performance.now() - startTime) / 1000;
    document.getElementById('stat-speed').innerText = `${(current / elapsed).toFixed(1)} img/s`;
    document.getElementById('scan-progress').value = (current / total) * 100;
    document.getElementById('progress-count').innerText = current;
    if (performance.memory) document.getElementById('stat-memory').innerText = `${Math.round(performance.memory.usedJSHeapSize/1048576)} MB`;
}

function showFinalReport(totalScanned) {
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    document.getElementById('sum-time').innerText = `${duration}s`;
    document.getElementById('sum-total').innerText = totalScanned;
    document.getElementById('sum-matches').innerText = matchedFiles.length;
    document.getElementById('sum-avg').innerText = ( (performance.now() - startTime) / totalScanned ).toFixed(0);
    
    document.getElementById('summary-card').style.display = 'block';
    document.getElementById('progress-section').style.display = 'none';

    // Update Status and Title based on how it ended
    if (isStopped) {
        statusText.innerText = "🛑 Scan Terminated";
        document.getElementById('summary-title').innerText = "🛑 Scan Terminated (Partial Report)";
    } else {
        statusText.innerText = "✨ Scan Complete!";
        document.getElementById('summary-title').innerText = "📊 Scan Summary Report";
    }
}

function updateUI() {
    document.getElementById('match-count').innerText = `${matchedFiles.length} Matches Found`;
    document.getElementById('actions-bar').style.display = matchedFiles.length > 0 ? 'flex' : 'none';
}

function resetScan() {
    matchedFiles.length = 0;
    objectURLs.forEach(url => URL.revokeObjectURL(url));
    objectURLs = [];
    gallery.innerHTML = '';
    document.getElementById('summary-card').style.display = 'none';
    updateUI();
}

document.getElementById('pause-btn').onclick = (e) => {
    isPaused = !isPaused;
    e.target.innerText = isPaused ? "Resume" : "Pause";
    statusText.innerText = isPaused ? "⏸ Paused" : "🚀 Resuming...";
};

document.getElementById('stop-btn').onclick = () => {
    isStopped = true;
};

document.getElementById('clear-btn').onclick = resetScan;

document.getElementById('download-zip').onclick = async () => {
    const zip = new JSZip();
    matchedFiles.forEach((f, i) => zip.file(`Match_${i+1}.jpg`, f));
    const content = await zip.generateAsync({type: "blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "MyMatches.zip";
    link.click();
};

init();