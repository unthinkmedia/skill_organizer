---
description: Decision framework and guidelines for choosing between native VS Code UI components, WebViews, and custom editors based on requirements and constraints.
applyTo: "**/*.agent.md"
---

# UI Component Selection Standards

Comprehensive framework for making informed decisions about VS Code extension UI implementation, prioritizing native components while strategically using WebViews and custom editors when appropriate.

## Component Selection Decision Tree

### Primary Decision Framework

```
User Interface Requirement
        │
        ▼
┌─────────────────────────────────┐
│ Can native VS Code components   │ YES ──┐
│ achieve the desired UX?         │       │
└─────────────────────────────────┘       │
        │ NO                              │
        ▼                                 ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ Is this specialized file        │  │ USE NATIVE UI COMPONENTS        │
│ editing/viewing?                │  │ • Tree Views                    │
└─────────────────────────────────┘  │ • Quick Pick                    │
        │ YES                          │ • Command Palette               │
        ▼                              │ • Status Bar                    │
┌─────────────────────────────────┐  │ • Settings API                  │
│ USE CUSTOM EDITORS              │  │ • Output Channels               │
│ • Text Editors                  │  └─────────────────────────────────┘
│ • Readonly Editors              │
│ • WebView Editors               │
└─────────────────────────────────┘
        │ NO
        ▼
┌─────────────────────────────────┐
│ USE STRATEGIC WEBVIEWS          │
│ • Rich Interactive Content      │
│ • Data Visualization            │
│ • Complex Forms                 │
│ • Interactive Tutorials         │
└─────────────────────────────────┘
```

### Detailed Selection Criteria

#### When to Use Native UI Components (First Choice)

**Tree Views for:**
- Hierarchical data representation (file trees, project structure)
- Navigation interfaces with expandable/collapsible nodes
- Data browsing with context menus and drag-drop functionality
- Any list-like interface where users need to browse and select items

**Quick Pick for:**
- Search and selection workflows
- Multi-step input processes and wizards
- Command launchers with fuzzy search
- Item filtering and selection from large datasets

**Command Palette Integration for:**
- All extension functionality (make everything discoverable)
- Keyboard shortcut workflows
- Context-sensitive commands
- Power user access to advanced features

**Status Bar for:**
- Extension status indicators
- Quick action buttons
- Progress indication for background operations
- Non-intrusive information display

**Settings API for:**
- All extension configuration
- User preferences and customization
- Workspace-specific settings
- Feature toggles and behavioral options

**Output Channels for:**
- Logging and debugging information
- Process output and streaming data
- Build results and error messages
- Any text-based output or status information

#### When to Consider Custom Editors

**Custom Text Editors for:**
- Enhanced text editing with specialized syntax highlighting
- Form-based editing of structured text files (JSON, YAML, XML)
- Text files requiring custom validation and IntelliSense
- Configuration files needing guided editing experiences

**Custom Readonly Editors for:**
- Specialized file format viewers (binary files, images, data files)
- Read-only visualization of complex data structures
- Preview interfaces for generated or processed content
- Diff viewers for specialized file formats

**WebView-Based Editors for:**
- Visual editing interfaces requiring custom layouts
- Rich form interfaces for structured data editing
- Graphical editors for diagrams, schemas, or visual content
- Interactive editing experiences requiring web technologies

#### When WebViews Are Justified (Strategic Use Only)

**Data Visualization:**
- Interactive charts and graphs requiring libraries like D3.js or Chart.js
- Real-time dashboards with complex data displays
- Statistical visualizations and business intelligence interfaces
- Scientific or engineering data plotting

**Rich Interactive Content:**
- Interactive tutorials with guided user experiences
- Complex form interfaces requiring custom validation and workflows
- Media-rich content presentation (images, videos, interactive demos)
- Game-like interfaces or interactive simulations

**Complex Layout Requirements:**
- Interfaces requiring CSS Grid or Flexbox layouts not achievable with native components
- Multi-panel interfaces with custom resizing and docking
- Responsive designs adapting to different panel sizes
- Custom design systems requiring specific visual styling

**Integration Requirements:**
- Embedding third-party web components or widgets
- Integration with web-based services requiring specific HTML/CSS
- Reuse of existing web application components
- Requirements for specific web frameworks or libraries

## Component Comparison Matrix

### Functionality Comparison

| Requirement | Native UI | Custom Editor | Strategic WebView | Recommendation |
|-------------|-----------|---------------|-------------------|----------------|
| File Explorer | Tree View ✅ | Not Applicable | Overkill ❌ | **Tree View** |
| Item Selection | Quick Pick ✅ | Not Applicable | Possible but Complex 🟡 | **Quick Pick** |
| Configuration | Settings API ✅ | Possible 🟡 | Form Interface ✅ | **Settings API** |
| Text Editing | Limited 🟡 | Custom Text Editor ✅ | Rich Editor ✅ | **Custom Editor** |
| Data Visualization | Very Limited ❌ | Limited 🟡 | Charts/Graphs ✅ | **WebView** |
| Forms (Simple) | Multi-step Quick Pick ✅ | Form Editor ✅ | Rich Forms ✅ | **Quick Pick** |
| Forms (Complex) | Very Limited ❌ | Visual Editor ✅ | Rich Forms ✅ | **WebView** |
| Media Display | Not Supported ❌ | Image Viewer 🟡 | Rich Media ✅ | **WebView** |
| Status Display | Status Bar ✅ | Not Applicable | Notification Panel 🟡 | **Status Bar** |
| Command Access | Command Palette ✅ | Not Applicable | Custom UI ❌ | **Command Palette** |

### Performance and Resource Impact

| Aspect | Native UI | Custom Editor | WebView |
|--------|-----------|---------------|---------|
| **Memory Usage** | Minimal | Low | Moderate to High |
| **Startup Impact** | None | Minimal | Low to Moderate |
| **CPU Usage** | Minimal | Low | Moderate |
| **Rendering Performance** | Excellent | Good | Good to Fair |
| **Theme Integration** | Automatic | Automatic | Manual |
| **Accessibility** | Built-in | Built-in | Manual |
| **Maintenance** | Low | Moderate | High |

### Development Complexity

| Component Type | Implementation Complexity | Maintenance Effort | Testing Complexity |
|----------------|---------------------------|--------------------|-----------------|
| **Tree View** | Low | Low | Low |
| **Quick Pick** | Low to Moderate | Low | Low |
| **Command Palette** | Low | Low | Low |
| **Status Bar** | Low | Low | Low |
| **Settings API** | Low | Low | Low |
| **Custom Text Editor** | Moderate | Moderate | Moderate |
| **Custom Readonly Editor** | Moderate | Moderate | Moderate |
| **WebView Panel** | High | High | High |
| **WebView Editor** | High | High | High |

## Implementation Decision Guidelines

### Evaluation Checklist

Before choosing WebViews or custom editors, verify that native components cannot meet requirements:

**For Data Display:**
- [ ] Can Tree View display the hierarchical data adequately?
- [ ] Would Output Channel be sufficient for text-based information?
- [ ] Can Status Bar provide the needed status information?
- [ ] Is the complexity justified over native alternatives?

**For User Input:**
- [ ] Can Quick Pick handle the selection/input workflow?
- [ ] Would multi-step Quick Pick provide adequate user guidance?
- [ ] Can VS Code Settings API handle the configuration needs?
- [ ] Is custom form complexity truly necessary?

**For File Interaction:**
- [ ] Are you editing specific file types that warrant custom editors?
- [ ] Does the editing experience require visual or form-based interfaces?
- [ ] Can enhanced text editor providers meet the requirements?
- [ ] Is the file format complex enough to justify custom editing?

**For Rich Content:**
- [ ] Is the visual complexity beyond what native components can achieve?
- [ ] Do you need interactive elements not available natively?
- [ ] Are you integrating with web-based services or components?
- [ ] Is the user experience significantly better with custom WebView?

### Selection Decision Process

#### Step 1: Requirements Analysis
1. **User Workflow Analysis**: Understand the complete user journey and interaction patterns
2. **Data Structure Assessment**: Analyze the type and complexity of data being displayed or manipulated
3. **Performance Requirements**: Define acceptable performance characteristics and constraints
4. **Integration Needs**: Identify external services, APIs, or components requiring integration

#### Step 2: Native Component Evaluation
1. **Tree View Assessment**: Can hierarchical data be effectively displayed with Tree View?
2. **Quick Pick Evaluation**: Can selection/input workflows be achieved with Quick Pick?
3. **Command Integration**: Can functionality be exposed through Command Palette?
4. **Settings Integration**: Can configuration be handled through VS Code Settings?

#### Step 3: Custom Solution Justification
1. **Editor Requirements**: Does file editing require specialized interfaces?
2. **Visual Complexity**: Does the interface require custom layouts or styling?
3. **Interactive Features**: Are interactive elements beyond native capabilities needed?
4. **Performance Trade-offs**: Are the benefits worth the performance and complexity costs?

#### Step 4: Implementation Strategy
1. **Hybrid Approach**: Can native components be combined with strategic custom elements?
2. **Progressive Enhancement**: Can the solution start with native components and enhance selectively?
3. **Fallback Options**: Are there simpler alternatives if complex solutions prove problematic?
4. **Maintenance Planning**: How will the chosen solution be maintained and updated?

## Common Anti-Patterns to Avoid

### WebView Overuse
❌ **Don't use WebViews for:**
- Simple lists that could be Tree Views
- Basic forms that could be Quick Pick workflows
- Status information that could be Status Bar items
- Settings that could use VS Code Settings API
- Text display that could use Output Channels

### Custom Editor Misuse
❌ **Don't create custom editors for:**
- Standard text files without specialized editing needs
- Simple configuration that could use Settings API
- Display-only content that could use readonly providers
- Temporary or ephemeral content

### Native Component Limitations
❌ **Don't force native components for:**
- Complex data visualizations requiring charts or graphs
- Rich media content requiring custom presentation
- Highly interactive interfaces with complex state management
- Integration with existing web-based tools or services

### VS Code Elements Integration (MANDATORY for WebViews)

When implementing WebViews, **always use VS Code Elements** for UI components to ensure native appearance and behavior:

**Required VS Code Elements Usage:**
- **Form Controls**: Use `vscode-button`, `vscode-textfield`, `vscode-dropdown`, `vscode-checkbox` instead of standard HTML
- **Layout Components**: Implement `vscode-collapsible`, `vscode-panels`, `vscode-tabs` for structured layouts
- **Data Display**: Use `vscode-badge`, `vscode-progressbar`, `vscode-data-grid` for information presentation
- **Navigation**: Apply `vscode-tree`, `vscode-tab` components for browsing interfaces

**VS Code Elements Benefits:**
- **Automatic Theme Integration**: Components automatically adapt to VS Code theme changes
- **Built-in Accessibility**: Keyboard navigation and screen reader support included
- **Performance Optimized**: Efficient rendering with minimal resource impact
- **Type Safety**: Full TypeScript support with comprehensive type definitions

**Implementation Pattern:**
```html
<!-- REQUIRED: Use VS Code Elements instead of standard HTML -->
<vscode-button appearance="primary">Save</vscode-button>
<vscode-textfield placeholder="Enter value..."></vscode-textfield>
<vscode-dropdown>
    <vscode-option>Option 1</vscode-option>
</vscode-dropdown>

<!-- AVOID: Standard HTML in WebViews -->
<button>Save</button>
<input type="text" placeholder="Enter value...">
<select><option>Option 1</option></select>
```

**Integration Reference**: See [vscode-elements-integration.instructions.md](vscode-elements-integration.instructions.md) for complete implementation guidelines.

## Best Practices for Each Component Type

### Native UI Components
- **Performance**: Implement lazy loading and efficient data management
- **Accessibility**: Ensure keyboard navigation and screen reader support
- **Theme Integration**: Use VS Code theme tokens and respect user customizations
- **Error Handling**: Provide clear feedback for errors and loading states

### Custom Editors
- **Lifecycle Management**: Proper save/load, dirty state, and disposal handling
- **Integration**: Seamless integration with VS Code editor features (undo/redo, find/replace)
- **Performance**: Efficient handling of large files and complex data structures
- **User Experience**: Familiar editing patterns that feel native to VS Code

### Strategic WebViews
- **Security**: Strict Content Security Policy and input validation
- **Performance**: Efficient rendering and memory management
- **Theme Integration**: Dynamic adaptation to VS Code theme changes
- **Accessibility**: WCAG compliance and keyboard navigation support

## Documentation Requirements

### Component Selection Rationale
For each non-native component choice, document:
- **Requirements Analysis**: Why native components were insufficient
- **Alternative Evaluation**: What other options were considered
- **Trade-off Analysis**: Performance, complexity, and maintenance implications
- **Success Criteria**: How success will be measured

### Implementation Guidelines
Provide clear guidance for:
- **Setup and Configuration**: How to implement the chosen component
- **Integration Patterns**: How the component integrates with extension architecture
- **Testing Strategy**: How to test the component effectively
- **Maintenance Plan**: How to maintain and update the component

### User Impact Assessment
Evaluate and document:
- **Performance Impact**: Effect on VS Code performance and user experience
- **Learning Curve**: How easy it is for users to understand and use
- **Accessibility**: Support for users with disabilities
- **Cross-Platform**: Consistency across Windows, macOS, and Linux

## Continuous Evaluation

### Regular Review Process
- **Usage Analytics**: Monitor how users interact with different components
- **Performance Metrics**: Track performance impact and optimization opportunities
- **User Feedback**: Collect and analyze user satisfaction with UI choices
- **Technology Updates**: Re-evaluate choices as VS Code API evolves

### Optimization Opportunities
- **Native Migration**: Consider migrating WebViews to native components when possible
- **Performance Improvements**: Regular performance profiling and optimization
- **Accessibility Enhancements**: Continuous improvement of accessibility features
- **User Experience Refinements**: Iterative improvements based on user feedback

This framework ensures that UI component choices are made thoughtfully, with proper consideration of user experience, performance, maintainability, and VS Code integration quality.