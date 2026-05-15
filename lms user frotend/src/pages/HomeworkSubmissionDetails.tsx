import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AccessControl, UserRole } from '@/utils/permissions';
import { homeworkSubmissionsApi, type HomeworkSubmission } from '@/api/homeworkSubmissions.api';
import { homeworkApi, type Homework } from '@/api/homework.api';
import { FileText, Calendar, User, ExternalLink, RefreshCw, ArrowLeft, Lock, Edit, Eye } from 'lucide-react';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import AppLayout from '@/components/layout/AppLayout';
import UploadCorrectionDialog from '@/components/forms/UploadCorrectionDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';

const HSD_COL_DEFS: ColumnDef[] = [
  { key: 'id', header: 'ID', defaultWidth: 80, minWidth: 60 },
  { key: 'studentId', header: 'Student ID', defaultWidth: 100, minWidth: 80 },
  { key: 'studentName', header: 'Student Name', defaultWidth: 150, minWidth: 100 },
  { key: 'submissionDate', header: 'Submission Date', defaultWidth: 150, minWidth: 120 },
  { key: 'remarks', header: 'Remarks', defaultWidth: 100, minWidth: 80 },
  { key: 'fileUrl', header: 'Submission', defaultWidth: 120, minWidth: 90 },
  { key: 'correctionUrl', header: 'Correction', defaultWidth: 120, minWidth: 90 },
  { key: 'isActive', header: 'Status', defaultWidth: 100, minWidth: 80 },
  { key: 'createdAt', header: 'Created At', defaultVisible: false, defaultWidth: 150, minWidth: 120 },
  { key: 'updatedAt', header: 'Updated At', defaultVisible: false, defaultWidth: 150, minWidth: 120 },
  { key: 'actions', header: 'Actions', defaultWidth: 120, minWidth: 90 },
];

const HomeworkSubmissionDetails = () => {
  const { instituteId, classId, subjectId, homeworkId } = useParams<{ 
    instituteId: string; 
    classId: string; 
    subjectId: string; 
    homeworkId: string 
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const instituteRole = useInstituteRole();
  const [homework, setHomework] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHomework, setIsLoadingHomework] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<HomeworkSubmission | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewSubmission, setViewSubmission] = useState<HomeworkSubmission | null>(null);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState<string>('');

  const loadHomework = async () => {
    if (!homeworkId) return;

    setIsLoadingHomework(true);
    try {
      const response = await homeworkApi.getHomeworkById(homeworkId);
      setHomework(response);
    } catch (error: any) {
      console.error('Error loading homework:', error);
      toast({
        title: "Error",
        description: "Failed to load homework details",
        variant: "destructive"
      });
    } finally {
      setIsLoadingHomework(false);
    }
  };

  const loadSubmissions = async (pageNumber = 1, limit = rowsPerPage) => {
    if (!homeworkId) return;

    setIsLoading(true);
    try {
      const response = await homeworkSubmissionsApi.getSubmissions(
        {
          page: pageNumber,
          limit,
          homeworkId,
        },
        true
      );

      const submissionsList = Array.isArray(response) ? response : response.data || [];
      const meta = Array.isArray(response) ? undefined : response.meta;

      setSubmissions(submissionsList);
      setTotalSubmissions(meta?.total ?? submissionsList.length);
      setPage(pageNumber - 1);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load homework submissions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (homeworkId) {
      loadHomework();
      // Don't auto-load submissions - user must click Load Data button
    }
  }, [homeworkId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCorrectionClick = (submission: HomeworkSubmission) => {
    setSelectedSubmission(submission);
    setCorrectionDialogOpen(true);
  };

  const handleCorrectionSuccess = () => {
    loadSubmissions();
  };

  const canUploadCorrections = ['InstituteAdmin', 'Teacher'].includes(instituteRole);

  const handleViewDetails = (submission: HomeworkSubmission) => {
    setViewSubmission(submission);
    setViewDialogOpen(true);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    void loadSubmissions(newPage + 1, rowsPerPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = +event.target.value;
    setRowsPerPage(next);
    setPage(0);
    void loadSubmissions(1, next);
  };

  const hsdColIds = useMemo(() => HSD_COL_DEFS.map(c => c.key), []);
  const hsdColDefaultWidths = useMemo(() => Object.fromEntries(HSD_COL_DEFS.map(c => [c.key, c.defaultWidth!])), []);
  const { getWidth: getHSDColWidth, setHoveredCol: setHSDHoveredCol, hoveredCol: HSDHoveredCol, activeCol: HSDActiveCol, startResize: HSDStartResize } = useResizableColumns(hsdColIds, hsdColDefaultWidths);
  const { colState: hsdColState, visibleColumns: hsdVisDefs, toggleColumn: toggleHSDCol, resetColumns: resetHSDCols } = useColumnConfig(HSD_COL_DEFS, 'homework-submission-details');
  const hsdVisKeys = useMemo(() => new Set(hsdVisDefs.map(c => c.key)), [hsdVisDefs]);

  // Check if user has permission to view homework submissions (institute-specific)
  if (!AccessControl.hasPermission(instituteRole as UserRole, 'view-homework-submissions')) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                You don't have permission to view homework submissions. Only teachers and institute administrators can access this feature.
              </p>
              <Button onClick={() => navigate('/homework')}>
                Back to Homework
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isLoadingHomework) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading homework details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!homework) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <EmptyState
            icon={FileText}
            title="Homework Not Found"
            description="The homework assignment could not be found."
          >
            <Button onClick={() => navigate('/homework')}>Back to Homework</Button>
          </EmptyState>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/institute/${instituteId}/class/${classId}/subject/${subjectId}/homework`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Homework
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h1 className="text-xl sm:text-2xl font-bold">Homework Submissions</h1>
          </div>
        </div>

        {/* Homework Info */}
        <Card>
          <CardHeader>
            <CardTitle>{homework.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{homework.description}</p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
              {homework.startDate && (
                <span>Start: {new Date(homework.startDate).toLocaleDateString()}</span>
              )}
              {homework.endDate && (
                <span>Due: {new Date(homework.endDate).toLocaleDateString()}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submissions Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Submissions ({submissions.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <ColumnConfigurator allColumns={HSD_COL_DEFS} colState={hsdColState} onToggle={toggleHSDCol} onReset={resetHSDCols} />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void loadSubmissions(1, rowsPerPage)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load Data
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadSubmissions(page + 1, rowsPerPage)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Submissions Yet"
                description="No students have submitted this homework yet."
              />
            ) : (
              <Paper sx={{ width: '100%', height: 'calc(100vh - 390px)', display: 'flex', flexDirection: 'column' }}>
                <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                  <Table stickyHeader aria-label="homework submissions table" sx={{ tableLayout: 'fixed', minWidth: hsdVisDefs.filter(c => c.key !== 'actions' || canUploadCorrections).reduce((s, c) => s + getHSDColWidth(c.key), 0) }}>
                    <TableHead>
                      <TableRow>
                        {hsdVisDefs.filter(col => col.key !== 'actions' || canUploadCorrections).map((col) => (
                          <TableCell
                            key={col.key}
                            sx={{ position: 'relative', width: getHSDColWidth(col.key), fontWeight: 600, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))', overflow: 'hidden', whiteSpace: 'nowrap' }}
                            onMouseEnter={() => setHSDHoveredCol(col.key)}
                            onMouseLeave={() => setHSDHoveredCol(null)}
                          >
                            <div style={{ paddingRight: 12 }}>{col.header}</div>
                            <ResizeHandle colId={col.key} hoveredCol={HSDHoveredCol} activeCol={HSDActiveCol} onMouseDown={HSDStartResize} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {submissions.map((row) => (
                        <TableRow hover role="checkbox" tabIndex={-1} key={row.id}>
                          {hsdVisKeys.has('id') && <TableCell style={{ width: getHSDColWidth('id'), maxWidth: getHSDColWidth('id'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{row.id}</TableCell>}
                          {hsdVisKeys.has('studentId') && <TableCell style={{ width: getHSDColWidth('studentId'), maxWidth: getHSDColWidth('studentId'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{row.studentId || '-'}</TableCell>}
                          {hsdVisKeys.has('studentName') && <TableCell style={{ width: getHSDColWidth('studentName'), maxWidth: getHSDColWidth('studentName'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{row.studentName || `${row.student?.firstName || ''} ${row.student?.lastName || ''}`.trim() || '-'}</TableCell>}
                          {hsdVisKeys.has('submissionDate') && <TableCell style={{ width: getHSDColWidth('submissionDate'), maxWidth: getHSDColWidth('submissionDate'), overflow: 'hidden' }}>{formatDate(row.submissionDate)}</TableCell>}
                          {hsdVisKeys.has('remarks') && (
                            <TableCell style={{ width: getHSDColWidth('remarks'), maxWidth: getHSDColWidth('remarks'), overflow: 'hidden' }}>
                              {row.remarks ? (
                                <Button size="sm" variant="outline" onClick={() => { setSelectedRemark(row.remarks || ''); setRemarkDialogOpen(true); }}>
                                  <Eye className="h-4 w-4 mr-1" />View
                                </Button>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          {hsdVisKeys.has('fileUrl') && (
                            <TableCell style={{ width: getHSDColWidth('fileUrl'), maxWidth: getHSDColWidth('fileUrl'), overflow: 'hidden' }}>
                              {row.fileUrl ? (
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.open(row.fileUrl, '_blank')}>
                                  <Eye className="h-4 w-4 mr-1" />View
                                </Button>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          {hsdVisKeys.has('correctionUrl') && (
                            <TableCell style={{ width: getHSDColWidth('correctionUrl'), maxWidth: getHSDColWidth('correctionUrl'), overflow: 'hidden' }}>
                              {row.teacherCorrectionFileUrl ? (
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => window.open(row.teacherCorrectionFileUrl, '_blank')}>
                                  <Eye className="h-4 w-4 mr-1" />View
                                </Button>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          {hsdVisKeys.has('isActive') && <TableCell style={{ width: getHSDColWidth('isActive'), maxWidth: getHSDColWidth('isActive'), overflow: 'hidden' }}><Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>}
                          {hsdVisKeys.has('createdAt') && <TableCell style={{ width: getHSDColWidth('createdAt'), maxWidth: getHSDColWidth('createdAt'), overflow: 'hidden' }}>{formatDate(row.createdAt)}</TableCell>}
                          {hsdVisKeys.has('updatedAt') && <TableCell style={{ width: getHSDColWidth('updatedAt'), maxWidth: getHSDColWidth('updatedAt'), overflow: 'hidden' }}>{formatDate(row.updatedAt)}</TableCell>}
                          {hsdVisKeys.has('actions') && canUploadCorrections && (
                            <TableCell style={{ width: getHSDColWidth('actions'), maxWidth: getHSDColWidth('actions'), overflow: 'hidden' }}>
                              <Button size="sm" variant="outline" className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white" onClick={() => handleCorrectionClick(row)}>
                                <Edit className="h-4 w-4 mr-1" />Correction
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={totalSubmissions}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </Paper>
            )}
          </CardContent>
        </Card>

        {/* View Details Dialog */}
        {viewSubmission && (
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="w-[95vw] max-w-3xl max-h-[93vh] overflow-y-auto">
              <DialogHeader className="pb-2">
                <DialogTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-base leading-tight">Submission Details</p>
                    <p className="text-[13px] text-muted-foreground font-normal">
                      {viewSubmission.studentName || `${viewSubmission.student?.firstName || ''} ${viewSubmission.student?.lastName || ''}`.trim() || 'Student submission'}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Submission Overview <span className="flex-1 h-px bg-border/40" /></p>
                  <div className="divide-y divide-border/40">
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Submission ID</span>
                      <span className="text-sm font-mono font-semibold text-primary break-all">{viewSubmission.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Student ID</span>
                      <span className="text-sm font-mono font-medium break-all">{viewSubmission.studentId}</span>
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Student Name</span>
                      <span className="text-sm font-medium">{viewSubmission.studentName || `${viewSubmission.student?.firstName || ''} ${viewSubmission.student?.lastName || ''}`.trim() || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className={`text-sm font-semibold ${viewSubmission.isActive ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>{viewSubmission.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Timeline <span className="flex-1 h-px bg-border/40" /></p>
                  <div className="divide-y divide-border/40">
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Submission Date</span>
                      <span className="text-sm font-medium">{formatDate(viewSubmission.submissionDate)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Created At</span>
                      <span className="text-sm font-medium">{formatDate(viewSubmission.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Updated At</span>
                      <span className="text-sm font-medium">{formatDate(viewSubmission.updatedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Homework ID</span>
                      <span className="text-sm font-mono font-medium break-all">{viewSubmission.homeworkId}</span>
                    </div>
                  </div>
                </div>

                {(viewSubmission.fileUrl || viewSubmission.teacherCorrectionFileUrl || viewSubmission.driveViewUrl) && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Files <span className="flex-1 h-px bg-border/40" /></p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {viewSubmission.fileUrl && (
                        <Button variant="outline" onClick={() => window.open(viewSubmission.fileUrl, '_blank', 'noopener,noreferrer')} className="sm:flex-1 justify-start">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Submission File
                        </Button>
                      )}
                      {viewSubmission.driveViewUrl && (
                        <Button variant="outline" onClick={() => window.open(viewSubmission.driveViewUrl, '_blank', 'noopener,noreferrer')} className="sm:flex-1 justify-start">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Drive File
                        </Button>
                      )}
                      {viewSubmission.teacherCorrectionFileUrl && (
                        <Button variant="outline" onClick={() => window.open(viewSubmission.teacherCorrectionFileUrl, '_blank', 'noopener,noreferrer')} className="sm:flex-1 justify-start">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Correction File
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Teacher Note <span className="flex-1 h-px bg-border/40" /></p>
                  <p className="text-sm whitespace-pre-wrap">{viewSubmission.remarks || 'No remarks'}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Remark Dialog */}
        <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
          <DialogContent className="w-[92vw] max-w-2xl">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-base leading-tight">Teacher Note</p>
                  <p className="text-[13px] text-muted-foreground font-normal">Submission remark details</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Note <span className="flex-1 h-px bg-border/40" /></p>
              <p className="text-sm whitespace-pre-wrap">{selectedRemark || 'No remarks'}</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Correction Upload Dialog */}
        {selectedSubmission && (
          <UploadCorrectionDialog
            submissionId={selectedSubmission.id}
            studentName={`${selectedSubmission.student?.firstName} ${selectedSubmission.student?.lastName}`}
            submission={selectedSubmission}
            isOpen={correctionDialogOpen}
            onClose={() => setCorrectionDialogOpen(false)}
            onSuccess={handleCorrectionSuccess}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default HomeworkSubmissionDetails;
