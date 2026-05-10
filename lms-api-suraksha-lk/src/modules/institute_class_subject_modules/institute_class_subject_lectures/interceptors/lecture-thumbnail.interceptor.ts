import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { InstituteClassSubjectLecture } from '../entities/institute_class_subject_lecture.entity';
import { PaginatedResponseDto } from '../../../../common/dto/paginated-response.dto';

function transformLecture(lecture: InstituteClassSubjectLecture): InstituteClassSubjectLecture {
  if (lecture.thumbnailUrl && !lecture.thumbnailUrl.startsWith('http')) {
    lecture.thumbnailUrl = `http://localhost:3000/${lecture.thumbnailUrl}`.replace(/\\/g, '/');
  }
  return lecture;
}

@Injectable()
export class LectureThumbnailInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        if (data instanceof PaginatedResponseDto && Array.isArray(data.data)) {
          data.data = data.data.map(item => {
            if (item instanceof InstituteClassSubjectLecture) {
              return transformLecture(item);
            }
            return item;
          });
        } else if (Array.isArray(data)) {
          return data.map(item => {
            if (item instanceof InstituteClassSubjectLecture) {
              return transformLecture(item);
            }
            return item;
          });
        } else if (data instanceof InstituteClassSubjectLecture) {
          return transformLecture(data);
        }
        return data;
      })
    );
  }
}
