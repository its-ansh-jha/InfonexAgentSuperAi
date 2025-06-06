import React, { useRef, useState, useEffect, ChangeEvent } from 'react';
import { Send, Volume2, ImagePlus, Image, X, Mic, Search, Brain } from 'lucide-react';
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

export function ChatInput() {
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isReasoningMode, setIsReasoningMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendUserMessage, searchAndRespond, reasonAndRespond, isLoading } = useChat();
  const { toast } = useToast();

  // Auto-resize textarea on input
  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current);
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Must have either text or an image to submit
    if ((!input.trim() && !imageFile) || isLoading) return;

    if (isSearchMode && !imageFile) {
      // Use search mode - search and get AI refined response
      await searchAndRespond(input);
    } else if (isReasoningMode && !imageFile) {
      // Use reasoning mode - get AI reasoning response
      await reasonAndRespond(input);
    } else {
      // Regular chat mode - send the message with optional image
      await sendUserMessage(input, imageFile);
    }

    // Reset state
    setInput('');
    setImageFile(null);
    setImageName('');
    setIsSearchMode(false);
    setIsReasoningMode(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

  const handleImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files && files.length > 0) {
      const file = files[0];

      // Check if the file is an image
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file (JPEG, PNG, etc.)",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      // Check file size (limit to 8MB)
      if (file.size > 8 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image file is too large (maximum: 8MB)",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setIsUploadingImage(true);
      setImageName(file.name);

      try {
        // Simulate processing time for better UX
        await new Promise(resolve => setTimeout(resolve, 500));

        setImageFile(file);
        setIsUploadingImage(false);

        toast({
          title: "Image ready",
          description: `Image "${file.name}" is ready to send`,
          duration: 2000,
        });
      } catch (error) {
        setIsUploadingImage(false);
        setImageName('');
        toast({
          title: "Error",
          description: "Failed to process image. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImageName('');
    setIsUploadingImage(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSearchMode = () => {
    setIsSearchMode(!isSearchMode);
    setIsReasoningMode(false); // Disable reasoning when enabling search
    if (imageFile) {
      // Clear image when switching to search mode since search doesn't support images
      removeImage();
    }
  };

  const toggleReasoningMode = () => {
    setIsReasoningMode(!isReasoningMode);
    setIsSearchMode(false); // Disable search when enabling reasoning
    if (imageFile) {
      // Clear image when switching to reasoning mode since reasoning doesn't support images
      removeImage();
    }
  };

  return (
    <footer className="sticky bottom-0 py-4 bg-neutral-900">
      <div className="container mx-auto px-4">
        {/* Now let's add our text-to-speech component */}
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* Hidden file input for image upload */}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Image preview (if uploaded or uploading) */}
          {(imageFile || isUploadingImage) && (
            <div className="mb-2 flex items-center">
              <Badge 
                variant="outline" 
                className={`bg-neutral-800 text-white border-neutral-700 py-1 pl-2 pr-1 flex items-center gap-1 ${
                  isUploadingImage ? 'opacity-75' : ''
                }`}
              >
                <Image className={`h-3 w-3 mr-1 ${isUploadingImage ? 'animate-pulse' : ''}`} />
                <span className="truncate max-w-[150px]">
                  {isUploadingImage ? `Processing ${imageName}...` : imageName}
                </span>
                {!isUploadingImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeImage}
                    className="h-4 w-4 rounded-full hover:bg-neutral-700 p-0 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            </div>
          )}

          {/* Integrated text input and buttons container */}
          <div className="relative bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            <div className="flex items-end">
              {/* Text input area */}
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={
                    isUploadingImage 
                      ? "Processing image..." 
                      : "Ask anything"
                  }
                  className="w-full py-4 px-4 bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-white placeholder-neutral-500 min-h-[52px] max-h-[200px]"
                  disabled={isLoading || isUploadingImage}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 px-3 pb-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleSearchMode}
                        className={`h-8 w-8 rounded-full hover:bg-neutral-700 ${
                          isSearchMode ? 'text-primary hover:text-primary bg-primary/20' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isSearchMode ? 'Exit search mode' : 'Search realtime data'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleReasoningMode}
                        className={`h-8 w-8 rounded-full hover:bg-neutral-700 ${
                          isReasoningMode ? 'text-purple-400 hover:text-purple-400 bg-purple-400/20' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Brain className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isReasoningMode ? 'Exit reasoning mode' : 'Advanced reasoning'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {!isSearchMode && !isReasoningMode && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleImageClick}
                          disabled={isUploadingImage}
                          className={`h-8 w-8 rounded-full hover:bg-neutral-700 ${
                            imageFile ? 'text-primary hover:text-primary' : 'text-neutral-400 hover:text-white'
                          } ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <ImagePlus className={`h-4 w-4 ${isUploadingImage ? 'animate-pulse' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Upload image</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleVoiceInput}
                        className={`h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700 ${
                          isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : ''
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isListening ? 'Stop recording' : 'Voice input'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button
                  type="submit"
                  disabled={isLoading || isUploadingImage || (!input.trim() && !imageFile)}
                  className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ml-2"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="text-xs text-neutral-500 text-center mt-2">
            {isListening ? (
              <span className="text-red-400">Listening...</span>
            ) : isSearchMode ? (
              <span className="text-blue-400">Search mode: Get realtime data refined by GPT-4o-mini</span>
            ) : isReasoningMode ? (
              <span className="text-purple-400">Reasoning mode: Advanced reasoning with o4 mini reasoning model</span>
            ) : (
              <span>Infonex is using GPT-4o to generate human-like text and analyze images</span>
            )}
          </div>
        </form>
      </div>
    </footer>
  );
}