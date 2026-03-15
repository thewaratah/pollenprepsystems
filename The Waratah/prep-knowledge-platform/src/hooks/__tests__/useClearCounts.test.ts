/**
 * Unit tests for useClearCounts hook
 * Tests clear counts modal and action
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useClearCounts } from '../useClearCounts';

describe('useClearCounts', () => {
  let mockFetchData: jest.Mock;
  let mockSetError: jest.Mock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetchData = jest.fn().mockResolvedValue(undefined);
    mockSetError = jest.fn();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    expect(result.current.showClearModal).toBe(false);
    expect(result.current.clearing).toBe(false);
  });

  it('should toggle clear modal visibility', () => {
    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    act(() => {
      result.current.setShowClearModal(true);
    });

    expect(result.current.showClearModal).toBe(true);

    act(() => {
      result.current.setShowClearModal(false);
    });

    expect(result.current.showClearModal).toBe(false);
  });

  it('should successfully clear counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    act(() => {
      result.current.setShowClearModal(true);
    });

    await act(async () => {
      await result.current.handleClearCounts();
    });

    // Should call API with correct parameters
    expect(mockFetch).toHaveBeenCalledWith('/api/prep/counts/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preserveVerified: false }),
    });

    // Should refresh data
    expect(mockFetchData).toHaveBeenCalledTimes(1);

    // Should close modal
    expect(result.current.showClearModal).toBe(false);

    // Should not set error
    expect(mockSetError).not.toHaveBeenCalled();
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Database error' }),
    });

    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    await act(async () => {
      await result.current.handleClearCounts();
    });

    // Should set error
    expect(mockSetError).toHaveBeenCalledWith('Database error');

    // Should not close modal (user needs to see error)
    expect(result.current.showClearModal).toBe(false); // Modal state unchanged

    // Should not refresh data on error
    expect(mockFetchData).not.toHaveBeenCalled();
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    await act(async () => {
      await result.current.handleClearCounts();
    });

    // Should set error
    expect(mockSetError).toHaveBeenCalledWith('Network error');

    // Should not refresh data
    expect(mockFetchData).not.toHaveBeenCalled();
  });

  it('should set clearing state during operation', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValue(promise);

    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    // Start the operation but don't await yet
    act(() => {
      result.current.handleClearCounts();
    });

    // Should be clearing
    await waitFor(() => {
      expect(result.current.clearing).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Wait for the operation to complete
    await waitFor(() => {
      expect(result.current.clearing).toBe(false);
    });
  });

  it('should clear clearing state even on error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useClearCounts(mockFetchData, mockSetError));

    act(() => {
      result.current.handleClearCounts();
    });

    // Wait for operation to complete
    await waitFor(() => {
      expect(result.current.clearing).toBe(false);
    });
  });
});
