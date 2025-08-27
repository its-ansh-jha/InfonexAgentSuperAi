import React, { useState } from 'react';
import { Copy, Check, Download, Code, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';


interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Code copied",
      description: "Code snippet has been copied to clipboard",
      duration: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    // Create a blob with the code content
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-snippet${language ? `.${language}` : '.txt'}`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: "Code snippet is being downloaded",
      duration: 2000,
    });
  };

  const openInNewTab = () => {
    // Create a blob with the code content
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Open in new tab
    window.open(url, '_blank');
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="bg-neutral-900 dark:bg-neutral-950 rounded-md my-3 relative">
      {language && (
        <div className="flex justify-between items-center px-4 py-2 text-xs border-b border-neutral-800">
          <span className="text-neutral-400">{language}</span>
        </div>
      )}
      
      <pre className="p-4 overflow-x-auto">
        <code className="font-mono text-neutral-200 text-sm">{code}</code>
      </pre>
      
      <div className="border-t border-neutral-800 py-1 px-2 flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={copyToClipboard}
                className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Copy code</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={downloadCode}
                className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Download as file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={openInNewTab}
                className="h-8 w-8 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Open in new tab</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
