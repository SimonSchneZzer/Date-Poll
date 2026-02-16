"use client";

import { Task } from "@/types";
import { useTasks } from "@/context/TaskContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
}

const priorityColors = {
  low: "bg-green-500/10 text-green-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-red-500/10 text-red-500",
};

export function TaskItem({ task }: TaskItemProps) {
  const { toggleComplete, deleteTask } = useTasks();

  return (
    <Card className={cn("transition-opacity", task.completed && "opacity-50")}>
      <CardContent className="flex items-center gap-4 p-4">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleComplete(task.id)}
          className="h-5 w-5 rounded border-gray-300"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium truncate",
                task.completed && "line-through"
              )}
            >
              {task.title}
            </span>
            <Badge variant="secondary" className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>
          </div>
          {task.startTime && (
            <p className="text-sm text-muted-foreground">
              {task.startTime}
              {task.endTime && ` - ${task.endTime}`}
            </p>
          )}
          {task.description && (
            <p className="text-sm text-muted-foreground truncate">
              {task.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteTask(task.id)}
          className="text-destructive hover:text-destructive"
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
