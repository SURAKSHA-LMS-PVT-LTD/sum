
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const assignParentSchema = z.object({
  parentType: z.enum(['father', 'mother', 'guardian'], {
    required_error: 'Please select a parent type'
  }),
  parentUserId: z.string().min(1, 'Parent User ID is required')
});

type AssignParentFormData = z.infer<typeof assignParentSchema>;

interface AssignParentFormProps {
  onSubmit: (data: AssignParentFormData) => void;
  onCancel: () => void;
}

const AssignParentForm = ({ onSubmit, onCancel }: AssignParentFormProps) => {
  const form = useForm<AssignParentFormData>({
    resolver: zodResolver(assignParentSchema),
    defaultValues: {
      parentType: undefined,
      parentUserId: ''
    }
  });

  const handleSubmit = (data: AssignParentFormData) => {
    onSubmit(data);
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="parentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="parentUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent User ID *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter parent user ID" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Assign Parent
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AssignParentForm;
