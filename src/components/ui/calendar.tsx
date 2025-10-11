"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
  locale?: any;
  className?: string;
  classNames?: any;
  showOutsideDays?: boolean;
}

function Calendar({
  className,
  selected,
  onSelect,
  initialFocus,
  locale,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date());
  
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const monthNames = [
    "Januar", "Februar", "Mars", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Desember"
  ];
  
  const dayNames = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
  
  const days = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }
  
  const isSelected = (day: number) => {
    if (!selected || !day) return false;
    const date = new Date(year, month, day);
    return date.toDateString() === selected.toDateString();
  };
  
  const isToday = (day: number) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return date.toDateString() === today.toDateString();
  };
  
  const handleDayClick = (day: number) => {
    if (!day) return;
    const date = new Date(year, month, day);
    onSelect?.(date);
  };
  
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  return (
    <div className={cn("p-3", className)}>
      <div className="flex justify-center pt-1 relative items-center mb-4">
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
          )}
          onClick={goToPreviousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium">
          {monthNames[month]} {year}
        </div>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
          )}
          onClick={goToNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      
      <div className="w-full border-collapse space-y-1">
        <div className="flex">
          {dayNames.map((dayName) => (
            <div
              key={dayName}
              className="text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center py-2"
            >
              {dayName}
            </div>
          ))}
        </div>
        
        <div className="flex w-full mt-2">
          <div className="grid grid-cols-7 gap-1 w-full">
            {days.map((day, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  "h-9 w-9 p-0 font-normal text-center text-sm rounded-md",
                  "hover:bg-accent hover:text-accent-foreground",
                  day && isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary",
                  day && isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground",
                  !day && "invisible"
                )}
                onClick={() => handleDayClick(day)}
                disabled={!day}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }