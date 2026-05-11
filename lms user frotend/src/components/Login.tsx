import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { type UserRole } from '@/contexts/AuthContext';
import { User, Eye, EyeOff, Building2, UserCircle, Users, CheckCircle2, Phone, School, Mail, KeyRound, Key, MonitorSmartphone, Wifi, WifiOff, Settings, RotateCcw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl, getBaseUrl2, instituteLogin, instituteLoginForce, initiateInstitutePasswordReset, verifyInstitutePasswordReset, getInstituteAvailableContacts, type InstituteAvailableContact } from '@/contexts/utils/auth.api';
import { getErrorMessage } from '@/api/apiError';
import { Capacitor } from '@capacitor/core';
// FirstLogin is now rendered via /activate/* routes
import { useTenant } from '@/contexts/TenantContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import surakshaLogo from '@/assets/suraksha-logo.png';
import loginIllustration from '@/assets/login-illustration.png';
import type { LoginCredentials } from '@/contexts/types/auth.types';

// Mock user credentials for different roles - ONLY available in development
const mockUsers = import.meta.env.DEV ? [{
  email: 'institute@cambridge.edu',
  password: 'institute123',
  role: 'InstituteAdmin' as UserRole,
  name: 'Cambridge Admin',
  institutes: [{
    id: '1',
    name: 'Cambridge International School',
    code: 'CIS001',
    description: 'Premier educational institution',
    isActive: true
  }]
}, {
  email: 'teacher@cambridge.edu',
  password: 'teacher123',
  role: 'Teacher' as UserRole,
  name: 'John Smith',
  institutes: [{
    id: '1',
    name: 'Cambridge International School',
    code: 'CIS001',
    description: 'Premier educational institution',
    isActive: true
  }, {
    id: '2',
    name: 'Oxford Academy',
    code: 'OXF002',
    description: 'Excellence in education',
    isActive: true
  }]
}, {
  email: 'marker@cambridge.edu',
  password: 'marker123',
  role: 'AttendanceMarker' as UserRole,
  name: 'Alice Johnson',
  institutes: [{
    id: '1',
    name: 'Cambridge International School',
    code: 'CIS001',
    description: 'Premier educational institution',
    isActive: true
  }, {
    id: '2',
    name: 'Oxford Academy',
    code: 'OXF002',
    description: 'Excellence in education',
    isActive: true
  }]
}, {
  email: 'student@cambridge.edu',
  password: 'student123',
  role: 'Student' as UserRole,
  name: 'Emma Wilson',
  institutes: [{
    id: '1',
    name: 'Cambridge International School',
    code: 'CIS001',
    description: 'Premier educational institution',
    isActive: true
  }, {
    id: '2',
    name: 'Oxford Academy',
    code: 'OXF002',
    description: 'Excellence in education',
    isActive: true
  }]
}, {
  email: 'parent@cambridge.edu',
  password: 'parent123',
  role: 'Parent' as UserRole,
  name: 'Michael Johnson',
  institutes: [{
    id: '1',
    name: 'Cambridge International School',
    code: 'CIS001',
    description: 'Premier educational institution',
    isActive: true
  }]
}, {
  email: 'orgmanager@company.com',
  password: 'orgmanager123',
  role: 'OrganizationManager' as UserRole,
  name: 'Organization Manager',
  institutes: [{
    id: 'org-1',
    name: 'Education Network International',
    code: 'ENI',
    description: 'Global education network',
    isActive: true
  }, {
    id: 'org-2',
    name: 'Academic Solutions Group',
    code: 'ASG',
    description: 'Educational technology solutions',
    isActive: true
  }, {
    id: 'org-3',
    name: 'Learning Excellence Corp',
    code: 'LEC',
    description: 'Excellence in learning management',
    isActive: true
  }]
}] : [];
interface LoginProps {
  onLogin: (user: any) => void;
  loginFunction: (credentials: LoginCredentials) => Promise<void>;
}
type LoginStep = 'login' | 'first-login-email' | 'first-login-otp' | 'first-login-password' | 'forgot-password' | 'reset-password' | 'institute-login' | 'institute-forgot' | 'institute-select-contact' | 'institute-reset' | 'institute-device-limit';
const Login = ({
  onLogin,
  loginFunction
}: LoginProps) => {
  const loginNavigate = useNavigate();
  const { isTenantLogin, subdomain, customDomain, loginMethod, branding, isLoading: tenantLoading, error: tenantError } = useTenant();

  // Resolved branding values (tenant overrides → defaults)
  const displayLogo = branding?.loginLogoUrl ? getImageUrl(branding.loginLogoUrl) : branding?.logoUrl ? getImageUrl(branding.logoUrl) : surakshaLogo;
  const displayIllustration = branding?.loginIllustrationUrl ? getImageUrl(branding.loginIllustrationUrl) : branding?.loginBackgroundUrl ? getImageUrl(branding.loginBackgroundUrl) : loginIllustration;
  const displayAppName = branding?.customAppName || (isTenantLogin && branding?.name) || 'SurakshaLMS';
  const displayWelcome = branding?.loginWelcomeTitle || 'Welcome back';
  const displaySubtitle = branding?.loginWelcomeSubtitle || 'Please enter your details';
  const showPoweredBy = isTenantLogin && (branding?.poweredByVisible !== false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  // On mobile app, always enable rememberMe for persistent login
  const [rememberMe, setRememberMe] = useState(Capacitor.isNativePlatform());
  const [baseUrl, setBaseUrl] = useState(() => {
    const stored = getBaseUrl();
    return stored || 'https://your-backend-url.com';
  });
  const [selectedRole, setSelectedRole] = useState<UserRole>('Student');
  const [showPassword, setShowPassword] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useApiLogin, setUseApiLogin] = useState(true);
  const [showFirstLogin, setShowFirstLogin] = useState(false);
  const [showFirstLoginV2, setShowFirstLoginV2] = useState(false);

  // First login and forgot password states
  // 🏢 Multi-tenant: always start at 'login', then switch to 'institute-login' AFTER branding is confirmed valid
  const [loginStep, setLoginStep] = useState<LoginStep>('login');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [attendanceUrl, setAttendanceUrl] = useState(() => {
    const stored = getBaseUrl2();
    return stored || getBaseUrl() || 'https://your-attendance-backend-url.com';
  });

  // Institute login states
  const [instituteId, setInstituteId] = useState('');
  const [instituteUserId, setInstituteUserId] = useState('');
  const [instituteResetSentTo, setInstituteResetSentTo] = useState('');
  // Contact picker state
  const [availableContacts, setAvailableContacts] = useState<InstituteAvailableContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  
  // Device limit state
  const [deviceLimitInfo, setDeviceLimitInfo] = useState<any>(null);

  const {
    toast
  } = useToast();

  // Store URL changes immediately to localStorage
  const handleBaseUrlChange = (newUrl: string) => {
    setBaseUrl(newUrl);
    if (newUrl.startsWith('http')) {
      localStorage.setItem('baseUrl', newUrl);
    }
  };
  const handleAttendanceUrlChange = (newUrl: string) => {
    setAttendanceUrl(newUrl);
    if (newUrl.startsWith('http')) {
      localStorage.setItem('attendanceUrl', newUrl);
    }
  };
  const getCurrentAttendanceUrl = () => {
    return localStorage.getItem('attendanceUrl') || attendanceUrl;
  };
  const getApiHeaders = () => ({
    'Content-Type': 'application/json'
  });

  // OTP Timer function
  const startOtpTimer = () => {
    setOtpTimer(60);
  };
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  // 🏢 Multi-tenant: Once tenant branding is confirmed valid (loading done, no error),
  // switch the login step to institute-login mode. This prevents the 'institute-login'
  // step from showing before we know the subdomain is actually valid.
  useEffect(() => {
    if (isTenantLogin && !tenantLoading && !tenantError) {
      setLoginStep('institute-login');
    }
  }, [isTenantLogin, tenantLoading, tenantError]);

  // Mock login handler
  const handleMockLogin = async (email: string, password: string, role: UserRole) => {
    const user = mockUsers.find((u) => u.email === email && u.password === password && u.role === role);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    return user;
  };

  // Test connection function
  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: getApiHeaders()
      });
      if (response.ok) {
        toast({
          title: "Connection Successful",
          description: "Backend is reachable"
        });
      } else {
        throw new Error(`Backend returned status: ${response.status}`);
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: getErrorMessage(error, 'Cannot reach backend'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user requires first login
  const checkFirstLoginStatus = async (email: string) => {
    try {
      const response = await fetch(`${baseUrl}/auth/status?email=${email}`, {
        headers: getApiHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        return data.requiresFirstLogin || false;
      }
    } catch {
      // proceed with regular login
    }
    return false;
  };

  // New First Login API Functions
  const initiateFirstLoginAPI = async (identifierValue: string) => {
    try {
      const response = await fetch(`${baseUrl}/auth/initiate`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier: identifierValue
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "OTP Sent",
          description: "Please check your registered email for the verification code."
        });
        setLoginStep('first-login-otp');
        startOtpTimer();
        return true;
      } else {
        throw new Error(data.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to send OTP'));
      return false;
    }
  };
  const verifyFirstLoginOTP = async (identifierValue: string, otpCode: string) => {
    try {
      const response = await fetch(`${baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier: identifierValue,
          otp: otpCode
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setVerificationToken(data.verificationToken);
        setLoginStep('first-login-password');
        toast({
          title: "OTP Verified",
          description: "Please set your new password."
        });
        return true;
      } else {
        throw new Error(data.message || 'Invalid OTP');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'OTP verification failed'));
      return false;
    }
  };
  const setFirstLoginPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)');
      return false;
    }
    try {
      const response = await fetch(`${baseUrl}/auth/set-password`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier,
          verificationToken,
          password: newPassword,
          confirmPassword,
          phoneNumber: phoneNumber || undefined
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Password Set Successfully",
          description: "You can now login with your credentials."
        });

        // Reset to login step and clear form
        setLoginStep(isTenantLogin ? 'institute-login' : 'login');
        setPassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
        setVerificationToken('');
        setOtp('');
        setPhoneNumber('');
        return true;
      } else {
        throw new Error(data.message || 'Failed to set password');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to set password'));
      return false;
    }
  };
  const resendFirstLoginOTP = async () => {
    try {
      const response = await fetch(`${baseUrl}/auth/resend-otp`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "OTP Resent",
          description: "Please check your registered email for the new verification code."
        });
        setOtp('');
        startOtpTimer();
        return true;
      } else {
        throw new Error(data.message || 'Failed to resend OTP');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to resend OTP'));
      return false;
    }
  };

  // Forgot password functions
  const startForgotPassword = () => {
    setLoginStep('forgot-password');
    setError('');
    setOtp('');
    setVerificationToken('');
    setNewPassword('');
    setConfirmPassword('');
  };
  const initiateForgotPassword = async (identifierValue: string) => {
    try {
      const response = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier: identifierValue
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Reset Code Sent",
          description: data.message || `Password reset code sent to your registered email. Expires in ${data.data?.expiresInMinutes || 15} minutes.`
        });
        setLoginStep('reset-password');
        startOtpTimer();
        return true;
      } else {
        throw new Error(data.message || 'Failed to send reset code');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to send reset code'));
      return false;
    }
  };
  const resetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)');
      return false;
    }
    try {
      const response = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier,
          otp,
          newPassword,
          confirmPassword
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Password Reset Successfully",
          description: data.message || "You can now login with your new password."
        });

        // Reset to login step and clear form
        setLoginStep(isTenantLogin ? 'institute-login' : 'login');
        setPassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
        setVerificationToken('');
        setOtp('');
        return true;
      } else {
        throw new Error(data.message || 'Failed to reset password');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to reset password'));
      return false;
    }
  };
  const resendForgotPasswordOtp = async () => {
    try {
      const response = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          identifier
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Reset Code Resent",
          description: "Please check your registered email for the new reset code."
        });
        setOtp('');
        startOtpTimer();
        return true;
      } else {
        throw new Error(data.message || 'Failed to resend reset code');
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to resend reset code'));
      return false;
    }
  };
  const handleForgotPasswordFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (loginStep === 'forgot-password') {
        await initiateForgotPassword(identifier);
      } else if (loginStep === 'reset-password') {
        const success = await resetPassword();
        if (success) {
          toast({
            title: "Success!",
            description: "Your password has been reset successfully. Please login now."
          });
        }
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Process failed'));
    } finally {
      setIsLoading(false);
    }
  };
  const handleQuickLogin = (role: UserRole) => {
    const user = mockUsers.find((u) => u.role === role);
    if (user) {
      setIdentifier(user.email);
      setPassword(user.password);
      setSelectedRole(role);
    }
  };
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate base URL is configured for API login
    if (useApiLogin && !baseUrl.startsWith('http')) {
      setError('Please enter a valid Backend URL (starting with http:// or https://) in the settings above before attempting login.');
      setIsLoading(false);
      return;
    }
    try {
      if (useApiLogin) {
        // Use the passed login function from AuthContext
        await loginFunction({
          identifier,
          password,
          rememberMe,
          ...(subdomain && { subdomain, loginMethod: 'SUBDOMAIN' as const }),
          ...(customDomain && { customDomain, loginMethod: 'CUSTOM_DOMAIN' as const }),
        });
        toast({
          title: "Success",
          description: "Logged in successfully"
        });
      } else {
        // Handle mock login - use identifier as email for mock login
        const user = await handleMockLogin(identifier, password, selectedRole);
        toast({
          title: "Success",
          description: `Logged in successfully as ${user.role}`
        });
        onLogin(user);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      toast({
        title: "Error",
        description: `Login failed: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============ INSTITUTE LOGIN HANDLERS ============
  const handleInstituteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await instituteLogin({
        instituteId: isTenantLogin && branding ? branding.id : instituteId,
        userIdByInstitute: instituteUserId,
        password,
        rememberMe,
      });

      if (result.deviceLimitReached) {
        setDeviceLimitInfo(result);
        setLoginStep('institute-device-limit');
        setIsLoading(false);
        return;
      }

      toast({ title: 'Success', description: `Logged in to ${result.user.instituteName}` });
      onLogin({
        id: result.user.userId,
        name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() || result.user.userIdByInstitute,
        email: '',
        role: result.user.instituteUserType,
        imageUrl: result.user.imageUrl,
        institutes: [{ id: result.user.instituteId, name: result.user.instituteName }],
      });
    } catch (error: any) {
      if (error?.errorCode === 'INSTITUTE_PASSWORD_NOT_SET') {
        setError('You have not set an institute password yet. Please log in to the main SurakshLMS app, go to Profile → Security → "Activate Institute Access" to set one.');
      } else {
        setError(error instanceof Error ? error.message : 'Institute login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstituteLoginForce = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await instituteLoginForce({
        instituteId: isTenantLogin && branding ? branding.id : instituteId,
        userIdByInstitute: instituteUserId,
        password,
        rememberMe,
      });

      toast({ title: 'Success', description: `Session replaced. Logged in to ${result.user.instituteName}` });
      onLogin({
        id: result.user.userId,
        name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() || result.user.userIdByInstitute,
        email: '',
        role: result.user.instituteUserType,
        imageUrl: result.user.imageUrl,
        institutes: [{ id: result.user.instituteId, name: result.user.instituteName }],
      });
    } catch (error: any) {
      setError(error instanceof Error ? error.message : 'Forced login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstitutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (loginStep === 'institute-forgot') {
        // Step 1: load available contacts
        const resolvedId = isTenantLogin && branding ? branding.id : instituteId;
        const result = await getInstituteAvailableContacts({
          instituteId: resolvedId,
          userIdByInstitute: instituteUserId,
        });
        setAvailableContacts(result.contacts);
        setSelectedContactId(result.contacts[0]?.id || '');
        setLoginStep('institute-select-contact');
      } else if (loginStep === 'institute-select-contact') {
        // Step 2: send OTP to selected contact
        if (!selectedContactId) { setError('Please select a contact option.'); setIsLoading(false); return; }
        const resolvedId = isTenantLogin && branding ? branding.id : instituteId;
        const result = await initiateInstitutePasswordReset({
          instituteId: resolvedId,
          userIdByInstitute: instituteUserId,
          selectedContactId,
        });
        setInstituteResetSentTo(result.sentTo);
        setLoginStep('institute-reset');
        toast({ title: 'OTP Sent', description: `Code sent to ${result.sentTo}${result.isParentContact ? ' (parent contact)' : ''}` });
      } else if (loginStep === 'institute-reset') {
        if (newPassword !== confirmPassword) { setError('Passwords do not match'); setIsLoading(false); return; }
        await verifyInstitutePasswordReset({
          instituteId: isTenantLogin && branding ? branding.id : instituteId,
          userIdByInstitute: instituteUserId,
          otpCode: otp,
          newPassword,
        });
        toast({ title: 'Success', description: 'Password reset successfully. You can now login.' });
        setLoginStep('institute-login');
        setOtp(''); setNewPassword(''); setConfirmPassword('');
      }
    } catch (error: any) {
      setError(error instanceof Error ? error.message : 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstLoginAPIFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (loginStep === 'first-login-email') {
        await initiateFirstLoginAPI(identifier);
      } else if (loginStep === 'first-login-otp') {
        await verifyFirstLoginOTP(identifier, otp);
      } else if (loginStep === 'first-login-password') {
        const success = await setFirstLoginPassword();
        if (success) {
          toast({
            title: "Welcome!",
            description: "Your account has been set up successfully. Please login now."
          });
        }
      }
    } catch (error: any) {
      setError(getErrorMessage(error, 'Process failed'));
    } finally {
      setIsLoading(false);
    }
  };
  const resetToLogin = () => {
    setLoginStep(isTenantLogin ? 'institute-login' : 'login');
    setError('');
    setOtp('');
    setVerificationToken('');
    setNewPassword('');
    setConfirmPassword('');
    setPhoneNumber('');
    setShowFirstLogin(false);
    setAvailableContacts([]);
    setSelectedContactId('');
  };
  const startFirstLogin = () => {
    setLoginStep('first-login-email');
    setError('');
    setOtp('');
    setVerificationToken('');
    setNewPassword('');
    setConfirmPassword('');
    setShowFirstLogin(true);
  };

  // Track keyboard visibility: with adjustResize the window shrinks when keyboard opens
  const [origHeight] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 812
  );
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  React.useEffect(() => {
    const onResize = () => setKeyboardVisible(window.innerHeight < origHeight - 150);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [origHeight]);

  const scrollInputIntoView = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    }
  };

  return <div className="min-h-[100dvh] flex flex-col md:flex-row overflow-x-hidden bg-background md:bg-none">
      {/* Top Illustration - Mobile Only: hidden when keyboard is open or tenant is loading */}
      {!(isTenantLogin && tenantLoading) && (
        <div className={`block md:hidden w-full relative h-[45vw] max-h-[40vh] shrink-0 overflow-hidden transition-all duration-200${keyboardVisible ? ' hidden' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
          <img src={displayIllustration} alt="Education illustration" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }} />
        </div>
      )}

      {/* Left Side - Form */}
      <div className="w-full md:w-3/5 lg:w-1/2 flex flex-col items-center justify-center px-5 py-7 sm:p-7 md:p-10 bg-background -mt-8 md:mt-0 rounded-t-[3rem] md:rounded-none relative z-10 flex-1 md:min-h-screen overflow-y-auto" onFocusCapture={scrollInputIntoView}>
        <div className="w-full max-w-md md:max-w-lg space-y-6 md:space-y-7">
          {/* Logo and Header — hidden while tenant branding is loading to avoid default flash */}
          {!(isTenantLogin && tenantLoading) && (
            <div className="text-center space-y-1">
              <div className="flex justify-center mb-2 md:mb-4">
                <div className="w-12 h-12 md:w-20 md:h-20 rounded-lg overflow-hidden">
                  <img src={displayLogo} alt={`${displayAppName} logo`} className="w-full h-full object-contain" loading="lazy" />
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{displayAppName}</h1>
              <p className="text-base md:text-lg font-normal text-foreground">{displayWelcome}</p>
              <p className="text-sm md:text-sm text-muted-foreground">{displaySubtitle}</p>
              {loginMethod === 'CUSTOM_DOMAIN' && branding?.subdomain && (
                <a
                  href={`https://${branding.subdomain}.suraksha.lk`}
                  className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <span>Also accessible via</span>
                  <span className="font-medium text-primary underline underline-offset-2">{branding.subdomain}.suraksha.lk</span>
                </a>
              )}
            </div>
          )}

          {/* Main Login/First Login/Forgot Password Card */}
          <Card className="border-border/50 shadow-md lg:shadow-lg">
            <CardContent className="p-5 md:p-8 lg:p-10">
            {tenantLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading institute...</p>
              </div>
            ) : tenantError ? (
              <div className="text-center space-y-4 py-8">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <WifiOff className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Institute Not Found</h3>
                <p className="text-sm text-muted-foreground">{tenantError}</p>
                <Button onClick={() => window.location.href = 'https://' + window.location.host.replace(/^[^.]+\./, '')} variant="outline" className="mt-4 w-full h-11 text-sm md:text-base">
                  Go to Main Portal
                </Button>
              </div>
            ) : (
              <>
                {loginStep === 'institute-device-limit' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                    <MonitorSmartphone className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Device Limit Reached</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You have reached the maximum number of allowed devices ({deviceLimitInfo?.maxDevices}) for this institute.
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    To sign in on this device, we need to sign out your oldest active session:
                  </p>
                  {deviceLimitInfo?.activeSessions?.slice(-1).map((session: any) => (
                    <div key={session.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-md">
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <MonitorSmartphone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {session.deviceLabel || 'Unknown Device'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last active: {new Date(session.lastActiveAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={handleInstituteLoginForce}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      'Sign Out Oldest Device & Continue'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setLoginStep('institute-login');
                      setDeviceLimitInfo(null);
                      setPassword('');
                    }}
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

                {/* Regular Login Form */}
                {loginStep === 'login' && <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
                {/* Role Selection - Only show for mock login */}
                {!useApiLogin && <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-sm">Role</Label>
                    <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
                      <SelectTrigger className="h-10 md:h-11">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="InstituteAdmin">Institute Administrator</SelectItem>
                        <SelectItem value="Teacher">Teacher</SelectItem>
                        <SelectItem value="AttendanceMarker">Attendance Marker</SelectItem>
                        <SelectItem value="Student">Student</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="OrganizationManager">Organization Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>}

                {/* Identifier Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="identifier" className="text-sm text-foreground">Email, Phone, ID or Birth Certificate</Label>
                  <Input id="identifier" type="text" placeholder="Enter email, phone, ID..." value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="h-11 md:h-11 text-sm md:text-base rounded-lg" autoComplete="username" autoCapitalize="none" autoCorrect="off" />
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm text-foreground">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 md:h-11 text-sm md:text-base pr-12 rounded-lg" autoComplete="current-password" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent touch-manipulation" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                {/* Remember me and Forgot Password */}
                {useApiLogin && <div className="flex items-center justify-between gap-2">
                  {/* Only show Remember Me checkbox on web, mobile always remembers */}
                  {!Capacitor.isNativePlatform() && <div className="flex items-center space-x-2">
                    <input
                    type="checkbox"
                    id="remember"
                    className="rounded border-border w-4 h-4 accent-primary"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)} />
                  
                    <label htmlFor="remember" className="text-xs md:text-sm text-foreground cursor-pointer select-none">
                      Remember me
                    </label>
                  </div>}
                  <Button type="button" variant="link" onClick={startForgotPassword} className="text-xs md:text-sm text-primary hover:text-primary/80 p-0 h-auto font-medium">
                    Forgot password?
                  </Button>
                </div>}

                {/* Error Message */}
                {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 md:p-3 rounded-lg">
                    {error}
                  </div>}

                {/* Login Button */}
                <Button type="submit" className="w-full h-11 md:h-12 text-sm md:text-base font-semibold touch-manipulation active:scale-[0.98] transition-transform rounded-lg" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>

                {/* First Time Login Link */}
                {useApiLogin && <div className="text-center pt-2 space-y-1.5">
                    <div>
                      <span className="text-xs md:text-sm text-muted-foreground">Registered by another one? </span>
                      <Button type="button" variant="link" onClick={() => loginNavigate('/activate/identify')} className="text-xs md:text-sm text-primary hover:text-primary/80 p-0 h-auto font-medium">
                        Activate your account
                      </Button>
                    </div>
                    <div>
                      <span className="text-xs md:text-sm text-muted-foreground">New here? </span>
                      <Button type="button" variant="link" onClick={() => loginNavigate('/register/step1')} className="text-xs md:text-sm text-primary hover:text-primary/80 p-0 h-auto font-medium">
                        Create Account
                      </Button>
                    </div>
                  </div>}
              </form>}

            {/* Institute Login Form */}
            {loginStep === 'institute-login' && <form onSubmit={handleInstituteLogin} className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Institute Login</h3>
                </div>

                {!isTenantLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="instituteId" className="text-sm">Institute ID</Label>
                    <Input id="instituteId" type="text" placeholder="Enter institute ID" value={instituteId} onChange={(e) => setInstituteId(e.target.value)} required={!isTenantLogin} className="h-11 text-sm rounded-lg" autoComplete="off" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="instituteUserId" className="text-sm">Your Institute User ID</Label>
                  <Input id="instituteUserId" type="text" placeholder="e.g., STU2024001" value={instituteUserId} onChange={(e) => setInstituteUserId(e.target.value)} required className="h-11 text-sm rounded-lg" autoComplete="username" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="instPassword" className="text-sm">Password</Label>
                  <div className="relative">
                    <Input id="instPassword" type={showPassword ? 'text' : 'password'} placeholder="Enter your institute password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 text-sm pr-12 rounded-lg" autoComplete="current-password" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {!Capacitor.isNativePlatform() && <div className="flex items-center space-x-2">
                    <input type="checkbox" id="instRemember" className="rounded border-border w-4 h-4 accent-primary" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    <label htmlFor="instRemember" className="text-xs md:text-sm text-foreground cursor-pointer select-none">Remember me</label>
                  </div>}
                  <Button type="button" variant="link" onClick={() => { setLoginStep('institute-forgot'); setError(''); }} className="text-xs md:text-sm text-primary p-0 h-auto font-medium">
                    Forgot password?
                  </Button>
                </div>

                {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

                <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>

                {!isTenantLogin && (
                  <Button type="button" variant="ghost" onClick={() => { setLoginStep('login'); setError(''); }} className="w-full h-9 text-sm">
                    Back to regular login
                  </Button>
                )}
              </form>}

            {/* Institute Forgot Password — Step 1: enter user ID */}
            {loginStep === 'institute-forgot' && <form onSubmit={handleInstitutePasswordReset} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Reset Institute Password</h3>
                </div>

                <p className="text-xs text-muted-foreground">Enter your institute user ID to see available contact options for OTP delivery.</p>

                {!isTenantLogin && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Institute ID</Label>
                    <Input type="text" placeholder="Enter institute ID" value={instituteId} onChange={(e) => setInstituteId(e.target.value)} required={!isTenantLogin} className="h-10 text-sm rounded-lg" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-sm">Your Institute User ID</Label>
                  <Input type="text" placeholder="e.g., STU2024001" value={instituteUserId} onChange={(e) => setInstituteUserId(e.target.value)} required className="h-10 text-sm rounded-lg" />
                </div>

                {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

                <Button type="submit" className="w-full h-10 text-sm font-semibold rounded-lg" disabled={isLoading}>
                  {isLoading ? 'Loading contacts...' : 'Continue'}
                </Button>

                <Button type="button" variant="ghost" onClick={() => { setLoginStep('institute-login'); setError(''); }} className="w-full h-9 text-sm">
                  Back to Institute Login
                </Button>
              </form>}

            {/* Institute Contact Picker — Step 2: choose where to receive OTP */}
            {loginStep === 'institute-select-contact' && <form onSubmit={handleInstitutePasswordReset} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Choose OTP Destination</h3>
                </div>

                <p className="text-xs text-muted-foreground">Select where we should send your one-time password. Phone numbers show last 2 digits only for privacy.</p>

                {availableContacts.length === 0 && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">No contact information found. Please contact your institute administrator.</div>
                )}

                <div className="space-y-2">
                  {availableContacts.map((c) => (
                    <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedContactId === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                      <input type="radio" name="contact" value={c.id} checked={selectedContactId === c.id} onChange={() => setSelectedContactId(c.id)} className="accent-primary w-4 h-4" />
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.masked}</p>
                      </div>
                      <span className="ml-auto text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground">{c.type === 'EMAIL' ? 'Email' : 'SMS'}</span>
                    </label>
                  ))}
                </div>

                {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

                <Button type="submit" className="w-full h-10 text-sm font-semibold rounded-lg" disabled={isLoading || !selectedContactId || availableContacts.length === 0}>
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </Button>

                <Button type="button" variant="ghost" onClick={() => { setLoginStep('institute-forgot'); setError(''); }} className="w-full h-9 text-sm">
                  Back
                </Button>
              </form>}

            {/* Institute Reset Password (OTP + New Password) */}
            {loginStep === 'institute-reset' && <form onSubmit={handleInstitutePasswordReset} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Enter OTP & New Password</h3>
                </div>

                <div className="text-xs text-muted-foreground bg-primary/10 p-2.5 rounded-lg">
                  OTP sent to {instituteResetSentTo}
                </div>

                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} className="gap-1.5">
                    <InputOTPGroup className="gap-1.5">
                      <InputOTPSlot index={0} className="w-10 h-12 text-lg" />
                      <InputOTPSlot index={1} className="w-10 h-12 text-lg" />
                      <InputOTPSlot index={2} className="w-10 h-12 text-lg" />
                      <InputOTPSlot index={3} className="w-10 h-12 text-lg" />
                      <InputOTPSlot index={4} className="w-10 h-12 text-lg" />
                      <InputOTPSlot index={5} className="w-10 h-12 text-lg" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">New Password</Label>
                  <div className="relative">
                    <Input type={showNewPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="h-10 text-sm pr-12 rounded-lg" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Confirm Password</Label>
                  <div className="relative">
                    <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="h-10 text-sm pr-12 rounded-lg" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

                <Button type="submit" className="w-full h-10 text-sm font-semibold rounded-lg" disabled={isLoading || otp.length < 6}>
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>

                <Button type="button" variant="ghost" onClick={() => { setLoginStep('institute-forgot'); setError(''); setOtp(''); }} className="w-full h-9 text-sm">
                  Back
                </Button>
              </form>}

            {/* First Login Email Form */}
            {loginStep === 'first-login-email' && <form onSubmit={handleFirstLoginAPIFlow} className="space-y-3 md:space-y-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstLoginIdentifier" className="text-sm">Email, Phone, ID or Birth Certificate</Label>
                    <Input id="firstLoginIdentifier" type="text" placeholder="Enter email, phone, ID..." value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="h-10 md:h-11 text-base" autoComplete="username" autoCapitalize="none" />
                  </div>

                  <div className="text-xs md:text-sm text-muted-foreground bg-primary/10 p-2.5 md:p-3 rounded-lg">
                    We'll send a 6-digit verification code to your registered email address.
                  </div>

                  {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 rounded-md">
                      {error}
                    </div>}

                  <Button type="submit" className="w-full h-10 md:h-11 text-base touch-manipulation" disabled={isLoading}>
                    {isLoading ? 'Sending Code...' : 'Send Verification Code'}
                  </Button>

                  <Button type="button" variant="ghost" onClick={resetToLogin} className="w-full h-9 md:h-10 touch-manipulation">
                    Back to Login
                  </Button>
                </div>
              </form>}

            {/* First Login OTP Verification */}
            {loginStep === 'first-login-otp' && <form onSubmit={handleFirstLoginAPIFlow} className="space-y-3 md:space-y-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="text-center">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      We sent a 6-digit code to your registered email address
                    </p>
                  </div>
                  
                  <div className="flex justify-center py-2">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp} className="gap-1.5 md:gap-2">
                      <InputOTPGroup className="gap-1.5 md:gap-2">
                        <InputOTPSlot index={0} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                        <InputOTPSlot index={1} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                        <InputOTPSlot index={2} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                        <InputOTPSlot index={3} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                        <InputOTPSlot index={4} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                        <InputOTPSlot index={5} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 rounded-md text-center">
                      {error}
                    </div>}

                  <Button type="submit" className="w-full h-10 md:h-11 text-base touch-manipulation" disabled={isLoading || otp.length !== 6}>
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </Button>

                  <div className="text-center">
                    {otpTimer > 0 ? <p className="text-xs md:text-sm text-muted-foreground">
                        Resend code in {otpTimer}s
                      </p> : <Button type="button" variant="ghost" onClick={resendFirstLoginOTP} disabled={isLoading} className="h-9 touch-manipulation">
                        Resend Code
                      </Button>}
                  </div>

                  <Button type="button" variant="ghost" onClick={resetToLogin} className="w-full h-9 md:h-10 touch-manipulation">
                    Back to Login
                  </Button>
                </div>
              </form>}

            {/* First Login Password Setup */}
            {loginStep === 'first-login-password' && <form onSubmit={handleFirstLoginAPIFlow} className="space-y-3 md:space-y-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="newFirstPassword" className="text-sm">New Password</Label>
                    <div className="relative">
                      <Input id="newFirstPassword" type={showNewPassword ? 'text' : 'password'} placeholder="Enter your new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="h-10 md:h-11 text-base pr-12" autoComplete="new-password" />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent touch-manipulation" onClick={() => setShowNewPassword(!showNewPassword)}>
                        {showNewPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmFirstPassword" className="text-sm">Confirm Password</Label>
                    <div className="relative">
                      <Input id="confirmFirstPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-10 md:h-11 text-base pr-12" autoComplete="new-password" />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent touch-manipulation" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="text-[10px] md:text-xs text-muted-foreground space-y-0.5 bg-muted/50 p-2 rounded-md">
                    <p className="font-medium">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>8+ chars, uppercase, lowercase, number, special (@$!%*?&)</li>
                    </ul>
                  </div>

                  {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 rounded-md">
                      {error}
                    </div>}

                  <Button type="submit" className="w-full h-10 md:h-11 text-base touch-manipulation" disabled={isLoading || !newPassword || !confirmPassword}>
                    {isLoading ? 'Setting Password...' : 'Set Password'}
                  </Button>

                  <Button type="button" variant="ghost" onClick={resetToLogin} className="w-full h-9 md:h-10 touch-manipulation">
                    Back to Login
                  </Button>
                </div>
              </form>}

            {/* Forgot Password Form */}
            {loginStep === 'forgot-password' && <form onSubmit={handleForgotPasswordFlow} className="space-y-3 md:space-y-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="resetIdentifier" className="text-sm">Email, Phone, ID or Birth Certificate</Label>
                    <Input id="resetIdentifier" type="text" placeholder="Enter email, phone, ID..." value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="h-10 md:h-11 text-base" autoComplete="username" autoCapitalize="none" />
                  </div>

                  <div className="text-xs md:text-sm text-muted-foreground bg-primary/10 p-2.5 md:p-3 rounded-lg">
                    We'll send a 6-digit reset code to your registered email.
                  </div>

                  {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 rounded-md">
                      {error}
                    </div>}

                  <Button type="submit" className="w-full h-10 md:h-11 text-base touch-manipulation" disabled={isLoading}>
                    {isLoading ? 'Sending Reset Code...' : 'Send Reset Code'}
                  </Button>

                  <Button type="button" variant="ghost" onClick={resetToLogin} className="w-full h-9 md:h-10 touch-manipulation">
                    Back to Login
                  </Button>
                </div>
              </form>}

            {/* Reset Password Form */}
            {loginStep === 'reset-password' && <form onSubmit={handleForgotPasswordFlow} className="space-y-3 md:space-y-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="text-center">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      We sent a 6-digit reset code to your registered email
                    </p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="resetOtp" className="text-sm">Reset Code (OTP)</Label>
                    <div className="flex justify-center py-2">
                      <InputOTP maxLength={6} value={otp} onChange={setOtp} className="gap-1.5 md:gap-2">
                        <InputOTPGroup className="gap-1.5 md:gap-2">
                          <InputOTPSlot index={0} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                          <InputOTPSlot index={1} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                          <InputOTPSlot index={2} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                          <InputOTPSlot index={3} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                          <InputOTPSlot index={4} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                          <InputOTPSlot index={5} className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newResetPassword" className="text-sm">New Password</Label>
                    <div className="relative">
                      <Input id="newResetPassword" type={showNewPassword ? 'text' : 'password'} placeholder="Enter your new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="h-10 md:h-11 text-base pr-12" autoComplete="new-password" />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent touch-manipulation" onClick={() => setShowNewPassword(!showNewPassword)}>
                        {showNewPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmResetPassword" className="text-sm">Confirm Password</Label>
                    <div className="relative">
                      <Input id="confirmResetPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-10 md:h-11 text-base pr-12" autoComplete="new-password" />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent touch-manipulation" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="text-[10px] md:text-xs text-muted-foreground space-y-0.5 bg-muted/50 p-2 rounded-md">
                    <p className="font-medium">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>8+ chars, uppercase, lowercase, number, special (@$!%*?&)</li>
                    </ul>
                  </div>

                  {error && <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-2.5 rounded-md">
                      {error}
                    </div>}

                  <Button type="submit" className="w-full h-10 md:h-11 text-base touch-manipulation" disabled={isLoading || otp.length !== 6 || !newPassword || !confirmPassword}>
                    {isLoading ? 'Resetting Password...' : 'Reset Password'}
                  </Button>

                  <div className="text-center">
                    {otpTimer > 0 ? <p className="text-xs md:text-sm text-muted-foreground">
                        Resend code in {otpTimer}s
                      </p> : <Button type="button" variant="ghost" onClick={resendForgotPasswordOtp} disabled={isLoading} className="text-xs md:text-sm h-9 touch-manipulation">
                        Resend Reset Code
                      </Button>}
                  </div>

                  <Button type="button" variant="ghost" onClick={resetToLogin} className="w-full h-9 md:h-10 touch-manipulation">
                    Back to Login
                  </Button>
                </div>
              </form>}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Login Options - Only show for mock login */}
        {!useApiLogin && <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Login (Demo)</CardTitle>
              <CardDescription className="text-xs">Click to auto-fill credentials for testing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleQuickLogin('InstituteAdmin')} className="text-xs">
                  Institute Admin
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickLogin('Teacher')} className="text-xs">
                  Teacher
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickLogin('AttendanceMarker')} className="text-xs">
                  Att. Marker
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickLogin('Student')} className="text-xs">
                  Student
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickLogin('Parent')} className="text-xs">
                  Parent
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickLogin('OrganizationManager')} className="text-xs">
                  Org Manager
                </Button>
              </div>
            </CardContent>
          </Card>}

        {/* API Demo Credentials */}
        {useApiLogin}

        {/* Demo Credentials - Only show for mock login */}
        {!useApiLogin && <Card className="text-xs border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Demo Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <div><strong>Institute Admin:</strong> institute@cambridge.edu / institute123</div>
              <div><strong>Teacher:</strong> teacher@cambridge.edu / teacher123</div>
              <div><strong>Attendance Marker:</strong> marker@cambridge.edu / marker123</div>
              <div><strong>Student:</strong> student@cambridge.edu / student123</div>
              <div><strong>Parent:</strong> parent@cambridge.edu / parent123</div>
              <div><strong>Organization Manager:</strong> orgmanager@company.com / orgmanager123</div>
            </CardContent>
          </Card>}
          
          {/* Mobile/Left column Powered by SurakshaLMS */}
          {showPoweredBy && (
            <div className="md:hidden text-center m-6 text-xs text-muted-foreground font-medium">
              Powered by SurakshaLMS
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Illustration */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative min-h-[300px] md:min-h-screen">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
        {branding?.loginBackgroundType === 'VIDEO' && branding?.loginBackgroundUrl ? (
          <video
            autoPlay muted loop playsInline
            poster={branding.loginVideoPosterUrl ? getImageUrl(branding.loginVideoPosterUrl) : undefined}
            className="absolute inset-0 w-full h-full object-cover mix-blend-multiply"
          >
            <source src={getImageUrl(branding.loginBackgroundUrl)} type="video/mp4" />
          </video>
        ) : (
          <img src={displayIllustration} alt="Education illustration" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply" loading="lazy" onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }} />
        )}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          {showPoweredBy && (
            <div className="absolute bottom-4 right-4 text-white/70 text-xs font-medium">
              Powered by SurakshaLMS
            </div>
          )}
        </div>
      </div>
    </div>;
};
export default Login;
