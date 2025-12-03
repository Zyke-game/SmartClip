/**
 * Utilities for processing video files in the browser using Canvas and MediaRecorder.
 */

export interface CompressionProgress {
  status: 'init' | 'processing' | 'done' | 'error';
  progress: number; // 0 to 100
}

/**
 * Compresses a video file to be suitable for Gemini API limits.
 * Uses a safer 2x playback rate to prevent frame skipping/truncation.
 */
export const compressVideo = async (
  file: File, 
  onProgress: (p: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // If file is small enough (< 20MB), return original
    if (file.size < 20 * 1024 * 1024) {
      onProgress(100);
      resolve(file);
      return;
    }

    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video load failed"));
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const TARGET_HEIGHT = 360; 
      const aspectRatio = video.videoWidth / video.videoHeight;
      const TARGET_WIDTH = Math.round(TARGET_HEIGHT * aspectRatio);
      
      // Reduced from 4.0 to 2.0 to ensure full duration is captured reliably
      const PLAYBACK_RATE = 2.0; 
      
      const canvas = document.createElement('canvas');
      canvas.width = TARGET_WIDTH;
      canvas.height = TARGET_HEIGHT;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context failed"));
        return;
      }

      // 15 FPS gives smoother motion for analysis
      const stream = canvas.captureStream(15); 
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 600000 // 600kbps
      });

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(url);
        resolve(blob);
      };

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        
        const percent = Math.min(99, Math.round((video.currentTime / duration) * 100));
        onProgress(percent);
        
        requestAnimationFrame(drawFrame);
      };

      mediaRecorder.start();
      video.playbackRate = PLAYBACK_RATE;
      
      video.play().then(() => {
        drawFrame();
      }).catch(e => {
        console.error("Auto-play failed", e);
        reject(e);
      });

      video.onended = () => {
        // Small delay to ensure last frames are flushed
        setTimeout(() => {
          mediaRecorder.stop();
          onProgress(100);
        }, 100);
      };
    };
  });
};

/**
 * Extracts a specific clip from the video file by re-recording it.
 * Note: This re-encodes the video, so quality is dependent on browser implementation.
 */
export const cutVideo = async (
  file: File,
  startTime: number,
  endTime: number,
  onProgress: (p: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.currentTime = startTime;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video load failed"));
    };

    video.onloadeddata = () => {
      video.currentTime = startTime;
    };

    // Wait for seek to complete before starting
    video.onseeked = async () => {
      // If we haven't started recording yet and we are at start time
      if (video.currentTime >= endTime) {
          // Already past end?
          return;
      }
    };

    video.oncanplay = () => {
        // Ready to start
    };

    // We use a similar canvas approach to ensure we can control the stream
    // Using original resolution if possible, or capped at 720p for performance/memory
    const MAX_HEIGHT = 720;
    
    // We need to wait for metadata to know dimensions
    if (video.readyState >= 1) {
        startProcessing();
    } else {
        video.onloadedmetadata = startProcessing;
    }

    function startProcessing() {
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (height > MAX_HEIGHT) {
            const ratio = width / height;
            height = MAX_HEIGHT;
            width = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Canvas context failed"));
            return;
        }

        const stream = canvas.captureStream(30); // 30fps for clips
        let mediaRecorder: MediaRecorder;
        
        try {
             mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9', // Try VP9 for better quality
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });
        } catch (e) {
            // Fallback to VP8 or default
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm',
                videoBitsPerSecond: 2500000 
            });
        }

        const chunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            URL.revokeObjectURL(url);
            resolve(blob);
        };

        // Render loop
        const drawFrame = () => {
            if (video.paused || video.ended || video.currentTime >= endTime) {
                 if (mediaRecorder.state === 'recording') {
                     mediaRecorder.stop();
                     onProgress(100);
                 }
                 video.pause();
                 return;
            }
            
            ctx.drawImage(video, 0, 0, width, height);
            
            const duration = endTime - startTime;
            const current = video.currentTime - startTime;
            const percent = Math.min(99, Math.round((current / duration) * 100));
            onProgress(percent);

            requestAnimationFrame(drawFrame);
        };

        // Start
        video.currentTime = startTime;
        
        // Wait a tick for seek
        setTimeout(() => {
            mediaRecorder.start();
            video.playbackRate = 1.0; // Normal speed for quality
            video.play().then(() => {
                drawFrame();
            }).catch(e => {
                reject(e);
            });
        }, 200);
    }
  });
};