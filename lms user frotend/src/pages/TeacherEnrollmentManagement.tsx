import React from 'react';
import { useSearchParams } from 'react-router-dom';
import TeacherEnrollmentManager from '@/components/enrollment/TeacherEnrollmentManager';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const TeacherEnrollmentManagement = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const instituteId = searchParams.get('instituteId');
  const classId = searchParams.get('classId');
  const subjectId = searchParams.get('subjectId');
  const subjectName = searchParams.get('subjectName');
  const className = searchParams.get('className');

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Please log in to access enrollment management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.userType !== 'Teacher' && user.role !== 'InstituteAdmin') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              This page is only available for teachers and administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!instituteId || !classId || !subjectId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Missing required parameters. Please access this page through the subject management interface.
            </p>
            <Button 
              onClick={() => navigate('/subjects')} 
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Subjects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <Button 
          onClick={() => navigate(-1)} 
          variant="ghost" 
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Enrollment Management</h1>
        </div>
        <p className="text-muted-foreground">
          Manage student enrollment for {subjectName || 'Subject'} in {className || 'Class'}
        </p>
      </div>

      <TeacherEnrollmentManager
        instituteId={instituteId}
        classId={classId}
        subjectId={subjectId}
        subjectName={subjectName || undefined}
        className={className || undefined}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Enrollment Methods</CardTitle>
          <CardDescription>
            There are two ways students can be enrolled in subjects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                🎓 Self-Enrollment
              </h3>
              <p className="text-sm text-muted-foreground">
                Students can enroll themselves using an enrollment key. Enable this option and share the key with your students.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                👨‍🏫 Teacher Assignment
              </h3>
              <p className="text-sm text-muted-foreground">
                Manually assign students to the subject. Use this for direct enrollment without requiring students to enter a key.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherEnrollmentManagement;
