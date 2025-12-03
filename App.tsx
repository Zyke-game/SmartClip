import React, { useState, useRef } from 'react';
import { analyzeVideo } from './services/geminiService';
import { compressVideo, cutVideo } from './utils/videoProcessor';
import { Clip, AnalysisResult, ProcessingStatus } from './types';
import VideoPlayer from './components/VideoPlayer';
import { UploadIcon, ScissorsIcon, FileTextIcon, LoaderIcon, PlayIcon, DownloadIcon, SparklesIcon } from './components/Icons';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // State for exporting specific clips
  const [exportingClipId, setExportingClipId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStatus(ProcessingStatus.IDLE);
      setResult(null);
      setActiveClip(null);
      setProgress(0);
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;

    try {
      // 1. Compress Video if needed
      setStatus(ProcessingStatus.READING_FILE);
      setStatusMessage('正在优化视频大小以进行 AI 分析...');
      
      const processFile = await compressVideo(videoFile, (p) => {
        setProgress(p);
        setStatusMessage(`正在压缩上传... ${p}%`);
      });

      // 2. Analyze
      setStatus(ProcessingStatus.ANALYZING);
      setStatusMessage('Gemini Pro 正在分析精彩片段...');
      const analysisData = await analyzeVideo(processFile);
      
      setResult(analysisData);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setStatus(ProcessingStatus.ERROR);
      setStatusMessage('分析过程中出错，请重试');
    }
  };

  const handleExportClip = async (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation(); // Prevent card click
    if (!videoFile || exportingClipId) return;

    try {
      setExportingClipId(clip.id);
      
      const blob = await cutVideo(videoFile, clip.startTime, clip.endTime, (p) => {
          // Optional: show local progress
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // .webm is the container used by MediaRecorder in Chrome/Firefox
      a.download = `${clip.title.replace(/\s+/g, '_')}_highlight.webm`; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Export failed", err);
      alert("导出失败，请重试");
    } finally {
      setExportingClipId(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result.markdownSummary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.videoTitle || 'summary'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadEDL = () => {
    if (!result) return;
    const edl = JSON.stringify(result.clips, null, 2);
    const blob = new Blob([edl], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.videoTitle || 'clips'}_EDL.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-neo-yellow selection:text-black pb-20">
      {/* Navbar */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neo-pink border-2 border-black shadow-neo-sm flex items-center justify-center transform hover:rotate-6 transition-transform flex-shrink-0">
              <ScissorsIcon />
            </div>
            <h1 className="text-xl md:text-2xl font-bold italic tracking-tighter uppercase truncate">
              SmartClip <span className="text-neo-blue">AI</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {status === ProcessingStatus.COMPLETED && (
               <div className="hidden md:flex gap-3">
                 <button 
                  onClick={handleDownloadMarkdown}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-bold bg-white border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2"
                 >
                   <FileTextIcon /> 导出 MD
                 </button>
                 <button 
                  onClick={handleDownloadEDL}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-bold bg-neo-yellow border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2"
                 >
                   <DownloadIcon /> 导出 EDL
                 </button>
               </div>
             )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        
        {/* Upload Section */}
        {!videoFile && (
          <div className="mt-10 border-4 border-black bg-white shadow-neo-lg rounded-none p-8 md:p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden group"
               onClick={() => fileInputRef.current?.click()}>
            
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-neo-blue via-neo-pink to-neo-yellow"></div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="video/*" 
              className="hidden" 
            />
            <div className="w-24 h-24 bg-neo-blue border-4 border-black shadow-neo rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <UploadIcon />
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tight">上传视频开始剪辑</h2>
            <p className="text-lg md:text-xl font-medium text-gray-600 max-w-lg">
              拖拽视频到此处。AI 将自动压缩并分析，寻找最佳高光时刻。
            </p>
            <button className="mt-8 px-8 py-4 bg-neo-green border-4 border-black text-black font-bold text-lg shadow-neo hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
              选择文件
            </button>
          </div>
        )}

        {/* Workspace */}
        {videoFile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Player & Controls */}
            <div className="lg:col-span-2 space-y-6">
              <div className="border-4 border-black bg-black shadow-neo rounded-none overflow-hidden relative">
                 {videoUrl && (
                  <VideoPlayer 
                    src={videoUrl} 
                    activeClip={activeClip} 
                    onTimeUpdate={setCurrentTime}
                    onLoadedMetadata={setDuration}
                  />
                )}
              </div>

              {/* Control Panel */}
              <div className="bg-white border-4 border-black p-4 md:p-6 shadow-neo flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col min-w-[150px]">
                    <h3 className="font-bold text-lg truncate max-w-[200px] md:max-w-[300px]">{videoFile.name}</h3>
                    <div className="font-mono text-sm bg-black text-white px-2 py-0.5 w-fit mt-1">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                  </div>

                  {status === ProcessingStatus.IDLE && (
                    <button 
                      onClick={handleAnalyze}
                      className="flex-shrink-0 flex items-center gap-2 px-6 md:px-8 py-3 bg-neo-pink border-2 border-black font-bold text-black shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      <SparklesIcon /> 智能识别高光
                    </button>
                  )}

                  {(status === ProcessingStatus.ANALYZING || status === ProcessingStatus.READING_FILE) && (
                    <div className="flex flex-col items-end w-full md:w-auto">
                       <div className="flex items-center gap-2 text-black font-bold animate-pulse text-sm md:text-base">
                        <LoaderIcon className="animate-spin" />
                        <span>{statusMessage}</span>
                      </div>
                      {status === ProcessingStatus.READING_FILE && (
                        <div className="w-full md:w-32 h-2 border-2 border-black mt-2 bg-gray-200">
                          <div className="h-full bg-neo-green transition-all duration-300" style={{width: `${progress}%`}}></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {status === ProcessingStatus.COMPLETED && (
                     <button 
                     onClick={() => setShowMarkdown(!showMarkdown)}
                     className={`flex-shrink-0 px-6 py-2 font-bold border-2 border-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all ${showMarkdown ? 'bg-black text-white' : 'bg-white text-black'}`}
                   >
                     {showMarkdown ? '查看片段列表' : '查看 AI 摘要'}
                   </button>
                  )}
                </div>

                {/* Timeline Visualization */}
                {status === ProcessingStatus.COMPLETED && result && (
                  <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 overflow-x-auto">
                    <div className="relative h-16 bg-gray-100 border-2 border-black overflow-hidden min-w-[300px]">
                      {/* Progress Bar */}
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-neo-blue/20 pointer-events-none"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      ></div>
                      
                      {/* Clip Markers */}
                      {result.clips.map((clip) => {
                         const startPct = (clip.startTime / duration) * 100;
                         const widthPct = ((clip.endTime - clip.startTime) / duration) * 100;
                         const isActive = activeClip?.id === clip.id;
                         
                         return (
                           <div
                            key={clip.id}
                            className={`absolute top-2 bottom-2 border-2 border-black cursor-pointer transition-all hover:brightness-110 ${isActive ? 'bg-neo-yellow z-10 scale-y-110' : 'bg-neo-pink/60'}`}
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                            onClick={() => setActiveClip(clip)}
                            title={clip.title}
                           >
                           </div>
                         )
                      })}

                       {/* Playhead */}
                       <div 
                        className="absolute top-0 bottom-0 w-1 bg-black z-20 pointer-events-none"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                      >
                        <div className="w-3 h-3 bg-black transform -translate-x-1/2 rotate-45 -mt-1"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Results */}
            <div className="bg-white border-4 border-black shadow-neo h-[600px] flex flex-col">
              <div className="p-4 border-b-4 border-black bg-neo-yellow">
                <h2 className="font-black text-xl uppercase">
                  {status === ProcessingStatus.COMPLETED ? (showMarkdown ? '视频摘要' : '精彩片段') : '任务列表'}
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {status === ProcessingStatus.IDLE && (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-50">
                      <SparklesIcon />
                      <p className="font-bold">等待分析...</p>
                   </div>
                )}

                {status === ProcessingStatus.COMPLETED && result && !showMarkdown && (
                  <div className="space-y-4">
                    {result.clips.map((clip, idx) => (
                      <div 
                        key={clip.id} 
                        onClick={() => setActiveClip(clip)}
                        className={`p-4 border-2 border-black cursor-pointer transition-all group relative ${activeClip?.id === clip.id ? 'bg-neo-blue shadow-neo-sm translate-x-[2px] translate-y-[2px]' : 'bg-white hover:bg-gray-50 hover:shadow-neo-sm'}`}
                      >
                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-black text-white font-bold flex items-center justify-center rounded-full border-2 border-white z-10">
                          {idx + 1}
                        </div>

                        <div className="flex justify-between items-start mb-2 pr-4">
                          <h4 className="font-bold text-lg leading-tight">
                            {clip.title}
                          </h4>
                        </div>
                        
                        <div className="inline-block bg-black text-white text-xs font-mono px-2 py-1 mb-2">
                          {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                        </div>

                        <p className="text-sm font-medium text-gray-700 mb-3 border-l-4 border-gray-300 pl-2">
                          {clip.description}
                        </p>

                        <div className="flex gap-2">
                           <button 
                             onClick={(e) => handleExportClip(e, clip)}
                             disabled={exportingClipId === clip.id}
                             className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold border-2 border-black transition-all shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] ${exportingClipId === clip.id ? 'bg-gray-300' : 'bg-neo-green'}`}
                           >
                             {exportingClipId === clip.id ? (
                               <>
                                 <LoaderIcon className="animate-spin w-4 h-4" /> 导出中...
                               </>
                             ) : (
                               <>
                                 <DownloadIcon /> 导出视频
                               </>
                             )}
                           </button>
                        </div>
                        
                        <div className="mt-2 flex items-center text-xs font-bold uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                           <PlayIcon /> <span className="ml-1">点击预览</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {status === ProcessingStatus.COMPLETED && result && showMarkdown && (
                   <div className="prose prose-sm max-w-none prose-headings:font-black prose-headings:border-b-2 prose-headings:border-black prose-p:font-medium prose-strong:text-neo-pink prose-strong:bg-black prose-strong:px-1">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {result.markdownSummary}
                      </div>
                   </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;