import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";
import { ChatHistoryProvider } from "@/context/ChatHistoryContext";
import { WebSearchProvider } from "@/context/WebSearchContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsConditions from "@/pages/TermsConditions";
import { handleRedirectResult } from "@/lib/firebase";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-conditions" component={TermsConditions} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Handle Firebase redirect on app load
  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        await handleRedirectResult();
      } catch (error) {
        console.error('Error handling auth redirect:', error);
      }
    };
    
    handleAuthRedirect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ChatHistoryProvider>
            <WebSearchProvider>
              <Toaster />
              <Router />
            </WebSearchProvider>
          </ChatHistoryProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
