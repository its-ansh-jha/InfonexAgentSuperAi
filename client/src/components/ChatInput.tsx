import React, { useRef, useState, useEffect, ChangeEvent } from 'react';
import { Send, Volume2, ImagePlus, Image, X, Mic, Search, Camera, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/context/ChatContext';
import { autoResizeTextarea } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { sendUserMessage, searchAndRespond, isLoading } = useChat();
  const { toast } = useToast();

  // Auto-resize textarea on input
  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current);
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multiple submissions and ensure we have content
    if (isLoading || isUploadingImage || (!input.trim() && imageFiles.length === 0)) return;

    // Store current state before clearing
    const currentInput = input.trim();
    const currentImageFiles = [...imageFiles];
    const currentSearchMode = isSearchMode;

    // Clear state immediately for better UX
    setInput('');
    removeImage(); // This clears all images
    setIsSearchMode(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      if (currentSearchMode && currentImageFiles.length === 0) {
        // Use search mode - search and get AI refined response
        await searchAndRespond(currentInput);
      } else {
        // Regular chat mode - send the message with optional images
        await sendUserMessage(currentInput, currentImageFiles.length > 0 ? currentImageFiles : undefined);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore input on error for retry
      setInput(currentInput);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle voice input
  const handleVoiceInput = () => {
    if (isListening) {
      // Stop listening if already active
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Error",
        description: "Speech recognition is not supported in your browser",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Create a new SpeechRecognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Handle recognition results
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');

      setInput(prevInput => prevInput + ' ' + transcript);
    };

    // Handle end of recognition
    recognition.onend = () => {
      setIsListening(false);
    };

    // Handle errors
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast({
        title: "Voice Input Error",
        description: `Error: ${event.error || 'Unknown error'}. Please try again.`,
        variant: 'destructive',
      });
    };

    // Start recognition
    try {
      recognition.start();
      setIsListening(true);
      toast({
        title: "Voice Input Active",
        description: "Speak now... Your voice will be transcribed",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast({
        title: "Voice Input Error",
        description: "Could not start voice recognition",
        variant: 'destructive',
      });
    }
  };

  const handleGalleryClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCameraClick = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files && files.length > 0) {
      setIsUploadingImage(true);
      
      const newFiles: File[] = [];
      const newPreviewUrls: string[] = [];
      const newNames: string[] = [];
      
      // Process multiple files (max 16 for GPT-4o)
      const filesToProcess = Array.from(files).slice(0, 16);
      
      for (const file of filesToProcess) {
        // Check if the file is an image
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Error",
            description: `"${file.name}" is not an image file`,
            variant: "destructive",
            duration: 3000,
          });
          continue;
        }

        // Check file size (limit to 8MB per file)
        if (file.size > 8 * 1024 * 1024) {
          toast({
            title: "Error",
            description: `"${file.name}" is too large (maximum: 8MB per file)`,
            variant: "destructive",
            duration: 3000,
          });
          continue;
        }

        try {
          // Create preview URL for the image
          const previewUrl = URL.createObjectURL(file);
          
          newFiles.push(file);
          newPreviewUrls.push(previewUrl);
          newNames.push(file.name);
        } catch (error) {
          toast({
            title: "Error",
            description: `Failed to process "${file.name}"`,
            variant: "destructive",
            duration: 3000,
          });
        }
      }

      if (newFiles.length > 0) {
        // Add to existing files instead of replacing them
        setImageFiles(prev => [...prev, ...newFiles]);
        setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
        setImageNames(prev => [...prev, ...newNames]);

        // Simulate processing time for better UX
        await new Promise(resolve => setTimeout(resolve, 300));

        toast({
          title: "Images ready",
          description: `${newFiles.length} image${newFiles.length > 1 ? 's' : ''} ready to send`,
          duration: 2000,
        });
      }
      
      setIsUploadingImage(false);
    }
  };

  const removeImage = (indexToRemove?: number) => {
    if (indexToRemove !== undefined) {
      // Remove specific image
      const urlToRevoke = imagePreviewUrls[indexToRemove];
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
      
      setImageFiles(prev => prev.filter((_, i) => i !== indexToRemove));
      setImagePreviewUrls(prev => prev.filter((_, i) => i !== indexToRemove));
      setImageNames(prev => prev.filter((_, i) => i !== indexToRemove));
    } else {
      // Remove all images
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      
      setImageFiles([]);
      setImageNames([]);
      setImagePreviewUrls([]);
      setIsUploadingImage(false);

      // Reset both file inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  const toggleSearchMode = () => {
    setIsSearchMode(!isSearchMode);
    if (imageFiles.length > 0) {
      // Clear images when switching to search mode since search doesn't support images
      removeImage();
    }
  };

  return (
    <footer className="sticky bottom-0 py-4 bg-neutral-900">
      <div className="container mx-auto px-4">
        {/* Now let's add our text-to-speech component */}
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* Hidden file inputs for image upload */}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
            data-testid="input-gallery-upload"
          />
          <input 
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="input-camera-capture"
          />

          {/* Multiple images preview */}
          {(imageFiles.length > 0 || isUploadingImage) && (
            <div className="mb-3 p-3 bg-neutral-800 rounded-lg border border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Image className={`h-4 w-4 ${isUploadingImage ? 'animate-pulse text-neutral-500' : 'text-primary'}`} />
                  <span className="text-sm font-medium text-white">
                    {isUploadingImage ? 'Processing images...' : `${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''} ready`}
                  </span>
                </div>
                {!isUploadingImage && imageFiles.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage()}
                    className="text-xs text-neutral-400 hover:text-white"
                    data-testid="button-remove-all-images"
                  >
                    Clear all
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-16 object-cover rounded border border-neutral-600"
                      data-testid={`image-preview-${index}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeImage(index)}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-image-${index}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 rounded-b truncate">
                      {imageNames[index]}
                    </div>
                  </div>
                ))}
                {isUploadingImage && (
                  <div className="w-full h-16 bg-neutral-700 rounded border border-neutral-600 flex items-center justify-center">
                    <Image className="h-6 w-6 text-neutral-500 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative flex items-center bg-neutral-800 rounded-full border border-neutral-700 overflow-hidden">
            <div className="flex items-center pl-3 space-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={toggleSearchMode}
                      className={`h-9 w-9 rounded-full hover:bg-neutral-700 ${
                        isSearchMode ? 'text-primary hover:text-primary bg-primary/20' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isSearchMode ? 'Exit search mode' : 'Search realtime data'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {!isSearchMode && (
                <DropdownMenu>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isUploadingImage}
                            className={`h-9 w-9 rounded-full hover:bg-neutral-700 ${
                              imageFiles.length > 0 ? 'text-primary hover:text-primary' : 'text-neutral-400 hover:text-white'
                            } ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                            data-testid="button-image-options"
                          >
                            <ImagePlus className={`h-5 w-5 ${isUploadingImage ? 'animate-pulse' : ''}`} />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Add image</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={handleCameraClick} className="cursor-pointer" data-testid="option-camera">
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleGalleryClick} className="cursor-pointer" data-testid="option-gallery">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Choose from Gallery
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                isUploadingImage 
                  ? "Processing images..." 
                  : isSearchMode
                    ? "Search for realtime information..."
                    : imageFiles.length > 0
                      ? `Ask about ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}...`
                      : "Ask Anything..."
              }
              className="flex-1 py-3 px-3 bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-white placeholder-neutral-500 min-h-[44px] max-h-[200px]"
              disabled={isLoading || isUploadingImage}
            />

            <div className="flex items-center pr-2 space-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleVoiceInput}
                      className={`h-9 w-9 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700 ${
                        isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : ''
                      }`}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isListening ? 'Stop recording' : 'Voice input'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                type="submit"
                disabled={isLoading || isUploadingImage || (!input.trim() && imageFiles.length === 0)}
                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-neutral-500 text-center mt-1">
            {isListening ? (
              <span className="text-red-400">Listening...</span>
            ) : isSearchMode ? (
              <span className="text-blue-400">Search mode: Get realtime data refined by GPT-4o-mini</span>
            ) : (
              <span>Infonex is using GPT-4o to generate human-like text and analyze images</span>
            )}
          </div>
        </form>
      </div>
    </footer>
  );
}