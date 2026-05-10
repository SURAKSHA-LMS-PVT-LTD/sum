
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, AlertCircle, Calendar, DollarSign, Clock, XCircle, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface PaymentSubmission {
  id: string;
  paymentId: string;
  userId: string;
  userType: string;
  username: string;
  paymentDate: string;
  receiptUrl: string;
  receiptFilename: string;
  transactionId: string;
  submittedAmount: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string;
  uploadedAt: string;
  updatedAt: string;
  paymentPreview: {
    id: string;
    title: string;
    description: string;
    amount: number;
    lastDate: string;
    status: string;
    isActive: boolean;
    priority: string;
    targetType: string;
    createdBy: {
      id: string;
      name: string;
    };
    createdAt: string;
  };
  submissionPreview: {
    receiptPreview: {
      filename: string;
      url: string;
      canView: boolean;
    };
    submissionSummary: {
      submittedAmount: number;
      transactionReference: string;
      paymentMethod: string;
      submissionDate: string;
      processingTime: string | null;
    };
    verificationPreview: any;
  };
  statusIndicators: {
    isPending: boolean;
    isVerified: boolean;
    isRejected: boolean;
    canResubmit: boolean;
    paymentIsActive: boolean;
    isOverdue: boolean;
  };
  availableActions: {
    canView: boolean;
    canDownloadReceipt: boolean;
    canResubmit: boolean;
    canDelete: boolean;
  };
}

interface SubmissionsResponse {
  success: boolean;
  message: string;
  data: PaymentSubmission[];
  summary: {
    total: number;
    byStatus: {
      pending: number;
      verified: number;
      rejected: number;
    };
    byPaymentStatus: {
      activePayments: number;
      inactivePayments: number;
    };
    totalAmountSubmitted: number;
    latestSubmission: string;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface StudentSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
  classId: string;
  subjectId: string;
}

const StudentSubmissionsDialog = ({
  open,
  onOpenChange,
  instituteId,
  classId,
  subjectId
}: StudentSubmissionsDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();
  const [submissionsData, setSubmissionsData] = useState<SubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('PENDING');

  const loadSubmissions = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const result = await enhancedCachedClient.get(
        `/institute-class-payment-submissions/payment/:paymentId/my-status`,
        {},
        {
          ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
          forceRefresh,
          userId: user?.id,
          role: userRole,
          instituteId,
          classId,
          subjectId
        }
      );

      setSubmissionsData(result);
      
      toast({
        title: "Success",
        description: `Loaded ${result.data.length} payment submissions`,
      });
    } catch (error: any) {
      console.error('Failed to load submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load payment submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load submissions when dialog opens (uses cache if available)
  useEffect(() => {
    if (open && instituteId && classId && subjectId) {
      loadSubmissions(false); // Load from cache
    }
  }, [open, instituteId, classId, subjectId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const filterSubmissionsByStatus = (status: string) => {
    if (!submissionsData) return [];
    return submissionsData.data.filter(submission => submission.status === status);
  };

  const handleViewReceipt = (receiptUrl: string) => {
    window.open(getImageUrl(receiptUrl), '_blank');
  };

  const handleDownloadReceipt = (receiptUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = getImageUrl(receiptUrl);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const renderSubmissionCard = (submission: PaymentSubmission) => (
    <div
      key={submission.id}
      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Badge className={`px-3 py-1 ${getStatusColor(submission.status)}`}>
            {getStatusIcon(submission.status)}
            <span className="ml-2">{submission.status}</span>
          </Badge>
          <div>
            <h3 className="font-semibold text-lg">
              {submission.paymentPreview.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {submission.paymentPreview.description}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">
            Rs {parseFloat(submission.submittedAmount).toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {submission.paymentPreview.priority}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Payment Method:</span>
            <span className="text-sm">{submission.submissionPreview.submissionSummary.paymentMethod}</span>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Transaction ID:</span>
            <span className="text-sm font-mono">{submission.transactionId}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Payment Date:</span>
            <span className="text-sm">
              {new Date(submission.paymentDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Due Date:</span>
            <span className="text-sm">
              {new Date(submission.paymentPreview.lastDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Submitted:</span>
            <span className="text-sm">
              {new Date(submission.uploadedAt).toLocaleDateString()}
            </span>
          </div>
          {submission.verifiedAt && (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Verified:</span>
              <span className="text-sm">
                {new Date(submission.verifiedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {submission.notes && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-1">Notes:</p>
          <p className="text-sm">{submission.notes}</p>
        </div>
      )}

      {submission.rejectionReason && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
          <p className="text-sm font-medium mb-1 text-red-800 dark:text-red-200">Rejection Reason:</p>
          <p className="text-sm text-red-700 dark:text-red-300">{submission.rejectionReason}</p>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <p className="text-sm font-medium mb-2">Receipt:</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm">{submission.receiptFilename}</span>
          </div>
          <div className="flex items-center space-x-2">
            {submission.availableActions.canView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewReceipt(submission.receiptUrl)}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
            {submission.availableActions.canDownloadReceipt && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadReceipt(submission.receiptUrl, submission.receiptFilename)}
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>My Payment Submissions</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Load Button */}
          <div className="flex justify-between items-center">
            <Button onClick={() => loadSubmissions(true)} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh Submissions'}
            </Button>
            
            {/* Summary Stats */}
            {submissionsData && (
              <div className="flex items-center space-x-4 text-sm">
                <span className="flex items-center space-x-1">
                  <FileText className="h-4 w-4" />
                  <span>Total: {submissionsData.summary.total}</span>
                </span>
                <span className="flex items-center space-x-1 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  <span>Pending: {submissionsData.summary.byStatus.pending}</span>
                </span>
                <span className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Verified: {submissionsData.summary.byStatus.verified}</span>
                </span>
                <span className="flex items-center space-x-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>Rejected: {submissionsData.summary.byStatus.rejected}</span>
                </span>
              </div>
            )}
          </div>

          {/* Submissions Tabs */}
          {!submissionsData ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                Click "Load My Submissions" to view your payment submissions
              </p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="PENDING" className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Pending ({submissionsData.summary.byStatus.pending})</span>
                </TabsTrigger>
                <TabsTrigger value="VERIFIED" className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Verified ({submissionsData.summary.byStatus.verified})</span>
                </TabsTrigger>
                <TabsTrigger value="REJECTED" className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4" />
                  <span>Rejected ({submissionsData.summary.byStatus.rejected})</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="PENDING" className="mt-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filterSubmissionsByStatus('PENDING').length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No pending submissions</p>
                    </div>
                  ) : (
                    filterSubmissionsByStatus('PENDING').map(renderSubmissionCard)
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="VERIFIED" className="mt-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filterSubmissionsByStatus('VERIFIED').length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No verified submissions</p>
                    </div>
                  ) : (
                    filterSubmissionsByStatus('VERIFIED').map(renderSubmissionCard)
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="REJECTED" className="mt-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filterSubmissionsByStatus('REJECTED').length === 0 ? (
                    <div className="text-center py-8">
                      <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No rejected submissions</p>
                    </div>
                  ) : (
                    filterSubmissionsByStatus('REJECTED').map(renderSubmissionCard)
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentSubmissionsDialog;
