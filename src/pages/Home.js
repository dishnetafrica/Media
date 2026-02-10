import { useState, useEffect, useRef } from 'react';

function Home() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedOutputs, setGeneratedOutputs] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState(null);
  
  // WebSocket states
  const [wsToken, setWsToken] = useState(null);
  const [wsStatus, setWsStatus] = useState('idle');
  const [videoProcessing, setVideoProcessing] = useState(false);
  const wsRef = useRef(null);

  // Progress states
  const [processingStage, setProcessingStage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Connect to WebSocket when token is available
  useEffect(() => {
    if (wsToken && !wsRef.current) {
      connectWebSocket(wsToken);
    }
  }, [wsToken]);

  // Timer for elapsed time
  useEffect(() => {
    if (videoProcessing) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setElapsedTime(0);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [videoProcessing]);

  // Format time in MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // WebSocket connection function
  const connectWebSocket = (token) => {
    const wsUrl = `wss://ghana-websockets-fastapi.uhnz4n.easypanel.host/ws/${token}`;
    
    console.log('🔄 Connecting to WebSocket:', wsUrl);
    setWsStatus('connecting');
    setVideoProcessing(true);
    setProcessingStage('video_generation');
    setEstimatedTime('3-5 minutes');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket Connected!');
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket Message received:', data);
        
        if (data.type === 'connected') {
          console.log('🎉 Connection confirmed by server');
        } else if (data.type === 'video_ready') {
          console.log('🎥 VIDEO IS READY!');
          console.log('📹 Video URL:', data.video_url);
          
          setGeneratedOutputs(prevOutputs => ({
            ...prevOutputs,
            video: {
              url: data.video_url,
              type: 'video',
              download_url: data.video_url
            }
          }));
          
          setVideoProcessing(false);
          setProcessingStage('');
          setEstimatedTime(null);
          
          if (wsRef.current) {
            wsRef.current.close();
          }
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket Error:', error);
        setWsStatus('error');
        setVideoProcessing(false);
        setProcessingStage('');
        setError('Failed to connect to video processor. Please try again.');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        setWsStatus('idle');
        wsRef.current = null;
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setWsStatus('error');
      setVideoProcessing(false);
      setProcessingStage('');
      setError('Failed to start video processing. Please try again.');
    }
  };

  // Image upload handler with API integration
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset states
    setError(null);
    setGeneratedOutputs(null);
    setWsToken(null);
    setVideoProcessing(false);
    setProcessingStage('image_upload');
    setEstimatedTime('30-60 seconds');
    setElapsedTime(0);

    // Preview uploaded image
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageUrl = event.target.result;
      setUploadedImage(imageUrl);

      // API Call: Upload image to webhook
      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const username = 'media_api';
        const password = '123456';
        const basicAuth = 'Basic ' + btoa(username + ':' + password);

        console.log('Uploading image to API...');
        
        const uploadResponse = await fetch('https://ghana-n8n.uhnz4n.easypanel.host/webhook/media/intake', {
          method: 'POST',
          headers: {
            'Authorization': basicAuth,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`API Error: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        const uploadData = await uploadResponse.json();
        console.log('Upload successful! Full API Response:', JSON.stringify(uploadData, null, 2));

        let responseData;
        let images;

        if (Array.isArray(uploadData)) {
          responseData = uploadData[0];
        } else {
          responseData = uploadData;
        }

        if (responseData && responseData.ws_token) {
          console.log('🎫 WebSocket Token received:', responseData.ws_token);
          setWsToken(responseData.ws_token);
        }

        if (responseData && responseData.images) {
          if (typeof responseData.images === 'string') {
            try {
              images = JSON.parse(responseData.images);
            } catch (parseError) {
              images = responseData.images;
            }
          } else {
            images = responseData.images;
          }
        } else {
          throw new Error('Invalid API response: No images found');
        }
        
        const platformOutputs = {};
        let foundAnyImage = false;
        
        if (images.facebook) {
          const fbUrl = images.facebook.preview_url || images.facebook.cloudinary_url || images.facebook.download_url;
          if (fbUrl) {
            platformOutputs.facebook = { 
              url: fbUrl, 
              type: 'image',
              download_url: images.facebook.download_url || fbUrl
            };
            foundAnyImage = true;
          }
        }
        
        if (images.linkedin) {
          const liUrl = images.linkedin.preview_url || images.linkedin.cloudinary_url || images.linkedin.download_url;
          if (liUrl) {
            platformOutputs.linkedin = { 
              url: liUrl, 
              type: 'image',
              download_url: images.linkedin.download_url || liUrl
            };
            foundAnyImage = true;
          }
        }
        
        if (images.instagram) {
          const igUrl = images.instagram.preview_url || images.instagram.cloudinary_url || images.instagram.download_url;
          if (igUrl) {
            platformOutputs.instagram = { 
              url: igUrl, 
              type: 'image',
              download_url: images.instagram.download_url || igUrl
            };
            foundAnyImage = true;
          }
        }

        if (!foundAnyImage) {
          throw new Error('API returned no images for any platform');
        }

        setGeneratedOutputs(platformOutputs);
        setProcessingStage('');
        setEstimatedTime(null);
        
      } catch (error) {
        console.error('Error processing image:', error);
        setError(error.message);
        setProcessingStage('');
        setEstimatedTime(null);
      } finally {
        setIsProcessing(false);
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      setError('Failed to read file');
      setIsProcessing(false);
      setProcessingStage('');
    };
    
    reader.readAsDataURL(file);
  };

  const openImageModal = (url, type = 'image') => {
    setSelectedImage({ url, type });
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: '📘', color: 'blue' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'blue' },
    { id: 'instagram', name: 'Instagram', icon: '📸', color: 'pink' },
    { id: 'video', name: 'YouTube Video', icon: '🎥', color: 'red' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Social Media AI Studio
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">Create platform-optimized content instantly</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-10 mb-6 sm:mb-8 border border-gray-100">
          <div className="text-center">
            <div className="mb-6 sm:mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Upload Your Image</h2>
              <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
                Transform one image into optimized content for Facebook, LinkedIn, Instagram, and YouTube
              </p>
            </div>

            {/* Upload Button */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageUpload"
                disabled={isProcessing || videoProcessing}
              />
              <label
                htmlFor="imageUpload"
                className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer text-base transform hover:scale-105 ${
                  (isProcessing || videoProcessing) ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''
                }`}
              >
                {isProcessing || videoProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Choose Image to Start</span>
                  </>
                )}
              </label>
            </div>

            {/* Smart Processing Status */}
            {(isProcessing || videoProcessing) && (
              <div className="mt-8 space-y-4">
                {/* Progress Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {processingStage === 'image_upload' ? '📸 Generating Platform Images' : '🎥 Creating Video Content'}
                      </h3>
                      <p className="text-sm text-gray-700 mb-3">
                        {processingStage === 'image_upload' 
                          ? 'AI is optimizing your image for each social media platform...' 
                          : 'AI is generating a professional video from your image...'}
                      </p>
                      
                      {/* Time Info */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-blue-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Estimated: {estimatedTime}</span>
                        </div>
                        {videoProcessing && (
                          <div className="flex items-center gap-2 text-indigo-700">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span className="font-medium">Elapsed: {formatTime(elapsedTime)}</span>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full animate-pulse" 
                               style={{width: videoProcessing ? '60%' : '30%', transition: 'width 0.5s'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Message */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-left">
                      <p className="text-sm font-medium text-amber-900">Please don't refresh or close this page</p>
                      <p className="text-xs text-amber-700 mt-1">Your content is being processed. This may take a few minutes.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-900">Processing Error</p>
                    <p className="text-xs text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Uploaded Image Preview */}
          {uploadedImage && (
            <div className="mt-8 p-6 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Original Image
              </h3>
              <div className="flex justify-center">
                <img
                  src={uploadedImage}
                  alt="Uploaded preview"
                  className="max-w-full max-h-96 rounded-lg shadow-lg object-contain border border-gray-200"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generated Outputs Section */}
        {generatedOutputs && (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-10 border border-gray-100">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Your Generated Content</h2>
                  <p className="text-sm text-gray-600">Ready to download and share across platforms</p>
                </div>
              </div>
            </div>

            {/* Platform Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {platforms.map((platform) => {
                const output = generatedOutputs[platform.id];
                const isVideo = output?.type === 'video';
                const hasContent = output && output.url;
                const isVideoProcessing = platform.id === 'video' && videoProcessing && !hasContent;
                
                return (
                  <div
                    key={platform.id}
                    className={`bg-gradient-to-br from-white to-gray-50 border-2 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ${
                      hasContent ? 'border-blue-300 hover:border-blue-400' : 
                      isVideoProcessing ? 'border-purple-300' : 'border-gray-200'
                    } ${isVideo ? 'md:col-span-2' : ''}`}
                  >
                    {/* Platform Header */}
                    <div className={`px-6 py-4 ${
                      hasContent ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 
                      isVideoProcessing ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 
                      'bg-gradient-to-r from-gray-400 to-gray-500'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{platform.icon}</span>
                          <div>
                            <h3 className="text-white font-bold text-lg">{platform.name}</h3>
                            <p className="text-xs text-white/80">
                              {hasContent ? (isVideo ? 'Video Ready' : 'Image Ready') : 
                               isVideoProcessing ? 'Processing...' : 'Not Available'}
                            </p>
                          </div>
                        </div>
                        {hasContent && (
                          <div className="flex items-center gap-2 text-white text-sm bg-white/20 px-3 py-1.5 rounded-full">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">Ready</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="p-6">
                      <div 
                        className={`relative ${isVideo ? 'aspect-video' : 'aspect-video'} bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden mb-4 border-2 border-gray-200 ${
                          hasContent ? 'cursor-pointer hover:opacity-95 hover:scale-[1.02]' : ''
                        } transition-all duration-300 shadow-inner`}
                        onClick={() => hasContent && openImageModal(output.url, output.type)}
                      >
                        {isVideoProcessing ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-100 via-indigo-100 to-blue-100">
                            <div className="text-center px-4">
                              <div className="relative w-16 h-16 mx-auto mb-4">
                                <div className="absolute inset-0 border-4 border-purple-300 rounded-full animate-ping"></div>
                                <div className="absolute inset-0 border-4 border-t-purple-600 border-r-purple-600 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                              </div>
                              <p className="text-base font-semibold text-purple-700 mb-1">Generating Video</p>
                              <p className="text-sm text-purple-600">AI is creating your video content</p>
                              <p className="text-xs text-purple-500 mt-2">⏱️ {formatTime(elapsedTime)} elapsed</p>
                            </div>
                          </div>
                        ) : hasContent ? (
                          isVideo ? (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center group">
                              <div className="text-center relative z-10">
                                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-2xl group-hover:scale-110 transition-transform">
                                  <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                  </svg>
                                </div>
                                <p className="text-white font-semibold text-lg mb-1">Click to Play Video</p>
                                <p className="text-gray-300 text-sm">Full screen player</p>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            </div>
                          ) : (
                            <img
                              src={output.url}
                              alt={`${platform.name} content`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="16"%3EImage Failed%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          )
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-gray-400 font-medium">No content available</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {hasContent ? (
                        <div className="flex gap-3">
                          <a 
                            href={output.download_url || output.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                          <button
                            onClick={() => openImageModal(output.url, output.type)}
                            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      ) : isVideoProcessing ? (
                        <button 
                          disabled
                          className="w-full py-3 bg-gradient-to-r from-purple-400 to-indigo-400 text-white font-semibold rounded-xl cursor-wait flex items-center justify-center gap-2 shadow-md"
                        >
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Processing Video...
                        </button>
                      ) : (
                        <button 
                          disabled
                          className="w-full py-3 bg-gray-200 text-gray-500 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Not Available
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Full Screen Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={closeImageModal}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 hover:bg-black/70 rounded-full p-3 shadow-xl"
              aria-label="Close"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div 
              className="max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedImage.type === 'video' ? (
                <div className="w-full max-w-6xl bg-black rounded-2xl overflow-hidden shadow-2xl">
                  <video
                    src={selectedImage.url}
                    controls
                    autoPlay
                    className="w-full h-auto max-h-[90vh]"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <img
                  src={selectedImage.url}
                  alt="Full screen preview"
                  className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;