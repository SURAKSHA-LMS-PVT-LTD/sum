// src/components/NotificationNavigator.tsx
// Renders nothing — just wires up push notification tap → auto navigate.
// Must be placed inside <BrowserRouter> so useNavigate() works.
import React from 'react';
import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';

const NotificationNavigator: React.FC = () => {
  useNotificationNavigation();
  return null;
};

export default NotificationNavigator;
