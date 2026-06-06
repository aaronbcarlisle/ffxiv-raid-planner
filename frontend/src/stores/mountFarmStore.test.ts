import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../services/api';
import { useMountFarmStore } from './mountFarmStore';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function resetMountFarmStore() {
  useMountFarmStore.setState({
    data: null,
    recommendations: [],
    isLoading: false,
    isLoadingRecs: false,
    isSaving: false,
    error: null,
  });
}

describe('mountFarmStore', () => {
  afterEach(() => {
    resetMountFarmStore();
    vi.clearAllMocks();
  });

  it('fetches progress from the static-group mount farms endpoint with trial_ids', async () => {
    vi.mocked(api.get).mockResolvedValue({
      trials: [],
      currentUserId: 'user-1',
    });

    await useMountFarmStore.getState().fetchProgress('group-1', [
      'dt-valigarmanda',
      'ew-zodiark',
    ]);

    expect(api.get).toHaveBeenCalledWith(
      '/api/static-groups/group-1/mount-farms?trial_ids=dt-valigarmanda,ew-zodiark'
    );
  });

  it('shows a Mount Farms-specific message when the API route returns 404', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, 'Not Found'));

    await useMountFarmStore.getState().fetchProgress('group-1', ['dt-valigarmanda']);

    expect(useMountFarmStore.getState().error).toBe(
      'Could not load mount farm progress. Static not found or you do not have access. The Mount Farm API route may also be unavailable in this deployment.'
    );
    consoleError.mockRestore();
  });
});
