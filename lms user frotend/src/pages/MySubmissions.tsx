import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, CheckCircle, Clock, XCircle, Eye, RefreshCw, CreditCard, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { institutePaymentsApi, MyPaymentSubmission, MySubmissionsResponse } from '@/api/institutePayments.api';
import { classPaymentsApi } from '@/api/classPayments.api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';

const MySubmissions = () => {
  const { selectedInstitute, isViewingAsParent, selectedChild, selectedClass } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [submissionsData, setSubmissionsData] = useState<any>(null);
  const [isClassSubmissions, setIsClassSubmissions] = useState(false);

  const loadSubmissions = async (forceRefresh = false) => {
    if (!selectedInstitute?.id) return;
    
    setLoading(true);
    try {
      let response: any;
      
      // Check if this is class-scoped submissions
      if (selectedClass?.id) {
        setIsClassSubmissions(true);
        response = await classPaymentsApi.getMyClassSubmissions(
          selectedInstitute.id,
          selectedClass.id,
          forceRefresh
        );
      } else {
        setIsClassSubmissions(false);
        if (isViewingAsParent && selectedChild) {
          response = await institutePaymentsApi.getStudentSubmissions(selectedInstitute.id, selectedChild.id, undefined, forceRefresh);
        } else {
          response = await institutePaymentsApi.getMySubmissions(selectedInstitute.id, undefined, forceRefresh);
        }
      }
      setSubmissionsData(response);
    } catch (error: any) {
      console.error('Failed to load submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load your submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [selectedInstitute?.id, selectedChild?.id, selectedClass?.id]);

  // Get submissions array depending on source
  const getSubmissionsArray = () => {
    if (isClassSubmissions && submissionsData?.data?.submissions) {
      return submissionsData.data.submissions;
    } else if (!isClassSubmissions && submissionsData?.data?.submissions) {
      return submissionsData.data.submissions;
    }
    return [];
  };

  // Filter submissions by status on frontend
  const getFilteredSubmissions = (status: string) => {
    const subs = getSubmissionsArray();
    return subs.filter(submission => submission.status === status);
  };

  const getStatusBadge = (status: string) => {
    const icons = {
      'VERIFIED': <CheckCircle className="h-4 w-4" />,
      'HALF_VERIFIED': <CheckCircle className="h-4 w-4" />,
      'QUARTER_VERIFIED': <CheckCircle className="h-4 w-4" />,
      'PENDING': <Clock className="h-4 w-4" />,
      'REJECTED': <XCircle className="h-4 w-4" />
    };
    
    const colors = {
      'VERIFIED': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300',
      'HALF_VERIFIED': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300',
      'QUARTER_VERIFIED': 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300',
      'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300',
      'REJECTED': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300'
    };

    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        <div className="flex items-center space-x-1">
          {icons[status]}
          <span>{status}</span>
        </div>
      </Badge>
    );
  };

  const getTabIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
      case 'HALF_VERIFIED':
      case 'QUARTER_VERIFIED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const renderSubmissionCards = (submissions: any[]) => {
    if (submissions.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No submissions in this category.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3">
        {submissions.map(sub => (
          <Card key={sub.id} className={`border-l-4 ${
            sub.status === 'VERIFIED' ? 'border-l-green-500' :
            sub.status === 'PENDING' ? 'border-l-yellow-500' :
            'border-l-red-500'
          }`}>
            <CardContent className="pt-4 pb-3 px-4">
              {/* Payment identity header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary shrink-0" />
                    <p className="font-bold text-base text-foreground leading-tight">{sub.paymentType || 'Payment'}</p>
                    {sub.priority && (
                      <Badge variant={sub.priority === 'MANDATORY' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                        {sub.priority}
                      </Badge>
                    )}
                  </div>
                  {sub.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 ml-5">{sub.description}</p>
                  )}
                </div>
                <div className="shrink-0">{getStatusBadge(sub.status)}</div>
              </div>

              {/* Rejection reason — prominent */}
              {sub.status === 'REJECTED' && sub.rejectionReason && (
                <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">Rejection Reason</p>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 ml-5">{sub.rejectionReason}</p>
                </div>
              )}

              {/* Status-specific notice */}
              {sub.status === 'PENDING' && sub.daysSinceSubmission != null && (
                <div className="mb-2 flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Awaiting review &mdash; {sub.daysSinceSubmission} day{sub.daysSinceSubmission !== 1 ? 's' : ''} since submission
                </div>
              )}
              {sub.status === 'VERIFIED' && sub.verifiedAt && (
                <div className="mb-2 flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  Verified on {new Date(sub.verifiedAt).toLocaleDateString()}
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2 border-t pt-2">
                <div>
                  <span className="text-muted-foreground">Amount:</span>{' '}
                  <span className="font-medium text-foreground">Rs {(sub.paymentAmount || 0).toLocaleString()}</span>
                </div>
                {(sub.totalAmountPaid > 0) && (
                  <div>
                    <span className="text-muted-foreground">Total Paid:</span>{' '}
                    <span className="font-medium text-foreground">Rs {sub.totalAmountPaid.toLocaleString()}</span>
                  </div>
                )}
                {(sub.lateFeeApplied > 0) && (
                  <div>
                    <span className="text-muted-foreground">Late Fee:</span>{' '}
                    <span className="font-medium text-destructive">Rs {sub.lateFeeApplied.toLocaleString()}</span>
                  </div>
                )}
                {sub.paymentMethod && (
                  <div>
                    <span className="text-muted-foreground">Method:</span>{' '}
                    <span className="font-medium text-foreground">{sub.paymentMethod.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {sub.transactionReference && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Transaction Ref:</span>{' '}
                    <span className="font-medium text-foreground font-mono">{sub.transactionReference}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Submitted:</span>{' '}
                  <span className="font-medium text-foreground">{new Date(sub.createdAt).toLocaleDateString()}</span>
                </div>
                {sub.dueDate && (
                  <div>
                    <span className="text-muted-foreground">Due Date:</span>{' '}
                    <span className="font-medium text-foreground">{new Date(sub.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
                {sub.paymentRemarks && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Remarks:</span>{' '}
                    <span className="text-foreground">{sub.paymentRemarks}</span>
                  </div>
                )}
              </div>

              {/* Receipt */}
              {sub.receiptFileUrl && (
                <div className="mt-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => window.open(getImageUrl(sub.receiptFileUrl), '_blank')}
                  >
                    <Eye className="h-3 w-3 mr-1" />View Receipt
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {isClassSubmissions && selectedClass && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/institute/${selectedInstitute?.id}/class/${selectedClass?.id}`)}
                className="mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Class
              </Button>
            )}
            <h1 className="text-3xl font-bold">My Submissions</h1>
            {selectedInstitute && (
              <p className="text-muted-foreground mt-1">
                Institute: {selectedInstitute.name}
                {isClassSubmissions && selectedClass && ` • Class: ${selectedClass.name}`}
              </p>
            )}
          </div>
          <Button onClick={() => loadSubmissions(true)} disabled={loading} variant="outline">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Summary Stats */}
        {submissionsData && (isClassSubmissions ? submissionsData.data?.total : submissionsData.data?.summary) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{isClassSubmissions ? (submissionsData.data?.total || 0) : (submissionsData.data.summary?.totalSubmissions || 0)}</p>
                    <p className="text-sm text-muted-foreground">Total Submissions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{isClassSubmissions ? (getFilteredSubmissions('PENDING').length || 0) : (submissionsData.data.summary?.byStatus?.pending || 0)}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{isClassSubmissions ? (getFilteredSubmissions('VERIFIED').length + getFilteredSubmissions('HALF_VERIFIED').length + getFilteredSubmissions('QUARTER_VERIFIED').length) : (submissionsData.data.summary?.byStatus?.verified || 0)}</p>
                    <p className="text-sm text-muted-foreground">Verified</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{isClassSubmissions ? (getFilteredSubmissions('REJECTED').length || 0) : (submissionsData.data.summary?.byStatus?.rejected || 0)}</p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Submissions Tabs */}
        {!submissionsData ? (
          <EmptyState
            icon={FileText}
            title="No Submissions"
            description={loading ? 'Loading your payment submissions...' : 'Click "Refresh" to view your payment submissions'}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="PENDING" className="flex items-center space-x-2">
                {getTabIcon('PENDING')}
                <span>Pending ({getFilteredSubmissions('PENDING').length})</span>
              </TabsTrigger>
              <TabsTrigger value="VERIFIED" className="flex items-center space-x-2">
                {getTabIcon('VERIFIED')}
                <span>Verified ({getFilteredSubmissions('VERIFIED').length + getFilteredSubmissions('HALF_VERIFIED').length + getFilteredSubmissions('QUARTER_VERIFIED').length})</span>
              </TabsTrigger>
              <TabsTrigger value="REJECTED" className="flex items-center space-x-2">
                {getTabIcon('REJECTED')}
                <span>Rejected ({getFilteredSubmissions('REJECTED').length})</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="PENDING" className="mt-4">
              {renderSubmissionCards(getFilteredSubmissions('PENDING'))}
            </TabsContent>
            
            <TabsContent value="VERIFIED" className="mt-4">
              {renderSubmissionCards([
                ...getFilteredSubmissions('VERIFIED'),
                ...getFilteredSubmissions('HALF_VERIFIED'),
                ...getFilteredSubmissions('QUARTER_VERIFIED')
              ])}
            </TabsContent>
            
            <TabsContent value="REJECTED" className="mt-4">
              {renderSubmissionCards(getFilteredSubmissions('REJECTED'))}
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
};

export default MySubmissions;