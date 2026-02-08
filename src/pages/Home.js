import { useState } from 'react';

function Home() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedOutputs, setGeneratedOutputs] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  // Image upload handler with API integration
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview uploaded image
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageUrl = event.target.result;
      setUploadedImage(imageUrl);

      // API Call: Upload image to webhook
      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append('file', file); // Key is 'file' as per API requirement

        // Create Basic Auth credentials
        const username = 'media_api';
        const password = '123456';
        const basicAuth = 'Basic ' + btoa(username + ':' + password);

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
        console.log('Upload successful:', uploadData);

        // Process the API response
        // TODO: Update this section based on the actual API response structure
        // Example: If API returns { platforms: { instagram: {...}, linkedin: {...} } }
        // then use: setGeneratedOutputs(uploadData.platforms);
        
        // For now, showing uploaded image in all cards
        // Replace with actual API response data structure
        setGeneratedOutputs({
          instagram: { url: imageUrl, type: 'image' },
          linkedin: { url: imageUrl, type: 'image' },
          youtube: { url: imageUrl, type: 'video' },
          facebook: { url: imageUrl, type: 'image' },
          twitter: { url: imageUrl, type: 'image' },
        });
      } catch (error) {
        console.error('Error processing image:', error);
        alert('Failed to upload image. Please try again. Error: ' + error.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetUpload = () => {
    setUploadedImage(null);
    setGeneratedOutputs(null);
  };

  const openImageModal = (url, type) => {
    setSelectedImage({ url, type });
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const platforms = [
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
    { id: 'facebook', name: 'Facebook', icon: '👥' },
    { id: 'twitter', name: 'Twitter/X', icon: '🦅' },
    { id: 'youtube', name: 'YouTube', icon: '▶️' },
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
                  
                  return (
                    <div
                      key={platform.id}
                      className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 ${
                        isVideo ? 'col-span-2 lg:col-span-4' : ''
                      }`}
                    >
                      {/* Platform Header */}
                      <div className="bg-blue-600 px-3 py-2 sm:px-4 sm:py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-2xl">{platform.icon}</span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-white font-semibold text-sm sm:text-base truncate">{platform.name}</h3>
                            <p className="text-blue-100 text-xs">
                              {isVideo ? 'Video' : 'Image'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Content Preview */}
                      <div className="p-2 sm:p-4">
                        <div 
                          className={`relative ${isVideo ? 'aspect-[21/9]' : 'aspect-video'} bg-gray-100 rounded-lg overflow-hidden mb-2 sm:mb-4 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity`}
                          onClick={() => openImageModal(output?.url, output?.type)}
                        >
                          {isVideo ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                              <div className="text-center">
                                <svg className="w-10 h-10 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs sm:text-sm text-gray-300">Video Preview</p>
                                <p className="text-xs text-gray-400 mt-1">Click to view full screen</p>
                                {output?.url && (
                                  <img
                                    src={output.url}
                                    alt="Video thumbnail"
                                    className="w-full h-full object-contain opacity-30 absolute inset-0"
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            output?.url ? (
                              <img
                                src={output.url}
                                alt={`${platform.name} content`}
                                className="w-full h-full object-contain bg-white"
                                onError={(e) => {
                                  console.error('Image failed to load:', output.url);
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-gray-400 text-sm">No image</p>
                              </div>
                            )
                          )}
                        </div>

                        {/* Download Button */}
                        <button className="w-full py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
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