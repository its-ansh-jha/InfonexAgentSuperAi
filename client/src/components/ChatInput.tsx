import React, { useRef, useState, useEffect, ChangeEvent } from 'react';
import { Send, Volume2, ImagePlus, Image, X, Mic } from 'lucide-react';
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
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendUserMessage, isLoading } = useChat();
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

    // Send the message with optional image
    await sendUserMessage(input, imageFile);
    
    // Reset state
    setInput('');
    setImageFile(null);
    setImageName('');
    
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
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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
      
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image file is too large (maximum: 5MB)",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      
      setImageFile(file);
      setImageName(file.name);
      
      toast({
        title: "Image added",
        description: `Image "${file.name}" added to your message`,
        duration: 2000,
      });
    }
  };
  
  const removeImage = () => {
    setImageFile(null);
    setImageName('');
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          
          {/* Image preview (if uploaded) */}
          {imageFile && (
            <div className="mb-2 flex items-center">
              <Badge 
                variant="outline" 
                className="bg-neutral-800 text-white border-neutral-700 py-1 pl-2 pr-1 flex items-center gap-1"
              >
                <Image className="h-3 w-3 mr-1" />
                <span className="truncate max-w-[150px]">{imageName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeImage}
                  className="h-4 w-4 rounded-full hover:bg-neutral-700 p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
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
                      onClick={handleImageClick}
                      className={`h-9 w-9 rounded-full hover:bg-neutral-700 ${
                        imageFile ? 'text-primary hover:text-primary' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <ImagePlus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Upload image</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={imageFile ? "Ask about this image..." : "Ask anything..."}
              className="flex-1 py-3 px-3 bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-white placeholder-neutral-500 min-h-[44px] max-h-[200px]"
              disabled={isLoading}
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
                disabled={isLoading || (!input.trim() && !imageFile)}
                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-neutral-500 text-center mt-1">
            {isListening ? (
              <span className="text-red-400">Listening...</span>
            ) : (
              <span>Infonex is using GPT-4o to generate human-like text and analyze images</span>
            )}
          </div>
        </form>
      </div>
    </footer>
  );
}
