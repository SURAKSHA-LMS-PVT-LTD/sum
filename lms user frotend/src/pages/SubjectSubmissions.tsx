import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, Search, BookOpen, CheckCircle, Clock, XCircle, Download, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { subjectPaymentsApi, SubjectSubmissionsResponse } from '@/api/subjectPayments.api';
import { getImageUrl } from '@/utils/imageUrlHelper';

const SubjectSubmissions = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissionsData, setSubmissionsData] = useState<SubjectSubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load student's subject submissions
  const loadMySubmissions = async () => {
    if (!selectedInstitute || !selectedClass || !selectedSubject) {
      toast({
        title: "Missing Selection",
        description: "Please select institute, class, and subject first.",
        variant: "destructive"
      });
      return;
    }

    if (userRole !== 'Student') {
      toast({
        title: "Access Denied",
        description: "Only students can view their submissions.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await subjectPaymentsApi.getMySubjectSubmissions(
        selectedInstitute.id,
        selectedClass.id,
        selectedSubject.id
      );

      setSubmissionsData(response);
      toast({
        title: "Success",
        description: "Subject submissions loaded successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load subject submissions.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
        return <FileText className="h-4 w-4" />;
    }
  };

  // Only show this page for students
  if (userRole !== 'Student') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only students can view subject submissions.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                My Subject Submissions
              </h1>
              {selectedSubject && (
                <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                  Subject: {selectedSubject.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={loadMySubmissions}
              disabled={loading || !selectedInstitute || !selectedClass || !selectedSubject}
              className="flex items-center space-x-2"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? 'Loading...' : 'Load Submissions'}</span>
            </Button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search submissions by payment type or reference..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">All Status</Button>
                <Button variant="outline">Date Range</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selection Info Card */}
        {(selectedInstitute || selectedClass || selectedSubject) && (
          <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-purple-900 dark:text-purple-100">
                <BookOpen className="h-5 w-5" />
                <span>Current Selection</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedInstitute && (
                <p className="text-purple-800 dark:text-purple-200">
                  <strong>Institute:</strong> {selectedInstitute.name}
                </p>
              )}
              {selectedClass && (
                <p className="text-purple-800 dark:text-purple-200">
                  <strong>Class:</strong> {selectedClass.name}
                </p>
              )}
              {selectedSubject && (
                <p className="text-purple-800 dark:text-purple-200">
                  <strong>Subject:</strong> {selectedSubject.name}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submissions List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>My Payment Submissions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!submissionsData ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                  Click "Load Submissions" to view data
                </p>
                <p className="text-gray-400 dark:text-gray-500">
                  Select institute, class, and subject first, then click Load Submissions.
                </p>
              </div>
            ) : submissionsData.data.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                  No submissions found
                </p>
                <p className="text-gray-400 dark:text-gray-500">
                  Your payment submissions will appear here once made.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissionsData.data.map((submission) => (
                  <div
                    key={submission.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {submission.paymentTitle || `Payment #${submission.paymentId}`}
                          </h3>
                          <Badge className={`flex items-center space-x-1 ${getStatusColor(submission.status)}`}>
                            {getStatusIcon(submission.status)}
                            <span>{submission.status}</span>
                          </Badge>
                        </div>
                        
                        {submission.paymentDescription && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {submission.paymentDescription}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <strong className="text-gray-600 dark:text-gray-400">Amount:</strong>
                            <p className="text-gray-900 dark:text-gray-100">Rs {submission.paymentAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <strong className="text-gray-600 dark:text-gray-400">Method:</strong>
                            <p className="text-gray-900 dark:text-gray-100">{submission.paymentMethod}</p>
                          </div>
                          <div>
                            <strong className="text-gray-600 dark:text-gray-400">Date:</strong>
                            <p className="text-gray-900 dark:text-gray-100">
                              {new Date(submission.paymentDate).toLocaleDateString()}
                            </p>
                          </div>
                          {submission.transactionReference && (
                            <div>
                              <strong className="text-gray-600 dark:text-gray-400">Reference:</strong>
                              <p className="text-gray-900 dark:text-gray-100">{submission.transactionReference}</p>
                            </div>
                          )}
                          {submission.lateFeeApplied && submission.lateFeeApplied > 0 && (
                            <div>
                              <strong className="text-gray-600 dark:text-gray-400">Late Fee:</strong>
                              <p className="text-red-600">Rs {submission.lateFeeApplied}</p>
                            </div>
                          )}
                          <div>
                            <strong className="text-gray-600 dark:text-gray-400">Submitted:</strong>
                            <p className="text-gray-900 dark:text-gray-100">
                              {new Date(submission.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {submission.paymentRemarks && (
                          <div className="mt-2">
                            <strong className="text-gray-600 dark:text-gray-400 text-sm">Remarks:</strong>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{submission.paymentRemarks}</p>
                          </div>
                        )}
                        
                        {submission.status === 'REJECTED' && submission.rejectionReason && (
                          <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                            <strong className="text-red-800 dark:text-red-200 text-sm">Rejection Reason:</strong>
                            <p className="text-sm text-red-700 dark:text-red-300">{submission.rejectionReason}</p>
                          </div>
                        )}
                        
                        {submission.status === 'VERIFIED' && submission.verifiedAt && (
                          <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                            <p className="text-sm text-green-700 dark:text-green-300">
                              <strong>Verified on:</strong> {new Date(submission.verifiedAt).toLocaleDateString()}
                              {submission.verifierName && ` by ${submission.verifierName}`}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-4">
                        {submission.receiptFileUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a 
                              href={getImageUrl(submission.receiptFileUrl)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1"
                            >
                              <Download className="h-3 w-3" />
                              <span>Receipt</span>
                            </a>
                          </Button>
                        )}
                        
                        {submission.canResubmit && (
                          <Button variant="outline" size="sm" className="flex items-center space-x-1">
                            <Upload className="h-3 w-3" />
                            <span>Resubmit</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {submissionsData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Submissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {submissionsData.summary.totalSubmissions}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Verified
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {submissionsData.summary.byStatus.verified}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {submissionsData.summary.byStatus.pending}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  Rs {submissionsData.summary.totalAmountSubmitted.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SubjectSubmissions;