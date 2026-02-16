export interface Task {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

export interface DaySchedule {
  date: Date;
  tasks: Task[];
}
