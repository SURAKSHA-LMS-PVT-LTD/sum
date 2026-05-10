import React from 'react';
import { useNavigate } from 'react-router-dom';
import InstituteRegistration from '@/components/InstituteRegistration';
import ProtectedRoute from '@/components/ProtectedRoute';

const RegisterInstitute: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ProtectedRoute>
      <InstituteRegistration
        onBack={() => navigate('/')}
        onComplete={() => {
          navigate('/', { replace: true });
        }}
      />
    </ProtectedRoute>
  );
};

export default RegisterInstitute;
