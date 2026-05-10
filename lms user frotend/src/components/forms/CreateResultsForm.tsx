import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cachedApiClient } from '@/api/cachedClient';
import { Users, GraduationCap, Award, Save, RefreshCw, Plus, Trash2, UserPlus } from 'lucide-react';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Exam {
  id: string;
  title: string;
  examType: string;
  totalMarks: string;
  passingMarks: string;
}

interface ResultData {
  studentId: string;
  score: string;
  grade: string;
  remarks: string;
}

interface CreateResultsFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateResultsForm = ({ onClose, onSuccess }: CreateResultsFormProps) => {
  const { currentInstituteId, currentClassId, currentSubjectId, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const { toast } = useToast();
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [results, setResults] = useState<ResultData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    if (currentInstituteId && currentClassId && currentSubjectId) {
      loadExams();
      loadStudents();
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  const loadExams = async () => {
    try {
      setIsLoading(true);
      const response = await cachedApiClient.get('/institute-class-subject-exams', {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        page: 1,
        limit: 100
      });
      
      const examData = Array.isArray(response) ? response : response?.data || [];
      setExams(examData);
    } catch (error: any) {
      console.error('Error loading exams:', error);
      toast({
        title: "Error",
        description: "Failed to load exams",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      setIsLoading(true);
      const response = await cachedApiClient.get('/institute-class-subject-students', {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        page: 1,
        limit: 100
      });
      
      const studentData = Array.isArray(response) ? response : response?.data || [];
      setStudents(studentData);
      
      // Don't automatically initialize results - let users add manually
      setResults([]);
    } catch (error: any) {
      console.error('Error loading students:', error);
      toast({
        title: "Error", 
        description: "Failed to load students",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultChange = (studentId: string, field: keyof ResultData, value: string) => {
    setResults(prev => prev.map(result => 
      result.studentId === studentId 
        ? { ...result, [field]: value }
        : result
    ));
  };

  const calculateGrade = (score: string, totalMarks: string) => {
    const numScore = parseFloat(score);
    const numTotal = parseFloat(totalMarks);
    
    if (isNaN(numScore) || isNaN(numTotal) || numTotal === 0) return '';
    
    const percentage = (numScore / numTotal) * 100;
    
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    return 'F';
  };

  const handleScoreChange = (studentId: string, score: string) => {
    const selectedExam = exams.find(exam => exam.id === selectedExamId);
    const grade = selectedExam ? calculateGrade(score, selectedExam.totalMarks) : '';
    
    setResults(prev => prev.map(result => 
      result.studentId === studentId 
        ? { ...result, score, grade }
        : result
    ));
  };

  const addStudentById = () => {
    if (!newStudentId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a student ID",
        variant: "destructive"
      });
      return;
    }

    // Check if student already exists in results
    const existingResult = results.find(r => r.studentId === newStudentId);
    if (existingResult) {
      toast({
        title: "Error",
        description: "Student already added to results",
        variant: "destructive"
      });
      return;
    }

    // Add new student to results
    setResults(prev => [...prev, {
      studentId: newStudentId,
      score: '',
      grade: '',
      remarks: ''
    }]);

    setNewStudentId('');
    setShowAddStudent(false);
    
    toast({
      title: "Student Added",
      description: `Student ID ${newStudentId} added to results`
    });
  };

  const removeStudent = (studentId: string) => {
    setResults(prev => prev.filter(result => result.studentId !== studentId));
    
    toast({
      title: "Student Removed",
      description: "Student removed from results"
    });
  };

  const getStudentInfo = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student || { id: studentId, firstName: 'Unknown', lastName: 'Student', email: '' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedExamId) {
      toast({
        title: "Error",
        description: "Please select an exam",
        variant: "destructive"
      });
      return;
    }

    // Filter out empty results
    const validResults = results.filter(result => result.score.trim() !== '');
    
    if (validResults.length === 0) {
      toast({
        title: "Error", 
        description: "Please enter at least one result",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const requestData = {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        examId: selectedExamId,
        results: validResults
      };

      const response = await cachedApiClient.post('/institute-class-subject-resaults/bulk', requestData);
      
      toast({
        title: "Results Created",
        description: `Successfully created ${validResults.length} results`
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Error creating results:', error);
      toast({
        title: "Error",
        description: "Failed to create results",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedExam = exams.find(exam => exam.id === selectedExamId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Context Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Current Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Institute: {selectedInstitute?.name}</Badge>
            <Badge variant="outline">Class: {selectedClass?.name}</Badge>
            <Badge variant="outline">Subject: {selectedSubject?.name}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Exam Selection */}
      <div className="space-y-2">
        <Label htmlFor="examId">Select Exam *</Label>
        <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={isLoading}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an exam" />
          </SelectTrigger>
          <SelectContent>
            {exams.map((exam) => (
              <SelectItem key={exam.id} value={exam.id}>
                <div className="flex flex-col">
                  <span>{exam.title}</span>
                  <span className="text-xs text-gray-500">
                    {exam.examType} • Total: {exam.totalMarks} • Passing: {exam.passingMarks}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add Student Section */}
      {selectedExamId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Students to Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!showAddStudent ? (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddStudent(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Student by ID
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter Student ID"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addStudentById()}
                  />
                  <Button 
                    type="button" 
                    onClick={addStudentById}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddStudent(false);
                      setNewStudentId('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Results */}
      {selectedExamId && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Results ({results.length} students)
            </CardTitle>
            {selectedExam && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Marks: {selectedExam.totalMarks} • Passing Marks: {selectedExam.passingMarks}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {results.map((result) => {
                const studentInfo = getStudentInfo(result.studentId);
                return (
                  <div key={result.studentId} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Student</Label>
                      <p className="text-sm">{studentInfo.firstName} {studentInfo.lastName}</p>
                      <p className="text-xs text-gray-500">{studentInfo.email || `ID: ${result.studentId}`}</p>
                    </div>
                    
                    <div>
                      <Label htmlFor={`score-${result.studentId}`}>Score</Label>
                      <Input
                        id={`score-${result.studentId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max={selectedExam?.totalMarks}
                        value={result.score}
                        onChange={(e) => handleScoreChange(result.studentId, e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`grade-${result.studentId}`}>Grade</Label>
                      <div className="flex items-center h-10">
                        {result.grade && (
                          <Badge variant="outline" className="h-8">
                            <Award className="h-3 w-3 mr-1" />
                            {result.grade}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor={`remarks-${result.studentId}`}>Remarks</Label>
                      <Input
                        id={`remarks-${result.studentId}`}
                        value={result.remarks}
                        onChange={(e) => handleResultChange(result.studentId, 'remarks', e.target.value)}
                        placeholder="Optional remarks"
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeStudent(result.studentId)}
                        className="flex items-center gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !selectedExamId || isLoading}
          className="flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Creating Results...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Create Results
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default CreateResultsForm;