import { Line } from './line.model';

export interface Category {
  id: number;
  Name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  lines?: Line[];
}


