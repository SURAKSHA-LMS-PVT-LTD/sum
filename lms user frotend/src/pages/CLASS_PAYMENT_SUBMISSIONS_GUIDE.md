# Class Payment Submissions API & Frontend Integration

## Overview
Complete system for managing class-level payment submissions with support for physical payment collection, verification, and rejection.

---

## API Endpoints

### 1. Get Class Payment Submissions
**Endpoint:** `GET /institute-class-payment-submissions/institute/{instituteId}/class/{classId}/payment/{paymentId}/submissions`

**Purpose:** Get all submissions for a specific payment (admin/teacher verification view)

**Parameters:**
- `instituteId` (path): Institute ID
- `classId` (path): Class ID
- `paymentId` (path): Payment ID
- `page` (query): Page number (default: 1)
- `limit` (query): Results per page (max: 100, default: 10)
- `status` (query): Filter by status (PENDING, VERIFIED, HALF_VERIFIED, QUARTER_VERIFIED, REJECTED)

**Response:**
```json
{
  "data": [
    {
      "id": "submission-123",
      "paymentId": "payment-1",
      "studentId": "student-456",
      "studentUuid": "uuid-789",
      "studentName": "John Doe",
      "nameWithInitials": "J.D.",
      "image": "path/to/image.jpg",
      "paymentDate": "2024-05-01",
      "receiptUrl": "path/to/receipt.pdf",
      "receiptFilename": "receipt.pdf",
      "transactionId": "TXN123456",
      "submittedAmount": "1000",
      "status": "PENDING",
      "verifiedBy": null,
      "verifiedAt": null,
      "rejectionReason": null,
      "notes": "Payment via bank transfer",
      "uploadedAt": "2024-05-01T10:30:00Z",
      "updatedAt": "2024-05-01T10:30:00Z",
      "canResubmit": true
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

---

### 2. Get Students with Payment Details
**Endpoint:** `GET /institute-class-payment-submissions/institute/{instituteId}/class/{classId}/payment/{paymentId}/students-details`

**Purpose:** Get all class students with their payment status and submission details (for physical payment collection)

**Parameters:**
- `instituteId` (path): Institute ID
- `classId` (path): Class ID
- `paymentId` (path): Payment ID
- `page` (query): Page number (default: 1)
- `limit` (query): Results per page (max: 100, default: 10)

**Response:**
```json
{
  "data": [
    {
      "studentId": "student-456",
      "studentUuid": "uuid-789",
      "studentName": "John Doe",
      "nameWithInitials": "J.D.",
      "image": "path/to/image.jpg",
      "instituteUserId": "STU-001",
      "phone": "07123456789",
      "email": "john@example.com",
      "paymentId": "payment-1",
      "paymentTitle": "School Fees",
      "paymentAmount": "5000",
      "paymentDueDate": "2024-05-31",
      "submissionId": "sub-123",
      "submissionStatus": "PENDING",
      "submittedAmount": "5000",
      "submittedDate": "2024-05-01",
      "receiptUrl": "path/to/receipt.pdf",
      "receiptFilename": "receipt.pdf",
      "transactionId": "TXN123456",
      "rejectionReason": null,
      "notes": "Payment notes",
      "verifiedAt": null,
      "verifiedBy": null,
      "canResubmit": true
    }
  ],
  "total": 60,
  "page": 1,
  "limit": 10,
  "totalPages": 6,
  "summary": {
    "totalStudents": 60,
    "verified": 45,
    "halfVerified": 10,
    "quarterVerified": 2,
    "pending": 2,
    "rejected": 1,
    "totalVerifiedAmount": "230000"
  }
}
```

---

### 3. Submit Class Payment
**Endpoint:** `POST /institute-class-payment-submissions/institute/{instituteId}/class/{classId}/payment/{paymentId}/submit`

**Purpose:** Student/parent submits payment with receipt file upload

**Request:**
- Method: POST
- Content-Type: multipart/form-data

**Body:**
```
paymentDate: "2024-05-01" (required)
submittedAmount: 5000 (required)
transactionId: "TXN123456" (optional)
notes: "Payment via bank transfer" (optional)
receiptFile: <File> (optional, max 5MB)
```

**Supported File Types:**
- Images: JPEG, JPG, PNG
- Documents: PDF

**Note:** Receipts are uploaded to the `class-payment-receipts` folder with automatic file type and size validation.

**Response:**
```json
{
  "success": true,
  "message": "Payment submitted successfully",
  "data": {
    "submissionId": "sub-123",
    "status": "PENDING"
  }
}
```

---

### 4. Verify Payment Submission
**Endpoint:** `PATCH /institute-class-payment-submissions/institute/{instituteId}/class/{classId}/submission/{submissionId}/verify`

**Purpose:** Admin/teacher verify a payment submission

**Request:**
```json
{
  "status": "VERIFIED",
  "notes": "Payment verified successfully"
}
```

**Status Options:**
- `VERIFIED`: Full payment (100%)
- `HALF_VERIFIED`: Partial payment (50%)
- `QUARTER_VERIFIED`: Partial payment (25%)

**Response:**
```json
{
  "success": true,
  "message": "Submission verified successfully"
}
```

---

### 5. Reject Payment Submission
**Endpoint:** `PATCH /institute-class-payment-submissions/institute/{instituteId}/class/{classId}/submission/{submissionId}/reject`

**Purpose:** Admin/teacher reject a payment submission

**Request:**
```json
{
  "rejectionReason": "Receipt is blurry, please resubmit",
  "notes": "Additional verification notes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Submission rejected successfully"
}
```

---

### 6. Get Submission Details for Verification
**Endpoint:** `GET /institute-class-payment-submissions/institute/{instituteId}/class/{classId}/submission/{submissionId}`

**Purpose:** Get detailed submission information for verification

**Response:**
```json
{
  "id": "sub-123",
  "paymentId": "payment-1",
  "studentId": "student-456",
  "studentUuid": "uuid-789",
  "studentName": "John Doe",
  "nameWithInitials": "J.D.",
  "image": "path/to/image.jpg",
  "paymentDate": "2024-05-01",
  "receiptUrl": "path/to/receipt.pdf",
  "receiptFilename": "receipt.pdf",
  "transactionId": "TXN123456",
  "submittedAmount": "5000",
  "status": "PENDING",
  "verifiedBy": null,
  "verifiedAt": null,
  "rejectionReason": null,
  "notes": "Payment notes",
  "uploadedAt": "2024-05-01T10:30:00Z",
  "updatedAt": "2024-05-01T10:30:00Z",
  "canResubmit": true
}
```

---

## Frontend Pages

### 1. Payment Submissions Verification Page
**Route:** `/payment-submissions?paymentId=1&paymentTitle=testing&type=class`

**File:** `src/pages/ClassPaymentSubmissionsPage.tsx`

**Features:**
- View all submissions for a payment
- Search submissions by student name/ID
- Filter by status (PENDING, VERIFIED, HALF_VERIFIED, QUARTER_VERIFIED, REJECTED)
- Verify submissions with notes
- Reject submissions with reason
- Download receipt files
- Pagination support (10, 25, 50 items per page)

**Query Parameters:**
- `paymentId` (required): Payment ID
- `paymentTitle` (optional): Display title
- `instituteId` (optional): Falls back to selectedInstitute from auth
- `classId` (optional): Falls back to selectedClass from auth
- `type` (required): Set to "class" for class payments

**Usage:**
```typescript
// Navigate to payment submissions page
navigate('/payment-submissions?paymentId=1&paymentTitle=School Fees&type=class');
```

---

### 2. Physical Payment Collection Page
**Route:** `/payment-submissions-physical?paymentId=1&paymentTitle=testing&instituteId=109&classId=1004&type=class`

**File:** `src/pages/ClassPaymentSubmissionsPhysicalPage.tsx`

**Features:**
- View all class students with payment details
- See student contact information (phone, email)
- View current payment status and submitted amount
- Summary cards showing verification statistics
- Search students by name, phone, or email
- Filter by payment status
- Submit payments with receipt upload
- Supports multiple payment tiers (Full, Half, Quarter)
- File upload (PDF, PNG, JPG up to 10MB)
- Pagination support

**Query Parameters:**
- `paymentId` (required): Payment ID
- `paymentTitle` (optional): Display title
- `instituteId` (required): Institute ID
- `classId` (required): Class ID
- `type` (required): Set to "class" for class payments

**Usage:**
```typescript
// Navigate to physical payment collection page
navigate('/payment-submissions-physical?paymentId=1&paymentTitle=School Fees&instituteId=109&classId=1004&type=class');
```

**Summary Statistics:**
- Total Students
- Verified Count
- Half Verified Count
- Quarter Verified Count
- Pending Count
- Rejected Count
- Total Verified Amount

---

## API Integration (TypeScript)

### Import
```typescript
import { classPaymentsApi, StudentPaymentDetail, ClassPaymentSubmissionDetail } from '@/api/classPayments.api';
```

### Get Submissions
```typescript
const submissions = await classPaymentsApi.getClassPaymentSubmissions(
  instituteId,
  classId,
  paymentId,
  { page: 1, limit: 10, status: 'PENDING' }
);

submissions.data.forEach(sub => {
  console.log(sub.studentName, sub.status, sub.submittedAmount);
});
```

### Get Students with Details
```typescript
const response = await classPaymentsApi.getStudentsForPaymentWithDetails(
  instituteId,
  classId,
  paymentId,
  { page: 1, limit: 20 }
);

console.log('Total Students:', response.summary.totalStudents);
console.log('Verified:', response.summary.verified);
console.log('Pending:', response.summary.pending);

response.data.forEach(student => {
  console.log(student.studentName, student.phone, student.submissionStatus);
});
```

### Submit Payment
```typescript
const result = await classPaymentsApi.submitClassPayment(
  instituteId,
  classId,
  paymentId,
  {
    paymentDate: '2024-05-01',
    submittedAmount: 5000,
    transactionId: 'TXN123456',
    notes: 'Bank transfer',
    receiptFile: file, // File object from input
  }
);

console.log('Submission ID:', result.data.submissionId);
```

### Verify Payment
```typescript
await classPaymentsApi.verifyClassPaymentSubmission(
  instituteId,
  classId,
  submissionId,
  {
    status: 'VERIFIED',
    notes: 'Payment verified successfully',
  }
);
```

### Reject Payment
```typescript
await classPaymentsApi.rejectClassPaymentSubmission(
  instituteId,
  classId,
  submissionId,
  {
    rejectionReason: 'Receipt is unclear',
    notes: 'Please resubmit with clear receipt',
  }
);
```

---

## Data Types

### StudentPaymentDetail
```typescript
interface StudentPaymentDetail {
  // Student info
  studentId: string;
  studentUuid: string;
  studentName: string;
  nameWithInitials: string;
  image?: string;
  instituteUserId: string;
  phone?: string;
  email?: string;
  
  // Payment info
  paymentId: string;
  paymentTitle: string;
  paymentAmount: string;
  paymentDueDate: string;
  
  // Submission status
  submissionId?: string;
  submissionStatus?: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED' | null;
  submittedAmount?: string;
  submittedDate?: string;
  receiptUrl?: string;
  receiptFilename?: string;
  transactionId?: string;
  rejectionReason?: string;
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  canResubmit?: boolean;
}
```

### ClassPaymentSubmissionDetail
```typescript
interface ClassPaymentSubmissionDetail {
  id: string;
  paymentId: string;
  studentId: string;
  studentUuid: string;
  studentName: string;
  nameWithInitials: string;
  image?: string;
  paymentDate: string;
  receiptUrl: string;
  receiptFilename: string;
  transactionId?: string;
  submittedAmount: string;
  status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  notes?: string;
  uploadedAt: string;
  updatedAt: string;
  canResubmit?: boolean;
}
```

---

## Status Flow Diagram

```
Student Submits Payment with Receipt
         ↓
      PENDING (Awaiting Admin Verification)
         ↓
    ┌────┴────┬────────────────┬─────────────┐
    ↓         ↓                 ↓             ↓
 VERIFIED  HALF_VERIFIED  QUARTER_VERIFIED  REJECTED
 (100%)      (50%)            (25%)         (Needs Resubmit)
    ↓         ↓                 ↓             ↓
  Payment Complete        Partial Payment   Student Can Resubmit
```

---

## Error Handling

### Common Errors

**400 Bad Request**
- Missing required parameters
- Invalid payment amount
- Invalid file type/size

**403 Forbidden**
- User doesn't have permission to verify payments
- Not an admin/teacher for this class

**404 Not Found**
- Payment not found
- Submission not found

**413 Payload Too Large**
- Receipt file exceeds 10MB limit

**Example Error Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You don't have permission to verify this payment",
  "statusCode": 403
}
```

---

## Usage Examples

### Workflow 1: Verify Payments (Admin)
```typescript
// 1. Load payment submissions
const submissions = await classPaymentsApi.getClassPaymentSubmissions(
  '109', // instituteId
  '1004', // classId
  '1', // paymentId
  { page: 1, limit: 50 }
);

// 2. Filter pending submissions
const pending = submissions.data.filter(s => s.status === 'PENDING');

// 3. Verify each submission
for (const sub of pending) {
  await classPaymentsApi.verifyClassPaymentSubmission(
    '109', '1004', sub.id,
    { status: 'VERIFIED', notes: 'Auto-verified' }
  );
}
```

### Workflow 2: Collect Physical Payments
```typescript
// 1. Load students with payment details
const response = await classPaymentsApi.getStudentsForPaymentWithDetails(
  '109', // instituteId
  '1004', // classId
  '1', // paymentId
);

// 2. Show summary
console.log(`Total: ${response.summary.totalStudents}`);
console.log(`Verified: ${response.summary.verified}`);
console.log(`Pending: ${response.summary.pending}`);

// 3. For each pending student, collect payment
const pendingStudents = response.data.filter(s => !s.submissionStatus);
for (const student of pendingStudents) {
  const formData = new FormData();
  formData.append('paymentDate', '2024-05-01');
  formData.append('submittedAmount', '5000');
  // Add receipt file...
  
  const result = await classPaymentsApi.submitClassPayment(
    '109', '1004', '1',
    { paymentDate: '2024-05-01', submittedAmount: 5000 }
  );
}
```

---

## Best Practices

1. **Always validate file sizes** before uploading (max 10MB)
2. **Use pagination** for large datasets (limit: 10-50 items)
3. **Cache responses** using the built-in caching mechanism
4. **Handle rejection reasons** - always provide clear feedback to students
5. **Track verification metadata** - store verifiedBy and verifiedAt for audits
6. **Validate amounts** - ensure submitted amount matches expected payment tier
7. **Use status filter** - optimize queries by filtering specific statuses

---

## Caching

All GET endpoints use intelligent caching with TTL of 5 minutes:

```typescript
// Fresh data (bypasses cache)
const response = await classPaymentsApi.getStudentsForPaymentWithDetails(
  instituteId, classId, paymentId,
  { forceRefresh: true }
);
```

---

## Troubleshooting

### 410 Gone Error
- **Cause:** Using deprecated subject-level endpoints
- **Solution:** Use class-level endpoints (`/institute-class-payment-submissions/`)

### 400 Bad Request - Limit Exceeded
- **Cause:** Requested limit > 100
- **Solution:** Use `limit: 100` or less

### 413 Payload Too Large
- **Cause:** Receipt file > 10MB
- **Solution:** Compress image or use smaller PDF

### 403 Forbidden
- **Cause:** Not an admin/teacher for the class
- **Solution:** Ensure user has appropriate role assignment

---

## Related Documentation

- [Class Payments API](./CLASS_PAYMENTS_API.md)
- [Payment Verification Dialog](./PAYMENT_VERIFICATION_DIALOG.md)
- [Physical Payment Collection Flow](./PHYSICAL_PAYMENT_COLLECTION.md)
