import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class SchemaGenerationService {

  constructor(private apiService: ApiService) { }

  /**
   * Downloads the generated schema from the API
   * @returns Observable of the blob data for the schema file
   */
  downloadSchemaFromApi(): Observable<Blob> {
    return this.apiService.downloadSchema();
  }

  /**
   * Downloads the generated schema as a JSON file from blob data
   * @param blob - The blob data from the API
   * @param filename - Optional filename (defaults to 'schema-config.json')
   */
  downloadSchemaFromBlob(blob: Blob, filename: string = 'schema-config.json'): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(link.href);
  }

}
