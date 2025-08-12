import React, { useRef, useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Send, Volume2, ImagePlus, Image, X, Mic, Search, Camera, FolderOpen, Loader2, Square, FileText } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

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
  const documentInputRef = useRef<HTMLInputElement>(null); // Ref for document input
  const [documentFile, setDocumentFile] = useState<File | null>(null); // State for document file
  const [documentName, setDocumentName] = useState<string>(''); // State for document name
  const { sendUserMessage, searchAndRespond, isLoading, isTyping, stopGeneration, stopTyping } = useChat();
  const { toast } = useToast();

  // Auto-resize textarea on input
  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current);
    }
  }, [input]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if ((!input.trim() && imageFiles.length === 0 && documentFile === null) || isLoading || isUploadingImage) return;

    let imageDataArray: string[] = [];
    let imageFilesToSend: File[] = [];
    let documentContent = '';

    try {
      setIsUploadingImage(true); // Temporarily disable input while processing

      // Process image if present
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const formData = new FormData();
          formData.append('image', file);

          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image upload failed for ${file.name}: ${errorText}`);
          }

          const result = await response.json();

          if (result.imageData) {
            imageDataArray.push(result.imageData);
            imageFilesToSend.push(file);
          }
        }
      }

      // Process document if present
      if (documentFile) {
        const formData = new FormData();
        formData.append('document', documentFile);

        const response = await fetch('/api/upload-document', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Document upload failed for ${documentFile.name}: ${errorText}`);
        }

        const result = await response.json();

        if (result.success && result.content) {
          documentContent = `\n\n--- Document Content (${result.metadata?.filename}) ---\n${result.content}\n--- End Document ---`;
        } else {
          throw new Error(result.error || `Failed to process document ${documentFile.name}`);
        }
      }

      // Combine text content with document content
      const finalContent = input.trim() + documentContent;

      if (isSearchMode && imageFilesToSend.length === 0) {
        // Use search mode - search and get AI refined response
        await searchAndRespond(finalContent);
      } else {
        // Regular chat mode - send the message with optional images
        await sendUserMessage(finalContent, imageFilesToSend.length > 0 ? imageFilesToSend : undefined);
      }

      // Clear form
      setInput('');
      removeImage(); // Clears all images
      setDocumentFile(null);
      setDocumentName('');
      setIsSearchMode(false); // Reset search mode after submission
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (documentInputRef.current) documentInputRef.current.value = '';

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

    } catch (error) {
      console.error('Error processing submission:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
        duration: 3000,
      });
      // Restore input on error for retry
      setInput(input);
    } finally {
      setIsUploadingImage(false);
      // Ensure the imageFiles state is cleared after successful submission or error
      if (imageFiles.length > 0 || documentFile) {
        removeImage();
        setDocumentFile(null);
        setDocumentName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (documentInputRef.current) documentInputRef.current.value = '';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any); // Cast to any to satisfy FormEvent
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

  const handleDocumentClick = () => {
    if (documentInputRef.current) {
      documentInputRef.current.click();
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

  // Handle document change
  const handleDocumentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Basic validation for allowed document types (can be expanded)
      const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.html', '.csv', '.json', '.xml', '.md'];
      const fileExtension = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2);
      if (!allowedTypes.includes(`.${fileExtension}`)) {
        toast({
          title: "Error",
          description: `Unsupported file type: ".${fileExtension}". Please upload a supported document.`,
          variant: "destructive",
          duration: 5000,
        });
        if (documentInputRef.current) documentInputRef.current.value = ''; // Clear the input
        return;
      }

      // Check file size (e.g., limit to 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Error",
          description: `"${file.name}" is too large (maximum: 20MB)`,
          variant: "destructive",
          duration: 3000,
        });
        if (documentInputRef.current) documentInputRef.current.value = ''; // Clear the input
        return;
      }

      setDocumentFile(file);
      setDocumentName(file.name);
      toast({
        title: "Document ready",
        description: `"${file.name}" ready to send`,
        duration: 2000,
      });
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

  // Function to remove the currently selected document
  const removeDocument = () => {
    setDocumentFile(null);
    setDocumentName('');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  const toggleSearchMode = () => {
    setIsSearchMode(!isSearchMode);
    if (imageFiles.length > 0) {
      // Clear images when switching to search mode since search doesn't support images
      removeImage();
    }
    // If switching out of search mode and a document is attached, it should remain
  };

  // Placeholder for sendMessage function, assuming it's provided by useChat context
  const sendMessage = async (message: string, images?: File[], imageData?: string[]) => {
    // This function would typically call sendUserMessage or searchAndRespond
    // For now, we'll assume the context handles it based on isSearchMode
    console.log("Sending message:", { message, images, imageData });
  };

  return (
    <footer className="sticky bottom-0 py-4 bg-neutral-900">
      <div className="container mx-auto px-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* Hidden file inputs for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
            data-testid="input-gallery-upload"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            data-testid="input-camera-capture"
          />

          {/* Hidden file input for document upload */}
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.html,.csv,.json,.xml,.md"
            onChange={handleDocumentChange}
            className="hidden"
            data-testid="input-document-upload"
          />

          {/* Multiple images and single document preview */}
          {(imageFiles.length > 0 || documentFile || isUploadingImage) && (
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
                      <>
                        {imageFiles.length > 0 && `${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''} ready`}
                        {imageFiles.length > 0 && documentFile && <span className="text-neutral-500">|</span>}
                        {documentFile && `Document "${documentName}" ready`}
                      </>
                    )}
                  </span>
                </div>
                {!isUploadingImage && (imageFiles.length > 0 || documentFile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { removeImage(); removeDocument(); }}
                    className="text-xs text-neutral-400 hover:text-white"
                    data-testid="button-remove-all-attachments"
                  >
                    Clear all
                  </Button>
                )}
              </div>

              {imageFiles.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-2">
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
              )}

              {documentFile && (
                <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-neutral-300">{documentName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeDocument}
                    className="h-5 w-5 text-neutral-400 hover:text-red-400 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isUploadingImage || documentFile !== null} // Disable if document is attached
                          className={`h-9 w-9 rounded-full hover:bg-neutral-700 ${
                            imageFiles.length > 0 ? 'text-primary hover:text-primary' : 'text-neutral-400 hover:text-white'
                          } ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                          data-testid="button-image-options"
                        >
                          <ImagePlus className={`h-5 w-5 ${isUploadingImage ? 'animate-pulse' : ''}`} />
                        </Button>
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

              {/* Document upload button */}
              {!isSearchMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleDocumentClick}
                        disabled={isUploadingImage || imageFiles.length > 0} // Disable if images are attached
                        className={`h-9 w-9 rounded-full hover:bg-neutral-700 ${
                          documentFile ? 'text-primary hover:text-primary' : 'text-neutral-400 hover:text-white'
                        } ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                        data-testid="button-document-upload"
                      >
                        <FileText className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Attach Document</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex-1 relative">
              {(imageFiles.length > 0 || documentFile) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {imageFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1 text-sm">
                      <Image className="h-4 w-4" />
                      <span className="text-neutral-300">{imageNames[index]}</span>
                      <button
                        onClick={() => removeImage(index)}
                        className="text-neutral-400 hover:text-red-400 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {documentFile && (
                    <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1 text-sm">
                      <FileText className="h-4 w-4" />
                      <span className="text-neutral-300">{documentName}</span>
                      <button
                        onClick={removeDocument}
                        className="text-neutral-400 hover:text-red-400 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  isUploadingImage
                    ? "Processing attachments..."
                    : isSearchMode
                      ? "Search for realtime information..."
                      : imageFiles.length > 0
                        ? `Ask about ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}...`
                        : documentFile
                          ? `Ask about "${documentName}"...`
                          : "Ask Anything..."
                }
                className="min-h-[44px] max-h-[200px] py-3 px-3 bg-transparent border-none focus:outline-none focus:ring-0 resize-none text-white placeholder-neutral-500"
                disabled={isLoading || isUploadingImage}
              />
            </div>

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
                disabled={isUploadingImage || (!(isLoading || isTyping) && (!input.trim() && imageFiles.length === 0 && documentFile === null))}
                className={`h-9 w-9 rounded-full text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 ${
                  (isLoading || isTyping)
                    ? 'bg-muted-foreground hover:bg-muted-foreground/80 shadow-lg'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {(isLoading || isTyping) ? (
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