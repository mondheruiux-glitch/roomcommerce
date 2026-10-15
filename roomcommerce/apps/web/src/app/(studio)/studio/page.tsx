'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchProjects, type ProjectData } from '../../../lib/api-client';

function daysUntilExpiry(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function ProjectCard({ project }: { project: ProjectData }) {
  const days = daysUntilExpiry(project.expiresAt);
  const isExpiringSoon = days <= 2;

  return (
    <article className="group relative bg-bg-surface rounded-xl border border-border-default overflow-hidden hover:border-brand-terracotta/40 hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-bg-subtle overflow-hidden relative">
        {project.renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.renderUrl}
            alt="Room redesign preview"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-ink-muted text-sm gap-2">
            <svg
              className="w-8 h-8 opacity-40 animate-pulse text-brand-terracotta"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{project.status === 'PROCESSING' ? 'Rendering room…' : 'Pending'}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              isExpiringSoon
                ? 'bg-status-warning/15 text-status-warning'
                : 'bg-bg-subtle text-ink-muted'
            }`}
          >
            {days === 0 ? 'Expires today' : `${days}d remaining`}
          </span>
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              project.status === 'COMPLETE'
                ? 'text-status-success'
                : project.status === 'FAILED'
                  ? 'text-status-danger'
                  : 'text-brand-terracotta'
            }`}
          >
            {project.status}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-default/60">
          <p className="text-xs text-ink-muted font-mono">
            {new Date(project.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <span className="text-xs font-medium text-brand-terracotta group-hover:translate-x-0.5 transition-transform">
            View Design →
          </span>
        </div>
      </div>

      {/* Tap target link overlay */}
      {project.status === 'COMPLETE' && (
        <Link
          href={`/studio/view/${project.id}`}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-inset rounded-xl"
          aria-label={`View redesigned room from ${new Date(project.createdAt).toLocaleDateString()}`}
        />
      )}
    </article>
  );
}

export default function StudioHubPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-up">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-primary tracking-tight">My Rooms</h1>
          <p className="text-ink-secondary text-sm mt-1 max-w-xl">
            Renders are stored for 7 days. Download your designs or purchase a pass to keep them forever.
          </p>
        </div>
        <Link
          href="/studio/new/upload"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:bg-brand-terracotta-hover transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Room</span>
        </Link>
      </header>

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading your rooms"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-surface rounded-xl border border-border-default overflow-hidden animate-pulse"
              aria-hidden="true"
            >
              <div className="aspect-[4/3] bg-bg-subtle" />
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-bg-subtle rounded-full" />
                  <div className="h-4 w-16 bg-bg-subtle rounded-full" />
                </div>
                <div className="h-3 w-28 bg-bg-subtle rounded" />
              </div>
            </div>
          ))}
          <span className="sr-only">Loading your rooms...</span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="text-center py-16 px-4 bg-status-danger/5 border border-status-danger/20 rounded-2xl max-w-lg mx-auto"
        >
          <div className="w-12 h-12 rounded-full bg-status-danger/10 text-status-danger flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-ink-primary font-semibold text-base mb-1">Failed to load your rooms</p>
          <p className="text-ink-muted text-sm mb-4">A temporary network or server error occurred.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg bg-bg-surface border border-border-default text-ink-primary hover:bg-bg-subtle text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {data && (data.projects ?? []).length === 0 && (
        <div className="text-center py-20 px-4 bg-bg-surface border border-border-default rounded-2xl max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-terracotta-subtle text-brand-terracotta-hover flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-ink-primary mb-2">No redesigned rooms yet</h2>
          <p className="text-ink-secondary text-sm max-w-md mx-auto mb-6">
            Upload a photo of your living room, bedroom, or dining area to get a photorealistic redesign with matching furniture.
          </p>
          <Link
            href="/studio/new/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:bg-brand-terracotta-hover transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
          >
            <span>Upload Your First Room</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* Project Grid */}
      {data && (data.projects ?? []).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(data.projects ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
