import React from 'react';
import { useNavigate } from 'react-router-dom';
import FirstLogin from '@/components/FirstLogin';
import { useAuth } from '@/contexts/AuthContext';

const ActivateAccount: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  return (
    <FirstLogin
      onBack={() => navigate('/')}
      onComplete={(user) => {
        navigate('/select-institute', { replace: true });
      }}
    />
  );
};

export default ActivateAccount;
