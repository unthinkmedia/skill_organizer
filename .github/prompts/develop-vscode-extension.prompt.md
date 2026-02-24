---
description: Comprehensive orchestration prompt for developing professional VS Code extensions from concept to marketplace publication.
---

# VS Code Extension Development Orchestration

Transform ideas into production-ready VS Code extensions through a systematic, design-first approach emphasizing native UI patterns, strategic WebView usage, and comprehensive testing.

## Workflow Overview

This workflow guides you through complete VS Code extension development with seven specialized agents handling design analysis, architecture, implementation, testing, and marketplace publication.

## Initial Analysis

**Start Here:** Provide your extension idea, requirements, or Figma designs. I'll analyze your needs and route you to the appropriate workflow entry point.

### Input Options
1. **Design-First Development**: Figma designs or screenshots for technical analysis
2. **Concept Development**: Extension idea or requirements for architecture planning
3. **Component-Specific Development**: Specific UI component or feature implementation
4. **Enhancement Project**: Existing extension requiring improvements or additional features

## Agent Handoff Chain

### 1. Design Analysis Phase
**Agent:** `designAnalyzer`
**Triggers when:** Figma designs, screenshots, or visual requirements provided
**Outputs:** Technical requirements, component mapping, UI pattern recommendations

### 2. Architecture Planning Phase  
**Agent:** `extensionArchitect`
**Triggers after:** Design analysis complete OR when starting with concept/requirements
**Outputs:** Extension architecture, component selection strategy, development roadmap

### 3. Implementation Phase (Parallel Execution)

#### Native UI Development
**Agent:** `uiPatternSpecialist`
**Focus:** Tree views, Quick Pick, Command Palette, Status Bar, Settings integration
**Best for:** Navigation, selection workflows, commands, configuration

#### Strategic WebView Development
**Agent:** `webviewDeveloper` 
**Focus:** Interactive dashboards, data visualization, complex forms
**Best for:** Rich interactive content requiring web technologies

#### Specialized File Editing
**Agent:** `customEditorSpecialist`
**Focus:** Custom text editors, readonly viewers, form-based editors
**Best for:** Specialized file types, visual editing interfaces

### 4. Quality Assurance Phase
**Agent:** `extensionTester`
**Triggers when:** Core implementation complete
**Outputs:** Comprehensive test suites, performance validation, quality reports

### 5. Marketplace Preparation Phase
**Agent:** `packagingSpecialist`  
**Triggers when:** All tests passing
**Outputs:** Marketplace-ready package, professional documentation, publishing automation

## Component Selection Workflow

The workflow uses intelligent component selection based on requirements:

```
User Requirement Analysis
        ↓
┌─────────────────────────────────┐
│ Can native components meet      │ YES ──► Native UI Implementation
│ the design requirements?        │        (Tree View, Quick Pick, etc.)
└─────────────────────────────────┘
        │ NO
        ↓
┌─────────────────────────────────┐
│ Is this specialized file        │ YES ──► Custom Editor Implementation  
│ editing or viewing?             │        (Text, Readonly, WebView editors)
└─────────────────────────────────┘
        │ NO
        ↓
┌─────────────────────────────────┐
│ Strategic WebView Implementation│
│ (Rich content, visualization,   │
│  complex forms, interactive UI) │
└─────────────────────────────────┘
```

## Workflow Execution Patterns

### Pattern 1: Design-First Development
```
Figma Design/Screenshot → designAnalyzer → extensionArchitect → 
Implementation Agents (parallel) → extensionTester → packagingSpecialist
```

**Best for:** Projects with existing designs or specific UI requirements

### Pattern 2: Concept-to-Code Development  
```
Extension Idea/Requirements → extensionArchitect → 
Implementation Agents (parallel) → extensionTester → packagingSpecialist
```

**Best for:** New extension ideas starting from functional requirements

### Pattern 3: Feature Enhancement
```
Existing Extension Analysis → extensionArchitect (enhancement planning) →
Implementation Agents (specific to enhancement) → extensionTester → packagingSpecialist
```

**Best for:** Adding features to existing extensions or refactoring

### Pattern 4: Component-Specific Development
```
Specific Component Need → Relevant Implementation Agent →
extensionTester (component testing) → Integration Planning
```

**Best for:** Implementing specific UI patterns or solving particular technical challenges

## Key Workflow Benefits

### Native UI First Approach
- **Automatic Theme Integration**: Extensions automatically respect user themes
- **Built-in Accessibility**: Screen reader support and keyboard navigation included  
- **Performance Optimization**: Minimal resource usage and fast rendering
- **Consistency**: Familiar VS Code patterns reduce user learning curve

### Strategic Enhancement Pattern
- **WebView When Justified**: Use for rich interactive content requiring web technologies
- **Custom Editors for Files**: Specialized editing experiences for specific file types
- **Performance Awareness**: All enhancements consider VS Code performance impact
- **Security by Design**: Comprehensive security patterns for WebViews and editors

### Quality Assurance Integration
- **Comprehensive Testing**: Unit, integration, performance, and accessibility testing
- **Cross-Platform Validation**: Windows, macOS, and Linux compatibility
- **Performance Monitoring**: Resource usage tracking and optimization
- **Marketplace Compliance**: Automated validation against VS Code marketplace standards

## Quick Start Examples

### Example 1: Tree View Extension
**Input:** "I need an extension that displays project dependencies in a tree structure with context menus for managing packages."

**Workflow:** 
1. `extensionArchitect` → Designs tree view architecture with command integration
2. `uiPatternSpecialist` → Implements TreeDataProvider with context menus
3. `extensionTester` → Creates comprehensive tree view tests
4. `packagingSpecialist` → Packages with dependency management screenshots

### Example 2: Data Visualization Extension  
**Input:** "Create an extension that displays code metrics in interactive charts and graphs."

**Workflow:**
1. `extensionArchitect` → Plans hybrid architecture (native commands + WebView dashboard)
2. `uiPatternSpecialist` → Implements command palette integration and status bar
3. `webviewDeveloper` → Creates secure WebView with Chart.js integration
4. `extensionTester` → Tests WebView security and performance
5. `packagingSpecialist` → Packages with visualization screenshots and demos

### Example 3: Custom File Editor
**Input:** "Build an extension for visual editing of JSON configuration files with validation and IntelliSense."

**Workflow:**
1. `extensionArchitect` → Designs custom editor architecture with validation
2. `customEditorSpecialist` → Implements CustomTextEditorProvider with JSON schema
3. `extensionTester` → Tests editor lifecycle and validation features  
4. `packagingSpecialist` → Creates comprehensive editing workflow documentation

## Workflow Quality Standards

### Performance Requirements
- **Activation Time**: < 100ms extension activation
- **Memory Usage**: Minimal impact on VS Code memory footprint  
- **UI Responsiveness**: Non-blocking operations with progress indication
- **Bundle Size**: Optimized packages under 50MB

### User Experience Standards  
- **Accessibility**: WCAG 2.1 AA compliance for all UI components
- **Theme Integration**: Automatic adaptation to all VS Code themes
- **Keyboard Navigation**: Full keyboard accessibility for all features
- **Error Handling**: Clear, actionable error messages and recovery options

### Code Quality Standards
- **TypeScript**: Comprehensive typing with strict compiler settings
- **Testing Coverage**: >80% test coverage for all components
- **Documentation**: Complete API documentation and user guides
- **Security**: Secure coding practices, especially for WebViews

### Marketplace Standards
- **Professional Assets**: High-quality icons, screenshots, and descriptions
- **Comprehensive Documentation**: README, API docs, and troubleshooting guides
- **Version Management**: Semantic versioning with detailed changelogs
- **Community Support**: Issue templates and contribution guidelines

## Advanced Workflow Patterns

### Hybrid Component Strategy
Combine multiple UI approaches for optimal user experience:

```typescript
// Example: Extension with multiple UI patterns
export class HybridExtension {
    // Native UI for navigation and commands
    private treeProvider = new ProjectTreeProvider();
    
    // WebView for rich data visualization  
    private dashboardWebview = new MetricsDashboard();
    
    // Custom editor for specialized files
    private configEditor = new ConfigurationEditor();
}
```

### Progressive Enhancement Pattern
Start with native components and enhance strategically:

1. **Phase 1**: Implement core functionality with native UI (Tree View, Commands)
2. **Phase 2**: Add WebView dashboard for advanced visualizations
3. **Phase 3**: Implement custom editors for specialized file types
4. **Phase 4**: Add advanced features and optimizations

### Modular Architecture Pattern
Design extensible architecture supporting multiple UI patterns:

```typescript
// Extension architecture supporting multiple UI approaches
interface UIComponent {
    activate(context: vscode.ExtensionContext): void;
    deactivate(): void;
}

class ExtensionManager {
    private components: UIComponent[] = [
        new TreeViewComponent(),
        new WebViewComponent(),
        new CustomEditorComponent()
    ];
}
```

## Troubleshooting and Support

### Common Decision Points

**"Should I use a WebView or native components?"**
→ Run through the Component Selection Workflow above. WebViews only for rich interactive content that can't be achieved natively.

**"How do I handle complex forms and configuration?"**
→ Start with VS Code Settings API. Use Quick Pick for multi-step workflows. WebViews only for highly complex forms requiring custom validation or layout.

**"My extension needs to edit specialized file types"**
→ Evaluate Custom Editor options: CustomTextEditorProvider for enhanced text editing, WebView-based editors for visual interfaces.

**"How do I ensure good performance?"**
→ Follow the Performance Requirements above. Use native components primarily, implement lazy loading, and follow memory management best practices.

### Quality Validation

Before proceeding to the next agent, ensure:
- [ ] Requirements are clearly defined and documented
- [ ] Component selection follows the decision framework
- [ ] Performance implications are understood and acceptable
- [ ] Security considerations are addressed (especially for WebViews)
- [ ] Accessibility requirements are planned for implementation

## Getting Started

**To begin development, provide:**

1. **Extension Purpose**: What problem does your extension solve?
2. **Target Users**: Who will use this extension and how?
3. **Key Features**: What are the main capabilities needed?
4. **Design Assets** (if available): Figma designs, mockups, or screenshots
5. **Technical Constraints**: Any specific requirements or limitations

The workflow will analyze your input and route you to the appropriate starting agent with a comprehensive development plan tailored to your specific requirements.

**Ready to start?** Describe your VS Code extension idea or share your design assets, and I'll guide you through the complete development process from concept to marketplace publication.
