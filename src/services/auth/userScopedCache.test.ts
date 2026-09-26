import { QueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';

import { bindUserScopedCache } from './userScopedCache';

jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

const A = { id: 'user-a', name: 'A', email: 'a@x.kg', createdAt: '' };
const B = { id: 'user-b', name: 'B', email: 'b@x.kg', createdAt: '' };

describe('user-scoped query cache', () => {
  it("never carries one account's private rows (creations, admin role) to the next", () => {
    const client = new QueryClient();
    useAuthStore.setState({ status: 'authenticated', user: A });
    const unbind = bindUserScopedCache(client);
    client.setQueryData(['oymo_creations'], [{ id: 'a-private' }]);
    client.setQueryData(['shyrdak_creation'], { id: 'a-private' });
    client.setQueryData(['admin_role'], 'super_admin');
    client.setQueryData(['explore_regions'], [{ id: 'public' }]);

    // Same account refreshing its session keeps everything.
    useAuthStore.setState({ user: { ...A } });
    expect(client.getQueryData(['oymo_creations'])).toBeDefined();

    // Sign out, then B signs in: A's rows are gone, public content stays.
    useAuthStore.setState({ status: 'unauthenticated', user: null });
    useAuthStore.setState({ status: 'authenticated', user: B });
    expect(client.getQueryData(['oymo_creations'])).toBeUndefined();
    expect(client.getQueryData(['shyrdak_creation'])).toBeUndefined();
    expect(client.getQueryData(['admin_role'])).toBeUndefined();
    expect(client.getQueryData(['explore_regions'])).toEqual([{ id: 'public' }]);
    unbind();
  });
});
