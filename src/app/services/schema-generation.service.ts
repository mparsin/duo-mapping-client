import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Line } from '../models/line.model';
import { Category } from '../models/category.model';
import { TableMatch } from '../models/table-match.model';

export interface SchemaConfig {
  version: string;
  generatedAt: string;
  categories: CategorySchema[];
  mappings: MappingSchema[];
}

export interface CategorySchema {
  id: number;
  name: string;
  description?: string;
  lines: LineSchema[];
}

export interface LineSchema {
  id: number;
  name?: string;
  fieldName?: string;
  defaultValue?: string;
  reason?: string;
  tableMatches?: TableMatchSchema[];
}

export interface TableMatchSchema {
  tableName: string;
  columnName: string;
  confidence: number;
  isSelected: boolean;
}

export interface MappingSchema {
  categoryId: number;
  categoryName: string;
  lineId: number;
  lineName?: string;
  fieldName?: string;
  selectedTable: string;
  selectedColumn: string;
  confidence: number;
  defaultValue?: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SchemaGenerationService {

  constructor() { }

  /**
   * Generates a schema configuration based on the provided mapping data
   * @param categories - Array of categories with their lines and mappings
   * @returns Observable of the generated schema configuration
   */
  generateSchema(categories: Category[]): Observable<SchemaConfig> {
    // This is a placeholder implementation
    // In the future, this will process the actual mapping data and generate a config file
    
    const schema: SchemaConfig = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      categories: this.processCategories(categories),
      mappings: this.extractMappings(categories)
    };

    return of(schema);
  }

  /**
   * Downloads the generated schema as a JSON file
   * @param schema - The schema configuration to download
   * @param filename - Optional filename (defaults to 'schema-config.json')
   */
  downloadSchema(schema: SchemaConfig, filename: string = 'schema-config.json'): void {
    const dataStr = JSON.stringify(schema, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(link.href);
  }

  /**
   * Validates the schema configuration
   * @param schema - The schema configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateSchema(schema: SchemaConfig): string[] {
    const errors: string[] = [];

    if (!schema.version) {
      errors.push('Schema version is required');
    }

    if (!schema.generatedAt) {
      errors.push('Generated timestamp is required');
    }

    if (!schema.categories || schema.categories.length === 0) {
      errors.push('At least one category is required');
    }

    if (!schema.mappings || schema.mappings.length === 0) {
      errors.push('At least one mapping is required');
    }

    // Validate categories
    schema.categories?.forEach((category, index) => {
      if (!category.id) {
        errors.push(`Category ${index + 1}: ID is required`);
      }
      if (!category.name) {
        errors.push(`Category ${index + 1}: Name is required`);
      }
      if (!category.lines || category.lines.length === 0) {
        errors.push(`Category ${index + 1}: At least one line is required`);
      }
    });

    // Validate mappings
    schema.mappings?.forEach((mapping, index) => {
      if (!mapping.categoryId) {
        errors.push(`Mapping ${index + 1}: Category ID is required`);
      }
      if (!mapping.lineId) {
        errors.push(`Mapping ${index + 1}: Line ID is required`);
      }
      if (!mapping.selectedTable) {
        errors.push(`Mapping ${index + 1}: Selected table is required`);
      }
      if (!mapping.selectedColumn) {
        errors.push(`Mapping ${index + 1}: Selected column is required`);
      }
    });

    return errors;
  }

  private processCategories(categories: Category[]): CategorySchema[] {
    return categories.map(category => ({
      id: category.id,
      name: category.Name,
      description: category.description,
      lines: category.lines?.map(line => ({
        id: line.id,
        name: line.name || line.Name,
        fieldName: line.field_name,
        defaultValue: line.default,
        reason: line.reason,
        tableMatches: line['tableMatches']?.map((match: any) => ({
          tableName: match.tableName,
          columnName: match.columnName,
          confidence: match.confidence,
          isSelected: match.isSelected
        })) || []
      })) || []
    }));
  }

  private extractMappings(categories: Category[]): MappingSchema[] {
    const mappings: MappingSchema[] = [];

    categories.forEach(category => {
      category.lines?.forEach(line => {
        const selectedMatch = line['tableMatches']?.find((match: any) => match.isSelected);
        if (selectedMatch) {
          mappings.push({
            categoryId: category.id,
            categoryName: category.Name,
            lineId: line.id,
            lineName: line.name || line.Name,
            fieldName: line.field_name,
            selectedTable: selectedMatch.tableName,
            selectedColumn: selectedMatch.columnName,
            confidence: selectedMatch.confidence,
            defaultValue: line.default,
            reason: line.reason
          });
        }
      });
    });

    return mappings;
  }
}
