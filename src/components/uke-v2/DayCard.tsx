'use client';

interface DayCardProps {
  date: string;
  entries: Array<{
    id: string;
    hours: number;
    project: string;
    projectNumber?: number;
    activity: string;
    status: string;
    color: string;
  }>;
  onCardClick: () => void;
}

export default function DayCard({ date, entries, onCardClick }: DayCardProps) {
  if (entries.length === 0) {
    return <div className="min-h-[80px]"></div>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <button
          key={entry.id}
          onClick={onCardClick}
          className="
            w-full 
            rounded-xl p-3 
            flex flex-col items-center justify-center
            text-white transition-all
            min-h-[80px]
            hover:opacity-90
          "
          style={{ 
            backgroundColor: entry.color
          }}
        >
          {/* Hours */}
          <div className="text-2xl font-bold mb-1">
            {entry.hours}
          </div>
          
          {/* Project name - truncated (same as original DayCard) */}
          <div className="text-xs text-center leading-tight line-clamp-2 opacity-90">
            {entry.project}
          </div>
        </button>
      ))}
    </div>
  );
}

