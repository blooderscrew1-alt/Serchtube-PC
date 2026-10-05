import React from 'react';

export interface GoogleHomeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  [key: string]: any;
}

export const GoogleHomeModal: React.FC<GoogleHomeModalProps> = () => {
  return null;
};

export default GoogleHomeModal;
