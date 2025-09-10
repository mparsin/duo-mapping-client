import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoryRefreshService {
  private categoryRefreshSubject = new Subject<number>();
  
  // Observable for components to subscribe to category refresh events
  categoryRefresh$ = this.categoryRefreshSubject.asObservable();
  
  // Method to trigger a category refresh
  refreshCategory(categoryId: number): void {
    this.categoryRefreshSubject.next(categoryId);
  }
}




