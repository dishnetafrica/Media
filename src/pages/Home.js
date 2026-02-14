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

  // Default/Static Prompts (not shown to user)
  const DEFAULT_PROMPTS = {
    message: 'Call with client and company',
    facebook: 'Resize and adapt this image to a 1:1 square format (1080x1080) for a Facebook feed post. Do not crop, remove, replace, or modify any existing elements in the image.',
    instagram: 'Resize and adapt this image to a 1:1 square format (1080x1080) for an Instagram feed post. Do not crop, remove, replace, or modify any existing elements in the image.',
    linkedin: 'Resize and adapt this image to a 1:1 square format (1080x1080) for a LinkedIn feed post. Do not crop, remove, replace, or modify any existing elements in the image.',
    video: 'Create a 6-second cinematic social media advertisement using the provided image. Animation style: - Smooth camera pan and zoom - Subtle depth and parallax - Soft lighting transitions - Realistic motion Rules: - Do not change or replace the main subject - Do not add text, logos, or watermarks - Maintain natural realism - Extend background only if needed - Its a telecom Company ad video So Company name and sentences there in photo should remain same with company logo Aspect ratio: 9:16 Output: High-quality promotional video.',
  };

  // Dynamic Prompt States
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptMode, setPromptMode] = useState('static'); // 'static' or 'custom'
  const [customPrompts, setCustomPrompts] = useState({
    facebook: '',
    instagram: '',
    linkedin: '',
    video: '',
  });
  const [tempPrompts, setTempPrompts] = useState({ ...customPrompts });
  const [pendingImage, setPendingImage] = useState(null);

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

  // Handle prompt modal
  const openPromptModal = () => {
    setTempPrompts({ ...customPrompts });
    setShowPromptModal(true);
  };

  const closePromptModal = () => {
    setShowPromptModal(false);
    setPendingImage(null); // Clear pending image if user cancels
  };

  const savePrompts = async () => {
    setCustomPrompts({ ...tempPrompts });
    setShowPromptModal(false);
    
    // Now process the pending image with the custom prompts
    if (pendingImage) {
      await processImageWithPrompts(pendingImage, tempPrompts);
    }
  };

  const useDefaultPrompts = async () => {
    setShowPromptModal(false);
    
    // Process with default prompts directly
    if (pendingImage) {
      await processImageWithPrompts(pendingImage, DEFAULT_PROMPTS);
    }
  };

  const handlePromptChange = (key, value) => {
    setTempPrompts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Process image with prompts
  const processImageWithPrompts = async (file, prompts) => {
    setIsProcessing(true);
    setProcessingStage('image_upload');
    setEstimatedTime('3-5 minutes');
    setElapsedTime(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add prompts to FormData
      formData.append('message', DEFAULT_PROMPTS.message); // Always use default message
      formData.append('facebook_prompt', prompts.facebook);
      formData.append('instagram_prompt', prompts.instagram);
      formData.append('linkedin_prompt', prompts.linkedin);
      formData.append('video_prompt', prompts.video);

      const username = 'media_api';
      const password = '123456';
      const basicAuth = 'Basic ' + btoa(username + ':' + password);

      console.log('Uploading image to API with prompts...');
      console.log('Prompts:', prompts);
      
      const uploadResponse = await fetch('https://ghana-n8n.uhnz4n.easypanel.host/webhook/media/intake', {
        method: 'POST',
        headers: {
          'Authorization': basicAuth
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      setProcessingStage('ai_generation');
      
      const responseData = await uploadResponse.json();
      console.log('✅ Upload Success! Response:', responseData);

      // Extract data from the array response
      const data = Array.isArray(responseData) ? responseData[0] : responseData;
      
      // Extract WebSocket token
      const token = data.ws_token;
      console.log('🎫 WebSocket Token:', token);
      
      if (token) {
        setWsToken(token);
      }

      // Parse and set the images from the response
      let imagesData;
      if (typeof data.images === 'string') {
        imagesData = JSON.parse(data.images);
      } else {
        imagesData = data.images;
      }

      console.log('🖼️ Images Data:', imagesData);

      // Map images to our output structure
      const outputs = {};
      
      if (imagesData.facebook) {
        outputs.facebook = {
          url: imagesData.facebook.preview_url || imagesData.facebook.cloudinary_url,
          type: 'image',
          download_url: imagesData.facebook.download_url
        };
      }

      if (imagesData.instagram) {
        outputs.instagram = {
          url: imagesData.instagram.preview_url || imagesData.instagram.cloudinary_url,
          type: 'image',
          download_url: imagesData.instagram.download_url
        };
      }

      if (imagesData.linkedin) {
        outputs.linkedin = {
          url: imagesData.linkedin.preview_url || imagesData.linkedin.cloudinary_url,
          type: 'image',
          download_url: imagesData.linkedin.download_url
        };
      }

      // Set video as processing initially
      outputs.video = {
        url: null,
        type: 'video',
        download_url: null,
        processing: true
      };

      console.log('📦 Processed Outputs:', outputs);
      setGeneratedOutputs(outputs);
      setProcessingStage('');
      setIsProcessing(false);
      setPendingImage(null);

    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to process image. Please try again.');
      setIsProcessing(false);
      setProcessingStage('');
      setPendingImage(null);
    }
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

  // Image upload handler - now shows prompt modal
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset states
    setError(null);
    setGeneratedOutputs(null);
    setWsToken(null);
    setVideoProcessing(false);
    setProcessingStage('');
    setEstimatedTime(null);
    setElapsedTime(0);

    // Preview uploaded image
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageUrl = event.target.result;
      setUploadedImage(imageUrl);
      
      // Store the file and show prompt modal
      setPendingImage(file);
      setPromptMode('static'); // Reset to static mode
      setTempPrompts({ ...customPrompts }); // Reset temp prompts
      setShowPromptModal(true);
    };

    reader.readAsDataURL(file);
  };

  // Modal handlers
  const openImageModal = (url, type) => {
    setSelectedImage({ url, type });
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  // Platform configurations
  const platforms = [
    { id: 'facebook', name: 'Facebook', color: 'from-blue-600 to-blue-800', icon: '📘' },
    { id: 'instagram', name: 'Instagram', color: 'from-pink-600 to-purple-700', icon: '📷' },
    { id: 'linkedin', name: 'LinkedIn', color: 'from-blue-700 to-blue-900', icon: '💼' },
    { id: 'video', name: 'Video', color: 'from-red-600 to-red-800', icon: '🎬' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header with gradient */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">AI Media Generator</h1>
              <p className="text-blue-100 text-sm mt-1">Transform your images into social media content</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Upload Section */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-10 border border-gray-100">
          <div className="text-center">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Your Image</h2>
              <p className="text-gray-600">Choose an image to generate content for all platforms</p>
            </div>
            
            <label className="relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isProcessing}
              />
              <div className={`relative border-3 border-dashed rounded-2xl p-12 transition-all duration-300 ${
                isProcessing 
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                  : 'border-indigo-300 hover:border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100'
              }`}>
                <div className="flex flex-col items-center">
                  {uploadedImage && !isProcessing ? (
                    <div className="mb-4">
                      <img 
                        src={uploadedImage} 
                        alt="Uploaded preview" 
                        className="max-w-xs max-h-48 rounded-xl shadow-lg border-4 border-white"
                      />
                    </div>
                  ) : (
                    <div className={`w-24 h-24 ${isProcessing ? 'bg-gray-200' : 'bg-gradient-to-br from-indigo-400 to-purple-500'} rounded-full flex items-center justify-center mb-4 shadow-lg ${!isProcessing && 'group-hover:scale-110'} transition-transform duration-300`}>
                      {isProcessing ? (
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
                      ) : (
                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                  )}
                  
                  <p className={`text-lg font-semibold mb-2 ${isProcessing ? 'text-gray-500' : 'text-gray-700'}`}>
                    {isProcessing ? 'Processing...' : uploadedImage ? 'Click to change image' : 'Click to upload or drag & drop'}
                  </p>
                  <p className={`text-sm ${isProcessing ? 'text-gray-400' : 'text-gray-500'}`}>
                    PNG, JPG, GIF up to 10MB
                  </p>

                  {/* Processing Stage Indicator */}
                  {processingStage && (
                    <div className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl border border-indigo-200">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-indigo-900 capitalize">
                            {processingStage.replace(/_/g, ' ')}
                          </p>
                          {estimatedTime && (
                            <p className="text-xs text-indigo-600">Est. {estimatedTime}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Generated Outputs Grid */}
        {generatedOutputs && (
          <div className="mb-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Generated Content</h2>
              <p className="text-gray-600">Your AI-generated media for different platforms</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {platforms.map((platform) => {
                const output = generatedOutputs[platform.id];
                const isVideo = platform.id === 'video';
                const hasContent = output && output.url;
                const isVideoProcessing = isVideo && videoProcessing && !hasContent;

                return (
                  <div 
                    key={platform.id}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-[1.02] transition-all duration-300 border border-gray-100"
                  >
                    {/* Platform Header */}
                    <div className={`bg-gradient-to-r ${platform.color} p-5`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{platform.icon}</span>
                          <div>
                            <h3 className="font-bold text-white text-lg">{platform.name}</h3>
                            <p className="text-white/80 text-xs">
                              {isVideoProcessing ? 'Processing...' : 'Not Available'}
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

      {/* Prompt Customization Modal */}
      {showPromptModal && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={closePromptModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Customize AI Prompts</h2>
                  <p className="text-indigo-100 text-sm">Personalize how AI generates content for each platform</p>
                </div>
                <button
                  onClick={closePromptModal}
                  className="text-white hover:text-gray-200 transition-colors bg-white/20 hover:bg-white/30 rounded-lg p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-8 py-6">
              {/* Mode Selector - Always Visible */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Choose Prompt Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Static Prompts Option */}
                  <button
                    onClick={() => setPromptMode('static')}
                    className={`p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                      promptMode === 'static'
                        ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        promptMode === 'static' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                      }`}>
                        {promptMode === 'static' && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 mb-1">Use Default Prompts</div>
                        <p className="text-xs text-gray-600 leading-relaxed">Quick start with optimized settings for best results</p>
                      </div>
                    </div>
                  </button>

                  {/* Custom Prompts Option */}
                  <button
                    onClick={() => setPromptMode('custom')}
                    className={`p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                      promptMode === 'custom'
                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        promptMode === 'custom' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}>
                        {promptMode === 'custom' && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 mb-1">Customize Prompts</div>
                        <p className="text-xs text-gray-600 leading-relaxed">Write your own custom instructions for each platform</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Prompt Fields - Only show if Custom mode selected */}
              {promptMode === 'custom' && (
                <div className="space-y-5">
                  {/* Facebook Prompt */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <label className="block">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                        <span className="font-semibold text-gray-900">Facebook Prompt</span>
                      </div>
                      <textarea
                        value={tempPrompts.facebook}
                        onChange={(e) => handlePromptChange('facebook', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                        placeholder="Write here..."
                      />
                    </label>
                  </div>

                  {/* Instagram Prompt */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <label className="block">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </div>
                        <span className="font-semibold text-gray-900">Instagram Prompt</span>
                      </div>
                      <textarea
                        value={tempPrompts.instagram}
                        onChange={(e) => handlePromptChange('instagram', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all resize-none text-sm"
                        placeholder="Write here..."
                      />
                    </label>
                  </div>

                  {/* LinkedIn Prompt */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <label className="block">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        </div>
                        <span className="font-semibold text-gray-900">LinkedIn Prompt</span>
                      </div>
                      <textarea
                        value={tempPrompts.linkedin}
                        onChange={(e) => handlePromptChange('linkedin', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent transition-all resize-none text-sm"
                        placeholder="Write here..."
                      />
                    </label>
                  </div>

                  {/* Video Prompt */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <label className="block">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-semibold text-gray-900">Video Prompt</span>
                      </div>
                      <textarea
                        value={tempPrompts.video}
                        onChange={(e) => handlePromptChange('video', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none text-sm"
                        placeholder="Write here..."
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Info message for Static mode */}
              {promptMode === 'static' && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Ready to Generate</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Using optimized default prompts for best results across all platforms. Click "Continue" below to start processing your image.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-8 py-5 rounded-b-2xl border-t border-gray-200">
              <div className="flex gap-3">
                {/* Cancel Button */}
                <button
                  onClick={closePromptModal}
                  className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg transition-all duration-200 border border-gray-300"
                >
                  Cancel
                </button>
                
                {/* Continue/Process Button */}
                {promptMode === 'static' ? (
                  <button
                    onClick={useDefaultPrompts}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Continue & Generate
                  </button>
                ) : (
                  <button
                    onClick={savePrompts}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save & Generate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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