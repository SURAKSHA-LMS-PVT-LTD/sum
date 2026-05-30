import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Hash, Layers } from 'lucide-react';
import { BasicUser } from '@/api/users.api';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface UserInfoDialogProps {
  open: boolean;
  onClose: () => void;
  user: BasicUser | null;
}

const UserInfoDialog: React.FC<UserInfoDialogProps> = ({ open, onClose, user }) => {
  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose} routeName="user-info-dialog-popup">
      <DialogContent className="max-w-3xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">User Information</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-5 py-4">
          <Avatar className="h-24 w-24 ring-2 ring-primary/20 shadow-md">
            <AvatarImage src={getImageUrl(user.imageUrl)} alt={user.fullName} />
            <AvatarFallback className="text-2xl font-semibold bg-primary/8 text-primary">
              {getInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <p className="font-bold text-xl text-center">{user.fullName}</p>
        </div>

        <div className="divide-y divide-border/40">
          <div className="flex items-start gap-4 py-3.5">
            <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Hash className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted-foreground leading-none mb-1.5">User ID</p>
              <p className="text-base font-semibold text-primary font-mono">{user.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 py-3.5">
            <span className="text-muted-foreground/60 shrink-0"><Layers className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted-foreground leading-none mb-1.5">User Type</p>
            </div>
            <Badge variant="secondary" className="text-sm px-3.5 py-1.5">{user.userType}</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserInfoDialog;
