import React from 'react';
import { useNavigate } from 'react-router-dom';
import Registration from '@/components/Registration';

const CreateAccount: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Registration
      onBack={() => navigate('/')}
      onComplete={() => {
        navigate('/', { replace: true });
      }}
    />
  );
};

export default CreateAccount;
