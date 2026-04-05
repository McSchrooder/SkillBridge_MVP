"use client";

import { useState, useMemo } from "react";
import { Course } from "@/types";

interface CourseCardsProps {
  courses: Course[];
  pageSize?: number;
}

export default function CourseCards({ courses, pageSize = 9 }: CourseCardsProps) {
  const [page, setPage] = useState(0);

  // Reset to page 0 when courses list changes
  const courseKey = courses.map((c) => c.id).join(",");
  const [prevKey, setPrevKey] = useState(courseKey);
  if (courseKey !== prevKey) {
    setPrevKey(courseKey);
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(courses.length / pageSize));
  const paginated = useMemo(
    () => courses.slice(page * pageSize, (page + 1) * pageSize),
    [courses, page, pageSize]
  );

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Recommended Courses
        </h3>
        <p className="text-sm text-slate-500">
          No matching courses found. Select an occupation to see recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Recommended Courses
        </h3>
        <span className="text-sm text-slate-400">
          {courses.length} course{courses.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[280px]">
        {paginated.map((course) => (
          <a
            key={course.id}
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-slate-100 p-4 hover:border-sky-300 hover:shadow-sm transition-all"
          >
            <h4 className="font-medium text-slate-900 text-sm leading-snug line-clamp-2">
              {course.title}
            </h4>
            <p className="text-xs text-slate-500 mt-1">{course.organization}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
              {course.rating > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-amber-500">&#9733;</span>
                  {course.rating.toFixed(1)}
                </span>
              )}
              {course.level && <span>{course.level}</span>}
            </div>
            {course.duration && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">{course.duration}</p>
            )}
            {course.skillNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {course.skillNames.slice(0, 3).map((s, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? "bg-sky-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
