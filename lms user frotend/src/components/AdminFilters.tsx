
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';

const AdminFilters = () => {
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const mockInstitutes = [
    { id: '1', name: 'Main Campus' },
    { id: '2', name: 'Science Branch' },
    { id: '3', name: 'Arts Branch' }
  ];

  const mockClasses = [
    { id: '1', name: 'Grade 10 - A' },
    { id: '2', name: 'Grade 10 - B' },
    { id: '3', name: 'Grade 11 - Science' }
  ];

  const mockSubjects = [
    { id: '1', name: 'Mathematics' },
    { id: '2', name: 'Science' },
    { id: '3', name: 'English' }
  ];

  const handleApplyFilters = () => {
    console.log('Applying filters:', {
      institute: selectedInstitute,
      class: selectedClass,
      subject: selectedSubject
    });
    // This would trigger data filtering in parent components
  };

  const handleClearFilters = () => {
    setSelectedInstitute('');
    setSelectedClass('');
    setSelectedSubject('');
    console.log('Filters cleared');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-blue-600" />
          System Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Institute
            </label>
            <Select value={selectedInstitute} onValueChange={setSelectedInstitute}>
              <SelectTrigger>
                <SelectValue placeholder="Institutes" />
              </SelectTrigger>
              <SelectContent>
                {mockInstitutes.map((institute) => (
                  <SelectItem key={institute.id} value={institute.id}>
                    {institute.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Class
            </label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {mockClasses.map((class_) => (
                  <SelectItem key={class_.id} value={class_.id}>
                    {class_.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Subject
            </label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {mockSubjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyFilters} className="bg-blue-600 hover:bg-blue-700">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminFilters;
