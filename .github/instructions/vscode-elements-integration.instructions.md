---
description: Guidelines and best practices for VS Code Elements in WebViews with native-like UI components and consistent user experience
applyTo: "**/webview-developer.agent.md"
---

# VS Code Elements Integration Standards

> **Note**: For comprehensive VS Code Elements integration including icons, theming, and React patterns, see vscode-elements-integration.instructions.md in the vscode-ui-experimentation workflow

Comprehensive guidelines for implementing VS Code Elements web components when building WebViews for VS Code extensions, ensuring native-like appearance and consistent user experience.

## Overview

VS Code Elements is a web component library that re-implements VS Code's native UI controls as custom elements (web components), enabling WebViews to create user interfaces that look and behave like the native VS Code interface. This addresses the fundamental limitation that VS Code's native UI widgets are not available within WebView contexts.

### Key Benefits

- **Native Appearance**: Components automatically match VS Code's theme and visual design language
- **Consistent Behavior**: Familiar interaction patterns that users expect from VS Code
- **Theme Integration**: Automatic adaptation to VS Code theme changes including high contrast modes
- **Accessibility**: Built-in keyboard navigation and screen reader support
- **Type Safety**: Full TypeScript support with proper type definitions

## When to Use VS Code Elements

### Recommended Use Cases

**Strategic WebView Enhancement:**
- WebViews requiring native-looking form controls (buttons, inputs, dropdowns)
- Interactive dashboards that should feel integrated with VS Code's interface
- Complex data entry forms requiring VS Code's visual consistency
- Settings or configuration interfaces that mirror native VS Code patterns

**Component Replacement Strategy:**
- Replace generic HTML controls with VS Code-themed equivalents
- Enhance custom editors with native-looking UI elements
- Improve user experience in existing WebViews with inconsistent styling

### Alternative Consideration

Before implementing VS Code Elements, consider **VS Code Elements Lite** for simpler use cases:
- Projects preferring traditional HTML/CSS over JavaScript components
- Scenarios where avoiding additional dependencies is preferred
- Simple interfaces where HTML/CSS snippets provide sufficient styling

## Installation and Setup

### NPM Installation
```bash
npm install @vscode-elements/elements
```

### Bundle Integration Options

#### Complete Bundle (Simplest Approach)
```html
<script src="node_modules/@vscode-elements/elements/dist/bundled.js" type="module"></script>
```

#### Selective Component Import (Optimized)
```javascript
// Import only needed components for better performance
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-textfield/index.js";
import "@vscode-elements/elements/dist/vscode-dropdown/index.js";
import "@vscode-elements/elements/dist/vscode-badge/index.js";
```

### WebView Integration Pattern
```typescript
// Extension side - WebView creation with VS Code Elements support
private _getHtmlForWebview(webview: vscode.Webview): string {
    const elementsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode-elements/elements', 'dist', 'bundled.js')
    );
    
    const nonce = this.getNonce();
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
        <title>VS Code Elements WebView</title>
    </head>
    <body>
        <div id="app">
            <!-- VS Code Elements components go here -->
            <vscode-button>Click me</vscode-button>
        </div>
        <script type="module" nonce="${nonce}" src="${elementsUri}"></script>
        <script nonce="${nonce}">
            // Application logic
        </script>
    </body>
    </html>`;
}
```

## Core Component Categories

### Form Controls

#### Buttons
```html
<!-- Primary action buttons -->
<vscode-button appearance="primary">Save Settings</vscode-button>

<!-- Secondary actions -->
<vscode-button appearance="secondary">Cancel</vscode-button>

<!-- Icon buttons -->
<vscode-button appearance="icon">
    <vscode-icon name="gear"></vscode-icon>
</vscode-button>
```

#### Text Inputs
```html
<!-- Standard text fields -->
<vscode-textfield placeholder="Enter value...">
    <span slot="start">📁</span>
</vscode-textfield>

<!-- Password fields -->
<vscode-textfield type="password" placeholder="Password"></vscode-textfield>

<!-- Multiline text areas -->
<vscode-textarea placeholder="Enter description..." rows="4"></vscode-textarea>
```

#### Selection Controls
```html
<!-- Dropdown selection -->
<vscode-dropdown>
    <vscode-option>Option 1</vscode-option>
    <vscode-option>Option 2</vscode-option>
    <vscode-option>Option 3</vscode-option>
</vscode-dropdown>

<!-- Checkbox inputs -->
<vscode-checkbox checked>Enable feature</vscode-checkbox>

<!-- Radio button groups -->
<vscode-radio-group>
    <vscode-radio value="option1">Option 1</vscode-radio>
    <vscode-radio value="option2">Option 2</vscode-radio>
</vscode-radio-group>
```

### Layout Components

#### Panels and Sections
```html
<!-- Collapsible sections -->
<vscode-collapsible title="Advanced Settings" expanded>
    <vscode-badge slot="decorations" variant="counter">3</vscode-badge>
    <div>
        <!-- Section content -->
    </div>
</vscode-collapsible>

<!-- Panel containers -->
<vscode-panels>
    <vscode-panel-tab id="tab-1">Configuration</vscode-panel-tab>
    <vscode-panel-tab id="tab-2">Advanced</vscode-panel-tab>
    <vscode-panel-view id="panel-1">
        <!-- Configuration content -->
    </vscode-panel-view>
    <vscode-panel-view id="panel-2">
        <!-- Advanced content -->
    </vscode-panel-view>
</vscode-panels>
```

#### Data Display
```html
<!-- Progress indicators -->
<vscode-progress-ring value="75"></vscode-progress-ring>
<vscode-progressbar value="50" max="100"></vscode-progressbar>

<!-- Badges and labels -->
<vscode-badge variant="activity-bar-counter">12</vscode-badge>
<vscode-tag>TypeScript</vscode-tag>

<!-- Data tables -->
<vscode-data-grid>
    <vscode-data-grid-row>
        <vscode-data-grid-cell>Name</vscode-data-grid-cell>
        <vscode-data-grid-cell>Type</vscode-data-grid-cell>
    </vscode-data-grid-row>
</vscode-data-grid>
```

### Navigation Components

#### Tabs and Trees
```html
<!-- Tab navigation -->
<vscode-tabs>
    <vscode-tab-header slot="header">
        <vscode-tab>Overview</vscode-tab>
        <vscode-tab>Details</vscode-tab>
    </vscode-tab-header>
    <vscode-tab-panel>
        <!-- Overview content -->
    </vscode-tab-panel>
    <vscode-tab-panel>
        <!-- Details content -->
    </vscode-tab-panel>
</vscode-tabs>

<!-- Tree structures -->
<vscode-tree>
    <vscode-tree-item expanded>
        <span>Root Folder</span>
        <vscode-tree-item>
            <span>Subfolder</span>
        </vscode-tree-item>
    </vscode-tree-item>
</vscode-tree>
```

## Integration Best Practices

### Mandatory VS Code Elements Usage

**When implementing WebViews, ALWAYS use VS Code Elements for UI components:**

- Replace all standard HTML buttons with `<vscode-button>`
- Use `<vscode-textfield>` instead of `<input type="text">`
- Implement `<vscode-dropdown>` for select elements
- Use `<vscode-checkbox>` for boolean inputs
- Apply `<vscode-progressbar>` for progress indication

### Component Selection Priority

1. **First Choice**: VS Code Elements components for all interactive elements
2. **Fallback**: Standard HTML only when VS Code Elements doesn't provide equivalent
3. **Never**: Generic styled HTML when VS Code Elements alternative exists

### Implementation Requirements

- **Package Installation**: Always include `@vscode-elements/elements` as dependency
- **Bundle Integration**: Use either complete bundle or selective imports based on performance needs
- **CSP Compliance**: Ensure Content Security Policy allows VS Code Elements execution
- **TypeScript Support**: Leverage provided TypeScript definitions for type safety

## Icon Integration Standards

### Codicons Installation and Setup
```bash
# Install VS Code's official icon library
npm install @vscode/codicons
```

**Resources:**
- **Codicons Repository**: https://github.com/microsoft/vscode-codicons
- **Icon Browser**: https://microsoft.github.io/vscode-codicons/dist/codicon.html
- **Icon Sources**: https://github.com/microsoft/vscode-codicons/tree/main/src/icons
- **Usage Examples**: https://github.com/microsoft/vscode-extension-samples/tree/main/webview-codicons-sample

### Icon Usage Patterns
```html
<!-- Include Codicons CSS -->
<link rel="stylesheet" href="node_modules/@vscode/codicons/dist/codicon.css">

<!-- Icon buttons -->
<vscode-button appearance="icon" title="Open Settings">
    <vscode-icon name="settings-gear"></vscode-icon>
</vscode-button>

<!-- Buttons with icons and text -->
<vscode-button appearance="primary">
    <vscode-icon name="save" slot="start"></vscode-icon>
    Save File
</vscode-button>

<!-- File type indicators -->
<vscode-icon name="file-code"></vscode-icon> <!-- Code files -->
<vscode-icon name="json"></vscode-icon> <!-- JSON files -->
<vscode-icon name="folder"></vscode-icon> <!-- Folders -->
```

## Required Implementation Patterns

### Complete Form Example
```html
<form id="settings-form">
    <div class="form-group">
        <label for="project-name">Project Name:</label>
        <vscode-textfield 
            id="project-name" 
            name="projectName" 
            placeholder="Enter project name"
            required>
            <vscode-icon name="folder" slot="start"></vscode-icon>
        </vscode-textfield>
    </div>
    
    <div class="form-group">
        <label for="language-select">Language:</label>
        <vscode-dropdown id="language-select" name="language">
            <vscode-option value="typescript">
                <vscode-icon name="file-code" slot="start"></vscode-icon>
                TypeScript
            </vscode-option>
            <vscode-option value="javascript">
                <vscode-icon name="file-code" slot="start"></vscode-icon>
                JavaScript
            </vscode-option>
        </vscode-dropdown>
    </div>
    
    <div class="form-actions">
        <vscode-button type="submit" appearance="primary">
            <vscode-icon name="save" slot="start"></vscode-icon>
            Save Configuration
        </vscode-button>
        <vscode-button type="button" appearance="secondary">
            <vscode-icon name="close" slot="start"></vscode-icon>
            Cancel
        </vscode-button>
    </div>
</form>
```

### Event Handling Standards
```javascript
// Required event handling pattern for VS Code Elements
const setupEventHandlers = () => {
    // Use VS Code Elements specific events
    document.querySelector('vscode-button').addEventListener('click', handleButtonClick);
    document.querySelector('vscode-textfield').addEventListener('input', handleInput);
    document.querySelector('vscode-dropdown').addEventListener('change', handleDropdownChange);
    
    // Handle custom VS Code Elements events
    document.querySelector('vscode-tabs').addEventListener('vsc-tabs-select', handleTabSelect);
};
```

## Security and Performance Requirements

### CSP Configuration for VS Code Elements and Codicons
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               script-src 'nonce-${nonce}' ${webview.cspSource}; 
               style-src ${webview.cspSource} 'unsafe-inline';
               font-src ${webview.cspSource};
               img-src ${webview.cspSource} data:;
               connect-src ${webview.cspSource};">
```

### Performance Optimization
```javascript
// Use selective imports for better performance
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-textfield/index.js";
// Only import components actually used

// Implement lazy loading for heavy components
const loadDataGrid = async () => {
    if (!document.querySelector('vscode-data-grid')) {
        await import("@vscode-elements/elements/dist/vscode-data-grid/index.js");
    }
};
```

## Validation and Quality Checks

### Component Usage Validation
```javascript
// Required validation for VS Code Elements implementation
const validateElementsUsage = () => {
    const violations = [];
    
    // Check for standard HTML elements that should be VS Code Elements
    if (document.querySelector('button:not(vscode-button)')) {
        violations.push('Standard HTML buttons found - use vscode-button');
    }
    
    if (document.querySelector('input[type="text"]:not(vscode-textfield)')) {
        violations.push('Standard HTML inputs found - use vscode-textfield');
    }
    
    if (document.querySelector('select:not(vscode-dropdown)')) {
        violations.push('Standard HTML selects found - use vscode-dropdown');
    }
    
    if (violations.length > 0) {
        console.error('VS Code Elements violations:', violations);
        throw new Error('WebView must use VS Code Elements for UI components');
    }
};
```

### Implementation Checklist

- [ ] VS Code Elements package installed and configured
- [ ] All interactive elements use VS Code Elements components
- [ ] TypeScript definitions imported and utilized
- [ ] Event handlers use VS Code Elements specific events
- [ ] Accessibility attributes properly applied
- [ ] CSP configured to allow VS Code Elements execution
- [ ] Theme integration tested across VS Code themes
- [ ] Performance optimized with selective imports
- [ ] Validation checks implemented for component usage

## Migration from Standard HTML

### Required Migration Pattern
```javascript
// Automatic migration from standard HTML to VS Code Elements
const migrateToVSCodeElements = () => {
    // Replace all standard buttons
    document.querySelectorAll('button:not([data-migrated])').forEach(button => {
        const vscodeButton = document.createElement('vscode-button');
        vscodeButton.textContent = button.textContent;
        vscodeButton.appearance = button.classList.contains('primary') ? 'primary' : 'secondary';
        button.parentNode.replaceChild(vscodeButton, button);
    });
    
    // Replace all text inputs
    document.querySelectorAll('input[type="text"]:not([data-migrated])').forEach(input => {
        const vscodeInput = document.createElement('vscode-textfield');
        vscodeInput.value = input.value;
        vscodeInput.placeholder = input.placeholder;
        input.parentNode.replaceChild(vscodeInput, input);
    });
};
```

This integration standard ensures that all WebView implementations in VS Code extensions maintain visual and behavioral consistency with VS Code's native interface through mandatory use of VS Code Elements components.