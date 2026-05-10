import React from 'react';
import SelfEnrollmentForm from '@/components/enrollment/SelfEnrollmentForm';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

const StudentEnrollment = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Please log in to access enrollment features.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.userType !== 'Student') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              This page is only available for students. Please contact your administrator if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Subject Enrollment</h1>
        </div>
        <p className="text-muted-foreground">
          Enroll in subjects using enrollment keys provided by your teachers.
        </p>
      </div>

      <SelfEnrollmentForm />
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to Enroll</CardTitle>
          <CardDescription>Follow these steps to enroll in a subject</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Get the enrollment key</p>
              <p className="text-sm text-muted-foreground">
                Your teacher will provide you with an enrollment key for the subject
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Enter the key</p>
              <p className="text-sm text-muted-foreground">
                Enter the enrollment key in the form above and click "Enroll in Subject"
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Confirm enrollment</p>
              <p className="text-sm text-muted-foreground">
                Once enrolled, you'll have access to the subject materials and assignments
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentEnrollment;
