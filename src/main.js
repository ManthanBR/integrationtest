const liveRenderTarget = document.getElementById('canvas');
const flipButton = document.getElementById('flip-button');
const recordButton = document.getElementById('record-button');
const progressRing = document.getElementById('progress-ring');
const progressPath = document.getElementById('progress-path');
const previewModal = document.getElementById('preview-modal');
const previewVideo = document.getElementById('preview-video');
const shareButton = document.getElementById('share-button');
const saveButton = document.getElementById('save-button');
const closeModalButton = document.getElementById('close-modal-button');

let isBackFacing = true;
let mediaStream;
let isFlipping = false;
let currentRotation = 0; // Track the current rotation
let session;
let mediaRecorder = null;
let downloadUrl = null;
let recordingStartTime = null;
const RECORD_DURATION = 60;

async function init() {
    const {
        bootstrapCameraKit,
        CameraKitSession,
        createMediaStreamSource,
        Transform2D,
    } = await import('@snap/camera-kit');

    const cameraKit = await bootstrapCameraKit({
        apiToken: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzM0NjkzMzE0LCJzdWIiOiIzMmZhMmZlNC0wYmYxLTQ2N2QtODM4Mi04MTVmNzliMjFkMWJ-U1RBR0lOR35iMWI3YmFjZi01ZGI3LTQxMDAtOWIzNC0zZDEwODJmNmMyYTAifQ.681nZeSjvWHzWBiZbHY-T3Yq6M6qk3j9zgk9nM6I06M'
    });
    const devicePixelRatio = window.devicePixelRatio || 1;
    const desiredAspectRatio = 9 / 16; // Example 9:16 ratio (e.g., portrait)

    // Calculate the best fit canvas dimensions based on screen and aspect ratio
    let canvasWidth;
    let canvasHeight;

    if (window.innerWidth / window.innerHeight > desiredAspectRatio) {
        // If the screen is wider than the desired aspect ratio, set height to match screen
        canvasWidth = window.innerWidth;
        canvasHeight = window.innerWidth / desiredAspectRatio;
    } else {
        //If the screen is taller than the desired aspect ratio, set width to match screen
        canvasHeight = window.innerHeight;
        canvasWidth = window.innerHeight * desiredAspectRatio;
    }

    liveRenderTarget.width = canvasWidth * devicePixelRatio;
    liveRenderTarget.height = canvasHeight * devicePixelRatio;
    liveRenderTarget.style.width = `${canvasWidth}px`;
    liveRenderTarget.style.height = `${canvasHeight}px`;
    liveRenderTarget.style.position = 'fixed';
    liveRenderTarget.style.left = '50%';
    liveRenderTarget.style.top = '50%';
    liveRenderTarget.style.transform = 'translate(-50%, -50%)';


    session = await cameraKit.createSession({ liveRenderTarget });

    mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: isBackFacing ? 'environment' : 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
    });

  const source = createMediaStreamSource(mediaStream);

  await session.setSource(source);
    if (!isBackFacing) {
        source.setTransform(Transform2D.MirrorX);
    }

  await session.play();

    const lens = await cameraKit.lensRepository.loadLens(
        "fb6410ff-f10b-438a-a8b0-70cc6012b2b6",
        "11cbcba2-1275-47ec-9916-feaa6c52d24b"
    );
    await session.applyLens(lens);
    bindFlipCamera(session);
    bindRecorder();
    bindModal()
}


function bindFlipCamera(session) {
    flipButton.style.cursor = 'pointer';

    flipButton.addEventListener('click', () => {
        if (!isFlipping) {
            flipButton.classList.add('animate-flip');
            updateCamera(session);
        }
    });

    updateCamera(session); //Initial camera setup.  Important to call it here.
}

async function updateCamera(session) {
    isFlipping = true;
    flipButton.disabled = true;
    isBackFacing = !isBackFacing;

    if (mediaStream) {
        session.pause();
        mediaStream.getVideoTracks()[0].stop();
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: isBackFacing ? 'environment' : 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
    });


    const source = createMediaStreamSource(mediaStream);

    await session.setSource(source);

    if (!isBackFacing) {
        source.setTransform(Transform2D.MirrorX);
    }

    session.play();

    currentRotation += 180; // Update current rotation
    flipButton.style.setProperty('--current-rotation', `${currentRotation}deg`);
    setTimeout(() => {
        isFlipping = false;
        flipButton.disabled = false;
        flipButton.classList.remove('animate-flip');
    }, 500)
}

function bindRecorder() {
    recordButton.addEventListener('click', () => {
        if (mediaRecorder?.state === 'recording') {
            stopRecording();
        }
        else {
            startRecording();
        }
    });
}

async function startRecording() {
    recordButton.classList.add('recording');
    progressRing.style.display = 'block';


    const mediaStream = liveRenderTarget.captureStream(30);


    mediaRecorder = new MediaRecorder(mediaStream);

    const chunks = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data);
        }
    });

    mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(chunks);
        downloadUrl = window.URL.createObjectURL(blob);
        previewVideo.src = downloadUrl;
        previewModal.style.display = 'flex'
        previewModal.classList.add('show');
        recordButton.classList.remove('recording');
        progressRing.style.display = 'none';
    });

    mediaRecorder.start();
    recordingStartTime = Date.now();
    updateProgress();
}

function updateProgress() {
    if (!mediaRecorder || mediaRecorder.state !== 'recording' || !recordingStartTime) {
        return;
    }

    const elapsedTime = Date.now() - recordingStartTime;
    const progressPercentage = Math.min(100, (elapsedTime / 1000 / RECORD_DURATION) * 100);
    const circumference = 2 * Math.PI * 30;
    const dashOffset = circumference * (1 - progressPercentage / 100);

    if(progressPath instanceof SVGPathElement)
    {
       progressPath.style.strokeDashoffset = String(dashOffset);
    }


    if (elapsedTime / 1000 >= RECORD_DURATION) {
        stopRecording();
    } else {
        requestAnimationFrame(updateProgress);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    recordingStartTime = null;
     if(progressPath instanceof SVGPathElement)
     {
         progressPath.style.strokeDashoffset = String(188);
     }

    recordButton.classList.remove('recording');
    progressRing.style.display = 'none';
}
function bindModal() {
    closeModalButton.addEventListener('click', () => {
        previewModal.style.display = 'none';
        previewModal.classList.remove('show');
        previewVideo.pause();
        previewVideo.currentTime = 0;
    });

    shareButton.addEventListener('click', async () => {
        if (downloadUrl) {
            try {
                const response = await fetch(downloadUrl);
                if (!response.ok) {
                  throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
                }
                const blob = await response.blob();

                // Explicitly create a Blob with the correct MIME type.
                const videoBlob = new Blob([blob], { type: 'video/mp4' });

                // Create a File object with the correct name and type.
                const videoFile = new File([videoBlob], 'video.mp4', { type: 'video/mp4' });

                //Check for share and then share it.
                if (navigator.canShare && navigator.canShare({ files: [videoFile] })) {
                    await navigator.share({
                        files: [videoFile],
                        title: 'Camera Kit Recording', // Optional: Add a title
                    });
                } else {
                    console.error('Sharing not supported or file is incompatible.');
                     alert('Sharing not supported in this browser or the file type is incompatible.');
                }
            } catch (error) {
                console.error('Error sharing video:', error);
                alert(`Error sharing video: ${error}`);
            }
        }
    });

    saveButton.addEventListener('click', () => {
        if (downloadUrl) {
            const link = document.createElement('a');
            link.setAttribute('style', 'display: none');
            link.href = downloadUrl;
            link.download = 'camera-kit-web-recording.mp4';
            link.click();
            link.remove();
        }
    });
}

init();