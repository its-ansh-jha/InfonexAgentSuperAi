import React, { useRef, useState, useEffect, ChangeEvent } from 'react';
import { Send, Volume2, ImagePlus, Image, X, Mic, Search, Camera, FolderOpen, Loader2, Square, Settings, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimit } from '@/hooks/useUsageLimit';
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { sendUserMessage, searchAndRespond, isLoading, isTyping, stopGeneration, stopTyping } = useChat();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { usage, incrementUsage } = useUsageLimit();

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

    // Check usage limits for non-authenticated users
    if (!isAuthenticated && !usage.canSendMessage) {
      toast({
        title: "Daily Limit Reached",
        description: `You've reached your daily limit of ${usage.limit} messages. Sign in to continue chatting without limits.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Store current state before clearing
    const currentInput = input.trim();
    const currentImageFiles = [...imageFiles];

    // Clear state immediately for better UX
    setInput('');
    removeImage(); // This clears all images

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Increment usage count for non-authenticated users before sending
      if (!isAuthenticated) {
        await incrementUsage();
      }
      
      // Send the message with optional images
      await sendUserMessage(currentInput, currentImageFiles.length > 0 ? currentImageFiles : undefined);
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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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

    // Stop any existing recognition instance
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Create a new SpeechRecognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false; // Only get final results to prevent duplication
    recognition.lang = 'en-US';

    // Handle recognition results
    recognition.onresult = (event) => {
      let finalTranscript = '';
      
      // Only process final results to avoid duplication
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript.trim()) {
        setInput(prevInput => {
          const newText = prevInput.trim() ? prevInput + ' ' + finalTranscript.trim() : finalTranscript.trim();
          return newText;
        });
      }
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
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Image upload is only available for signed-in users. Sign in to unlock this feature.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCameraClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Camera capture is only available for signed-in users. Sign in to unlock this feature.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
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
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Image className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium text-white">
                    {isUploadingImage ? (
                      <span className="flex items-center gap-2">
                        Processing images
                        <div className="typing-dots text-primary">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </span>
                    ) : (
                      `${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''} ready`
                    )}
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
                      className="h-9 w-9 rounded-full hover:bg-neutral-700 text-blue-500 hover:text-blue-400"
                      data-testid="button-search-info"
                      onClick={() => {
                        toast({
                          title:  "Web Search Already Built-in",
                          description: "InfonexAgent has automatic web search capabilities. Just ask any question that requires current information and the AI will search for you!",
                          duration: 4000,
                        });
                      }}
                    >
                      <Globe className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>AI Search Info</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DropdownMenu>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isUploadingImage || !isAuthenticated}
                            className={`h-9 w-9 rounded-full hover:bg-neutral-700 ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''} ${
                              imageFiles.length > 0 ? 'text-primary hover:text-primary' : 'text-neutral-400 hover:text-white'
                            } ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                            data-testid="button-image-options"
                          >
                            {!isAuthenticated ? (
                              <div className="relative">
                                <ImagePlus className={`h-5 w-5 ${isUploadingImage ? 'animate-pulse' : ''}`} />
                                <Lock className="h-2 w-2 absolute -top-1 -right-1 text-red-400" />
                              </div>
                            ) : (
                              <ImagePlus className={`h-5 w-5 ${isUploadingImage ? 'animate-pulse' : ''}`} />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{!isAuthenticated ? 'Sign in to add images' : 'Add image'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={handleCameraClick} className="cursor-pointer" data-testid="option-camera">
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                      {!isAuthenticated && <Lock className="ml-auto h-4 w-4 text-red-400" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleGalleryClick} className="cursor-pointer" data-testid="option-gallery">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Choose from Gallery
                      {!isAuthenticated && <Lock className="ml-auto h-4 w-4 text-red-400" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                type={isLoading || isTyping ? "button" : "submit"}
                onClick={(isLoading || isTyping) ? (isLoading ? stopGeneration : stopTyping) : undefined}
                disabled={isUploadingImage || (!(isLoading || isTyping) && (!input.trim() && imageFiles.length === 0))}
                className={`h-9 w-9 rounded-full text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 ${
                  (isLoading || isTyping)
                    ? 'bg-muted-foreground hover:bg-muted-foreground/80 shadow-lg' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isLoading ? (
                  <Square className="h-4 w-4" />
                ) : isTyping ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          <div className="text-xs text-neutral-500 text-center mt-1">
            {isLoading ? (
              <span className="text-primary animate-pulse flex items-center justify-center gap-1">
                <div className="typing-dots">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
                <span className="ml-2">Processing your message...</span>
              </span>
            ) : isListening ? (
              <span className="text-red-400">Listening...</span>
            ) : !isAuthenticated ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">Daily messages: {usage.messageCount}/{usage.limit}</span>
                  {!usage.canSendMessage && (
                    <span className="text-red-400 text-xs bg-red-900/20 px-2 py-1 rounded">
                      Limit reached - Sign in to continue
                    </span>
                  )}
                </div>
                <span>
                  InfonexAgent • Sign in for unlimited access and image features
                </span>
              </div>
            ) : (
              <span>
                InfonexAgent is using Infonex Ai to generate human-like text and analyze images
              </span>
            )}
          </div>
        </form>
      </div>
    </footer>
  );
}
