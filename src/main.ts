import {
    bootstrapCameraKit,
    CameraKitSession,
    createMediaStreamSource,
    Transform2D,
} from '@snap/camera-kit';

const liveRenderTarget = document.getElementById('canvas') as HTMLCanvasElement;
const flipButton = document.getElementById('flip-button') as HTMLButtonElement;
const recordButton = document.getElementById('record-button') as HTMLButtonElement;
const progressRing = document.getElementById('progress-ring') as HTMLDivElement;
const progressPath = document.getElementById('progress-path');
const previewModal = document.getElementById('preview-modal') as HTMLDivElement;
const previewVideo = document.getElementById('preview-video') as HTMLVideoElement;
const shareButton = document.getElementById('share-button') as HTMLButtonElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const closeModalButton = document.getElementById('close-modal-button') as HTMLButtonElement;


let isBackFacing = true;
let mediaStream: MediaStream;
let isFlipping = false;
let currentRotation = 0; // Track the current rotation 
let session: CameraKitSession;
let mediaRecorder: MediaRecorder | null = null;
let downloadUrl: string | null = null;
let recordingStartTime: number | null = null;
const RECORD_DURATION = 60;

async function init() {
    const cameraKit = await bootstrapCameraKit({
        apiToken: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzI2NTY1MzEwLCJzdWIiOiIyN2NmNDQwYy04YjBkLTQ5ZDEtYTM2MC04YjdkODQ5OTM3ZWJ-U1RBR0lOR340Y2ZhYTJiOC1kYWY4LTRhZDYtODYwNy1iMmI5NWYzMDVmMzAifQ.q8qMDDOzMv4jFiZ8NRqQ8-qDJMV4l5YmOex67WC6DqI'
    });
    const devicePixelRatio = window.devicePixelRatio || 1;
    const desiredAspectRatio = 9 / 16; // Example 9:16 ratio (e.g., portrait)

    // Calculate the best fit canvas dimensions based on screen and aspect ratio
    let canvasWidth: number;
    let canvasHeight: number;

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
        "77b918f0-930f-423c-be8b-05c1ccd96747",
        "11cbcba2-1275-47ec-9916-feaa6c52d24b"
    );
    await session.applyLens(lens);
    bindFlipCamera(session);
    bindRecorder();
    bindModal()
}


function bindFlipCamera(session: CameraKitSession) {
    flipButton.style.cursor = 'pointer';

    flipButton.addEventListener('click', () => {
        if (!isFlipping) {
            flipButton.classList.add('animate-flip');
            updateCamera(session);
        }
    });

    updateCamera(session);
}

async function updateCamera(session: CameraKitSession) {
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

    const chunks: BlobPart[] = [];

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
function bindModal(){
    closeModalButton.addEventListener('click', () => {
        previewModal.style.display = 'none';
       previewModal.classList.remove('show');
        previewVideo.pause();
        previewVideo.currentTime = 0;

    });
      shareButton.addEventListener('click', async() => {
        if (downloadUrl)
        {
            const blob = await fetch(downloadUrl).then(r => r.blob());
             const filesArray = [
              new File([blob], 'video.webm', {type: 'video/webm'})
            ];
            if(navigator.canShare && navigator.canShare({files: filesArray}))
              {
                    navigator.share({
                      files: filesArray,
                    })
                }
        }
    });
    saveButton.addEventListener('click', () => {
      if (downloadUrl)
      {
        const link = document.createElement('a');
        link.setAttribute('style', 'display: none');
        link.href = downloadUrl;
        link.download = 'camera-kit-web-recording.webm';
        link.click();
        link.remove();
      }
  });
}

init();