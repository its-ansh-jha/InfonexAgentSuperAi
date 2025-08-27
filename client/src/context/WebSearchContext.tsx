import React, { createContext, useContext, useState, useEffect } from 'react';

interface WebSearchContextType {
  isWebSearchEnabled: boolean;
  toggleWebSearch: () => void;
}

const WebSearchContext = createContext<WebSearchContextType | undefined>(undefined);

export const useWebSearch = () => {
  const context = useContext(WebSearchContext);
  if (context === undefined) {
    throw new Error('useWebSearch must be used within a WebSearchProvider');
  }
  return context;
};

export const WebSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(() => {
    // Load from localStorage or default to true
    const saved = localStorage.getItem('webSearchEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    // Save to localStorage whenever the state changes
    localStorage.setItem('webSearchEnabled', JSON.stringify(isWebSearchEnabled));
  }, [isWebSearchEnabled]);

  const toggleWebSearch = () => {
    setIsWebSearchEnabled(prev => !prev);
  };

  return (
    <WebSearchContext.Provider value={{ isWebSearchEnabled, toggleWebSearch }}>
      {children}
    </WebSearchContext.Provider>
  );
};