import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Users, RefreshCw, ChevronRight, Upload, FileSpreadsheet, Trash2, AlertTriangle, Wallet, ArrowDownRight, ArrowUpRight, ChevronLeft, History, School } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { apiClient } from '@/api/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import ClassMultiSelectDialog, { SmsClassOption } from '@/components/sms/ClassMultiSelectDialog';
import SubjectMultiSelectDialog, { SmsSubjectOption } from '@/components/sms/SubjectMultiSelectDialog';
import { creditsApi, type CreditBalance, type CreditTransaction } from '@/api/credits.api';


interface SenderMask {
  maskId: string;
  isActive: boolean;
  displayName: string;
  phoneNumber: string;
}

interface SMSCredentials {
  verificationStage: string;
  availableCredits: number;
  totalCreditsGranted: number;
  totalCreditsUsed: number;
  maskIds: string[];
  senderMasks: SenderMask[];
  isActive: boolean;
}

const SMS = () => {
  const { currentInstituteId, selectedInstituteType } = useAuth();
  const instituteRole = useInstituteRole();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { navigateToPage } = useAppNavigation();

  // SMS Credentials state
  const [credentials, setCredentials] = useState<SMSCredentials | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [selectedMaskId, setSelectedMaskId] = useState<string>('');

  // Bulk SMS state
  const [bulkMessage, setBulkMessage] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedClassItems, setSelectedClassItems] = useState<SmsClassOption[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSubjectItems, setSelectedSubjectItems] = useState<SmsSubjectOption[]>([]);
  const [selectedRecipientTypes, setSelectedRecipientTypes] = useState<string[]>([]);
  const [bulkScheduledAt, setBulkScheduledAt] = useState('');
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isBulkNow, setIsBulkNow] = useState(true);

  // Custom SMS state
  const [customMessage, setCustomMessage] = useState('');
  const [customRecipients, setCustomRecipients] = useState<Array<{ name: string; phoneNumber: string }>>([]);
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [isCustomSending, setIsCustomSending] = useState(false);
  const [isCustomNow, setIsCustomNow] = useState(true);
  const [customScheduledAt, setCustomScheduledAt] = useState('');
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('bulk');

  // Bulk file upload state
  const [nameColumn, setNameColumn] = useState('name');
  const [phoneColumn, setPhoneColumn] = useState('phone');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [fileParseError, setFileParseError] = useState('');
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  // Credit balance & usage history
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [usageHistory, setUsageHistory] = useState<CreditTransaction[]>([]);
  const [usageTotal, setUsageTotal] = useState(0);
  const [usagePage, setUsagePage] = useState(1);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageFilter, setUsageFilter] = useState<string>('SMS_SEND');

  // Selection is handled via searchable pickers (no manual ID entry).

  // Auto-set scheduled time when component mounts and live update every second when "Send Now" is checked
  useEffect(() => {
    const getSriLankaTime = () => {
      const now = new Date();
      // Convert to Sri Lanka time (UTC+5:30)
      const sriLankaTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      return sriLankaTime.toISOString().slice(0, 16);
    };
    const sriLankaTime = getSriLankaTime();
    setBulkScheduledAt(sriLankaTime);
    setCustomScheduledAt(sriLankaTime);

    // Live update when "Send Now" is checked
    const interval = setInterval(() => {
      if (isBulkNow) {
        setBulkScheduledAt(getSriLankaTime());
      }
      if (isCustomNow) {
        setCustomScheduledAt(getSriLankaTime());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isBulkNow, isCustomNow]);

  // Load credentials from cache only on mount (no automatic refresh)
  useEffect(() => {
    if (currentInstituteId) {
      // Silent cache load only - no loading indicator
      const loadFromCache = async () => {
        try {
          const response = await enhancedCachedClient.get(
            `/sms/credentials/status`,
            { instituteId: currentInstituteId },
            {
              ttl: CACHE_TTL.SMS_CREDENTIALS,
              forceRefresh: false, // Only load from cache
              userId: currentInstituteId
            }
          );
          setCredentials(response as SMSCredentials);
        } catch (error: any) {
          // Silently fail - user can click refresh if needed
          console.log('📦 No cached SMS credentials available');
        }
      };
      loadFromCache();
    }
  }, [currentInstituteId]);

  // Load credit balance on mount
  const loadCreditBalance = useCallback(async () => {
    if (!currentInstituteId) return;
    try {
      const data = await creditsApi.getBalance(currentInstituteId);
      setCreditBalance(data);
    } catch {
      setCreditBalance(null);
    }
  }, [currentInstituteId]);

  // Load usage history (SMS-related transactions)
  const loadUsageHistory = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoadingUsage(true);
    try {
      const data = await creditsApi.getTransactions(currentInstituteId, {
        type: usageFilter || undefined,
        page: usagePage,
        limit: 10,
      });
      setUsageHistory(data.data);
      setUsageTotal(data.total);
    } catch {
      setUsageHistory([]);
      setUsageTotal(0);
    }
    setLoadingUsage(false);
  }, [currentInstituteId, usagePage, usageFilter]);

  useEffect(() => { loadCreditBalance(); }, [loadCreditBalance]);
  useEffect(() => { loadUsageHistory(); }, [loadUsageHistory]);

  const fetchCredentials = async () => {
    if (!currentInstituteId) {
      console.log('❌ No currentInstituteId, skipping fetch');
      return;
    }
    
    console.log('🔄 Fetching SMS credentials for institute:', currentInstituteId);
    setLoadingCredentials(true);
    try {
      const response = await enhancedCachedClient.get(
        `/sms/credentials/status`,
        { instituteId: currentInstituteId },
        {
          ttl: CACHE_TTL.SMS_CREDENTIALS,
          forceRefresh: false,
          userId: currentInstituteId
        }
      );
      console.log('✅ SMS credentials response:', response);
      setCredentials(response as SMSCredentials);
      console.log('✅ Credentials set successfully:', response);
    } catch (error: any) {
      console.error('❌ Failed to fetch SMS credentials:', error);
      toast({
        title: 'Warning',
        description: 'Could not load SMS configuration',
        variant: 'destructive',
      });
    } finally {
      setLoadingCredentials(false);
    }
  };

  // Check if user has permission
  const allowedRoles = new Set(['InstituteAdmin', 'INSTITUTE_ADMIN']);
  if (!allowedRoles.has(String(instituteRole))) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Only Institute Admins can access SMS features.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentInstituteId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Institute Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please select an institute to send SMS.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleBulkSMS = async () => {
    if (!bulkMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedMaskId) {
      toast({
        title: 'Error',
        description: 'Please select a mask ID',
        variant: 'destructive',
      });
      return;
    }

    // Check credit balance before sending
    if (creditBalance && creditBalance.balance <= 0) {
      toast({
        title: 'Insufficient Balance',
        description: 'Your wallet balance is empty. Please top up before sending SMS.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedRecipientTypes.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one recipient type',
        variant: 'destructive',
      });
      return;
    }

    setIsBulkSending(true);
    try {
      const response: any = await apiClient.post(
        `/sms/send-bulk?instituteId=${currentInstituteId}`,
        {
          messageTemplate: bulkMessage,
          recipientTypes: selectedRecipientTypes,
          classIds: selectedClasses,
          subjectIds: selectedSubjects,
          maskId: selectedMaskId,
          isNow: isBulkNow,
        }
      );

      toast({
        title: 'Success',
        description: `${response.message || 'SMS created successfully'}. Message ID: ${response.messageId || 'N/A'}. Recipients: ${response.totalRecipients || 0}. Status: ${response.status || 'Unknown'}. Estimated Credits: ${response.estimatedCredits || 0}. Processing Time: ${response.processingTime || 'N/A'}`,
      });

      // Reset form
      setBulkMessage('');
      setSelectedClasses([]);
      setSelectedClassItems([]);
      setSelectedSubjects([]);
      setSelectedSubjectItems([]);
      setSelectedRecipientTypes([]);
      const now = new Date();
      const sriLankaTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      setBulkScheduledAt(sriLankaTime.toISOString().slice(0, 16));
      setIsBulkNow(true);
      
      // Refresh credentials, credit balance and usage history
      fetchCredentials();
      loadCreditBalance();
      loadUsageHistory();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to send bulk SMS',
        variant: 'destructive',
      });
    } finally {
      setIsBulkSending(false);
    }
  };


  const toggleRecipientType = (recipientType: string) => {
    setSelectedRecipientTypes((prev) =>
      prev.includes(recipientType) ? prev.filter((t) => t !== recipientType) : [...prev, recipientType]
    );
  };

  const removeClassId = (id: string) => {
    setSelectedClasses(selectedClasses.filter((c) => c !== id));
    setSelectedClassItems(selectedClassItems.filter((c) => c.id !== id));
  };

  const removeSubjectId = (id: string) => {
    setSelectedSubjects(selectedSubjects.filter((s) => s !== id));
    setSelectedSubjectItems(selectedSubjectItems.filter((s) => s.id !== id));
  };


  const addCustomRecipient = () => {
    if (!customName.trim() || !customPhone.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter both name and phone number',
        variant: 'destructive',
      });
      return;
    }

    const phoneRegex = /^\+94\d{9}$/;
    if (!phoneRegex.test(customPhone.trim())) {
      toast({
        title: 'Error',
        description: 'Phone number must be in format +94XXXXXXXXX',
        variant: 'destructive',
      });
      return;
    }

    setCustomRecipients([...customRecipients, { name: customName.trim(), phoneNumber: customPhone.trim() }]);
    setCustomName('');
    setCustomPhone('');
  };

  /** Normalize phone: 07X → +947X, 947X → +947X */
  const normalizePhone = (raw: string): string | null => {
    const digits = raw.replace(/[\s\-()]/g, '');
    let phone = digits;
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '+94' + phone.slice(1);
    } else if (phone.startsWith('94') && phone.length === 11) {
      phone = '+' + phone;
    } else if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }
    return /^\+94\d{9}$/.test(phone) ? phone : null;
  };

  /** Parse uploaded CSV or Excel file */
  const handleFileUpload = (file: File) => {
    setFileParseError('');
    setUploadedFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processRows(result.data as Record<string, string>[]),
        error: () => setFileParseError('Failed to parse CSV file'),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
          processRows(rows);
        } catch {
          setFileParseError('Failed to parse Excel file');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFileParseError('Unsupported file type. Use .csv, .xlsx, or .xls');
    }
  };

  const processRows = (rows: Record<string, string>[]) => {
    const nCol = nameColumn.trim();
    const pCol = phoneColumn.trim();
    if (!pCol) {
      setFileParseError('Phone column name is required');
      return;
    }
    const parsed: Array<{ name: string; phoneNumber: string }> = [];
    const invalid: string[] = [];
    for (const row of rows) {
      const rawPhone = String(row[pCol] ?? '').trim();
      const rawName = nCol ? String(row[nCol] ?? '').trim() : '';
      if (!rawPhone) continue;
      const phone = normalizePhone(rawPhone);
      if (phone) {
        parsed.push({ name: rawName || 'Recipient', phoneNumber: phone });
      } else {
        invalid.push(rawPhone);
      }
    }
    if (parsed.length === 0) {
      setFileParseError(`No valid phone numbers found. Check column name "${pCol}". Available columns: ${rows.length > 0 ? Object.keys(rows[0]).join(', ') : 'none'}`);
      return;
    }
    setCustomRecipients(prev => [...prev, ...parsed]);
    const msg = `Loaded ${parsed.length} recipients from file.`;
    toast({
      title: 'File Imported',
      description: invalid.length > 0
        ? `${msg} ${invalid.length} invalid numbers skipped.`
        : msg,
    });
  };

  const removeCustomRecipient = (index: number) => {
    setCustomRecipients(customRecipients.filter((_, i) => i !== index));
  };

  const handleCustomSMS = async () => {
    if (!customMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (customRecipients.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one recipient',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedMaskId) {
      toast({
        title: 'Error',
        description: 'Please select a mask ID',
        variant: 'destructive',
      });
      return;
    }

    // Check credit balance before sending
    if (creditBalance && creditBalance.balance < customRecipients.length) {
      toast({
        title: 'Insufficient Balance',
        description: `You need at least ${customRecipients.length} units to send to ${customRecipients.length} recipients. Your balance: ${Math.floor(creditBalance.balance)}. Please top up your wallet.`,
        variant: 'destructive',
      });
      return;
    }

    setIsCustomSending(true);
    try {
      // Chunk recipients into groups of 1000 (backend limit)
      const CHUNK_SIZE = 1000;
      const chunks: Array<Array<{ name: string; phoneNumber: string }>> = [];
      for (let i = 0; i < customRecipients.length; i += CHUNK_SIZE) {
        chunks.push(customRecipients.slice(i, i + CHUNK_SIZE));
      }

      let totalSent = 0;
      setSendProgress({ current: 0, total: chunks.length });

      for (let i = 0; i < chunks.length; i++) {
        setSendProgress({ current: i + 1, total: chunks.length });
        const response: any = await apiClient.post('/sms/send-custom', {
          messageTemplate: customMessage,
          customRecipients: chunks[i],
          maskId: selectedMaskId,
          isNow: isCustomNow,
          scheduledAt: isCustomNow ? new Date().toISOString() : customScheduledAt,
        });
        totalSent += response.totalRecipients || chunks[i].length;
      }

      setSendProgress(null);
      toast({
        title: 'Success',
        description: `SMS sent to ${totalSent} recipients${chunks.length > 1 ? ` in ${chunks.length} batches` : ''}.`,
      });

      // Reset form
      setCustomMessage('');
      setCustomRecipients([]);
      setCustomName('');
      setCustomPhone('');
      const now = new Date();
      const sriLankaTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      setCustomScheduledAt(sriLankaTime.toISOString().slice(0, 16));
      setIsCustomNow(true);
      
      // Refresh credentials, credit balance and usage history
      fetchCredentials();
      loadCreditBalance();
      loadUsageHistory();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to send custom SMS',
        variant: 'destructive',
      });
    } finally {
      setIsCustomSending(false);
      setSendProgress(null);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-3 sm:p-6 space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">SMS</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Send bulk messages, manage sender masks, and track usage.
        </p>
      </header>

      {/* SMS Credits Display */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet & SMS Configuration
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {credentials && (
                <Badge variant={credentials.isActive ? 'default' : 'destructive'}>
                  {credentials.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => { fetchCredentials(); loadCreditBalance(); }} disabled={loadingCredentials}>
                <RefreshCw className={`h-4 w-4 ${loadingCredentials ? 'animate-spin' : ''}`} />
                <span className="ml-2 hidden sm:inline">{loadingCredentials ? 'Loading...' : 'Refresh'}</span>
                <span className="ml-2 sm:hidden">{loadingCredentials ? '...' : 'Refresh'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="text-2xl font-bold text-primary">
                {creditBalance ? Math.floor(creditBalance.balance) : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">institute wallet for all services</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-2xl font-bold">
                {creditBalance ? Math.floor(creditBalance.totalUsed) : '—'}
              </p>
            </div>
            <div>
              <Label htmlFor="mask-id">Sender Mask</Label>
              <Select value={selectedMaskId} onValueChange={setSelectedMaskId}>
                <SelectTrigger id="mask-id" className="mt-1">
                  <SelectValue placeholder="Select a mask" />
                </SelectTrigger>
                <SelectContent>
                  {credentials?.senderMasks?.map((mask) => (
                    <SelectItem key={mask.maskId} value={mask.maskId}>
                      <div className="flex flex-col">
                        <span className="font-medium">{mask.displayName}</span>
                        <span className="text-xs text-muted-foreground">{mask.phoneNumber}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile && !mobileSection ? (
            <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-card/50">
              {[
                { id: 'bulk', icon: Users, label: 'Bulk SMS', description: 'Send messages to classes or roles', color: 'text-blue-500' },
                { id: 'custom', icon: MessageSquare, label: 'Custom SMS', description: 'Send messages to specific numbers', color: 'text-emerald-500' },
                { id: 'usage', icon: History, label: 'Usage', description: 'Credit balance & usage history', color: 'text-amber-500' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setMobileSection(item.id)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-muted/60 transition-colors"
                  >
                    <div className={`p-2.5 rounded-xl bg-muted/60 ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={isMobile ? "space-y-4" : ""}>
              {isMobile && mobileSection && (
                <div className="flex items-center mb-4">
                  <button
                    onClick={() => setMobileSection(null)}
                    className="flex items-center gap-2 text-sm font-medium text-primary active:opacity-70 transition-opacity"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back to Menu
                  </button>
                </div>
              )}
              {isMobile && mobileSection && (
                <h2 className="text-lg font-bold text-foreground mb-4">
                  {mobileSection === 'bulk' && 'Bulk SMS'}
                  {mobileSection === 'custom' && 'Custom SMS'}
                  {mobileSection === 'usage' && 'Usage History'}
                </h2>
              )}
              <Tabs value={isMobile ? mobileSection : activeTab} onValueChange={setActiveTab} className="w-full">
                {!isMobile && (
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="bulk" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className={activeTab === "bulk" ? "" : "hidden sm:inline"}>
                        Bulk SMS
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <span className={activeTab === "custom" ? "" : "hidden sm:inline"}>
                        Custom SMS
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="usage" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                      <History className="h-4 w-4 shrink-0" />
                      <span className={activeTab === "usage" ? "" : "hidden sm:inline"}>
                        Usage
                      </span>
                    </TabsTrigger>
                  </TabsList>
                )}

            {/* Bulk SMS Tab */}
            <TabsContent value="bulk" className="space-y-4">
              {/* Institute type context hint */}
              {selectedInstituteType && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/60">
                  <School className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Institute type: <span className="font-medium text-foreground capitalize">{selectedInstituteType.replace(/_/g, ' ')}</span>
                    {selectedInstituteType === 'dhamma_school' && ' — Select classes (Dhamma school sections) then subjects (Dhamma subjects)'}
                    {selectedInstituteType === 'school' && ' — Select grade classes then subjects to target specific recipients'}
                    {selectedInstituteType === 'tuition_institute' && ' — Select classes (tuition batches) then subjects (courses)'}
                    {selectedInstituteType === 'university' && ' — Select classes (faculties/courses) then subjects (modules)'}
                  </span>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bulk-message">Message</Label>
                  <Textarea
                    id="bulk-message"
                    placeholder="Your class schedule has been updated. Thank you!"
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Recipient Types</Label>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {[
                      { value: 'STUDENTS', label: selectedInstituteType === 'dhamma_school' ? 'Dhamma Students' : 'Students' },
                      { value: 'PARENTS', label: 'Parents / Guardians' },
                      { value: 'TEACHERS', label: selectedInstituteType === 'dhamma_school' ? 'Dhamma Teachers' : 'Teachers' },
                      { value: 'ADMIN', label: 'Admins' },
                      { value: 'ALL', label: 'All Members' },
                    ].map(({ value, label }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`recipienttype-${value}`}
                          checked={selectedRecipientTypes.includes(value)}
                          onCheckedChange={() => toggleRecipientType(value)}
                        />
                        <label htmlFor={`recipienttype-${value}`} className="text-sm cursor-pointer">
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="class-ids">Classes</Label>
                  <div className="flex gap-2 mt-2">
                    <ClassMultiSelectDialog
                      instituteId={currentInstituteId}
                      userId={currentInstituteId}
                      role={String(instituteRole || 'User')}
                      selectedIds={selectedClasses}
                      onChange={(ids, items) => {
                        setSelectedClasses(ids);
                        if (items) setSelectedClassItems(items);
                      }}
                      triggerLabel={selectedClasses.length > 0 ? `${selectedClasses.length} Selected` : "Select Classes"}
                    />
                  </div>

                  {selectedClassItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedClassItems.map((cls) => (
                        <Badge key={cls.id} variant="secondary" className="cursor-pointer" onClick={() => removeClassId(cls.id)}>
                          {cls.name} • {cls.academicYear} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="subject-ids">Subjects</Label>
                    {selectedClasses.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Showing subjects for {selectedClasses.length} selected class{selectedClasses.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <SubjectMultiSelectDialog
                      instituteId={currentInstituteId}
                      userId={currentInstituteId}
                      role={String(instituteRole || 'User')}
                      selectedIds={selectedSubjects}
                      classIds={selectedClasses.length > 0 ? selectedClasses : undefined}
                      onChange={(ids, items) => {
                        setSelectedSubjects(ids);
                        if (items) setSelectedSubjectItems(items);
                      }}
                      triggerLabel={selectedSubjects.length > 0 ? `${selectedSubjects.length} Selected` : "Select Subjects"}
                    />
                  </div>

                  {selectedSubjectItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSubjectItems.map((sub) => (
                        <Badge key={sub.id} variant="secondary" className="cursor-pointer" onClick={() => removeSubjectId(sub.id)}>
                          {sub.name} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="bulk-scheduled">Scheduled At</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="bulk-is-now"
                        checked={true}
                        disabled
                        className="opacity-70"
                      />
                      <label htmlFor="bulk-is-now" className="text-sm text-muted-foreground cursor-not-allowed">
                        Send Now (locked)
                      </label>
                    </div>
                  </div>
                  <Input
                    id="bulk-scheduled"
                    type="datetime-local"
                    value={bulkScheduledAt}
                    onChange={(e) => setBulkScheduledAt(e.target.value)}
                    disabled={isBulkNow}
                    className="mt-2"
                  />
                </div>

                <Button onClick={handleBulkSMS} disabled={isBulkSending} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {isBulkSending ? 'Sending...' : 'Send Bulk SMS'}
                </Button>
              </div>
            </TabsContent>

            {/* Custom SMS Tab */}
            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-message">Message</Label>
                  <Textarea
                    id="custom-message"
                    placeholder="Hello, your admission is confirmed. Thank you!"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Same message will be sent to all recipients.</p>
                </div>

                {/* ── Bulk File Upload ── */}
                <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                    <Label className="text-sm font-semibold">Bulk Upload (CSV / Excel)</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name Column</Label>
                      <Input
                        placeholder="e.g. name"
                        value={nameColumn}
                        onChange={(e) => setNameColumn(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone Column *</Label>
                      <Input
                        placeholder="e.g. phone"
                        value={phoneColumn}
                        onChange={(e) => setPhoneColumn(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.csv,.xlsx,.xls';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileUpload(file);
                        };
                        input.click();
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      Upload File
                    </Button>
                    {uploadedFileName && (
                      <span className="text-xs text-muted-foreground">{uploadedFileName}</span>
                    )}
                  </div>
                  {fileParseError && (
                    <div className="flex items-start gap-2 text-destructive text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{fileParseError}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Type the exact column names from your spreadsheet header row. Phone numbers are auto-formatted to +94XXXXXXXXX.</p>
                </div>

                {/* ── Manual Add ── */}
                <div>
                  <Label>Add Manually</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <Input
                      placeholder="Recipient Name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCustomRecipient()}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="+94771234567"
                        value={customPhone}
                        onChange={(e) => setCustomPhone(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCustomRecipient()}
                      />
                      <Button type="button" onClick={addCustomRecipient} size="icon" variant="outline">
                        +
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── Recipient List ── */}
                {customRecipients.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Recipients ({customRecipients.length}){customRecipients.length > 1000 && <span className="text-xs text-muted-foreground ml-1">(will send in {Math.ceil(customRecipients.length / 1000)} batches)</span>}</p>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive gap-1 h-7" onClick={() => { setCustomRecipients([]); setUploadedFileName(''); }}>
                        <Trash2 className="h-3 w-3" /> Clear All
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {customRecipients.slice(0, 100).map((recipient, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="cursor-pointer px-3 py-1"
                          onClick={() => removeCustomRecipient(index)}
                        >
                          {recipient.name} - {recipient.phoneNumber} ×
                        </Badge>
                      ))}
                      {customRecipients.length > 100 && (
                        <Badge variant="outline" className="px-3 py-1">+{customRecipients.length - 100} more</Badge>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="custom-scheduled">Scheduled At</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="custom-is-now"
                        checked={true}
                        disabled
                        className="opacity-70"
                      />
                      <label htmlFor="custom-is-now" className="text-sm text-muted-foreground cursor-not-allowed">
                        Send Now (locked)
                      </label>
                    </div>
                  </div>
                  <Input
                    id="custom-scheduled"
                    type="datetime-local"
                    value={customScheduledAt}
                    onChange={(e) => setCustomScheduledAt(e.target.value)}
                    disabled={isCustomNow}
                    className="mt-2"
                  />
                </div>

                <Button onClick={handleCustomSMS} disabled={isCustomSending || customRecipients.length === 0} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {isCustomSending
                    ? sendProgress
                      ? `Sending batch ${sendProgress.current}/${sendProgress.total}...`
                      : 'Sending...'
                    : `Send to ${customRecipients.length} Recipient${customRecipients.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </TabsContent>

            {/* Usage History Tab - SMS Deductions from Wallet */}
            <TabsContent value="usage" className="space-y-4">
              {/* SMS Usage Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownRight className="h-3.5 w-3.5 text-orange-500" />
                      <p className="text-xs text-muted-foreground">Today's SMS Deductions</p>
                    </div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {creditBalance ? Math.floor(creditBalance.dailyUsed) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">credits used today</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-xs text-muted-foreground">Total SMS Used</p>
                    </div>
                    <p className="text-lg font-bold">
                      {creditBalance ? Math.floor(creditBalance.totalUsed) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">all time</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 dark:border-blue-800 col-span-2 sm:col-span-1">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-xs text-muted-foreground">Wallet Balance</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {creditBalance ? Math.floor(creditBalance.balance) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">available credits</p>
                  </CardContent>
                </Card>
              </div>

              {/* Low balance warning */}
              {creditBalance && creditBalance.balance < 50 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                    Low balance ({Math.floor(creditBalance.balance)} remaining). Top up to avoid interruptions.
                  </p>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs h-7" onClick={() => navigateToPage('institute-credits')}>
                    Top Up
                  </Button>
                </div>
              )}

              {/* Header + Refresh */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">SMS Send History</p>
                  <p className="text-xs text-muted-foreground">Credits deducted for each SMS send</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { loadCreditBalance(); loadUsageHistory(); }}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>

              {/* Transaction list — SMS_SEND only */}
              {loadingUsage ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-muted/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : usageHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No SMS sends yet</p>
                  <p className="text-xs mt-1">Credits deducted when SMS messages are sent will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {usageHistory.map(tx => {
                      const deducted = Math.abs(tx.amount);
                      const isToday = tx.createdAt
                        ? new Date(tx.createdAt).toDateString() === new Date().toDateString()
                        : false;
                      return (
                        <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 shrink-0">
                            <MessageSquare className="h-4 w-4 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                                −{deducted} credits
                              </span>
                              {isToday && (
                                <Badge variant="outline" className="text-[10px] h-4 border-orange-300 text-orange-600">Today</Badge>
                              )}
                            </div>
                            {tx.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[260px]">{tx.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Balance after: {tx.balanceAfter != null ? Math.floor(tx.balanceAfter) : '—'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {Math.ceil(usageTotal / 10) > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setUsagePage(p => Math.max(1, p - 1))} disabled={usagePage <= 1}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {usagePage} / {Math.ceil(usageTotal / 10)}
                      </span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setUsagePage(p => Math.min(Math.ceil(usageTotal / 10), p + 1))} disabled={usagePage >= Math.ceil(usageTotal / 10)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Link to full wallet page */}
              <div className="text-center pt-2">
                <Button variant="link" size="sm" className="text-xs" onClick={() => navigateToPage('institute-credits')}>
                  View full wallet & top-up page <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </TabsContent>


              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default SMS;
