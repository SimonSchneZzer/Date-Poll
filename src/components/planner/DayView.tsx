"use client";

import { useMemo } from "react";
import { useTasks } from "@/context/TaskContext";
import { TaskItem } from "./TaskItem";
import { AddTaskDialog } from "./AddTaskDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DayViewProps {
  selectedDate: Date;
}

export function DayView({ selectedDate }: DayViewProps) {
  const { tasks } = useTasks();

  const dayTasks = useMemo(() => {
    return tasks
      .filter(
        (task) =>
          task.date.toDateString() === selectedDate.toDateString()
      )
      .sort((a, b) => {
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        if (a.startTime) return -1;
        if (b.startTime) return 1;
        return 0;
      });
  }, [tasks, selectedDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{formatDate(selectedDate)}</h2>
        <AddTaskDialog selectedDate={selectedDate} />
      </div>
      <Separator className="mb-4" />
      <ScrollArea className="flex-1">
        {dayTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tasks scheduled for this day.
          </div>
        ) : (
          <div className="space-y-3 pr-4">
            {dayTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
