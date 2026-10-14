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
    <article className="group relative bg-bg-surface rounded-xl border border-border-default overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-bg-subtle overflow-hidden">
        {project.renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.renderUrl}
            alt="Room redesign preview"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-muted text-sm">
            {project.status === 'PROCESSING' ? 'Rendering…' : 'Pending'}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isExpiringSoon
                ? 'bg-status-warning/15 text-status-warning'
                : 'bg-bg-subtle text-ink-muted'
            }`}
          >
            {days === 0 ? 'Expires today' : `${days}d remaining`}
          </span>
          <span
            className={`text-xs font-medium ${
              project.status === 'COMPLETE'
                ? 'text-status-success'
                : project.status === 'FAILED'
                  ? 'text-status-danger'
                  : 'text-ink-muted'
            }`}
          >
            {project.status}
          </span>
        </div>

        <p className="text-xs text-ink-muted font-mono">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Tap target link overlay */}
      {project.status === 'COMPLETE' && (
        <Link
          href={`/studio/view/${project.id}`}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-inset"
          aria-label={`View redesigned room from ${new Date(project.createdAt).toLocaleDateString()}`}
        />
      )}
    </article>
  );
}

export default function StudioHubPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">My Rooms</h1>
          <p className="text-ink-secondary text-sm mt-1">
            Renders are stored for 7 days. Download or purchase a pass to keep them.
          </p>
        </div>
        <Link
          href="/studio/new/upload"
          className="px-5 py-2 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
        >
          + New Room
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl bg-bg-subtle animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-status-danger text-sm py-8 text-center">
          Failed to load your rooms. Please refresh.
        </p>
      )}

      {data && data.projects.length === 0 && (
        <div className="text-center py-20">
          <p className="text-ink-muted text-base mb-4">No rooms yet.</p>
          <Link
            href="/studio/new/upload"
            className="px-5 py-2 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Upload your first room →
          </Link>
        </div>
      )}

      {data && data.projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
