import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  Copy,
  Variable,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  scope: string;
  titleTemplate: string;
  messageTemplate: string;
  variables: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
}

// Mock templates - replace with actual API when available
const mockTemplates: NotificationTemplate[] = [
  {
    id: "1",
    name: "Class Cancellation",
    description: "Template for notifying about cancelled classes",
    scope: "CLASS",
    titleTemplate: "Class Cancelled: {{className}}",
    messageTemplate: "Dear {{studentName}}, your {{className}} class scheduled for {{date}} has been cancelled. {{reason}}",
    variables: ["className", "studentName", "date", "reason"],
    category: "Academic",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-20T14:30:00Z",
  },
  {
    id: "2",
    name: "Homework Reminder",
    description: "Remind students about pending homework",
    scope: "SUBJECT",
    titleTemplate: "Homework Due: {{subjectName}}",
    messageTemplate: "Don't forget! Your {{subjectName}} homework is due on {{dueDate}}. {{additionalInfo}}",
    variables: ["subjectName", "dueDate", "additionalInfo"],
    category: "Academic",
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-01-18T11:00:00Z",
  },
  {
    id: "3",
    name: "System Maintenance",
    description: "Notify all users about scheduled maintenance",
    scope: "GLOBAL",
    titleTemplate: "Scheduled Maintenance on {{date}}",
    messageTemplate: "The system will be down for maintenance from {{startTime}} to {{endTime}} on {{date}}. Please save your work.",
    variables: ["date", "startTime", "endTime"],
    category: "System",
    createdAt: "2026-01-05T08:00:00Z",
    updatedAt: "2026-01-05T08:00:00Z",
  },
];

const NotificationTemplates = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>(mockTemplates);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    scope: "INSTITUTE",
    titleTemplate: "",
    messageTemplate: "",
    variables: "",
    category: "",
  });

  const getScopeBadge = (scope: string) => {
    const scopeColors: Record<string, string> = {
      GLOBAL: "bg-purple-100 text-purple-800",
      INSTITUTE: "bg-blue-100 text-blue-800",
      CLASS: "bg-green-100 text-green-800",
      SUBJECT: "bg-orange-100 text-orange-800",
    };
    return (
      <Badge className={`${scopeColors[scope] || "bg-gray-100 text-gray-800"} hover:opacity-80`}>
        {scope}
      </Badge>
    );
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.titleTemplate || !newTemplate.messageTemplate) {
      toast({
        title: "Validation Error",
        description: "Name, title template, and message template are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const template: NotificationTemplate = {
        id: String(templates.length + 1),
        name: newTemplate.name,
        description: newTemplate.description,
        scope: newTemplate.scope,
        titleTemplate: newTemplate.titleTemplate,
        messageTemplate: newTemplate.messageTemplate,
        variables: newTemplate.variables.split(",").map(v => v.trim()).filter(Boolean),
        category: newTemplate.category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setTemplates([...templates, template]);
      setIsCreateDialogOpen(false);
      setNewTemplate({
        name: "",
        description: "",
        scope: "INSTITUTE",
        titleTemplate: "",
        messageTemplate: "",
        variables: "",
        category: "",
      });
      
      toast({
        title: "Template Created",
        description: "The notification template has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    toast({
      title: "Template Deleted",
      description: "The notification template has been deleted.",
    });
  };

  const handlePreviewTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    const initialVars: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialVars[v] = `[${v}]`;
    });
    setPreviewVariables(initialVars);
    setIsPreviewDialogOpen(true);
  };

  const handleDuplicateTemplate = (template: NotificationTemplate) => {
    const duplicate: NotificationTemplate = {
      ...template,
      id: String(templates.length + 1),
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates([...templates, duplicate]);
    toast({
      title: "Template Duplicated",
      description: "A copy of the template has been created.",
    });
  };

  const renderPreviewContent = () => {
    if (!selectedTemplate) return null;

    let title = selectedTemplate.titleTemplate;
    let message = selectedTemplate.messageTemplate;

    Object.entries(previewVariables).forEach(([key, value]) => {
      title = title.replace(new RegExp(`{{${key}}}`, "g"), value);
      message = message.replace(new RegExp(`{{${key}}}`, "g"), value);
    });

    return { title, message };
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notification Templates
            </CardTitle>
            <CardDescription>
              Create and manage reusable notification templates with dynamic variables
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a reusable notification template with dynamic variables using {"{{variableName}}"} syntax.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Template Name</Label>
                      <Input
                        id="name"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        placeholder="e.g., Class Cancellation"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={newTemplate.category}
                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                        placeholder="e.g., Academic, System"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                      placeholder="Brief description of the template"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Select
                      value={newTemplate.scope}
                      onValueChange={(value) => setNewTemplate({ ...newTemplate, scope: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GLOBAL">Global</SelectItem>
                        <SelectItem value="INSTITUTE">Institute</SelectItem>
                        <SelectItem value="CLASS">Class</SelectItem>
                        <SelectItem value="SUBJECT">Subject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="titleTemplate">Title Template</Label>
                    <Input
                      id="titleTemplate"
                      value={newTemplate.titleTemplate}
                      onChange={(e) => setNewTemplate({ ...newTemplate, titleTemplate: e.target.value })}
                      placeholder="e.g., Class Cancelled: {{className}}"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="messageTemplate">Message Template</Label>
                    <Textarea
                      id="messageTemplate"
                      value={newTemplate.messageTemplate}
                      onChange={(e) => setNewTemplate({ ...newTemplate, messageTemplate: e.target.value })}
                      placeholder="Use {{variableName}} for dynamic content"
                      rows={4}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="variables">
                      Variables <span className="text-muted-foreground">(comma-separated)</span>
                    </Label>
                    <Input
                      id="variables"
                      value={newTemplate.variables}
                      onChange={(e) => setNewTemplate({ ...newTemplate, variables: e.target.value })}
                      placeholder="e.g., className, studentName, date"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTemplate} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No templates found. Create your first template to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {template.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getScopeBadge(template.scope)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((variable) => (
                          <Badge key={variable} variant="secondary" className="text-xs">
                            <Variable className="h-3 w-3 mr-1" />
                            {variable}
                          </Badge>
                        ))}
                        {template.variables.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.variables.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreviewTemplate(template)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Preview Template</DialogTitle>
            <DialogDescription>
              Enter values for variables to preview the notification
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-3">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable} className="grid gap-2">
                    <Label htmlFor={variable}>{variable}</Label>
                    <Input
                      id={variable}
                      value={previewVariables[variable] || ""}
                      onChange={(e) =>
                        setPreviewVariables({ ...previewVariables, [variable]: e.target.value })
                      }
                      placeholder={`Enter ${variable}`}
                    />
                  </div>
                ))}
              </div>
              {renderPreviewContent() && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="font-semibold text-lg mb-2">
                    {renderPreviewContent()?.title}
                  </div>
                  <div className="text-muted-foreground">
                    {renderPreviewContent()?.message}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationTemplates;