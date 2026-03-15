/**
 * Workflow Generation Hook
 *
 * Manages the "Generate Ordering & Prep Sheets" workflow.
 * Executes: Finalize Stocktake → Generate Prep Run → Trigger Export
 */

import { useState, useCallback } from 'react';

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export interface WorkflowResult {
  success: boolean;
  folderUrl?: string;
  error?: string;
}

export function useWorkflowGeneration(fetchData: () => Promise<void>) {
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);

  const handleGenerate = useCallback(async () => {
    setShowWorkflowModal(true);
    setWorkflowRunning(true);
    setWorkflowResult(null);
    setWorkflowSteps([
      { name: 'Finalize Stocktake', status: 'pending' },
      { name: 'Generate Prep Run', status: 'pending' },
      { name: 'Trigger Export', status: 'pending' },
    ]);

    try {
      const res = await fetch('/api/prep/workflow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Workflow failed');
      }

      // Update steps based on result - API returns 'results' array
      if (result.results) {
        setWorkflowSteps(
          result.results.map((step: { step: string; status: string; message?: string }) => ({
            name:
              step.step === 'finalize'
                ? 'Finalize Stocktake'
                : step.step === 'generate'
                ? 'Generate Prep Run'
                : step.step === 'export'
                ? 'Trigger Export'
                : step.step,
            status:
              step.status === 'success'
                ? 'success'
                : step.status === 'error'
                ? 'error'
                : step.status === 'skipped'
                ? 'success'
                : 'pending',
            message: step.message,
          }))
        );
      }

      setWorkflowResult({
        success: result.success,
        folderUrl: result.folderUrl,
        error: result.error,
      });
    } catch (err) {
      setWorkflowResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setWorkflowRunning(false);
    }
  }, []);

  const closeWorkflowModal = useCallback(() => {
    setShowWorkflowModal(false);
    if (workflowResult?.success) {
      fetchData();
    }
  }, [workflowResult, fetchData]);

  return {
    showWorkflowModal,
    workflowRunning,
    workflowSteps,
    workflowResult,
    handleGenerate,
    closeWorkflowModal,
  };
}
