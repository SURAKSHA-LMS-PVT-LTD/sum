import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { transportApi, TransportEnrollment } from '@/api/transport.api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import PageContainer from '@/components/layout/PageContainer';
import EnrollTransportDialog from '@/components/forms/EnrollTransportDialog';

const Transport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<TransportEnrollment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEnrollments = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await transportApi.getStudentEnrollments(user.id.toString());
      setEnrollments(response.data.enrollments);
    } catch (error: any) {
      console.error('Failed to load transport enrollments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transport enrollments';
      
      if (errorMessage.includes('404') || errorMessage.includes('Cannot GET')) {
        toast.error('Transport endpoint not available. Please ensure the attendance backend is running and the endpoint exists.');
      } else {
        toast.error('Failed to load transport enrollments. Please check your attendance backend configuration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentSuccess = () => {
    loadEnrollments();
  };

  const handleSelectTransport = (enrollment: TransportEnrollment) => {
    // Navigate to transport attendance page with state
    navigate(`/transport-attendance`, {
      state: { 
        transport: {
          id: enrollment.id,
          vehicleNumber: enrollment.cardId || `Bookhire-${enrollment.bookhireId}`,
          bookhireId: enrollment.bookhireId
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (enrollments.length === 0 && !loading) {
    return (
      <AppLayout currentPage="transport">
        <PageContainer>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">My Transport</h1>
                <p className="text-muted-foreground">
                  View and manage your transport enrollments
                </p>
              </div>
              <EnrollTransportDialog 
                studentId={user?.id?.toString() || ''} 
                onEnrollmentSuccess={handleEnrollmentSuccess}
              />
            </div>
            
            <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Transport Enrollments</h3>
              <p className="text-muted-foreground mb-6 text-center">
                Click the button below to load your transport enrollments.
              </p>
              <Button onClick={loadEnrollments} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? 'Loading...' : 'Load Transport Enrollments'}
              </Button>
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout currentPage="transport">
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading transport enrollments...</p>
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="transport">
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Transport</h1>
              <p className="text-muted-foreground">
                View and manage your transport enrollments
              </p>
            </div>
            <EnrollTransportDialog 
              studentId={user?.id?.toString() || ''} 
              onEnrollmentSuccess={handleEnrollmentSuccess}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => (
              <div key={enrollment.id} className="relative flex w-80 flex-col rounded-xl bg-white dark:bg-card bg-clip-border text-gray-700 dark:text-foreground shadow-md">
                {/* Header with gradient and optional image */}
                <div className="relative mx-4 -mt-6 h-40 overflow-hidden rounded-xl bg-blue-gray-500 bg-clip-border text-white shadow-lg shadow-blue-gray-500/40 bg-gradient-to-r from-blue-500 to-blue-600">
                  {enrollment.imageUrl ? (
                    <img
                      src={enrollment.imageUrl}
                      alt={enrollment.bookhireTitle || 'Transport vehicle'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : null}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="mb-0 block font-sans text-xl font-semibold leading-snug tracking-normal text-blue-gray-900 dark:text-foreground antialiased">
                      {enrollment.bookhireTitle || 'Transport Service'}{enrollment.vehicleNumber ? ` - ${enrollment.vehicleNumber}` : ''}
                    </h5>
                    <Badge className={getStatusColor(enrollment.status)}>
                      {enrollment.status}
                    </Badge>
                  </div>

                  {enrollment.pickupLocation && (
                    <p className="block font-sans text-base font-light leading-relaxed text-inherit antialiased mb-2">
                      <span className="font-medium">Pickup: </span>
                      {enrollment.pickupLocation}
                    </p>
                  )}

                  {enrollment.dropoffLocation && (
                    <p className="block font-sans text-base font-light leading-relaxed text-inherit antialiased mb-3">
                      <span className="font-medium">Drop-off: </span>
                      {enrollment.dropoffLocation}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-border">
                    <span className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Monthly Fee:</span>
                    <span className="font-bold text-blue-600 dark:text-primary text-lg">
                      LKR {Number(enrollment.monthlyFee || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <button
                    onClick={() => handleSelectTransport(enrollment)}
                    className="select-none rounded-lg bg-blue-500 py-3 px-6 text-center align-middle font-sans text-xs font-bold uppercase text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/40 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none w-full"
                  >
                    Select Transport
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
};

export default Transport;
