import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save, X } from 'lucide-react';
export interface GradeRange {
  grade: string;
  minScore: number;
  maxScore: number;
}
interface GradeConfigurationCardProps {
  gradeRanges: GradeRange[];
  onGradeRangesChange: (ranges: GradeRange[]) => void;
  onReset: () => void;
  onSave: () => void;
  onClose?: () => void;
}
const GradeConfigurationCard: React.FC<GradeConfigurationCardProps> = ({
  gradeRanges,
  onGradeRangesChange,
  onReset,
  onSave,
  onClose
}) => {
  const ALLOWED_GRADES = ['A', 'B', 'C', 'S', 'F'];
  const handleRangeChange = (index: number, field: keyof GradeRange, value: string | number) => {
    // Validate grade input
    if (field === 'grade') {
      const gradeValue = String(value).toUpperCase();
      if (gradeValue && !ALLOWED_GRADES.includes(gradeValue)) {
        return; // Don't update if not an allowed grade
      }
      value = gradeValue;
    }
    const updatedRanges = [...gradeRanges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      [field]: field === 'grade' ? value : Number(value)
    };
    onGradeRangesChange(updatedRanges);
  };
  return <Card className="relative">
      {onClose && (
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3">
          <X className="h-4 w-4" />
        </Button>
      )}
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-12">
        <CardTitle>Grade Configuration</CardTitle>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={onReset} className="w-full sm:w-auto">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button size="sm" onClick={onSave} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {gradeRanges.map((range, index) => <div key={index} className="border rounded-lg p-3 sm:p-4 space-y-3">
              <div>
                <Label htmlFor={`grade-${index}`} className="text-sm font-medium">Grade</Label>
                <Input id={`grade-${index}`} value={range.grade} onChange={e => handleRangeChange(index, 'grade', e.target.value)} className="font-bold text-center mt-1" maxLength={1} placeholder="A/B/C/S/F" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`min-${index}`} className="text-sm font-medium">Min Score</Label>
                  <Input id={`min-${index}`} type="number" value={range.minScore} onChange={e => handleRangeChange(index, 'minScore', e.target.value)} min={0} max={100} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor={`max-${index}`} className="text-sm font-medium">Max Score</Label>
                  <Input id={`max-${index}`} type="number" value={range.maxScore} onChange={e => handleRangeChange(index, 'maxScore', e.target.value)} min={0} max={100} className="mt-1" />
                </div>
              </div>
            </div>)}
        </div>
      </CardContent>
    </Card>;
};
export default GradeConfigurationCard;