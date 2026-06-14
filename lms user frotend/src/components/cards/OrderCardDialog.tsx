/**
 * OrderCardDialog - Dialog to order a new ID card
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CreditCard, MapPin, Phone, FileText, Loader2 } from 'lucide-react';
import { Card as CardType } from '@/api/userCard.api';
import { userCardApi } from '@/api/userCard.api';
import { formatPrice } from '@/utils/cardHelpers';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { getErrorMessage } from '@/api/apiError';
import { useAuth } from '@/contexts/AuthContext';

interface OrderCardDialogProps {
  card: CardType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const orderSchema = z.object({
  deliveryAddress: z.string().min(10, 'Address must be at least 10 characters'),
  contactPhone: z.string().regex(/^\+94\d{9}$/, 'Please enter a valid Sri Lankan phone number (+94XXXXXXXXX)'),
  notes: z.string().optional(),
});

const OrderCardDialog: React.FC<OrderCardDialogProps> = ({
  card,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    deliveryAddress: '',
    contactPhone: '+94',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { selectedChild, isViewingAsParent } = useAuth();
  const forUserId = isViewingAsParent && selectedChild ? (selectedChild.userId || selectedChild.id) : undefined;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async () => {
    if (!card) return;

    // Validate
    const result = orderSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setLoading(true);
      await userCardApi.createOrder({
        cardId: card.id,
        deliveryAddress: formData.deliveryAddress.trim(),
        contactPhone: formData.contactPhone.trim(),
        notes: formData.notes.trim() || undefined,
      }, forUserId);

      toast({
        title: 'Order Created',
        description: 'Your order has been placed. Please proceed to payment.',
      });

      // Reset form
      setFormData({
        deliveryAddress: '',
        contactPhone: '+94',
        notes: '',
      });
      setErrors({});
      onSuccess();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to create order'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Order ID Card
          </DialogTitle>
          <DialogDescription>
            Fill in your delivery details to order the selected card.
          </DialogDescription>
        </DialogHeader>

        {/* Card Summary */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{card.cardName}</span>
            <Badge variant="outline">{card.cardType}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Validity: {Math.floor(card.validityDays / 365)} year(s)</span>
            <span className="text-lg font-bold text-primary">{formatPrice(card.price)}</span>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="deliveryAddress" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </Label>
            <Textarea
              id="deliveryAddress"
              placeholder="Enter your full delivery address..."
              value={formData.deliveryAddress}
              onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
              className={errors.deliveryAddress ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.deliveryAddress && (
              <p className="text-sm text-red-500">{errors.deliveryAddress}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Phone
            </Label>
            <Input
              id="contactPhone"
              placeholder="+94771234567"
              value={formData.contactPhone}
              onChange={(e) => handleInputChange('contactPhone', e.target.value)}
              className={errors.contactPhone ? 'border-red-500' : ''}
            />
            {errors.contactPhone && (
              <p className="text-sm text-red-500">{errors.contactPhone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Place Order'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderCardDialog;
