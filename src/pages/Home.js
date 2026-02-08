import { useState } from 'react';

function Home() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedOutputs, setGeneratedOutputs] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState(null);

  // Image upload handler with API integration
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset error state
    setError(null);

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

        // Create Basic Auth credentials
        const username = 'media_api';
        const password = '123456';
        const basicAuth = 'Basic ' + btoa(username + ':' + password);

        console.log('Uploading image to API...');
        
        // Upload image to webhook
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

        // Robust API response handling
        let responseData;
        let images;

        // Check if response is an array
        if (Array.isArray(uploadData)) {
          console.log('Response is an array, taking first element');
          responseData = uploadData[0];
        } else {
          console.log('Response is an object');
          responseData = uploadData;
        }

        // Extract images object
        if (responseData && responseData.images) {
          images = responseData.images;
          console.log('Images object found:', JSON.stringify(images, null, 2));
        } else {
          console.error('No images object in response!', responseData);
          throw new Error('Invalid API response: No images found');
        }
        
        // Map API response to platform outputs
        const platformOutputs = {};
        let foundAnyImage = false;
        
        // Process Facebook
        if (images.facebook) {
          console.log('Facebook data found:', images.facebook);
          const fbUrl = images.facebook.preview_url || images.facebook.cloudinary_url || images.facebook.download_url;
          if (fbUrl) {
            platformOutputs.facebook = { 
              url: fbUrl, 
              type: 'image',
              download_url: images.facebook.download_url || fbUrl
            };
            foundAnyImage = true;
            console.log('✓ Facebook image added:', fbUrl);
          }
        } else {
          console.log('✗ No Facebook data in response');
        }
        
        // Process LinkedIn
        if (images.linkedin) {
          console.log('LinkedIn data found:', images.linkedin);
          const liUrl = images.linkedin.preview_url || images.linkedin.cloudinary_url || images.linkedin.download_url;
          if (liUrl) {
            platformOutputs.linkedin = { 
              url: liUrl, 
              type: 'image',
              download_url: images.linkedin.download_url || liUrl
            };
            foundAnyImage = true;
            console.log('✓ LinkedIn image added:', liUrl);
          }
        } else {
          console.log('✗ No LinkedIn data in response');
        }
        
        // Process Instagram
        if (images.instagram) {
          console.log('Instagram data found:', images.instagram);
          const igUrl = images.instagram.preview_url || images.instagram.cloudinary_url || images.instagram.download_url;
          if (igUrl) {
            platformOutputs.instagram = { 
              url: igUrl, 
              type: 'image',
              download_url: images.instagram.download_url || igUrl
            };
            foundAnyImage = true;
            console.log('✓ Instagram image added:', igUrl);
          }
        } else {
          console.log('✗ No Instagram data in response');
        }
        
        // Process video
        if (images.video) {
          console.log('video data found:', images.video);
          const ytUrl = images.video.preview_url || images.video.cloudinary_url || images.video.download_url;
          if (ytUrl) {
            platformOutputs.video = { 
              url: ytUrl, 
              type: 'video',
              download_url: images.video.download_url || ytUrl
            };
            foundAnyImage = true;
            console.log('✓ video video added:', ytUrl);
          }
        } else {
          console.log('✗ No video data in response');
        }

        if (!foundAnyImage) {
          console.error('No images found in any platform!');
          throw new Error('API returned no images for any platform');
        }

        console.log('Final platform outputs:', platformOutputs);
        setGeneratedOutputs(platformOutputs);
        
      } catch (error) {
        console.error('Error processing image:', error);
        setError(error.message);
        alert('Failed to upload image. Please try again. Error: ' + error.message);
      } finally {
        setIsProcessing(false);
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      setError('Failed to read file');
      alert('Failed to read file. Please try again.');
    };
    
    reader.readAsDataURL(file);
  };

  const resetUpload = () => {
    setUploadedImage(null);
    setGeneratedOutputs(null);
    setError(null);
  };

  const openImageModal = (url, type) => {
    if (url) {
      setSelectedImage({ url, type });
    }
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const platforms = [
    { id: 'instagram', name: 'Instagram' },
    { id: 'linkedin', name: 'LinkedIn'},
    { id: 'facebook', name: 'Facebook' },
    { id: 'video', name: 'video'},
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Social Media Content Generator
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-500">
                Upload your image and get platform-optimized content
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        {!uploadedImage && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-8 mb-4 sm:mb-6">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 sm:p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-200">
                <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-medium text-gray-900">Upload your image</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">Click to browse or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-2">JPG, PNG, WEBP (Max 10MB)</p>
                  </div>
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-base sm:text-lg font-medium text-gray-900">Processing your image...</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Generating content for all platforms</p>
              </div>
            </div>
          </div>
        )}

        {/* Generated Outputs */}
        {generatedOutputs && !isProcessing && (
          <div className="space-y-4 sm:space-y-6">
            {/* Original Image Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Original Image</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">Source file uploaded</p>
                </div>
                <button
                  onClick={resetUpload}
                  className="px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200 w-full sm:w-auto"
                >
                  Upload New Image
                </button>
              </div>
              <div className="flex justify-center bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                <img 
                  src={uploadedImage} 
                  alt="Original upload" 
                  className="max-h-48 sm:max-h-64 w-auto rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openImageModal(uploadedImage, 'image')}
                />
              </div>
            </div>

            {/* Platform Outputs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Platform-Optimized Content</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Ready to download and share</p>
              </div>

              {/* Grid Layout - 2 columns on mobile, 4 on desktop */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {platforms.map((platform) => {
                  const output = generatedOutputs[platform.id];
                  const isVideo = output?.type === 'video';
                  const hasContent = output && output.url;
                  
                  return (
                    <div
                      key={platform.id}
                      className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 ${
                        isVideo ? 'col-span-2 lg:col-span-4' : ''
                      } ${!hasContent ? 'opacity-60' : ''}`}
                    >
                      {/* Platform Header */}
                      <div className={`px-3 py-2 sm:px-4 sm:py-3 ${hasContent ? 'bg-blue-600' : 'bg-gray-400'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-2xl">{platform.icon}</span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-white font-semibold text-sm sm:text-base truncate">{platform.name}</h3>
                            <p className={`text-xs ${hasContent ? 'text-blue-100' : 'text-gray-200'}`}>
                              {hasContent ? (isVideo ? 'Video' : 'Image') : 'Not available'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Content Preview */}
                      <div className="p-2 sm:p-4">
                        <div 
                          className={`relative ${isVideo ? 'aspect-[21/9]' : 'aspect-video'} bg-gray-100 rounded-lg overflow-hidden mb-2 sm:mb-4 border border-gray-200 ${hasContent ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity`}
                          onClick={() => hasContent && openImageModal(output.url, output.type)}
                        >
                          {hasContent ? (
                            isVideo ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                <div className="text-center">
                                  <svg className="w-10 h-10 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-xs sm:text-sm text-gray-300">Video Preview</p>
                                  <p className="text-xs text-gray-400 mt-1">Click to view full screen</p>
                                  <img
                                    src={output.url}
                                    alt="Video thumbnail"
                                    className="w-full h-full object-contain opacity-30 absolute inset-0"
                                    onError={(e) => {
                                      console.error(`Failed to load ${platform.name} image:`, output.url);
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <img
                                src={output.url}
                                alt={`${platform.name} content`}
                                className="w-full h-full object-contain bg-white"
                                onError={(e) => {
                                  console.error(`Failed to load ${platform.name} image:`, output.url);
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="16"%3EImage Load Failed%3C/text%3E%3C/svg%3E';
                                }}
                                onLoad={() => {
                                  console.log(`✓ Successfully loaded ${platform.name} image`);
                                }}
                              />
                            )
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-gray-400 text-sm">No image available</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Download Button */}
                        {hasContent ? (
                          <a 
                            href={output.download_url || output.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm"
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        ) : (
                          <button 
                            disabled
                            className="w-full py-2 sm:py-2.5 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm"
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
          </div>
        )}
      </main>

      {/* Full Screen Modal for Images and Videos */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={closeImageModal}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
              aria-label="Close"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div 
              className="max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedImage.type === 'video' ? (
                <div className="w-full max-w-4xl bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
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
                  className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
                  onError={(e) => {
                    console.error('Failed to load full screen image:', selectedImage.url);
                  }}
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