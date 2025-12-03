import React, { useRef, useEffect, useState } from 'react';
import { Clip } from '../types';

interface VideoPlayerProps {
  src: string;
  activeClip: Clip | null;
  onTimeUpdate: (currentTime: number) => void;
  onLoadedMetadata: (duration: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, activeClip, onTimeUpdate, onLoadedMetadata }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (activeClip && videoRef.current) {
      videoRef.current.currentTime = activeClip.startTime;
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [activeClip]);

  useEffect(() => {
    // Stop playing if we exceed the clip duration when in clip mode
    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      onTimeUpdate(videoRef.current.currentTime);

      if (activeClip && videoRef.current.currentTime >= activeClip.endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      if (videoElement) {
        videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [activeClip, onTimeUpdate]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      onLoadedMetadata(videoRef.current.duration);
    }
  };

  return (
    <div className="relative w-full h-full bg-black aspect-video group">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controls
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {activeClip && isPlaying && (
        <div className="absolute top-4 right-4 bg-red-600 border-2 border-white text-white px-4 py-1 text-sm font-bold shadow-lg animate-pulse uppercase tracking-wider">
          预览片段中
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;