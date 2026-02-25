import { useMemo, useState } from "react";
import type { TreeNode } from "../../utils/treeUtils";

type NodeSearchProps = {
  nodes: Map<string, TreeNode>;
  buildNodePath: (nodeId: string, nodesById: Map<string, TreeNode>) => string;
  jumpToNode: (nodeId: string) => void;
};

export default function NodeSearch({ nodes, buildNodePath, jumpToNode }: NodeSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    const results: Array<{ node: TreeNode; path: string; score: number }> = [];

    nodes.forEach((node) => {
      const title = node.title.toLowerCase();
      const path = buildNodePath(node.id, nodes).toLowerCase();

      // Skip if no match
      if (!title.includes(query) && !path.includes(query)) return;

      // Calculate relevance score
      let score = 0;
      if (title === query) score = 1000; // Exact match
      else if (title.startsWith(query)) score = 100; // Starts with
      else if (title.includes(query)) score = 10; // Contains
      else if (path.includes(query)) score = 1; // Path contains

      results.push({ node, path: buildNodePath(node.id, nodes), score });
    });

    // Sort by relevance score (highest first)
    results.sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title));

    // Limit to 20 results
    return results.slice(0, 20);
  }, [searchQuery, nodes, buildNodePath]);

  const handleResultClick = (nodeId: string) => {
    jumpToNode(nodeId);
    setSearchQuery("");
    setIsExpanded(false);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);

    return (
      <>
        {before}
        <mark className="search-highlight">{match}</mark>
        {after}
      </>
    );
  };

  return (
    <div className="node-search">
      <div className="node-search-input-wrapper">
        <input
          type="text"
          className="node-search-input"
          placeholder="🔍 Search nodes..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsExpanded(true);
          }}
          onFocus={() => setIsExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchQuery("");
              setIsExpanded(false);
            }
            if (e.key === "Enter" && searchResults.length > 0) {
              handleResultClick(searchResults[0].node.id);
            }
          }}
        />
        {searchQuery && (
          <button
            className="node-search-clear"
            onClick={() => {
              setSearchQuery("");
              setIsExpanded(false);
            }}
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {isExpanded && searchQuery.length >= 2 && (
        <div className="node-search-results">
          {searchResults.length === 0 ? (
            <div className="node-search-no-results">No nodes found for "{searchQuery}"</div>
          ) : (
            <>
              <div className="node-search-count">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
              </div>
              {searchResults.map(({ node, path }) => (
                <button
                  key={node.id}
                  className="node-search-result"
                  onClick={() => handleResultClick(node.id)}
                  title={path}
                >
                  <div className="node-search-result-title">
                    {highlightMatch(node.title, searchQuery)}
                  </div>
                  <div className="node-search-result-path">{path}</div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
