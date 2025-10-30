"use client";
import { useCallback, useState } from "react";

export type NavGroupKey = 'projects' | 'inspections';

export interface UseListNavigatorOptions {
  counts: Record<NavGroupKey, number>;
  onEnter: (group: NavGroupKey, index: number) => void;
}

export default function useListNavigator({ counts, onEnter }: UseListNavigatorOptions) {
  const [activeGroup, setActiveGroup] = useState<NavGroupKey>('projects');
  const [activeIndex, setActiveIndex] = useState(-1);

  const reset = useCallback(() => {
    setActiveGroup('projects');
    setActiveIndex(-1);
  }, []);

  const onArrow = useCallback((dir: 1 | -1) => {
    let group = activeGroup;
    let index = activeIndex;
    
    // If no active selection, start at first available group
    if (index === -1) {
      if (counts.projects > 0) { group = 'projects'; index = 0; }
      else if (counts.inspections > 0) { group = 'inspections'; index = 0; }
      else { return; } // No results to navigate
    } else {
      const count = counts[group];
      if (count === 0) {
        // Current group is empty, switch to other
        group = group === 'projects' ? 'inspections' : 'projects';
        index = counts[group] > 0 ? (dir === 1 ? 0 : counts[group] - 1) : -1;
      } else {
        index += dir;
        // Wrap around or switch groups
        if (index < 0) {
          // Going up: try previous group or wrap to end of current
          const prevGroup = group === 'projects' ? 'inspections' : 'projects';
          if (counts[prevGroup] > 0) {
            group = prevGroup;
            index = counts[prevGroup] - 1;
          } else {
            index = count - 1; // Wrap to end of current group
          }
        } else if (index >= count) {
          // Going down: try next group or wrap to start of current
          const nextGroup = group === 'projects' ? 'inspections' : 'projects';
          if (counts[nextGroup] > 0) {
            group = nextGroup;
            index = 0;
          } else {
            index = 0; // Wrap to start of current group
          }
        }
      }
    }
    
    setActiveGroup(group);
    setActiveIndex(index);
  }, [activeGroup, activeIndex, counts]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key;
    if (key === 'ArrowDown') { e.preventDefault(); onArrow(1); }
    else if (key === 'ArrowUp') { e.preventDefault(); onArrow(-1); }
    else if (key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) onEnter(activeGroup, activeIndex);
    }
  }, [onArrow, onEnter, activeGroup, activeIndex]);

  return { activeGroup, activeIndex, setActiveGroup, setActiveIndex, reset, onKeyDown };
}
