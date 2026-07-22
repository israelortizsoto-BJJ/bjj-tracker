export type WorkflowStatus = { status: string };

export type WorkflowInstanceLike = {
  id: string;
  status(): Promise<WorkflowStatus>;
};

export type WorkflowBindingLike<T> = {
  create(options: {
    id: string;
    params: T;
    retention: { successRetention: "3 days"; errorRetention: "3 days" };
  }): Promise<WorkflowInstanceLike>;
  get(id: string): Promise<WorkflowInstanceLike>;
};

export type TriggerResult = {
  id: string;
  duplicate: boolean;
  status: string;
};

export async function createOrGetDeterministicWorkflow<T>(
  workflow: WorkflowBindingLike<T>,
  id: string,
  params: T,
): Promise<TriggerResult> {
  try {
    const instance = await workflow.create({
      id,
      params,
      retention: { successRetention: "3 days", errorRetention: "3 days" },
    });
    return { id: instance.id, duplicate: false, status: "accepted" };
  } catch {
    const existing = await workflow.get(id);
    const status = await existing.status();
    return { id: existing.id, duplicate: true, status: status.status };
  }
}
