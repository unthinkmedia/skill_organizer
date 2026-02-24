# VS Code Extension Development Workflow

Build production-ready VS Code extensions from concept to marketplace publication, emphasizing native UI patterns while strategically using WebViews and custom editors when appropriate. Includes design analysis through Figma MCP and screenshot integration.

## Overview

This workflow provides comprehensive VS Code extension development that starts with design analysis and proceeds through architecture planning, implementation, and marketplace publication. The workflow emphasizes using VS Code's native UI components while strategically incorporating WebViews and custom editors when design requirements demand richer interactive experiences.

## Workflow Components

### Specialized Agents
- **[Design Analyzer](agents/design-analyzer.agent.md)** - Analyzes Figma designs and screenshots to extract technical requirements and recommend component strategies
- **[Extension Architect](agents/extension-architect.agent.md)** - Designs overall extension architecture with proper component selection and integration strategy
- **[UI Pattern Specialist](agents/ui-pattern-specialist.agent.md)** - Implements native VS Code UI components (Tree Views, Quick Picks, Command Palette)
- **[WebView Developer](agents/webview-developer.agent.md)** - Creates rich interactive WebViews with mandatory VS Code Elements integration for native-looking components
- **[Custom Editor Specialist](agents/custom-editor-specialist.agent.md)** - Builds custom editors for specialized file types and editing experiences
- **[Extension Tester](agents/extension-tester.agent.md)** - Develops comprehensive testing strategies across all UI patterns
- **[Packaging Specialist](agents/packaging-specialist.agent.md)** - Handles marketplace packaging and publication

### Quality Standards
- **[Extension Development Best Practices](instructions/extension-development-best-practices.instructions.md)** - Core development patterns and VS Code API usage guidelines
- **[UI Component Selection Standards](instructions/ui-component-selection-standards.instructions.md)** - Decision framework for native UI vs WebViews vs custom editors
- **[VS Code Elements Integration](instructions/vscode-elements-integration.instructions.md)** - **MANDATORY** guidelines for using VS Code Elements in WebViews for native-looking components

### Orchestration Prompts
- **[Develop VS Code Extension](prompts/develop-vscode-extension.prompt.md)** - Complete workflow orchestration from design to publication

## How to Use

### Design-First Development Approach

1. **Start with design analysis**:
   ```
   @design-analyzer Analyze this Figma design for a code review extension: [Figma URL or screenshot]
   ```

2. **Get architecture recommendations**:
   ```
   @extension-architect Design architecture based on the design analysis for [extension concept]
   ```

3. **Implement with appropriate patterns**:
   ```
   @develop-vscode-extension Build the extension using the recommended architecture and component selection
   ```

### Quick Start for Complete Development
```
@develop-vscode-extension I want to create a [extension description] based on this design: [Figma URL/screenshot]. The extension should [functionality description].
```

### Component Selection Workflow

The workflow follows this decision tree for UI components:

```
Design Requirements
        │
        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│Can native UI    │───▶│Use Native        │───▶│Tree Views,      │
│achieve design?  │Yes │Components        │    │Quick Picks,     │
│                 │    │                  │    │Command Palette  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │No
        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│Need custom file │───▶│Use Custom        │───▶│Custom Editors   │
│editing?         │Yes │Editors           │    │for specialized  │
│                 │    │                  │    │file types       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │No
        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│Need rich        │───▶│Use Strategic     │───▶│WebViews with    │
│interactive UI?  │Yes │WebViews          │    │theme integration│
│                 │    │                  │    │and accessibility │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Individual Agent Usage

**Analyze design requirements:**
```
@design-analyzer Review this Figma design for a project dashboard and recommend technical implementation approach
```

**Design extension architecture:**
```
@extension-architect Plan architecture for a Git workflow extension with custom merge conflict editor and status tree view
```

**Implement native UI patterns:**
```
@ui-pattern-specialist Create tree view provider for project files with custom icons and drag-drop functionality
```

**Build strategic WebViews:**
```
@webview-developer Create interactive chart dashboard with real-time data updates and VS Code theme integration
```

**Develop custom editors:**
```
@custom-editor-specialist Build custom editor for configuration files with visual form interface and validation
```

**Create comprehensive tests:**
```
@extension-tester Design test strategy for extension with native UI, WebViews, and custom editors
```

**Package for marketplace:**
```
@packaging-specialist Package extension with proper metadata, screenshots, and automated publishing pipeline
```

## Component Selection Guidelines

### Native UI Components (First Choice)
**Use for:**
- File/project browsers → Tree View Providers
- Item selection/search → Quick Pick Interfaces  
- Command access → Command Palette Integration
- Status display → Status Bar Items
- Configuration → VS Code Settings API
- Simple forms → Multi-step Quick Pick workflows

**Benefits:**
- Native accessibility and keyboard navigation
- Automatic theme integration
- Consistent with VS Code UX patterns
- Better performance and memory usage
- Built-in internationalization support

### Custom Editors (Specialized Files)
**Use for:**
- JSON/YAML editors with visual forms
- Configuration file editors with validation
- Diagram/schema editors with visual representation
- Binary file viewers with custom rendering
- Specialized markup editors with live preview

**Implementation Patterns:**
- Custom text editors for enhanced editing experiences
- Custom readonly editors for specialized file viewing
- Diff editors for comparison workflows
- Webview-based editors for complex visual interfaces

### WebViews (Rich Interactive Content)
**Use for:**
- Complex data visualizations requiring charts/graphs
- Rich interactive dashboards with real-time updates
- Multi-media content presentation
- Complex forms requiring custom layouts
- Interactive tutorials or guided experiences

**Best Practices:**
- **MANDATORY**: Use VS Code Elements web components for native-looking UI
- Use VS Code theme CSS variables for consistency
- Implement proper message passing for communication
- Ensure accessibility with proper ARIA labels
- Handle theme changes dynamically
- Optimize performance with virtual scrolling for large datasets

### VS Code Elements Integration

**MANDATORY for all WebViews**: Use VS Code Elements web components to ensure native appearance and consistent user experience.

**Installation and Setup:**
```bash
npm install @vscode-elements/elements
```

**Required Usage Pattern:**
```html
<!-- WebView with VS Code Elements -->
<script src="node_modules/@vscode-elements/elements/dist/bundled.js" type="module"></script>

<form class="settings-form">
    <vscode-textfield placeholder="Project name" required></vscode-textfield>
    <vscode-dropdown>
        <vscode-option value="typescript">TypeScript</vscode-option>
        <vscode-option value="javascript">JavaScript</vscode-option>
    </vscode-dropdown>
    <vscode-button appearance="primary">Save Settings</vscode-button>
</form>
```

**Benefits:**
- Automatic VS Code theme integration
- Built-in accessibility and keyboard navigation  
- Consistent with native VS Code interface
- Full TypeScript support

**Reference**: See [VS Code Elements Integration Standards](instructions/vscode-elements-integration.instructions.md) for complete implementation guidelines.

## Workflow Execution Pattern

### Sequential Development Pipeline
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │───▶│ Design Analyzer  │───▶│ Extension       │
│ (Concept +      │    │ • Extract        │    │ Architect       │
│  Design)        │    │   requirements   │    │ • Plan          │
│                 │    │ • Map components │    │   architecture  │
└─────────────────┘    │ • Recommend      │    │ • Select APIs   │
                       │   strategy       │    │ • Design        │
                       └──────────────────┘    │   integration   │
                              │                └─────────────────┘
                       [Requirements                   │
                        Review]                [Architecture
                              │                 Approval]
                              │                       │
                              ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│Published        │◀───│ Packaging        │◀───│ Component       │
│Extension        │    │ Specialist       │    │ Implementation  │
│                 │    │ • Bundle         │    │ (Parallel)      │
│                 │    │   extension      │    │                 │
└─────────────────┘    │ • Create assets  │    │ ┌─────────────┐ │
        │               │ • Marketplace    │    │ │ Native UI   │ │
 [Marketplace           │   preparation    │    │ │ Specialist  │ │
  Ready]                └──────────────────┘    │ └─────────────┘ │
        │                      │                │ ┌─────────────┐ │
        ▼               [Package                │ │ WebView     │ │
┌─────────────────┐      Review]               │ │ Developer   │ │
│User Testing &   │            │                │ └─────────────┘ │
│Feedback         │            │                │ ┌─────────────┐ │
│Integration      │            │                │ │ Custom      │ │
└─────────────────┘            │                │ │ Editor      │ │
                              │                │ │ Specialist  │ │
                              │                │ └─────────────┘ │
                              │                └─────────────────┘
                              │                       │
                              │                [Implementation
                              │                 Review]
                              │                       │
                              │                       ▼
                              │                ┌─────────────────┐
                              └────────────────│ Extension       │
                                               │ Tester          │
                                               │ • Test all      │
                                               │   components    │
                                               │ • Validate      │
                                               │   integration   │
                                               │ • Performance   │
                                               │   testing       │
                                               └─────────────────┘
```

## Design Analysis Integration

### Figma MCP Integration
The workflow can analyze Figma designs to extract:
- UI component requirements and layout specifications
- Interaction patterns and user flow definitions
- Color schemes and typography for theme integration
- Icon requirements and visual asset specifications
- Accessibility considerations from design annotations

### Screenshot Analysis
For design concepts provided as screenshots:
- Component identification and categorization
- Layout analysis and responsive design considerations  
- VS Code integration recommendations
- Technical feasibility assessment and alternative suggestions

### Design-to-Code Workflow
```
Design Input (Figma/Screenshot)
        │
        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│Design Analysis  │───▶│Component         │───▶│Architecture     │
│• UI Components  │    │Selection         │    │Design           │
│• Interactions   │    │• Native UI       │    │• File structure │
│• Visual Design  │    │• Custom Editors  │    │• API integration│
│• Accessibility  │    │• WebViews        │    │• Testing plan   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                      │                       │
        └──────────────────────┼───────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │Implementation   │
                    │• TypeScript     │
                    │• UI Components  │
                    │• Testing        │
                    │• Documentation  │
                    └─────────────────┘
```

## Example Use Cases

### Development Tool Extensions

**Git Workflow Manager**
- **Native UI**: Tree view for branch management, command palette for Git operations, status bar for repository status
- **Custom Editor**: Merge conflict resolution with side-by-side diff view and interactive conflict resolution
- **Strategic WebView**: Commit history visualization with interactive timeline and branch graph

**Code Review Extension**  
- **Native UI**: Tree view for review items, quick pick for reviewer selection, command palette for review actions
- **Custom Editor**: Code review editor with inline comments and approval workflow
- **Strategic WebView**: Review dashboard with metrics, team activity, and review queue management

**Project Template Manager**
- **Native UI**: Tree view for template browsing, command palette for scaffolding, settings for template preferences
- **Custom Editor**: Template configuration editor with visual form interface
- **Strategic WebView**: Template preview with live project structure visualization

### Content Creation Extensions

**Documentation Generator**
- **Native UI**: Command palette for generation commands, tree view for document structure
- **Custom Editor**: Markdown editor with enhanced syntax highlighting and live outline view  
- **Strategic WebView**: Live preview panel with custom styling and interactive table of contents

**API Documentation Tool**
- **Native UI**: Tree view for endpoint organization, quick pick for API exploration
- **Custom Editor**: OpenAPI schema editor with visual interface and validation
- **Strategic WebView**: Interactive API documentation with request testing and response visualization

## Testing Strategy

### Multi-Pattern Testing
```typescript
// Test native UI components
suite('Native UI Integration Tests', () => {
    test('Tree view populates and responds to user interaction', async () => {
        // Test tree view functionality
    });
    
    test('Command palette integration works correctly', async () => {
        // Test command registration and execution
    });
});

// Test WebView functionality
suite('WebView Integration Tests', () => {
    test('WebView loads and communicates with extension', async () => {
        // Test WebView message passing
    });
    
    test('WebView adapts to theme changes', async () => {
        // Test theme integration
    });
});

// Test custom editors
suite('Custom Editor Tests', () => {
    test('Custom editor opens and saves files correctly', async () => {
        // Test custom editor functionality
    });
    
    test('Custom editor integrates with VS Code lifecycle', async () => {
        // Test editor lifecycle management
    });
});
```

### User Experience Testing
- **Usability Testing**: Real user interaction patterns and feedback
- **Performance Benchmarking**: Extension startup time and memory usage
- **Accessibility Auditing**: Screen reader compatibility and keyboard navigation
- **Cross-Extension Testing**: Compatibility with popular VS Code extensions

## Performance and Accessibility

### Performance Optimization
- **Lazy Loading**: Initialize components only when needed
- **Virtual Rendering**: Implement efficient rendering for large datasets
- **Memory Management**: Proper disposal of WebView and editor resources
- **Theme Caching**: Cache theme-dependent resources for faster switching

### Accessibility Excellence  
- **Keyboard Navigation**: Full keyboard support across all UI patterns
- **Screen Reader Support**: Proper ARIA labels and semantic structure
- **High Contrast Compliance**: Theme adaptation for accessibility themes
- **Focus Management**: Logical tab order and focus indication

### Cross-Platform Considerations
- **Theme Compatibility**: Testing across VS Code's built-in themes
- **Platform-Specific Patterns**: macOS, Windows, and Linux UI considerations
- **Performance Testing**: Validation across different system configurations
- **Extension Compatibility**: Testing with popular VS Code extensions

## Marketplace Success Factors

### Professional Packaging
- **Rich Media Assets**: Screenshots, GIFs, and videos demonstrating functionality
- **Comprehensive Documentation**: Installation, usage, and troubleshooting guides
- **Version Management**: Semantic versioning and detailed changelogs
- **Community Engagement**: Response to user feedback and feature requests

### Quality Indicators
- **Code Quality**: TypeScript usage, comprehensive testing, and documentation
- **User Experience**: Intuitive interface design and helpful error messages
- **Performance**: Minimal VS Code impact and responsive user interactions
- **Accessibility**: Full compliance with accessibility guidelines and standards

## Troubleshooting

### Common Issues and Solutions

**"Extension isn't activating properly"**
- Review extension manifest activation events and entry point configuration
- Check that activation conditions match your extension's use case
- Validate TypeScript compilation and ensure no runtime errors in activation code

**"VS Code API calls aren't working as expected"**
- Verify API version compatibility with your target VS Code version
- Check that required API permissions are declared in package.json
- Review official VS Code API documentation for correct usage patterns

**"Performance issues during extension runtime"**
- Implement lazy loading for heavy operations and large data structures
- Use VS Code's built-in progress indicators for long-running operations
- Profile extension performance and optimize critical code paths

**"UI components don't match VS Code theming"**
- Use VS Code's theme tokens and CSS variables for consistent styling
- Test extension appearance across different VS Code themes
- Follow VS Code UX guidelines for native look and feel

**"WebView or Custom Editor not loading correctly"**
- Check Content Security Policy (CSP) configuration for WebViews
- Verify resource URIs are properly generated and accessible
- Ensure proper message passing implementation between extension and WebView

**"Extension fails marketplace validation"**
- Review VS Code marketplace publishing requirements and guidelines
- Ensure all required metadata and assets are included
- Validate extension security and privacy compliance

## Timeline Expectations

### Complete Extension Development: 2-4 weeks
- **Week 1**: Design analysis, architecture planning, and core setup
- **Week 2**: Native UI implementation and basic functionality
- **Week 3**: Advanced components (WebViews/Custom Editors), testing
- **Week 4**: Polish, documentation, packaging, and marketplace submission

### Focused Development: 1-2 weeks per component
- Individual agent workflows for specific extension features
- Targeted development for particular UI patterns or integrations
- Quick enhancement of existing extensions

### Rapid Prototyping: 3-5 days
- Basic functionality implementation for validation
- UI mockups and interaction design
- Technical feasibility assessment and proof of concept

## Success Patterns

### Extension Types by Timeline

**Simple Utility Extensions (3-7 days)**
- Command palette integration with basic functionality
- Status bar indicators and simple notifications
- Settings-driven behavior modifications

**Enhanced Editor Extensions (1-2 weeks)**  
- Language support with IntelliSense providers
- Editor decorations and custom highlighting
- File type associations with specialized handlers

**Complex Tool Extensions (2-4 weeks)**
- Multi-component architecture with native UI and strategic WebViews
- Custom editors for specialized file types
- Integration with external services and APIs

**Platform Extensions (3-6 weeks)**
- Comprehensive development environments
- Multi-language support with debugging capabilities
- Rich dashboard interfaces with real-time data

## Best Practices Summary

### Design-Driven Development
- Start with design analysis to inform technical decisions
- Use component selection framework to choose appropriate UI patterns
- Maintain design consistency while leveraging VS Code's native capabilities
- Document design decisions and component selection rationale

### Implementation Excellence
- Prioritize native VS Code components for familiar user experience
- Use WebViews strategically when native components are insufficient
- Implement custom editors for specialized file editing experiences
- Follow VS Code API best practices and performance guidelines

### Quality Assurance
- Comprehensive testing across all UI patterns and integration points
- Accessibility compliance with keyboard navigation and screen reader support
- Performance optimization with lazy loading and efficient resource management
- Theme integration with proper CSS variable usage and high contrast support

### Marketplace Readiness
- Professional packaging with rich media assets and comprehensive documentation
- Semantic versioning with detailed changelogs and migration guides
- Community engagement with responsive support and feature development
- Continuous improvement based on user feedback and usage analytics

For additional support or complex extension development scenarios, this workflow provides a comprehensive foundation for creating professional, user-friendly, and technically excellent VS Code extensions that leverage the full spectrum of VS Code's extensibility platform.