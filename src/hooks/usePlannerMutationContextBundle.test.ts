import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlannerMutationContextBundle } from "./usePlannerMutationContextBundle";

const {
  mockUsePlannerCreateDeleteActions,
  mockUsePlannerNodeMutationActions,
  mockUsePlannerCrossRefActions,
  mockUsePlannerDragActions,
  mockUsePlannerContextActions,
} = vi.hoisted(() => ({
  mockUsePlannerCreateDeleteActions: vi.fn(),
  mockUsePlannerNodeMutationActions: vi.fn(),
  mockUsePlannerCrossRefActions: vi.fn(),
  mockUsePlannerDragActions: vi.fn(),
  mockUsePlannerContextActions: vi.fn(),
}));

vi.mock("./usePlannerCreateDeleteActions", () => ({
  usePlannerCreateDeleteActions: mockUsePlannerCreateDeleteActions,
}));

vi.mock("./usePlannerNodeMutationActions", () => ({
  usePlannerNodeMutationActions: mockUsePlannerNodeMutationActions,
}));

vi.mock("./usePlannerCrossRefActions", () => ({
  usePlannerCrossRefActions: mockUsePlannerCrossRefActions,
}));

vi.mock("./usePlannerDragActions", () => ({
  usePlannerDragActions: mockUsePlannerDragActions,
}));

vi.mock("./usePlannerContextActions", () => ({
  usePlannerContextActions: mockUsePlannerContextActions,
}));

describe("usePlannerMutationContextBundle", () => {
  beforeEach(() => {
    mockUsePlannerCreateDeleteActions.mockReset();
    mockUsePlannerNodeMutationActions.mockReset();
    mockUsePlannerCrossRefActions.mockReset();
    mockUsePlannerDragActions.mockReset();
    mockUsePlannerContextActions.mockReset();
  });

  it("passes setNodeTaskStatus from node actions into context actions and merges all outputs", () => {
    const setNodeTaskStatus = vi.fn();
    const createDeleteActions = { createChild: vi.fn() };
    const nodeMutationActions = { renameSelected: vi.fn(), setNodeTaskStatus };
    const crossRefActions = { createCrossRef: vi.fn() };
    const dragActions = { onNodeDragStop: vi.fn() };
    const contextActions = { handleContextAddChild: vi.fn() };

    mockUsePlannerCreateDeleteActions.mockReturnValue(createDeleteActions);
    mockUsePlannerNodeMutationActions.mockReturnValue(nodeMutationActions);
    mockUsePlannerCrossRefActions.mockReturnValue(crossRefActions);
    mockUsePlannerDragActions.mockReturnValue(dragActions);
    mockUsePlannerContextActions.mockReturnValue(contextActions);

    const params = {
      createDelete: { marker: "create-delete" },
      nodeMutation: { marker: "node-mutation" },
      crossRef: { marker: "cross-ref" },
      drag: { marker: "drag" },
      context: { marker: "context" },
    } as unknown as Parameters<typeof usePlannerMutationContextBundle>[0];

    const result = usePlannerMutationContextBundle(params);

    expect(mockUsePlannerCreateDeleteActions).toHaveBeenCalledWith(params.createDelete);
    expect(mockUsePlannerNodeMutationActions).toHaveBeenCalledWith(params.nodeMutation);
    expect(mockUsePlannerCrossRefActions).toHaveBeenCalledWith(params.crossRef);
    expect(mockUsePlannerDragActions).toHaveBeenCalledWith(params.drag);
    expect(mockUsePlannerContextActions).toHaveBeenCalledWith(
      expect.objectContaining({
        marker: "context",
        setNodeTaskStatus,
      })
    );
    expect(result).toEqual({
      ...createDeleteActions,
      ...nodeMutationActions,
      ...crossRefActions,
      ...dragActions,
      ...contextActions,
    });
  });
});
