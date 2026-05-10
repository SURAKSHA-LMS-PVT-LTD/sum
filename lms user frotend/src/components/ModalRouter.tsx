import React from 'react';
import { useModalRouting } from '@/utils/modalRouting';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import StudentDetailsDialog from '@/components/forms/StudentDetailsDialog';
import HomeworkDetailsDialog from '@/components/forms/HomeworkDetailsDialog';
import PaymentSubmissionsDialog from '@/components/PaymentSubmissionsDialog';
import VerifySubmissionDialog from '@/components/forms/VerifySubmissionDialog';
import { studentsApi } from '@/api/students.api';
import { homeworkApi, Homework } from '@/api/homework.api';
import { cachedApiClient } from '@/api/cachedClient';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 🔒 SECURE Modal Router
 * - Fetches sensitive URLs server-side, never exposes in browser URL
 * - All modals driven by resource IDs (videoRef, studentId, etc.)
 * - Persists modal state on refresh via URL query params
 */
const ModalRouter: React.FC = () => {
  const { active, closeModal } = useModalRouting();
  const { selectedInstitute } = useAuth();
  const [student, setStudent] = React.useState<any | null>(null);
  const [homework, setHomework] = React.useState<Homework | null>(null);
  const [submission, setSubmission] = React.useState<any | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string>('');
  const [videoTitle, setVideoTitle] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setStudent(null);
    setHomework(null);
    setSubmission(null);
    setVideoUrl('');
    setVideoTitle('');
    setLoading(false);
    
    if (!active) return;

    const load = async () => {
      try {
        setLoading(true);

        // 🔒 SECURITY: Fetch video URL from backend using lectureId or videoRef
        if (active.name === 'video' && active.params.lectureId) {
          const lecture = await cachedApiClient.get(`/lectures/${active.params.lectureId}`);
          setVideoUrl(lecture.videoUrl || lecture.referenceLink || '');
          setVideoTitle(lecture.title || active.params.title || 'Video');
        } else if (active.name === 'video' && active.params.videoRef) {
          // Fetch video metadata from backend by videoRef
          const video = await cachedApiClient.get(`/videos/${active.params.videoRef}`);
          setVideoUrl(video.url || '');
          setVideoTitle(video.title || active.params.title || 'Video');
        }

        if (active.name === 'student' && active.params.studentId) {
          const data = await studentsApi.getById(active.params.studentId);
          setStudent({
            id: data.user.id,
            name: `${data.user.firstName} ${data.user.lastName}`.trim(),
            email: data.user.email,
            phoneNumber: data.user.phoneNumber,
            imageUrl: data.user.imageUrl,
            studentId: data.studentId,
            userIdByInstitute: data.studentId,
            dateOfBirth: data.user.dateOfBirth,
            emergencyContact: data.emergencyContact,
            medicalConditions: data.medicalConditions,
            allergies: data.allergies
          });
        }

        if (active.name === 'homework' && active.params.homeworkId) {
          const hw = await homeworkApi.getHomeworkById(active.params.homeworkId);
          setHomework(hw);
        }

        if (active.name === 'verifySubmission' && active.params.submissionId) {
          const sub = await cachedApiClient.get(`/payment-submissions/${active.params.submissionId}`);
          setSubmission(sub);
        }
      } catch (error: any) {
        console.error('Failed to load modal data:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [active]);

  if (!active) return null;

  const onOpenChange = (open: boolean) => {
    if (!open) closeModal();
  };

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  switch (active.name) {
    case 'video': {
      if (!videoUrl) return null;
      return (
        <VideoPreviewDialog open={true} onOpenChange={onOpenChange} url={videoUrl} title={videoTitle} />
      );
    }
    case 'student': {
      return (
        <StudentDetailsDialog open={true} onOpenChange={onOpenChange} student={student} />
      );
    }
    case 'homework': {
      return (
        <HomeworkDetailsDialog isOpen={true} onClose={() => onOpenChange(false)} homework={homework} />
      );
    }
    case 'paymentSubmissions': {
      const paymentId = String(active.params.paymentId || '');
      const paymentTitle = String(active.params.paymentTitle || 'Payment');
      return (
        <PaymentSubmissionsDialog open={true} onOpenChange={onOpenChange} paymentId={paymentId} paymentTitle={paymentTitle} />
      );
    }
    case 'verifySubmission': {
      if (!submission || !selectedInstitute) return null;
      return (
        <VerifySubmissionDialog 
          open={true} 
          onOpenChange={onOpenChange} 
          submission={submission} 
          instituteId={String(selectedInstitute.id)} 
          onSuccess={() => {
            closeModal();
            window.location.reload(); // Refresh to show updated data
          }}
        />
      );
    }
    default:
      return null;
  }
};

export default ModalRouter;

