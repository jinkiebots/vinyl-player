const state = {
    isPoweredOn: true,
    isLoaded: false,
    isPlaying: false,
    currentVideo: null,
    tonearmAngle: -30,
    needleOnRecord: false,
    videoElement: null,
    sourceType: null,
    ytPlayer: null,
    ytReady: false
};

const inputDeck = document.getElementById('inputDeck');
const vinylRecord = document.getElementById('vinylRecord');
const tonearm = document.getElementById('tonearm');
const tonearmAssembly = document.getElementById('tonearmAssembly');
const videoPlayer = document.getElementById('videoPlayer');
const youtubeInput = document.getElementById('youtubeInput');
const fileInput = document.getElementById('fileInput');
const loadButton = document.getElementById('loadButton');
const rpmControl = document.getElementById('rpmControl');
const rpmSlider = document.getElementById('rpmSlider');
const rpmDisplay = document.getElementById('rpmDisplay');

state.videoElement = videoPlayer;

function extractYouTubeId(url) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'youtu.be') {
            return parsed.pathname.slice(1);
        }
        if (parsed.hostname.includes('youtube.com')) {
            if (parsed.pathname === '/watch') {
                return parsed.searchParams.get('v');
            }
            const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
            if (embedMatch) return embedMatch[1];
            const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
            if (shortsMatch) return shortsMatch[1];
        }
    } catch {
        return null;
    }
    return null;
}

if (window.YT && window.YT.Player) {
    state.ytReady = true;
}
window.onYouTubeIframeAPIReady = function () {
    state.ytReady = true;
};

function createYouTubePlayer(videoId, onReady) {
    if (state.ytPlayer) {
        state.ytPlayer.destroy();
        state.ytPlayer = null;
    }

    const videoContainer = document.getElementById('videoContainer');
    let container = document.getElementById('youtubePlayer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'youtubePlayer';
        const dustOverlay = videoContainer.querySelector('.dust-overlay');
        videoContainer.insertBefore(container, dustOverlay);
    }

    state.ytPlayer = new YT.Player('youtubePlayer', {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 0,
            disablekb: 1,
            iv_load_policy: 3,
            playsinline: 1,
            origin: window.location.origin
        },
        events: {
            onReady: function (e) {
                if (onReady) onReady(e);
            },
            onError: function (e) {
                console.error('YouTube error code:', e.data);
                alert('Error loading YouTube video. Make sure you are running from a local server (npm start), not file://.');
            }
        }
    });
}

// File Input Handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        state.currentVideo = url;
        state.sourceType = 'local';
        youtubeInput.value = '';
        const melodyNote = document.querySelector('.melody-note');
        if (melodyNote) melodyNote.style.display = 'none';
    }
});

// YouTube URL Handler
youtubeInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (!url) return;
    const melodyNote = document.querySelector('.melody-note');
    if (melodyNote) melodyNote.style.display = 'none';
    const ytId = extractYouTubeId(url);
    if (ytId) {
        state.currentVideo = ytId;
        state.sourceType = 'youtube';
    } else {
        state.currentVideo = url;
        state.sourceType = 'local';
    }
});

function finishLoad(keepCredit) {
    state.isLoaded = true;
    rpmControl.classList.add('active');
    rpmSlider.disabled = false;
    if (!keepCredit) {
        document.getElementById('vinylCredit').classList.add('hidden');
    }
}

// Load Media Button
loadButton.addEventListener('click', () => {
    if (!state.currentVideo) {
        alert('Please select a video file or enter a video URL');
        return;
    }

    state.isPreloaded = false;

    if (state.sourceType === 'youtube') {
        videoPlayer.style.display = 'none';
        const ytEl = document.getElementById('youtubePlayer');
        ytEl.style.display = 'block';
        ytEl.style.visibility = 'visible';

        if (!state.ytReady) {
            alert('YouTube player is still loading. Please wait a moment and try again.');
            return;
        }

        createYouTubePlayer(state.currentVideo, () => {
            finishLoad();
        });
    } else {
        videoPlayer.style.display = 'block';
        document.getElementById('youtubePlayer').style.display = 'none';

        videoPlayer.src = state.currentVideo;
        videoPlayer.load();

        videoPlayer.addEventListener('loadedmetadata', () => {
            videoPlayer.classList.add('loaded');
            finishLoad();
        }, { once: true });

        videoPlayer.addEventListener('error', () => {
            alert('Error loading video. Please try a different file or URL.');
        }, { once: true });
    }
});

// Tonearm Dragging System
const MIN_ANGLE = -10;
const MAX_ANGLE = 11;
const VINYL_ANGLE_START = 3;
const VINYL_ANGLE_END = 11;

let isDragging = false;
let dragOffset = 0;
let currentAngle = MIN_ANGLE;
let tonearmNaturalWidth = 0;
let tonearmNaturalHeight = 0;

function initTonearmSize() {
    const img = tonearm.querySelector('img');
    if (img && img.naturalWidth) {
        const displayWidth = tonearm.offsetWidth;
        const scale = displayWidth / img.naturalWidth;
        tonearmNaturalWidth = displayWidth;
        tonearmNaturalHeight = img.naturalHeight * scale;
    }
}

function getTonearmPivot() {
    if (!tonearmNaturalHeight) initTonearmSize();
    const assemblyRect = tonearmAssembly.getBoundingClientRect();
    return {
        x: assemblyRect.left + tonearmNaturalWidth * 0.47,
        y: assemblyRect.top + tonearmNaturalHeight * 0.27
    };
}

const tonearmImg = tonearm.querySelector('img');
if (tonearmImg.complete) {
    initTonearmSize();
} else {
    tonearmImg.addEventListener('load', initTonearmSize);
}

function isNeedleOnVinyl() {
    if (!state.isLoaded) return false;
    return currentAngle >= VINYL_ANGLE_START && currentAngle <= VINYL_ANGLE_END;
}

function calculateVideoTime() {
    const range = VINYL_ANGLE_END - VINYL_ANGLE_START;
    const normalized = Math.max(0, Math.min(1,
        (currentAngle - VINYL_ANGLE_START) / range
    ));

    if (state.sourceType === 'youtube' && state.ytPlayer && state.ytPlayer.getDuration) {
        return normalized * state.ytPlayer.getDuration();
    }
    if (videoPlayer.duration) {
        return normalized * videoPlayer.duration;
    }
    return 0;
}

const tonearmHandle = document.getElementById('tonearmHandle');

function getPointerAngle(clientX, clientY) {
    const pivot = getTonearmPivot();
    return Math.atan2(clientY - pivot.y, clientX - pivot.x) * 180 / Math.PI;
}

const dropSound = new Audio('dragon-studio-button-press-382713.mp3');

function handleDragStart(clientX, clientY) {
    isDragging = true;
    dragOffset = getPointerAngle(clientX, clientY) - currentAngle;
}

function handleDragMove(clientX, clientY) {
    if (!isDragging) return;

    const angle = getPointerAngle(clientX, clientY);
    currentAngle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle - dragOffset));
    tonearm.style.transform = `rotate(${currentAngle}deg)`;

    state.needleOnRecord = isNeedleOnVinyl();

    if (state.isLoaded && !state.needleOnRecord && state.isPlaying) {
        pausePlayback();
    }
}

function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;

    dropSound.currentTime = 0;
    dropSound.play().catch(() => {});

    if (!state.isLoaded) return;

    state.needleOnRecord = isNeedleOnVinyl();

    if (state.needleOnRecord && !state.isPlaying) {
        playWithPop();
    } else if (!state.needleOnRecord && state.isPlaying) {
        pausePlayback();
    }
}

tonearmHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
});
document.addEventListener('mousemove', (e) => {
    handleDragMove(e.clientX, e.clientY);
});
document.addEventListener('mouseup', handleDragEnd);

tonearmHandle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
}, { passive: false });
document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
}, { passive: false });
document.addEventListener('touchend', handleDragEnd);
document.addEventListener('touchcancel', handleDragEnd);

let vinylRotation = 0;
let lastFrameTime = null;
let spinAnimId = null;
let spinSpeed = 1;

function spinVinyl(timestamp) {
    if (!state.isPlaying) return;
    if (lastFrameTime === null) lastFrameTime = timestamp;

    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    const degreesPerMs = (360 / (1800 / spinSpeed));
    vinylRotation = (vinylRotation + degreesPerMs * delta) % 360;
    vinylRecord.style.transform = `translate(-50%, -50%) rotate(${vinylRotation}deg)`;

    spinAnimId = requestAnimationFrame(spinVinyl);
}

function playWithPop() {
    if (!state.isLoaded) return;

    if (state.sourceType === 'youtube' && state.ytPlayer) {
        state.ytPlayer.unMute();
        state.ytPlayer.setVolume(100);
        state.ytPlayer.playVideo();
    } else {
        videoPlayer.play().catch(err => {
            console.error('Playback error:', err);
        });
    }
    state.isPlaying = true;
    lastFrameTime = null;
    spinAnimId = requestAnimationFrame(spinVinyl);
}

function pausePlayback() {
    if (state.sourceType === 'youtube' && state.ytPlayer) {
        state.ytPlayer.pauseVideo();
    } else {
        videoPlayer.pause();
    }
    state.isPlaying = false;
    if (spinAnimId) {
        cancelAnimationFrame(spinAnimId);
        spinAnimId = null;
    }
}

// RPM Slider
rpmSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    rpmDisplay.textContent = speed.toFixed(1) + 'x';
    spinSpeed = speed;

    if (state.sourceType === 'youtube' && state.ytPlayer && state.ytPlayer.setPlaybackRate) {
        state.ytPlayer.setPlaybackRate(speed);
    } else {
        videoPlayer.playbackRate = speed;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && state.isLoaded) {
        e.preventDefault();
        if (state.isPlaying) {
            pausePlayback();
        } else if (state.needleOnRecord) {
            playWithPop();
        }
    }
});

videoPlayer.addEventListener('ratechange', () => {
    if (state.sourceType === 'local') {
        spinSpeed = videoPlayer.playbackRate;
    }
});

tonearm.style.transform = `rotate(${currentAngle}deg)`;

// Preload song
const PRELOAD_ID = 'GHwVwZ0REtY';
let preloadReady = false;

function preloadSong() {
    state.currentVideo = PRELOAD_ID;
    state.sourceType = 'youtube';
    state.isPreloaded = true;

    videoPlayer.style.display = 'none';
    const ytEl = document.getElementById('youtubePlayer');
    ytEl.style.display = 'block';
    ytEl.style.visibility = 'hidden';

    function tryCreate() {
        if (!state.ytReady) {
            setTimeout(tryCreate, 200);
            return;
        }
        createYouTubePlayer(PRELOAD_ID, () => {
            finishLoad(true);
            preloadReady = true;
        });
    }
    tryCreate();
}
preloadSong();


// Runaway text interaction
const melodyNote = document.getElementById('melodyNote');
const noteWrapper = document.getElementById('melodyNoteWrapper');
const originalText = melodyNote ? melodyNote.textContent : '';
let isRunning = false;

if (melodyNote && noteWrapper) {
    let hovered = false;

    melodyNote.addEventListener('mouseenter', () => {
        hovered = true;
        if (!isRunning) {
            isRunning = true;
            melodyNote.textContent = 'catch me if you can ;)';
        } else {
            melodyNote.textContent = 'haha hi';
            melodyNote.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
        }
    });

    melodyNote.addEventListener('mouseleave', () => {
        hovered = false;
        isRunning = false;
        melodyNote.textContent = originalText;
        melodyNote.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isRunning || hovered) return;

        const rect = melodyNote.getBoundingClientRect();
        const noteCenterX = rect.left + rect.width / 2;
        const noteCenterY = rect.top + rect.height / 2;

        const dx = noteCenterX - e.clientX;
        const dy = noteCenterY - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const detectDistance = 250;
        if (dist < detectDistance) {
            const force = Math.pow((detectDistance - dist) / detectDistance, 1.2) * 250;
            const angle = Math.atan2(dy, dx);
            const moveX = Math.cos(angle) * force;
            const moveY = Math.sin(angle) * force * 0.6;
            const rotation = (Math.random() - 0.5) * 15;
            melodyNote.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotation}deg) scale(${1 + (force / 250) * 0.3})`;
        } else {
            isRunning = false;
            melodyNote.textContent = originalText;
            melodyNote.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
        }
    });

    melodyNote.addEventListener('touchstart', (e) => {
        e.preventDefault();
        melodyNote.textContent = 'catch me if you can ;)';
        const jumpX = (Math.random() - 0.5) * 200;
        const jumpY = -40 - Math.random() * 60;
        const rotation = (Math.random() - 0.5) * 30;
        melodyNote.style.transform = `translate(${jumpX}px, ${jumpY}px) rotate(${rotation}deg) scale(1.2)`;
        setTimeout(() => {
            melodyNote.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
            melodyNote.textContent = originalText;
        }, 1000);
    }, { passive: false });
}
