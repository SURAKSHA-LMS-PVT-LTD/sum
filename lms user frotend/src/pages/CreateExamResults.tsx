import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Save, RefreshCw, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import donutChartIcon from '@/assets/donut-chart.png';
import { examApi } from '@/api/exam.api';
import { examResultsApi, type Grade } from '@/api/examResults.api';
import GradeConfigurationCard, { GradeRange } from '@/components/GradeConfigurationCard';
import { cn } from '@/lib/utils';

// Parse URL params manually since we use catch-all routes
const parseUrlParams = (pathname: string) => {
  // IDs can be numeric or UUID — match any non-slash sequence
  const instituteMatch = pathname.match(/\/institute\/([^/]+)/);
  const classMatch = pathname.match(/\/class\/([^/]+)/);
  const subjectMatch = pathname.match(/\/subject\/([^/]+)/);
  const examMatch = pathname.match(/\/exam\/([^/]+)/);

  return {
    instituteId: instituteMatch?.[1] || null,
    classId: classMatch?.[1] || null,
    subjectId: subjectMatch?.[1] || null,
    examId: examMatch?.[1] || null,
  };
};

interface Student {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  userIdByInstitute: string;
}

interface StudentResult {
  studentId: string;
  score: string;
  grade: Grade | '';
  remarks: string;
}

const defaultGradeRanges: GradeRange[] = [
  { grade: 'A', minScore: 75, maxScore: 100 },
  { grade: 'B', minScore: 65, maxScore: 74 },
  { grade: 'C', minScore: 55, maxScore: 64 },
  { grade: 'S', minScore: 40, maxScore: 54 },
  { grade: 'F', minScore: 0, maxScore: 39 }
];

const defaultRemarks: Record<string, string> = {
  'A': 'Excellent',
  'B': 'Very Good',
  'C': 'Credit Pass',
  'S': 'Ordinary Pass (Satisfactory)',
  'F': 'Fail'
};

const CreateExamResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Parse URL params manually since useParams doesn't work with catch-all routes
  const { instituteId, classId, subjectId, examId } = parseUrlParams(location.pathname);
  
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<Record<string, StudentResult>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gradeRanges, setGradeRanges] = useState<GradeRange[]>(defaultGradeRanges);
  const [gradeConfigOpen, setGradeConfigOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [examId, instituteId, classId, subjectId]);

  const loadData = async () => {
    if (!examId || !instituteId || !classId || !subjectId) {
      return;
    }

    setLoading(true);
    try {
      // Load exam details
      const examsResponse = await examApi.getExams({
        instituteId,
        classId,
        subjectId,
        page: 1,
        limit: 50
      });
      const examData = examsResponse.data.find((e: any) => e.id === examId);
      if (examData) setExam(examData);

      // Load students WITH their existing marks in one call
      const studentsWithMarks = await examResultsApi.getStudentsWithMarks({
        instituteId,
        classId,
        subjectId,
        examId,
      });

      const studentsData: Student[] = studentsWithMarks.map((s) => ({
        id: s.userId,
        name: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.userId,
        email: '',
        imageUrl: s.imageUrl ?? undefined,
        userIdByInstitute: '',
      }));

      setStudents(studentsData);

      // Pre-populate results — use existing mark if already graded
      const isUngraded = (s: typeof studentsWithMarks[number]) =>
        s.score === '0' && s.grade === null;

      const initialResults: Record<string, StudentResult> = {};
      studentsWithMarks.forEach((s) => {
        initialResults[s.userId] = {
          studentId: s.userId,
          score: isUngraded(s) ? '' : s.score,
          grade: s.grade ?? '',
          remarks: '',
        };
      });
      setResults(initialResults);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load students. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateGradeAndRemarks = (score: string): { grade: string; remarks: string } => {
    const numScore = parseFloat(score);
    
    if (isNaN(numScore) || numScore < 0) {
      return { grade: '', remarks: '' };
    }
    
    // Find the matching grade range
    for (const range of gradeRanges) {
      if (numScore >= range.minScore && numScore <= range.maxScore) {
        return { grade: range.grade, remarks: defaultRemarks[range.grade] || '' };
      }
    }
    
    return { grade: '', remarks: '' };
  };

  const handleResultChange = (studentId: string, field: keyof StudentResult, value: string) => {
    setResults(prev => {
      const updatedResult = {
        ...prev[studentId],
        [field]: value
      };
      
      // Auto-calculate grade and remarks when score changes
      if (field === 'score' && value) {
        const { grade, remarks } = calculateGradeAndRemarks(value);
        updatedResult.grade = grade as any;
        updatedResult.remarks = remarks;
      }
      
      return {
        ...prev,
        [studentId]: updatedResult
      };
    });
  };

  const handleSubmit = async () => {
    if (!examId || !instituteId || !classId || !subjectId) {
      return;
    }

    // Filter out students without scores
    const validResults = Object.values(results).filter(result => result.score !== '');

    if (validResults.length === 0) {
      toast({
        title: "No Results",
        description: "Please enter at least one student's result.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      await examResultsApi.createBulkResults({
        instituteId: instituteId,
        classId: classId,
        subjectId: subjectId,
        examId: examId,
        results: validResults.map(r => ({
          studentId: r.studentId,
          score: r.score || undefined,
          grade: (r.grade as Grade) || undefined,
          remarks: r.remarks || undefined,
        })),
      });

      toast({
        title: "Success",
        description: `Results created for ${validResults.length} student(s).`
      });

      navigate(`/institute/${instituteId}/class/${classId}/subject/${subjectId}/exams`);
    } catch (error: any) {
      console.error('Error creating results:', error);
      toast({
        title: "Error",
        description: "Failed to create results. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/institute/${instituteId}/class/${classId}/subject/${subjectId}/exams`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Create Exam Results</h1>
            {exam && (
              <p className="text-muted-foreground mt-1">
                {exam.title} - Enter marks for each student
              </p>
            )}
          </div>
          <Dialog open={gradeConfigOpen} onOpenChange={setGradeConfigOpen} routeName="grade-configuration-popup">
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <img src={donutChartIcon} alt="Grade Configuration" className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Grade Configuration</DialogTitle>
              </DialogHeader>
              <GradeConfigurationCard
                gradeRanges={gradeRanges}
                onGradeRangesChange={setGradeRanges}
                onReset={() => setGradeRanges(defaultGradeRanges)}
                onSave={() => {
                  toast({
                    title: "Success",
                    description: "Grade configuration saved successfully",
                  });
                  setGradeConfigOpen(false);
                }}
                onClose={() => setGradeConfigOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Students Found"
          description="No students found for this class and subject."
        />
      ) : (
        <>
          <div className="space-y-4">
            {students.map((student) => (
              <Card key={student.id}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={student.imageUrl} alt={student.name} />
                      <AvatarFallback>
                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {student.userIdByInstitute} • {student.email}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`score-${student.id}`}>Score</Label>
                      <Input
                        id={`score-${student.id}`}
                        type="number"
                        placeholder="Enter score"
                        value={results[student.id]?.score || ''}
                        onChange={(e) => handleResultChange(student.id, 'score', e.target.value)}
                        className={cn(
                          "font-bold",
                          results[student.id]?.grade === 'A' && "text-green-600 dark:text-green-400 border-green-500",
                          results[student.id]?.grade === 'B' && "text-blue-600 dark:text-blue-400 border-blue-500",
                          results[student.id]?.grade === 'C' && "text-teal-600 dark:text-teal-400 border-teal-500",
                          results[student.id]?.grade === 'S' && "text-yellow-600 dark:text-yellow-400 border-yellow-500",
                          results[student.id]?.grade === 'F' && "text-red-600 dark:text-red-400 border-red-500"
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`grade-${student.id}`}>Grade (Auto)</Label>
                      <Input
                        id={`grade-${student.id}`}
                        placeholder="Auto-filled"
                        value={results[student.id]?.grade || ''}
                        readOnly
                        className={cn(
                          "bg-muted font-bold",
                          results[student.id]?.grade === 'A' && "text-green-600 dark:text-green-400",
                          results[student.id]?.grade === 'B' && "text-blue-600 dark:text-blue-400",
                          results[student.id]?.grade === 'C' && "text-teal-600 dark:text-teal-400",
                          results[student.id]?.grade === 'S' && "text-yellow-600 dark:text-yellow-400",
                          results[student.id]?.grade === 'F' && "text-red-600 dark:text-red-400"
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`remarks-${student.id}`}>Remarks</Label>
                      <Input
                        id={`remarks-${student.id}`}
                        placeholder="Enter or auto-fill remarks"
                        value={results[student.id]?.remarks || ''}
                        onChange={(e) => handleResultChange(student.id, 'remarks', e.target.value)}
                        className={cn(
                          "font-medium",
                          results[student.id]?.grade === 'A' && "text-green-600 dark:text-green-400",
                          results[student.id]?.grade === 'B' && "text-blue-600 dark:text-blue-400",
                          results[student.id]?.grade === 'C' && "text-teal-600 dark:text-teal-400",
                          results[student.id]?.grade === 'S' && "text-yellow-600 dark:text-yellow-400",
                          results[student.id]?.grade === 'F' && "text-red-600 dark:text-red-400"
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate('/exams')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Results
                </>
              )}
            </Button>
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default CreateExamResults;
