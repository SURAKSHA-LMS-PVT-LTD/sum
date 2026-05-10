import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { transportApi } from '@/api/transport.api';
import BookhireSelect from '@/components/ui/BookhireSelect';
import { toast } from 'sonner';

interface EnrollTransportDialogProps {
  studentId: string;
  onEnrollmentSuccess: () => void;
  instituteId?: string;
}

const EnrollTransportDialog: React.FC<EnrollTransportDialogProps> = ({ 
  studentId, 
  onEnrollmentSuccess,
  instituteId,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookhireId, setBookhireId] = useState('');
  const [formData, setFormData] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    monthlyFee: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: Record<string, string> = {};
    if (!bookhireId) errors.bookhireId = 'Please select a transport service';
    if (!formData.pickupLocation) errors.pickupLocation = 'Pickup location is required';
    if (!formData.dropoffLocation) errors.dropoffLocation = 'Drop-off location is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setLoading(true);
      await transportApi.enrollTransport({
        studentId,
        bookhireId: parseInt(bookhireId),
        pickupLocation: formData.pickupLocation,
        dropoffLocation: formData.dropoffLocation,
        monthlyFee: parseFloat(formData.monthlyFee) || 0,
      });

      toast.success('Successfully enrolled in transport service');
      setOpen(false);
      setBookhireId('');
      setFieldErrors({});
      setFormData({ pickupLocation: '', dropoffLocation: '', monthlyFee: '' });
      onEnrollmentSuccess();
    } catch (error: any) {
      console.error('Failed to enroll in transport:', error);
      toast.error('Failed to enroll in transport service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Enroll Transport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] mx-auto">
        <DialogHeader>
          <DialogTitle>Enroll in Transport Service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <BookhireSelect
              value={bookhireId}
              onChange={(id) => { setBookhireId(id); setFieldErrors(prev => ({ ...prev, bookhireId: '' })); }}
              instituteId={instituteId}
              label="Transport Service"
              required
            />
            {fieldErrors.bookhireId && <p className="text-xs text-red-500">{fieldErrors.bookhireId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickupLocation">
              Pickup Location <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pickupLocation"
              value={formData.pickupLocation}
              onChange={(e) => { setFormData({ ...formData, pickupLocation: e.target.value }); setFieldErrors(prev => ({ ...prev, pickupLocation: '' })); }}
              placeholder="Enter pickup location"
              className={fieldErrors.pickupLocation ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {fieldErrors.pickupLocation && <p className="text-xs text-red-500">{fieldErrors.pickupLocation}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dropoffLocation">
              Drop-off Location <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dropoffLocation"
              value={formData.dropoffLocation}
              onChange={(e) => { setFormData({ ...formData, dropoffLocation: e.target.value }); setFieldErrors(prev => ({ ...prev, dropoffLocation: '' })); }}
              placeholder="Enter drop-off location"
              className={fieldErrors.dropoffLocation ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {fieldErrors.dropoffLocation && <p className="text-xs text-red-500">{fieldErrors.dropoffLocation}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyFee">Monthly Fee (LKR)</Label>
            <Input
              id="monthlyFee"
              type="number"
              step="0.01"
              value={formData.monthlyFee}
              onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
              placeholder="Enter monthly fee"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !bookhireId}>
              {loading ? 'Enrolling...' : 'Enroll'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollTransportDialog;
