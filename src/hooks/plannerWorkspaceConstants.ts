import {
  BUBBLES_SIMPLIFIED_MODE,
  CROSS_REFERENCES_ENABLED,
  DEFAULT_BUBBLE_COLOR,
  STORY_NODE_MAX_HEIGHT,
  STORY_NODE_MAX_WIDTH,
  STORY_NODE_MIN_HEIGHT,
  STORY_NODE_MIN_WIDTH,
} from "../utils/plannerConfig";

export const plannerWorkspaceConstants = Object.freeze({
  crossReferencesEnabled: CROSS_REFERENCES_ENABLED,
  bubblesSimplifiedMode: BUBBLES_SIMPLIFIED_MODE,
  defaultBubbleColor: DEFAULT_BUBBLE_COLOR,
  storyNodeMinWidth: STORY_NODE_MIN_WIDTH,
  storyNodeMaxWidth: STORY_NODE_MAX_WIDTH,
  storyNodeMinHeight: STORY_NODE_MIN_HEIGHT,
  storyNodeMaxHeight: STORY_NODE_MAX_HEIGHT,
});
