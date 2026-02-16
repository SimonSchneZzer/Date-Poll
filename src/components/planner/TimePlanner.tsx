"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { DayView } from "./DayView";

export function TimePlanner() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <Card className="lg:col-span-1">
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-md"
          />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2 min-h-[500px]">
        <CardContent className="p-6 h-full">
          <DayView selectedDate={selectedDate} />
        </CardContent>
      </Card>
    </div>
  );
}
