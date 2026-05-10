import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import AppLayout from '@/components/layout/AppLayout';
import HomeworkReferencesSection from '@/components/homework/HomeworkReferencesSection';

const UpdateHomework = () => {
  const { instituteId, classId, subjectId, homeworkId } = useParams<{
    instituteId: string;
    classId: string;
    subjectId: string;
    homeworkId: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();
  const [loading, setLoading] = useState(false);
  const [homework, setHomework] = useState<any>(null);
  
  // Check if user has permission to update homework - Teachers only
  const canUpdate = userRole === 'Teacher';
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    startDate: '',
    dueDate: '',
    maxMarks: '',
    attachmentUrl: '',
    referenceLink: '',
    isActive: true
  });

  useEffect(() => {
    if (!canUpdate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to update homework. This feature is only available for Teachers.",
        variant: "destructive"
      });
      navigate('/homework');
      return;
    }

    if (homeworkId) {
      fetchHomework();
    }
  }, [homeworkId, canUpdate, navigate]);

  const toDateString = (value: any): string => {
    if (!value) return '';
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    } catch {
      return '';
    }
  };

  const fetchHomework = async () => {
    try {
      setLoading(true);
      const baseUrl = getBaseUrl();
      const headers = await getApiHeadersAsync();
      const response = await fetch(
        `${baseUrl}/institute-class-subject-homeworks/${homeworkId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (response.ok) {
        const homeworkData = await response.json();
        setHomework(homeworkData);
        setFormData({
          title: homeworkData.title || '',
          description: homeworkData.description || '',
          instructions: homeworkData.instructions || '',
          startDate: toDateString(homeworkData.startDate),
          dueDate: toDateString(homeworkData.endDate),
          maxMarks: homeworkData.maxMarks?.toString() || '',
          attachmentUrl: homeworkData.attachmentUrl || '',
          referenceLink: homeworkData.referenceLink || '',
          isActive: homeworkData.isActive ?? true
        });
      } else {
        throw new Error('Failed to fetch homework');
      }
    } catch (error: any) {
      console.error('Error fetching homework:', error);
      toast({
        title: "Error",
        description: "Failed to load homework details",
        variant: "destructive"
      });
      navigate('/homework');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate || null,
        endDate: formData.dueDate || null,
        referenceLink: formData.referenceLink || null,
        isActive: formData.isActive
      };

      const baseUrl = getBaseUrl();
      const headers = await getApiHeadersAsync();
      const response = await fetch(
        `${baseUrl}/institute-class-subject-homeworks/${homeworkId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Homework updated successfully"
        });
        navigate('/homework');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update homework');
      }
    } catch (error: any) {
      console.error('Error updating homework:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update homework",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading && !homework) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 sm:p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading homework details...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/homework')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homework
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Update Homework</h1>
            <p className="text-muted-foreground mt-1">Modify homework assignment details</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Homework Details</CardTitle>
            <CardDescription>
              Update the homework assignment information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter homework title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxMarks">Max Marks</Label>
                  <Input
                    id="maxMarks"
                    type="number"
                    value={formData.maxMarks}
                    onChange={(e) => handleInputChange('maxMarks', e.target.value)}
                    placeholder="Enter maximum marks"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter homework description"
                  required
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => handleInputChange('instructions', e.target.value)}
                  placeholder="Enter detailed instructions for students"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="attachmentUrl">Attachment URL</Label>
                <Input
                  id="attachmentUrl"
                  value={formData.attachmentUrl}
                  onChange={(e) => handleInputChange('attachmentUrl', e.target.value)}
                  placeholder="Enter attachment URL (optional)"
                />
              </div>

              <div>
                <Label htmlFor="referenceLink">Reference Link</Label>
                <Input
                  id="referenceLink"
                  value={formData.referenceLink}
                  onChange={(e) => handleInputChange('referenceLink', e.target.value)}
                  placeholder="Enter reference link (optional)"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/homework')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Updating...' : 'Update Homework'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {homeworkId && (
          <Card>
            <CardHeader>
              <CardTitle>Reference Materials</CardTitle>
              <CardDescription>Add learning materials for this homework</CardDescription>
            </CardHeader>
            <CardContent>
              <HomeworkReferencesSection homeworkId={homeworkId} editable={canUpdate} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default UpdateHomework;