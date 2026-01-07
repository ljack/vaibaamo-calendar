---
trigger: always_on
---

# Rule: Maximum 5 Browser Tabs

## Summary

No more than **5 browser tabs** may be open at any time.

## Rule

- If the number of open browser tabs exceeds **5**, tabs **must be closed
  immediately**.
- Tabs are closed in order of age or position:
  - **Preferred (LRU)**: The tab with the oldest (lowest) \`lastAccessed\` timestamp.
  - **Alternative (Position)**: The leftmost tab in the current window (lowest index).

## Enforcement

When the tab count is greater than 5:

1. Identify candidate tabs using either **Least Recently Used (LRU)** logic or **Leftmost** logic.
2. Close tabs until only 5 tabs remain.

## Allowed Actions

Tabs may be closed using either of the following methods:

- **JavaScript-based automation**
- **Manual clicking in the browser UI**

## Examples

### ❌ Not allowed

- Keeping 6 or more tabs open.
- Ignoring excess tabs.

### ✅ Allowed

- Automatically closing older tabs via JavaScript.
- Manually clicking and closing the oldest/leftmost tabs until only 5 remain.

## Implementation Examples

### Option 1: Least Recently Used (LRU) - Recommended

\`\`\`javascript
chrome.tabs.query({}, (tabs) => {
  if (tabs.length <= 5) return;

  // Sort by lastAccessed - oldest (lowest timestamp) first
  const withAge = tabs.map(t => ({
    id: t.id,
    lastAccessed: t.lastAccessed || 0
  })).sort((a, b) => a.lastAccessed - b.lastAccessed);

  const toClose = withAge.slice(0, tabs.length - 5);
  toClose.forEach(tab => chrome.tabs.remove(tab.id));
});
\`\`\`

### Option 2: Leftmost in Current Window - Alternative

\`\`\`javascript
async function closeLeftmostInCurrentWindow() {
  const win = await chrome.windows.getCurrent();
  const tabs = await chrome.tabs.query({ windowId: win.id });
  
  if (tabs.length <= 5) return;

  const leftmost = tabs.reduce((best, t) => (t.index < best.index ? t : best), tabs[0]);
  if (leftmost?.id != null) await chrome.tabs.remove(leftmost.id);
}
\`\`\`

## Notes

This rule prioritizes cognitive focus, performance, and resource efficiency.
