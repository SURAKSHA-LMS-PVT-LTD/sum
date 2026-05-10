import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Award, RefreshCw, AlertTriangle, TrendingUp, BookOpen, Target,
  ArrowLeft, Search, Users, ChevronDown, ChevronUp, User, Hash, FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { examResultsApi, type ExamResult, type ExamResultsQueryParams } from '@/api/examResults.api';
import { useApiRequest } from '@/hooks/useApiRequest';
import { EmptyState } from '@/components/ui/EmptyState';
import MUITable from '@/components/ui/mui-table';
import { cn } from '@/lib/utils';

// Parse URL params manually since we use catch-all routes
const parseUrlParams = (pathname: string) => {
  const instituteMatch = pathname.match(/\/institute\/(\d+)/);
  const classMatch = pathname.match(/\/class\/(\d+)/);
  const subjectMatch = pathname.match(/\/subject\/(\d+)/);
  const examMatch = pathname.match(/\/exam\/(\d+)/);
  return {
    instituteId: instituteMatch?.[1] || null,
    classId: classMatch?.[1] || null,
    subjectId: subjectMatch?.[1] || null,
    examId: examMatch?.[1] || null,
  };
};

// Custom Toggle Switch Component
const ViewToggle = ({ isCard, onChange }: { isCard: boolean; onChange: (val: boolean) => void }) => (
  <div className="flex items-center gap-2.5">
    <span className={cn("text-xs font-medium transition-colors", !isCard ? "text-primary" : "text-muted-foreground")}>Table</span>
    <label className="relative inline-block w-[3.5em] h-[2em] text-[17px]">
      <input
        type="checkbox"
        checked={isCard}
        onChange={e => onChange(e.target.checked)}
        className="opacity-0 w-0 h-0"
      />
      <span
        className={cn(
          "absolute cursor-pointer inset-0 rounded-[30px] transition-all duration-400",
          isCard
            ? "bg-primary border border-primary"
            : "bg-background border border-muted-foreground/40"
        )}
      >
        <span
          className={cn(
            "absolute h-[1.4em] w-[1.4em] rounded-[20px] left-[0.27em] bottom-[0.25em] transition-all duration-400",
            isCard ? "translate-x-[1.4em] bg-primary-foreground" : "translate-x-0 bg-muted-foreground"
          )}
        />
      </span>
    </label>
    <span className={cn("text-xs font-medium transition-colors", isCard ? "text-primary" : "text-muted-foreground")}>Card</span>
  </div>
);

const ExamResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { instituteId, classId, subjectId, examId } = parseUrlParams(location.pathname);

  const [examDetails, setExamDetails] = useState<{
    title?: string; examType?: string; totalMarks?: string; passingMarks?: string;
  }>({});
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const { toast } = useToast();
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [isCardView] = useState(() => {
    return (localStorage.getItem('viewMode') || 'card') === 'card';
  });
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { execute: fetchResults, loading } = useApiRequest(examResultsApi.getExamResults);
  const contextKey = `${instituteId}-${classId}-${subjectId}-${examId}`;
  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');

  const toggleResultCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadExamResults = async (page = currentPage) => {
    if (!instituteId || !classId || !subjectId) {
      toast({ title: "Selection Required", description: "Please select institute, class, and subject to view exam results", variant: "destructive" });
      return;
    }
    try {
      const params: ExamResultsQueryParams = { page, limit: 10, instituteId, classId, subjectId };
      if (examId) params.examId = examId;
      const response = await fetchResults(params, true);
      setExamResults(response.data);
      setTotalResults(response.meta.total);
      setTotalPages(response.meta.totalPages);
      setHasNextPage(response.meta.hasNextPage);
      setHasPreviousPage(response.meta.hasPreviousPage);
      setCurrentPage(page);
      setLastRefresh(new Date());
      if (response.data.length > 0 && !examDetails.title) {
        const firstResult = response.data[0];
        setExamDetails({ title: firstResult.exam.title, examType: firstResult.exam.examType });
      }
      toast({ title: "Results Loaded", description: `Loaded ${response.data.length} exam results` });
    } catch (error: any) {
      console.error('Error loading exam results:', error);
      toast({ title: "Error", description: "Failed to load exam results", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (instituteId && classId && subjectId && examId && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      loadExamResults(1);
    }
  }, [contextKey]);

  const handlePageChange = (newPage: number) => { loadExamResults(newPage); };
  const handleGoBack = () => { navigate(`/institute/${instituteId}/class/${classId}/subject/${subjectId}/exams`); };

  const getContextBreadcrumb = () => {
    const parts = [];
    if (selectedInstitute) parts.push(selectedInstitute.name);
    if (selectedClass) parts.push(selectedClass.name);
    if (selectedSubject) parts.push(selectedSubject.name);
    return parts.length > 0 ? `Exams (${parts.join(' → ')})` : 'Exams';
  };

  const getGradeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
      case 'A+': case 'A': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'B+': case 'B': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'C+': case 'C': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'D': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'F': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const calculateAverageScore = () => {
    if (examResults.length === 0) return 0;
    const totalScore = examResults.reduce((sum, result) => sum + parseFloat(result.score), 0);
    return Math.round(totalScore / examResults.length * 100) / 100;
  };

  const getGradeDistribution = () => {
    const distribution: Record<string, number> = {};
    examResults.forEach(result => {
      const grade = result.grade.toUpperCase();
      distribution[grade] = (distribution[grade] || 0) + 1;
    });
    return distribution;
  };

  const gradeDistribution = getGradeDistribution();
  const averageScore = calculateAverageScore();

  const filteredResults = examResults.filter(result => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return result.student.firstName.toLowerCase().includes(searchLower) ||
      result.student.lastName.toLowerCase().includes(searchLower) ||
      result.student.email.toLowerCase().includes(searchLower) ||
      result.grade.toLowerCase().includes(searchLower) ||
      (result.remarks && result.remarks.toLowerCase().includes(searchLower));
  });

  return (
    <>
      <div className="w-full min-h-full">
        <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-4 sm:p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <Button variant="ghost" size="sm" onClick={handleGoBack} className="mb-3 -ml-2 hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="text-sm">{getContextBreadcrumb()}</span>
              </Button>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="hidden sm:flex h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 items-center justify-center shadow-lg shadow-primary/25">
                    <Award className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-2xl font-bold">{examDetails.title || 'Exam Results'}</h1>
                    {examDetails.examType && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0 mt-1">{examDetails.examType}</Badge>
                    )}
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">View and analyze student performance</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => loadExamResults(currentPage)} disabled={loading} size="sm" className="bg-background/80 backdrop-blur-sm self-start">
                  <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              {lastRefresh && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {!instituteId || !classId || !subjectId ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Selection Required</h3>
                <p className="text-muted-foreground text-sm">Please select institute, class, and subject to view exam results.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stats Grid */}
              {examResults.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="group relative overflow-hidden border-border/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{totalResults}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Total Results</p>
                    </CardContent>
                  </Card>
                  <Card className="group relative overflow-hidden border-border/50 hover:border-green-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <Target className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{averageScore}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Average Score</p>
                    </CardContent>
                  </Card>
                  <Card className="group relative overflow-hidden border-border/50 hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-lg font-bold text-purple-600">
                        {averageScore >= 85 ? 'Excellent' : averageScore >= 70 ? 'Good' : averageScore >= 50 ? 'Average' : 'Needs Work'}
                      </p>
                      <Button variant="ghost" size="sm" className="mt-1 h-6 px-2 text-[10px] text-purple-600 hover:text-purple-700 hover:bg-purple-500/10 -ml-2" onClick={() => setShowPerformanceDialog(true)}>
                        View Analytics →
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="group relative overflow-hidden border-border/50 hover:border-amber-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Award className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">A+/A</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">{(gradeDistribution.A || 0) + (gradeDistribution['A+'] || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Top Performers</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Grade Distribution */}
              {examResults.length > 0 && Object.keys(gradeDistribution).length > 0 && (
                <Card className="border-border/50 overflow-hidden">
                  <CardHeader className="pb-3 bg-gradient-to-r from-muted/30 to-transparent">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Award className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Grade Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(gradeDistribution).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => (
                        <div key={grade} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors">
                          <Badge className={`${getGradeColor(grade)} font-semibold text-xs`}>{grade}</Badge>
                          <span className="text-sm font-medium">{count}</span>
                          <span className="text-xs text-muted-foreground">({Math.round(count / totalResults * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Results Section with Toggle */}
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="p-3 sm:p-4 bg-gradient-to-r from-muted/30 to-transparent border-b border-border/50">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm sm:text-base">Student Results</CardTitle>
                          <p className="text-xs text-muted-foreground">{filteredResults.length} of {totalResults} results</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{isCardView ? 'Card View' : 'Table View'}</span>
                      </div>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input placeholder="Search students, grade..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 text-sm bg-background/80 h-9" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex justify-center items-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                      <span>Loading results...</span>
                    </div>
                  ) : filteredResults.length > 0 ? (
                    isCardView ? (
                      /* ========== CARD VIEW ========== */
                      <div className="p-3 sm:p-4 space-y-2.5">
                        {filteredResults.map((result) => {
                          const isExpanded = expandedCards.has(result.id);
                          const isPassed = examDetails.passingMarks
                            ? parseFloat(result.score) >= parseFloat(examDetails.passingMarks)
                            : true;

                          return (
                            <Card
                              key={result.id}
                              className={cn(
                                "overflow-hidden border-border/50 transition-all duration-200 hover:shadow-md cursor-pointer",
                                isPassed ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"
                              )}
                              onClick={() => toggleResultCard(result.id)}
                            >
                              <CardContent className="p-0">
                                {/* Summary Row */}
                                <div className="flex items-center gap-3 p-3 sm:p-4">
                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                                    {result.student.firstName.charAt(0)}{result.student.lastName.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm truncate">
                                        {result.student.firstName} {result.student.lastName}
                                      </span>
                                      <Badge className={cn("text-[10px] px-1.5", getGradeColor(result.grade))}>{result.grade}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      Score: <span className="font-semibold text-foreground">{result.score}</span>
                                      {examDetails.totalMarks && <span> / {examDetails.totalMarks}</span>}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-muted-foreground">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                  <div className="border-t border-border/50 bg-muted/20 p-3 sm:p-4 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="flex items-center gap-2 text-sm">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Email:</span>
                                      </div>
                                      <span className="text-sm truncate">{result.student.email}</span>

                                      <div className="flex items-center gap-2 text-sm">
                                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Exam:</span>
                                      </div>
                                      <span className="text-sm">{result.exam.title}</span>

                                      <div className="flex items-center gap-2 text-sm">
                                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Score:</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{result.score}</span>
                                        {examDetails.totalMarks && <span className="text-xs text-muted-foreground">/ {examDetails.totalMarks}</span>}
                                      </div>

                                      <div className="flex items-center gap-2 text-sm">
                                        <Award className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Grade:</span>
                                      </div>
                                      <Badge className={cn("w-fit", getGradeColor(result.grade))}>{result.grade}</Badge>

                                      {examDetails.passingMarks && (
                                        <>
                                          <div className="flex items-center gap-2 text-sm">
                                            <Target className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">Status:</span>
                                          </div>
                                          <Badge variant={isPassed ? "default" : "destructive"} className="w-fit text-xs">
                                            {isPassed ? "Pass" : "Fail"}
                                          </Badge>
                                        </>
                                      )}

                                      {result.remarks && (
                                        <>
                                          <div className="flex items-center gap-2 text-sm">
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">Remarks:</span>
                                          </div>
                                          <span className="text-sm">{result.remarks}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      /* ========== TABLE VIEW ========== */
                      <MUITable
                        title=""
                        columns={[
                          {
                            id: 'student', label: 'Student', minWidth: 180,
                            format: (_: any, row: ExamResult) => (
                              <div className="flex flex-col">
                                <span className="font-medium">{row.student.firstName} {row.student.lastName}</span>
                                <span className="text-xs text-muted-foreground">{row.student.email}</span>
                              </div>
                            )
                          },
                          {
                            id: 'exam', label: 'Exam Details', minWidth: 150,
                            format: (_: any, row: ExamResult) => (
                              <div className="flex flex-col">
                                <span className="font-medium">{row.exam.title}</span>
                                <Badge variant="outline" className="text-xs w-fit mt-1">{row.exam.examType}</Badge>
                              </div>
                            )
                          },
                          {
                            id: 'score', label: 'Score', minWidth: 120, align: 'center' as const,
                            format: (value: string) => (
                              <div className="flex items-center gap-2 justify-center">
                                <span className="font-semibold text-lg">{value}</span>
                                {examDetails.totalMarks && <span className="text-muted-foreground">/ {examDetails.totalMarks}</span>}
                              </div>
                            )
                          },
                          {
                            id: 'grade', label: 'Grade', minWidth: 100, align: 'center' as const,
                            format: (value: string) => <Badge className={getGradeColor(value)}>{value}</Badge>
                          },
                          ...(examDetails.totalMarks && examDetails.passingMarks ? [{
                            id: 'status', label: 'Pass/Fail', minWidth: 100, align: 'center' as const,
                            format: (_: any, row: ExamResult) => (
                              <Badge variant={parseFloat(row.score) >= parseFloat(examDetails.passingMarks!) ? "default" : "destructive"}>
                                {parseFloat(row.score) >= parseFloat(examDetails.passingMarks!) ? "Pass" : "Fail"}
                              </Badge>
                            )
                          }] : []),
                          {
                            id: 'remarks', label: 'Remarks', minWidth: 150,
                            format: (value: string) => <span className="text-sm">{value || "No remarks"}</span>
                          }
                        ]}
                        data={filteredResults}
                        page={currentPage - 1}
                        rowsPerPage={10}
                        totalCount={totalResults}
                        onPageChange={newPage => handlePageChange(newPage + 1)}
                        onRowsPerPageChange={() => {}}
                        rowsPerPageOptions={[10]}
                      />
                    )
                  ) : (
                    <EmptyState
                      icon={Award}
                      title={searchTerm ? 'No results match your search' : 'No Exam Results'}
                      description={searchTerm ? 'Try adjusting your search criteria.' : 'No exam results found.'}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Performance Analytics Dialog */}
          <Dialog open={showPerformanceDialog} onOpenChange={setShowPerformanceDialog}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto p-0 gap-0 border-border/50">
              <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-primary/5 to-background p-5 sm:p-6 border-b border-border/50">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-bold">Performance Analytics</DialogTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">Comprehensive exam performance overview</p>
                    </div>
                  </div>
                </DialogHeader>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-600">{totalResults}</p>
                    <p className="text-xs text-muted-foreground mt-1">Students</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                    <p className="text-2xl font-bold text-green-600">{averageScore}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Average</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                    <p className="text-2xl font-bold text-amber-600">{(gradeDistribution.A || 0) + (gradeDistribution['A+'] || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Top Grades</p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-purple-500/5 to-transparent p-4">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Overall Performance</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {averageScore >= 85 ? 'Excellent' : averageScore >= 70 ? 'Good' : averageScore >= 50 ? 'Average' : 'Needs Improvement'}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <TrendingUp className="h-7 w-7 text-purple-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Score Progress</span>
                      <span className="font-semibold text-purple-600">{averageScore}%</span>
                    </div>
                    <div className="w-full bg-secondary/50 rounded-full h-3 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out" style={{ width: `${Math.min(averageScore, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Grade Distribution</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {Object.entries(gradeDistribution).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => {
                      const percentage = Math.round(count / totalResults * 100);
                      const colorClass = grade.includes('A') ? 'from-green-500 to-emerald-500'
                        : grade.includes('B') ? 'from-blue-500 to-cyan-500'
                        : grade.includes('C') ? 'from-yellow-500 to-amber-500'
                        : grade.includes('D') ? 'from-orange-500 to-red-400'
                        : 'from-red-500 to-rose-500';
                      return (
                        <div key={grade} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Badge className={`${getGradeColor(grade)} font-semibold`}>{grade}</Badge>
                              <span className="text-sm text-muted-foreground">{count} student{count !== 1 ? 's' : ''}</span>
                            </div>
                            <span className="text-sm font-bold">{percentage}%</span>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-2.5 overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-500 group-hover:opacity-80`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Award className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="font-semibold text-sm">Excellence Metrics</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-2xl font-bold text-amber-600">{(gradeDistribution.A || 0) + (gradeDistribution['A+'] || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">A Grade Students</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-2xl font-bold text-amber-600">
                        {totalResults > 0 ? Math.round(((gradeDistribution.A || 0) + (gradeDistribution['A+'] || 0)) / totalResults * 100) : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Excellence Rate</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end p-4 border-t border-border/50 bg-muted/20">
                <Button onClick={() => setShowPerformanceDialog(false)} className="bg-primary hover:bg-primary/90">Close Analytics</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
};

export default ExamResults;
