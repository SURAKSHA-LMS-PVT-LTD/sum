
import React, { useState, useEffect } from 'react';
import { generateNameWithInitials } from '@/contexts/utils/user.utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/ui/SafeImage';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, User, Phone, AlertTriangle, RefreshCw } from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useNavigate } from 'react-router-dom';
import type { Child } from '@/contexts/types/auth.types';

interface ParentData {
  parentId: string;
  parentName: string;
}

const ParentChildrenSelector = () => {
  const { user, setSelectedChild, children: cachedChildren, fetchChildren } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [parentMeta, setParentMeta] = useState<ParentData | null>(null);

  const loadChildren = async (forceRefresh = false) => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      setError('');
      const result = await fetchChildren(forceRefresh);
      setParentMeta({ parentId: user.id, parentName: user.name || user.nameWithInitials || '' });
      if (result.length === 0 && forceRefresh) {
        setError('No children found');
      }
    } catch (err: any) {
      console.error('Error fetching children:', err);
      setError(err?.message || 'Failed to fetch children');
      toast({ title: "Error", description: "Failed to load children", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Use cached children if available, otherwise fetch fresh
    if (cachedChildren.length > 0) {
      setParentMeta({ parentId: user?.id || '', parentName: user?.name || user?.nameWithInitials || '' });
      setIsLoading(false);
    } else {
      loadChildren(false);
    }
  }, [user?.id]);

  const handleChildSelect = (child: Child) => {
    console.log('Selected child:', child);
    // Child from AuthContext already has userId set correctly
    setSelectedChild(child, true);
    navigate(`/child/${child.id}/select-institute`);
    toast({
      title: "Child Selected",
      description: `Now viewing ${child.name || child.nameWithInitials || 'child'}'s information`,
    });
  };

  const getRelationshipLabel = (child: Child) => {
    return (child.relationship || 'child').charAt(0).toUpperCase() + (child.relationship || 'child').slice(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading children...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && cachedChildren.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Unable to Load Children
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error || 'Failed to load children information'}
              </p>
              <Button onClick={() => loadChildren(true)}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Select Your Child
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a child to view their academic information, attendance, and results.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadChildren(true)}
          disabled={isLoading}
          className="shrink-0 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Parent Info */}
      {parentMeta && (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Parent Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-lg font-medium">{parentMeta.parentName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Parent ID: {parentMeta.parentId}</p>
          </div>
        </CardContent>
      </Card>
      )}

      {cachedChildren.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Children Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No children are currently associated with your account.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cachedChildren.map((child) => (
            <Card 
              key={child.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200 dark:hover:border-blue-800"
              onClick={() => handleChildSelect(child)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-primary/10 flex-shrink-0">
                    <SafeImage
                      src={getImageUrl(child.imageUrl)}
                      alt={`${child.name || child.nameWithInitials || 'Child'} profile photo`}
                      className="h-full w-full object-cover"
                      fallback={
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-lg">
                          {(child.name || child.nameWithInitials || 'C').split(' ').map(n => n.charAt(0)).join('').toUpperCase()}
                        </div>
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      {child.nameWithInitials || child.name || (() => {
                        const parts = (child.name || '').split(' ');
                        if (parts.length >= 2) {
                          return generateNameWithInitials(parts.slice(0, -1).join(' '), parts[parts.length - 1]);
                        }
                        return child.name || '';
                      })()}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Child ID: {child.id}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {getRelationshipLabel(child)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {child.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {child.email}
                  </span>
                </div>
                )}
                
                <Button className="w-full mt-4">
                  View {((child.nameWithInitials || child.name || '')).split(' ')[0]}'s Dashboard
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParentChildrenSelector;
