import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface ChildCurrentSelectionProps {
  className?: string;
}

const ChildCurrentSelection: React.FC<ChildCurrentSelectionProps> = ({ className }) => {
  const { selectedChild, isViewingAsParent } = useAuth();

  // Only show when viewing as parent with a selected child
  if (!isViewingAsParent || !selectedChild) {
    return null;
  }

  const childData = selectedChild as any;
  const childName = childData.name || 
    `${childData.user?.firstName || ''} ${childData.user?.lastName || ''}`.trim() || 
    'Selected Child';
  
  const childImage = childData.imageUrl || childData.user?.imageUrl;
  const initials = childName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className || ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            {childImage ? (
              <AvatarImage src={getImageUrl(childImage)} alt={childName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Current Selection
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-background text-xs px-2 py-0.5">
                Child
              </Badge>
              <span className="font-semibold text-foreground truncate">
                {childName}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChildCurrentSelection;
