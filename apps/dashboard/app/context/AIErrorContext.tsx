'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { StructuredAIError } from '@ion-ai/contracts';
import { AIErrorModal } from '../components/AIErrorModal';

interface AIErrorContextType {
  error: StructuredAIError | null;
  showAIErrorModal: (error: StructuredAIError, onAction?: (action: string) => void) => void;
  dismissErrorModal: () => void;
}

const AIErrorContext = createContext<AIErrorContextType>({
  error: null,
  showAIErrorModal: () => {},
  dismissErrorModal: () => {},
});

export const AIErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setError] = useState<StructuredAIError | null>(null);
  const [actionCallback, setActionCallback] = useState<((action: string) => void) | null>(null);

  const showAIErrorModal = (err: StructuredAIError, onAction?: (action: string) => void) => {
    setError(err);
    if (onAction) setActionCallback(() => onAction);
  };

  const dismissErrorModal = () => {
    setError(null);
    setActionCallback(null);
  };

  const handleAction = (actionType: string) => {
    if (actionCallback) {
      actionCallback(actionType);
    }
    if (actionType === 'NAVIGATE_TO_SETTINGS' || actionType === 'UPDATE_CUSTOM_KEY') {
      window.location.href = '/settings';
    }
    dismissErrorModal();
  };

  return (
    <AIErrorContext.Provider value={{ error, showAIErrorModal, dismissErrorModal }}>
      {children}
      {error && <AIErrorModal error={error} onClose={dismissErrorModal} onAction={handleAction} />}
    </AIErrorContext.Provider>
  );
};

export const useAIError = () => useContext(AIErrorContext);
