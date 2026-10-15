import { router } from 'expo-router';

import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { PROJECT_TYPES, projectKey, type ProjectRef, type ProjectType } from './workspaceModel';

export const isProjectType = (type: string): type is ProjectType => (PROJECT_TYPES as readonly string[]).includes(type);
export const workspaceRoute = (ref: ProjectRef) => `/profile/workspaces/${encodeURIComponent(projectKey(ref))}`;
export const WORKSPACES_ROUTE = '/profile/workspaces';

/**
 * Opens (and, the first time, adds) the workspace for an existing project.
 * If the add can't be written, the workspace screen still opens and offers
 * to add it again - the project itself is never touched.
 */
export async function openWorkspace(owner: string, ref: ProjectRef, title: string): Promise<void> {
  await useWorkspaceStore.getState().load();
  await useWorkspaceStore.getState().change(owner, { kind: 'add', ref, title, now: new Date().toISOString() });
  router.push(workspaceRoute(ref) as never);
}
