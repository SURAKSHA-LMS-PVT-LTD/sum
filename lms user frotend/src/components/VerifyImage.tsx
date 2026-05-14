import React, { useState, useEffect, useMemo } from 'react';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { RefreshCw, CheckCircle, Eye, XCircle, ImageIcon, ChevronDown, Phone, Mail, LayoutGrid, Table2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  type InstituteUnverifiedImageItem,
  profileImageApi,
} from '@/api/profileImage.api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { getImageUrl } from '@/utils/imageUrlHelper';

type VIAlign = 'right' | 'left' | 'center';
interface VIColDef extends ColumnDef { align?: VIAlign; }
const VI_COL_DEFS: VIColDef[] = [
  { key: 'image', header: 'Submitted Image', locked: true, defaultWidth: 110, minWidth: 80, align: 'center' },
  { key: 'userId', header: 'User ID', defaultVisible: false, defaultWidth: 80, minWidth: 60 },
  { key: 'name', header: 'Name', locked: true, defaultWidth: 170, minWidth: 120 },
  { key: 'email', header: 'Email', defaultVisible: true, defaultWidth: 200, minWidth: 140 },
  { key: 'phoneNumber', header: 'Phone', defaultVisible: true, defaultWidth: 130, minWidth: 90 },
  { key: 'userType', header: 'Type', defaultVisible: true, defaultWidth: 90, minWidth: 70 },
  { key: 'studentId', header: 'Institute ID', defaultVisible: true, defaultWidth: 120, minWidth: 90 },
  { key: 'actions', header: 'Actions', locked: true, defaultWidth: 230, minWidth: 180, align: 'center' },
];

const VerifyImage = () => {
  const { user, currentInstituteId, selectedInstitute } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<InstituteUnverifiedImageItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<InstituteUnverifiedImageItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; userMetadata?: { userId?: string; email?: string; phoneNumber?: string; instituteUserType?: string; } } | null>(null);

  const [viewMode, setViewMode] = useState<'card' | 'table'>(() =>
    (localStorage.getItem('viewMode') as 'card' | 'table') || 'card'
  );

  const { getWidth: getVIColWidth, totalWidth: totalVITableWidth, setHoveredCol: setVIHoveredCol, ResizeHandle: VIResizeHandle } = useResizableColumns(
    ['image', 'userId', 'name', 'email', 'phoneNumber', 'userType', 'studentId', 'actions'],
    { image: 110, userId: 80, name: 170, email: 200, phoneNumber: 130, userType: 90, studentId: 120, actions: 230 }
  );
  const { colState: viColState, visibleColumns: visColDefs, toggleColumn: toggleVICol, resetColumns: resetVICols } = useColumnConfig(VI_COL_DEFS, 'verify-image');
  const visibleVIKeys = useMemo(() => new Set(visColDefs.map(c => c.key)), [visColDefs]);
  const visibleVITotal = useMemo(() => (visColDefs as VIColDef[]).reduce((sum, col) => sum + getVIColWidth(col.key), 0), [visColDefs, getVIColWidth]);

  const renderVICell = (colKey: string, student: InstituteUnverifiedImageItem) => {
    const imageUrl = getImageUrl(student.instituteUserImageUrl);
    const displayName = student.nameWithInitials || '—';
    switch (colKey) {
      case 'image': return (
        <div className="flex flex-col items-center gap-1">
          <Avatar className="h-16 w-16 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImage({ url: imageUrl, title: `${displayName} — Submitted Image`, userMetadata: { userId: student.userId, email: student.email, phoneNumber: student.phoneNumber, instituteUserType: student.instituteUserType } })}>
            <AvatarImage src={imageUrl} alt={displayName} />
            <AvatarFallback>{displayName.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <Badge variant="outline" className={`text-xs ${student.imageVerificationStatus === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' : student.imageVerificationStatus === 'VERIFIED' ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' : 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'}`}>
            <ImageIcon className="h-3 w-3 mr-1" />{student.imageVerificationStatus}
          </Badge>
        </div>
      );
      case 'userId': return <>{student.userId}</>;
      case 'name': return <>{displayName}</>;
      case 'email': return <>{student.email || '—'}</>;
      case 'phoneNumber': return <>{student.phoneNumber || '—'}</>;
      case 'userType': return <Badge variant="secondary" className="text-xs">{student.instituteUserType || '—'}</Badge>;
      case 'studentId': return <>{student.userIdByInstitute || '—'}</>;
      case 'actions': return (
        <div className="flex justify-center items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewDetails(student)}><Eye className="h-4 w-4 mr-1" /> View</Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveImage(student)} disabled={approvingIds.has(student.userId)}><CheckCircle className="h-4 w-4 mr-1" />{approvingIds.has(student.userId) ? 'Approving...' : 'Approve'}</Button>
          <Button size="sm" variant="destructive" onClick={() => openRejectDialog(student)} disabled={rejectingIds.has(student.userId)}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
        </div>
      );
      default: return null;
    }
  };
  const userRole = useInstituteRole();

  // Auto-load on mount
  useEffect(() => {
    if (currentInstituteId && userRole === 'InstituteAdmin') {
      fetchUnverifiedImages();
    }
  }, [currentInstituteId]);

  if (userRole !== 'InstituteAdmin') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Access denied. InstituteAdmin role required.</p>
      </div>
    );
  }

  if (!currentInstituteId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please select an institute first.</p>
      </div>
    );
  }

  const fetchUnverifiedImages = async () => {
    if (!currentInstituteId) return;
    setIsLoading(true);
    try {
      const result = await profileImageApi.getInstituteUnverifiedImages(currentInstituteId, { page, limit });
      setStudents(result.data || []);
      setTotalCount(result.total || 0);
    } catch (error: any) {
      console.error('Error fetching unverified images:', error);
      toast({
        title: "Error",
        description: "Failed to load unverified images",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (student: InstituteUnverifiedImageItem) => {
    setSelectedStudent(student);
    setIsViewDialogOpen(true);
  };

  const handleApproveImage = async (student: InstituteUnverifiedImageItem) => {
    if (!currentInstituteId) return;
    setApprovingIds(prev => new Set(prev).add(student.userId));
    try {
      const result = await profileImageApi.verifyInstituteUserImage(currentInstituteId, student.userId, { status: 'VERIFIED' });
      toast({
        title: "Image Approved",
        description: result.message || "Image has been approved successfully",
        duration: 1500
      });
      fetchUnverifiedImages();
    } catch (error: any) {
      console.error('Error approving image:', error);
      toast({ title: "Error", description: "Failed to approve image", variant: "destructive", duration: 1500 });
    } finally {
      setApprovingIds(prev => { const s = new Set(prev); s.delete(student.userId); return s; });
    }
  };

  const handleRejectImage = async () => {
    if (!selectedStudent || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive", duration: 1500 });
      return;
    }
    if (!currentInstituteId) return;

    setRejectingIds(prev => new Set(prev).add(selectedStudent.userId));
    try {
      const result = await profileImageApi.verifyInstituteUserImage(currentInstituteId, selectedStudent.userId, {
        status: 'REJECTED',
        rejectionReason,
      });

      toast({
        title: "Image Rejected",
        description: result.message || "Image has been rejected and user notified",
        duration: 1500
      });

      setIsRejectDialogOpen(false);
      setRejectionReason('');
      setSelectedStudent(null);
      fetchUnverifiedImages();
    } catch (error: any) {
      console.error('Error rejecting image:', error);
      toast({ title: "Error", description: "Failed to reject image", variant: "destructive", duration: 1500 });
    } finally {
      setRejectingIds(prev => { const s = new Set(prev); s.delete(selectedStudent!.userId); return s; });
    }
  };

  const openRejectDialog = (student: InstituteUnverifiedImageItem) => {
    setSelectedStudent(student);
    setIsRejectDialogOpen(true);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLimit(+event.target.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 pb-4">
        <div>
          <h1 className="text-3xl font-bold">Verify Image</h1>
          <p className="text-muted-foreground mt-1">
            Verify and manage user images for {selectedInstitute?.name || 'institute'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnConfigurator allColumns={VI_COL_DEFS} colState={viColState} onToggle={toggleVICol} onReset={resetVICols} />
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View">
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          <Button
            onClick={fetchUnverifiedImages}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="px-4 pb-4 grid grid-cols-1 gap-4 overflow-y-auto">
          {students.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              {isLoading ? <p className="text-lg">Loading images...</p> : (
                <><p className="text-lg font-medium">No pending images</p><p className="text-sm">All user images have been verified.</p></>
              )}
            </div>
          ) : students.map((student) => {
            const imageUrl = getImageUrl(student.instituteUserImageUrl);
            const displayName = student.nameWithInitials || '—';
            const status = student.imageVerificationStatus;
            return (
              <Card key={student.userId} className="overflow-hidden hover:shadow-lg transition-all duration-200">
                <div className={`h-1.5 w-full ${
                  status === 'VERIFIED' ? 'bg-green-500' :
                  status === 'REJECTED' ? 'bg-destructive' : 'bg-amber-400'
                }`} />
                <div className="p-4 flex items-center gap-3">
                  <Avatar
                    className="h-16 w-16 ring-2 ring-offset-2 ring-muted hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
                    onClick={() => setPreviewImage({ url: imageUrl, title: `${displayName} — Submitted Image`, userMetadata: { userId: student.userId, email: student.email, phoneNumber: student.phoneNumber, instituteUserType: student.instituteUserType } })}
                  >
                    <AvatarImage src={imageUrl} alt={displayName} />
                    <AvatarFallback className="font-bold">{displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold truncate">{displayName}</p>
                      <Badge className={`text-xs shrink-0 ${
                        status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' :
                        status === 'VERIFIED' ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' :
                        'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                      }`} variant="outline">
                        {status}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs mb-2">{student.instituteUserType || '—'}</Badge>
                    <div className="text-[13px] text-muted-foreground space-y-0.5">
                      {student.email && <p className="truncate"><Mail className="h-3 w-3 inline mr-1" />{student.email}</p>}
                      {student.phoneNumber && <p><Phone className="h-3 w-3 inline mr-1" />{student.phoneNumber}</p>}
                      {student.userIdByInstitute && <p>ID: <span className="font-medium text-foreground">{student.userIdByInstitute}</span></p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleViewDetails(student)} title="View Details">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApproveImage(student)}
                      disabled={approvingIds.has(student.userId)}
                      title="Approve Image"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(student)}
                      disabled={rejectingIds.has(student.userId)}
                      title="Reject Image"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
      <Paper sx={{ 
        flex: 1, 
        overflow: 'hidden',
        mx: 3,
        mb: 3,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader aria-label="sticky table" sx={{ tableLayout: 'fixed', minWidth: visibleVITotal }}>
            <TableHead>
              <TableRow>
                {(visColDefs as VIColDef[]).map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.align}
                    onMouseEnter={() => setVIHoveredCol(col.key)}
                    onMouseLeave={() => setVIHoveredCol(null)}
                    style={{ position: 'relative', width: getVIColWidth(col.key), userSelect: 'none' }}
                    sx={{ fontWeight: 'bold', backgroundColor: 'rgba(0, 0, 0, 0.04)' }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.header}</div>
                    <VIResizeHandle colId={col.key} isActions={col.key === 'actions'} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visColDefs.length} align="center">
                    <div className="py-12 text-center text-gray-500">
                      {isLoading ? (
                        <p className="text-lg">Loading images...</p>
                      ) : (
                        <>
                          <p className="text-lg">No pending images</p>
                          <p className="text-sm">All user images have been verified, or there are no users with unverified images.</p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => {
                  return (
                  <TableRow hover role="checkbox" tabIndex={-1} key={student.userId}>
                    {(visColDefs as VIColDef[]).map(col => (
                      <TableCell key={col.key} align={col.align}>
                        {renderVICell(col.key, student)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={limit}
          page={page - 1}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      )}

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto mx-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-3">
              {selectedStudent && (
                <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                  <AvatarImage src={getImageUrl(selectedStudent.instituteUserImageUrl)} alt="Submitted"
                    onClick={() => setPreviewImage({ url: getImageUrl(selectedStudent.instituteUserImageUrl), title: `${selectedStudent.nameWithInitials || selectedStudent.userId} — Submitted`, userMetadata: { userId: selectedStudent.userId, email: selectedStudent.email, phoneNumber: selectedStudent.phoneNumber, instituteUserType: selectedStudent.instituteUserType } })}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {(selectedStudent.nameWithInitials || 'U').split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <p className="font-bold text-base leading-tight">{selectedStudent?.nameWithInitials || 'User Details'}</p>
                <p className="text-[13px] text-muted-foreground font-mono mt-0.5">{selectedStudent?.userId}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Identity <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">System User ID</span>
                    <span className="text-sm font-mono font-semibold text-primary">{selectedStudent.userId}</span>
                  </div>
                  {selectedStudent.userIdByInstitute && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Institute ID</span>
                      <span className="text-sm font-mono font-medium">{selectedStudent.userIdByInstitute}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">User Type</span>
                    <span className="text-sm font-medium">{selectedStudent.instituteUserType || '—'}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Contact <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  {selectedStudent.email && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-xs font-medium break-all">{selectedStudent.email}</span>
                    </div>
                  )}
                  {selectedStudent.phoneNumber && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Phone</span>
                      <span className="text-sm font-medium">{selectedStudent.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Verification Status</span>
                    <span className="text-sm font-semibold">{selectedStudent.imageVerificationStatus}</span>
                  </div>
                </div>
              </div>

              <button
                className="text-xs text-primary hover:underline font-medium"
                onClick={() => setPreviewImage({ url: getImageUrl(selectedStudent.instituteUserImageUrl), title: `${selectedStudent.nameWithInitials || selectedStudent.userId} — Submitted`, userMetadata: { userId: selectedStudent.userId, email: selectedStudent.email, phoneNumber: selectedStudent.phoneNumber, instituteUserType: selectedStudent.instituteUserType } })}
              >
                View full image →
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Image</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this image
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                placeholder="e.g., Image quality is too poor"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setRejectionReason('');
                  setSelectedStudent(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectImage}
                disabled={!rejectionReason.trim() || (selectedStudent ? rejectingIds.has(selectedStudent.userId) : false)}
              >
                {selectedStudent && rejectingIds.has(selectedStudent.userId) ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Image
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageUrl={previewImage.url}
          title={previewImage.title}
          userMetadata={previewImage.userMetadata}
        />
      )}
    </div>
  );
};

export default VerifyImage;
