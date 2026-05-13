import { enhancedCachedClient } from './enhancedCachedClient';

export interface UserType {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  color: string | null;
  icon: string | null;
}

const userTypesApi = {
  list: (instituteId: string): Promise<UserType[]> => {
    return enhancedCachedClient.get<UserType[]>(`/institutes/${instituteId}/user-types`);
  },
  get: (instituteId: string, typeId: string): Promise<UserType> => {
    return enhancedCachedClient.get<UserType>(`/institutes/${instituteId}/user-types/${typeId}`);
  }
};

export { userTypesApi };
