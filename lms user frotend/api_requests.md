# Dashboard Widget API Requests

The dashboard has been redesigned to use a widget-based layout instead of a grid of quick action buttons. To populate these widgets with real data, the following APIs are required.

## 1. Admin Dashboard Widgets

### `GET /api/dashboard/admin/overview`
**Purpose:** Fetches the high-level daily overview stats for the Institute Admin.
**Query Parameters:**
- `instituteId` (string, required)
- `date` (string, optional, defaults to today)

**Response Payload:**
```json
{
  "attendance": {
    "presentPercentage": 84,
    "trend": 2.5, // Positive means increase from yesterday
    "totalStudents": 1200,
    "presentStudents": 1008
  },
  "staff": {
    "activeStaff": 42,
    "totalStaff": 45,
    "onLeave": 3
  }
}
```

### `GET /api/dashboard/admin/recent-payments`
**Purpose:** Fetches the most recent payments collected today for the Institute Admin.
**Query Parameters:**
- `instituteId` (string, required)
- `limit` (number, optional, defaults to 5)

**Response Payload:**
```json
{
  "payments": [
    {
      "id": "pay_123",
      "studentName": "John Doe",
      "studentInitials": "JD",
      "className": "Grade 10",
      "subjectName": "Science",
      "amount": 150.00,
      "currency": "USD",
      "timestamp": "2026-03-12T08:30:00Z"
    }
  ]
}
```

## 2. Teacher Dashboard Widgets

### `GET /api/dashboard/teacher/schedule`
**Purpose:** Fetches the teacher's class schedule for the day.
**Query Parameters:**
- `instituteId` (string, required)
- `date` (string, optional, defaults to today)

**Response Payload:**
```json
{
  "totalClasses": 3,
  "schedule": [
    {
      "id": "class_123",
      "className": "Grade 10",
      "subjectName": "Mathematics",
      "startTime": "08:00 AM",
      "endTime": "09:30 AM",
      "status": "completed" // completed, in-progress, upcoming
    }
  ]
}
```

### `GET /api/dashboard/teacher/pending-tasks`
**Purpose:** Fetches actionable items for the teacher (e.g., homework to grade, attendance to mark).
**Query Parameters:**
- `instituteId` (string, required)

**Response Payload:**
```json
{
  "tasks": [
    {
      "id": "task_1",
      "type": "homework_grading",
      "title": "Grade 10 Algebra Assignment",
      "subtitle": "24 submissions to grade",
      "actionUrl": "/homework/grade/123"
    },
    {
      "id": "task_2",
      "type": "mark_attendance",
      "title": "Mark Attendance",
      "subtitle": "Grade 11 Advanced Math",
      "actionUrl": "/attendance/mark/456"
    }
  ]
}
```

## 3. Student Dashboard Widgets

### `GET /api/dashboard/student/upcoming-classes`
**Purpose:** Fetches the student's upcoming classes for the day.
**Query Parameters:**
- `instituteId` (string, required)
- `classId` (string, required)
- `date` (string, optional, defaults to today)

**Response Payload:**
```json
{
  "classes": [
    {
      "id": "lecture_123",
      "subjectName": "Physics - Mechanics",
      "teacherName": "Mr. Anderson",
      "room": "Room 302",
      "startTime": "10:00",
      "startPeriod": "AM"
    }
  ]
}
```

### `GET /api/dashboard/student/assignments-due`
**Purpose:** Fetches homework/assignments due in the near future.
**Query Parameters:**
- `instituteId` (string, required)
- `classId` (string, required)
- `days` (number, optional, defaults to 7)

**Response Payload:**
```json
{
  "assignments": [
    {
      "id": "hw_123",
      "title": "Physics Worksheet 4",
      "dueDateFormatted": "Due Tomorrow, 11:59 PM",
      "urgency": "high" // high, medium, low (determines color indicator)
    }
  ]
}
```
