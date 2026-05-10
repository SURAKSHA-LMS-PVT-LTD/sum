import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { RefreshCw, Users, Award, Calendar, FileText, Search } from 'lucide-react';
import { examResultsApi, type ExamResult, type ExamResultsResponse } from '@/api/examResults.api';
import { EmptyState } from '@/components/ui/EmptyState';

interface ExamResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exam: {
    id: string;
    title: string;
    examType: string;
    totalMarks: string;
    passingMarks: string;
  } | null;
}

export const ExamResultsDialog = ({ isOpen, onClose, exam }: ExamResultsDialogProps) => {
  const { user, currentInstituteId, currentClassId, currentSubjectId, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  
  const [results, setResults] = useState<ExamResult[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadExamResults = async () => {
    if (!exam || !currentInstituteId || !currentClassId || !currentSubjectId) {
      toast({
        title: "Error",
        description: "Missing required selection data",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const params = {
        page: 1,
        limit: 10,
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        examId: exam.id,
        userId: user?.id,
        role: userRole
      };

      const response = await examResultsApi.getExamResults(params, true);
      
      setResults(response.data);
      setMeta(response.meta);
      setHasLoaded(true);
      
      toast({
        title: "Results Loaded",
        description: `Successfully loaded ${response.data.length} exam results`
      });
      
    } catch (error: any) {
      console.error('Error loading exam results:', error);
      toast({
        title: "Error",
        description: "Failed to load exam results",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'B+':
      case 'B':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'C+':
      case 'C':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'F':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPassStatus = (score: string, passingMarks: string) => {
    const numScore = parseFloat(score);
    const numPassing = parseFloat(passingMarks);
    return numScore >= numPassing;
  };

  // Filter results based on search term
  const filteredResults = results.filter(result => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      result.student.firstName.toLowerCase().includes(searchLower) ||
      result.student.lastName.toLowerCase().includes(searchLower) ||
      result.student.email.toLowerCase().includes(searchLower) ||
      result.grade.toLowerCase().includes(searchLower) ||
      (result.remarks && result.remarks.toLowerCase().includes(searchLower))
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Exam Results</p>
              <p className="text-sm text-muted-foreground font-normal mt-0.5">{exam?.title}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Context */}
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Context <span className="flex-1 h-px bg-border/40" /></p>
          <div className="divide-y divide-border/40">
            {selectedInstitute?.name && (
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Institute</span>
                <span className="text-sm font-medium">{selectedInstitute.name}</span>
              </div>
            )}
            {selectedClass?.name && (
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Class</span>
                <span className="text-sm font-medium">{selectedClass.name}</span>
              </div>
            )}
            {selectedSubject?.name && (
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Subject</span>
                <span className="text-sm font-medium">{selectedSubject.name}</span>
              </div>
            )}
            {exam && (
              <>
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-muted-foreground">Exam Type</span>
                  <span className="text-sm font-medium">{exam.examType}</span>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-muted-foreground">Total Marks</span>
                  <span className="text-sm font-semibold text-primary">{exam.totalMarks}</span>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-muted-foreground">Passing Marks</span>
                  <span className="text-sm font-semibold text-green-700 dark:text-green-300">{exam.passingMarks}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Load Results Button */}
        {!hasLoaded && (
          <EmptyState
            icon={Award}
            title="Exam Results"
            description="Click the button below to load exam results for this exam"
          >
            <Button
              onClick={loadExamResults}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Loading Results...</>
              ) : (
                <><Users className="h-4 w-4" />Load Exam Results</>
              )}
            </Button>
          </EmptyState>
        )}

        {/* Results Table */}
        {hasLoaded && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-3">
                Results — {results.length} students
                {meta && ` · Page ${meta.page}/${meta.totalPages}`}
                <span className="flex-1 h-px bg-border/40" />
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search students, grade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 text-sm w-60"
                />
              </div>
            </div>
            {filteredResults.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={searchTerm ? 'No results match your search' : 'No Results Found'}
                description={searchTerm ? 'Try a different search term' : 'No results found for this exam'}
              />
            ) : (
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-sm font-semibold">Student</TableHead>
                        <TableHead className="text-sm font-semibold">Email</TableHead>
                        <TableHead className="text-sm font-semibold">Score</TableHead>
                        <TableHead className="text-sm font-semibold">Grade</TableHead>
                        <TableHead className="text-sm font-semibold">Pass/Fail</TableHead>
                        <TableHead className="text-sm font-semibold">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow key={result.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-base">
                            {result.student.firstName} {result.student.lastName}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{result.student.email}</TableCell>
                          <TableCell>
                            <span className="font-bold text-base">{result.score}</span>
                            <span className="text-muted-foreground text-sm"> / {exam?.totalMarks}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-sm ${getGradeColor(result.grade)}`}>
                              {result.grade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {exam && (
                              <Badge
                                variant={getPassStatus(result.score, exam.passingMarks) ? 'default' : 'destructive'}
                                className="text-sm"
                              >
                                {getPassStatus(result.score, exam.passingMarks) ? 'Pass' : 'Fail'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{result.remarks || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          {hasLoaded && (
            <Button 
              variant="outline" 
              onClick={loadExamResults}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};