import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { systemAdminUserApi } from '@/api/systemAdminUser.api';
import { CreateFamilyUnitRequest, BulkCreateResult, UserType } from '@/types/user.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Upload, Loader2, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';

interface BulkFamilyImportProps {
  onSuccess?: () => void;
}

export function BulkFamilyImport({ onSuccess }: BulkFamilyImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [families, setFamilies] = useState<CreateFamilyUnitRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkCreateResult | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());

        const parsedFamilies: CreateFamilyUnitRequest[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });

          // Parse into family structure
          const family: CreateFamilyUnitRequest = {
            student: {
              email: row.studentEmail || undefined,
              phoneNumber: row.studentPhone || undefined,
              firstName: row.studentFirstName || undefined,
              lastName: row.studentLastName || undefined,
              gender: row.studentGender as any || undefined,
              userType: UserType.USER_WITHOUT_PARENT,
            },
            sendWelcomeNotifications: true,
          };

          // Add father if email or phone provided
          if (row.fatherEmail || row.fatherPhone) {
            family.father = {
              email: row.fatherEmail || undefined,
              phoneNumber: row.fatherPhone || undefined,
              firstName: row.fatherFirstName || undefined,
              lastName: row.fatherLastName || undefined,
              userType: UserType.USER_WITHOUT_STUDENT,
            };
          }

          // Add mother if email or phone provided
          if (row.motherEmail || row.motherPhone) {
            family.mother = {
              email: row.motherEmail || undefined,
              phoneNumber: row.motherPhone || undefined,
              firstName: row.motherFirstName || undefined,
              lastName: row.motherLastName || undefined,
              userType: UserType.USER_WITHOUT_STUDENT,
            };
          }

          parsedFamilies.push(family);
        }

        setFamilies(parsedFamilies);
        setResults(null);
        toast({
          title: 'Success',
          description: `Loaded ${parsedFamilies.length} families from CSV`,
        });
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast({
          title: 'Error',
          description: 'Failed to parse CSV file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  // Handle CSV values that might contain commas within quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleBulkCreate = async () => {
    if (families.length === 0) {
      toast({
        title: 'Error',
        description: 'No families to create',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await systemAdminUserApi.bulkCreateFamilyUnits(families, {
        continueOnError: true,
        sendWelcomeNotifications: true,
      });

      setResults(result);
      toast({
        title: 'Import Complete',
        description: `Created ${result.successCount} families successfully. ${result.failureCount} failed.`,
      });
      onSuccess?.();
    } catch (error: any) {
      console.error('Error in bulk create:', error);
      toast({
        title: 'Error',
        description: 'Bulk creation failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = `studentEmail,studentPhone,studentFirstName,studentLastName,studentGender,fatherEmail,fatherPhone,fatherFirstName,fatherLastName,motherEmail,motherPhone,motherFirstName,motherLastName
student1@example.com,+94771234567,Kasun,Silva,MALE,father1@example.com,+94772345678,Nimal,Silva,mother1@example.com,+94773456789,Kamala,Silva
,+94771234568,Nimal,Perera,MALE,,,,,,,
student3@example.com,,Sunil,Fernando,MALE,father3@example.com,,,,,,,`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearData = () => {
    setFamilies([]);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download CSV Template
          </CardTitle>
          <CardDescription>
            Download the template, fill it with your data, and upload it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-upload">Select CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {families.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Preview ({families.length} families)</CardTitle>
              <CardDescription>Review data before importing</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={clearData}>
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead>Mother</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {families.map((family, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{family.student.firstName || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">
                            {family.student.email || family.student.phoneNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {family.father ? (
                          <div>
                            <p className="font-medium">{family.father.firstName || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">
                              {family.father.email || family.father.phoneNumber}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {family.mother ? (
                          <div>
                            <p className="font-medium">{family.mother.firstName || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">
                              {family.mother.email || family.mother.phoneNumber}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="mt-4">
              <Button onClick={handleBulkCreate} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create {families.length} Families
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Success: {results.successCount} families
              </Badge>
              {results.failureCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" />
                  Failed: {results.failureCount} families
                </Badge>
              )}
            </div>

            {/* Error Details */}
            {results.results.filter((r) => !r.success).length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Failed Families:</h4>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {results.results
                      .filter((r) => !r.success)
                      .map((r, index) => (
                        <div
                          key={index}
                          className="text-sm text-destructive-foreground bg-destructive/20 p-2 rounded"
                        >
                          Row {r.index + 1}: {r.error?.message || 'Unknown error'}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
