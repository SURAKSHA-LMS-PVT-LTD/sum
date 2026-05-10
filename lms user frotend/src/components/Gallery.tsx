
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Images, Upload, Search, Grid3X3, List } from 'lucide-react';

const Gallery = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Mock gallery data - only images
  const galleryItems = [
    {
      id: '1',
      name: 'School Assembly 2024',
      type: 'image',
      url: '/placeholder.svg',
      uploadedAt: '2024-01-15',
      category: 'events'
    },
    {
      id: '2',
      name: 'Sports Day Highlights',
      type: 'image',
      url: '/placeholder.svg',
      uploadedAt: '2024-01-12',
      category: 'events'
    },
    {
      id: '3',
      name: 'Science Fair Exhibition',
      type: 'image',
      url: '/placeholder.svg',
      uploadedAt: '2024-01-10',
      category: 'education'
    },
    {
      id: '4',
      name: 'Art Class Masterpiece',
      type: 'image',
      url: '/placeholder.svg',
      uploadedAt: '2024-01-08',
      category: 'education'
    },
    {
      id: '5',
      name: 'Music Concert',
      type: 'image',
      url: '/placeholder.svg',
      uploadedAt: '2024-01-05',
      category: 'events'
    },
    {
      id: '6',
      name: 'Library Reading Hour',
      type: 'image',
      url: '/placeholder.svg',
      uploadedAt: '2024-01-03',
      category: 'education'
    }
  ];

  const filteredItems = galleryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const GalleryCard = ({ item }: { item: any }) => {
    return (
      <Card className="group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
        <CardContent className="p-0">
          <div className="aspect-[4/3] bg-gray-100 rounded-t-lg overflow-hidden">
            <img 
              src={item.url} 
              alt={item.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-2">
              {item.name}
            </h3>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gallery</h1>
          <p className="text-muted-foreground">Browse and manage your images</p>
        </div>
        <div className="ml-auto">
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant={viewMode === 'grid' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Images</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {viewMode === 'grid' ? (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredItems.map(item => (
                <GalleryCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
              {filteredItems.map(item => (
                <GalleryCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {filteredItems.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <Images className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium">No images found</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm ? 'Try adjusting your search terms' : 'Upload your first image to get started'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Gallery;
