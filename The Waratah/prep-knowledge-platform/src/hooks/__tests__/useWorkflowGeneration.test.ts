/**
 * Unit tests for useWorkflowGeneration hook
 * Tests workflow generation modal and execution
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowGeneration } from '../useWorkflowGeneration';

describe('useWorkflowGeneration', () => {
  let mockFetchData: jest.Mock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetchData = jest.fn().mockResolvedValue(undefined);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    expect(result.current.showWorkflowModal).toBe(false);
    expect(result.current.workflowRunning).toBe(false);
    expect(result.current.workflowSteps).toEqual([]);
    expect(result.current.workflowResult).toBe(null);
  });

  it('should initialize workflow steps when generate is called', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          { step: 'finalize', status: 'success', message: 'Finalized 150 counts' },
          { step: 'generate', status: 'success', message: 'Created 24 tasks' },
          { step: 'export', status: 'success', message: 'Triggered export' },
        ],
      }),
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    // Should show modal
    expect(result.current.showWorkflowModal).toBe(true);

    // Should have 3 workflow steps
    expect(result.current.workflowSteps).toHaveLength(3);
    expect(result.current.workflowSteps[0].name).toBe('Finalize Stocktake');
    expect(result.current.workflowSteps[1].name).toBe('Generate Prep Run');
    expect(result.current.workflowSteps[2].name).toBe('Trigger Export');
  });

  it('should call workflow API with correct parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [],
      }),
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/prep/workflow/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });

  it('should handle successful workflow execution', async () => {
    const mockResponse = {
      success: true,
      folderUrl: 'https://drive.google.com/folder/123',
      results: [
        { step: 'finalize', status: 'success', message: 'Finalized 150 counts' },
        { step: 'generate', status: 'success', message: 'Created 24 tasks' },
        { step: 'export', status: 'success', message: 'Triggered export' },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    // Should set workflow result
    expect(result.current.workflowResult).toEqual({
      success: true,
      folderUrl: 'https://drive.google.com/folder/123',
      error: undefined,
    });

    // Should not be running
    expect(result.current.workflowRunning).toBe(false);

    // Should update step statuses
    expect(result.current.workflowSteps[0].status).toBe('success');
    expect(result.current.workflowSteps[1].status).toBe('success');
    expect(result.current.workflowSteps[2].status).toBe('success');
  });

  it('should handle workflow API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Stocktake not finalized' }),
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    // Should set error result
    expect(result.current.workflowResult).toEqual({
      success: false,
      error: 'Stocktake not finalized',
    });

    // Should not be running
    expect(result.current.workflowRunning).toBe(false);
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    // Should set error result
    expect(result.current.workflowResult).toEqual({
      success: false,
      error: 'Network error',
    });
  });

  it('should map step statuses correctly', async () => {
    const mockResponse = {
      success: true,
      results: [
        { step: 'finalize', status: 'success', message: 'Done' },
        { step: 'generate', status: 'skipped', message: 'Already exists' },
        { step: 'export', status: 'error', message: 'Failed' },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.workflowSteps[0].status).toBe('success');
    expect(result.current.workflowSteps[1].status).toBe('success'); // skipped → success
    expect(result.current.workflowSteps[2].status).toBe('error');
  });

  it('should close modal and refresh data on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [],
      }),
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.showWorkflowModal).toBe(true);

    act(() => {
      result.current.closeWorkflowModal();
    });

    // Should close modal
    expect(result.current.showWorkflowModal).toBe(false);

    // Should refresh data
    expect(mockFetchData).toHaveBeenCalledTimes(1);
  });

  it('should close modal without refresh on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed' }),
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.showWorkflowModal).toBe(true);

    act(() => {
      result.current.closeWorkflowModal();
    });

    // Should close modal
    expect(result.current.showWorkflowModal).toBe(false);

    // Should NOT refresh data on failure
    expect(mockFetchData).not.toHaveBeenCalled();
  });

  it('should set running state during execution', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(promise);

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    // Start the operation but don't await yet
    act(() => {
      result.current.handleGenerate();
    });

    // Should be running
    await waitFor(() => {
      expect(result.current.workflowRunning).toBe(true);
    });

    // Resolve the API call
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true, results: [] }),
    });

    // Should no longer be running
    await waitFor(() => {
      expect(result.current.workflowRunning).toBe(false);
    });
  });

  it('should clear running state even on error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    act(() => {
      result.current.handleGenerate();
    });

    // Wait for operation to complete
    await waitFor(() => {
      expect(result.current.workflowRunning).toBe(false);
    });
  });

  it('should reset workflow result on new generate', async () => {
    // First successful workflow
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        folderUrl: 'https://drive.google.com/folder/123',
        results: [],
      }),
    });

    const { result } = renderHook(() => useWorkflowGeneration(mockFetchData));

    act(() => {
      result.current.handleGenerate();
    });

    await waitFor(() => {
      expect(result.current.workflowResult?.success).toBe(true);
    });

    // Second workflow (should reset result)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'New error' }),
    });

    act(() => {
      result.current.handleGenerate();
    });

    // Result should be updated (not previous result)
    await waitFor(() => {
      expect(result.current.workflowResult?.success).toBe(false);
      expect(result.current.workflowResult?.error).toBe('New error');
    });
  });
});
