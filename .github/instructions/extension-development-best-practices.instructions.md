---
description: Core development patterns, VS Code API usage guidelines, and quality standards for professional extension development.
applyTo: "**/*.agent.md"
---

# Extension Development Best Practices

Comprehensive guidelines for developing professional VS Code extensions that follow API best practices, maintain performance standards, and provide excellent user experience.

## Core Development Principles

### Native UI First Philosophy
- **Prioritize Built-in Components**: Always evaluate VS Code native components before considering custom solutions
- **Tree View Providers**: Use for hierarchical data, file explorers, and navigation structures
- **Quick Pick Interfaces**: Implement for search, selection, and multi-step workflows
- **Command Palette Integration**: Make all functionality discoverable through commands
- **Status Bar Integration**: Provide status information and quick actions without intrusive UI
- **Settings API Usage**: Use VS Code settings for all configuration needs

### Strategic WebView Implementation
Only use WebViews when native components cannot achieve design requirements:
- **Complex Data Visualization**: Charts, graphs, and interactive data displays
- **Rich Form Interfaces**: Complex forms requiring custom layouts and validation
- **Interactive Tutorials**: Guided experiences with progressive disclosure
- **Media Integration**: Rich media content that cannot be displayed in native components

### Custom Editor Guidelines
Implement custom editors for specialized file editing experiences:
- **File Type Specialization**: Custom editing for specific file formats or data structures
- **Visual Editing Interfaces**: Form-based editing for structured data
- **Binary File Handling**: Specialized viewers for non-text file formats
- **Enhanced Text Editing**: Advanced text editing features beyond standard VS Code capabilities

## VS Code Extension API Best Practices

### Extension Lifecycle Management
```typescript
// Proper extension activation
export function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize services
        const extensionService = new ExtensionService(context);
        
        // Register commands with proper error handling
        const commands = [
            vscode.commands.registerCommand('extension.command1', handleCommand1),
            vscode.commands.registerCommand('extension.command2', handleCommand2)
        ];
        
        // Register UI components
        const treeProvider = new CustomTreeProvider();
        const treeView = vscode.window.createTreeView('customView', {
            treeDataProvider: treeProvider,
            canSelectMany: true
        });
        
        // Add all disposables to context
        context.subscriptions.push(
            ...commands,
            treeView,
            extensionService
        );
        
        console.log('Extension activated successfully');
    } catch (error) {
        console.error('Extension activation failed:', error);
        vscode.window.showErrorMessage(`Extension activation failed: ${error.message}`);
    }
}

// Proper cleanup
export function deactivate(): Thenable<void> | undefined {
    // Cleanup any resources that require explicit disposal
    return cleanup();
}
```

### Resource Management
- **Disposable Pattern**: Always implement proper disposal of resources
- **Event Listener Cleanup**: Remove event listeners in dispose methods
- **Memory Management**: Avoid memory leaks through proper resource cleanup
- **Performance Optimization**: Use lazy loading and efficient data structures

### Error Handling Standards
```typescript
// Comprehensive error handling
export class SafeCommandHandler {
    async executeCommand(args: any[]): Promise<void> {
        try {
            // Validate inputs
            this.validateInputs(args);
            
            // Execute command with progress indication
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Processing...",
                cancellable: true
            }, async (progress, token) => {
                await this.performOperation(progress, token);
            });
            
            // Provide success feedback
            vscode.window.showInformationMessage('Operation completed successfully');
            
        } catch (error) {
            // Log error for debugging
            console.error('Command execution failed:', error);
            
            // Show user-friendly error message
            const message = error instanceof Error ? error.message : 'An unexpected error occurred';
            vscode.window.showErrorMessage(`Operation failed: ${message}`);
        }
    }
    
    private validateInputs(args: any[]): void {
        if (!args || args.length === 0) {
            throw new Error('Invalid command arguments');
        }
        // Additional validation logic
    }
}
```

## Performance Optimization Guidelines

### Extension Activation Optimization
- **Lazy Activation**: Use specific activation events instead of `*`
- **Efficient Initialization**: Minimize work done during activation
- **Background Processing**: Move heavy operations to background threads
- **Resource Preloading**: Only load resources when needed

### Memory Management
```typescript
// Efficient tree data provider with caching
export class OptimizedTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private cache = new Map<string, TreeItem[]>();
    private loadingItems = new Set<string>();
    
    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        const key = element?.id || 'root';
        
        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }
        
        // Avoid duplicate loading
        if (this.loadingItems.has(key)) {
            return [];
        }
        
        // Load data with error handling
        this.loadingItems.add(key);
        try {
            const children = await this.loadChildrenAsync(element);
            this.cache.set(key, children);
            return children;
        } catch (error) {
            console.error('Failed to load tree children:', error);
            return [];
        } finally {
            this.loadingItems.delete(key);
        }
    }
    
    refresh(element?: TreeItem): void {
        // Clear cache for element and its children
        const key = element?.id || 'root';
        this.cache.delete(key);
        this._onDidChangeTreeData.fire(element);
    }
}
```

### UI Performance
- **Virtual Rendering**: Use virtual scrolling for large lists
- **Efficient Updates**: Minimize DOM manipulation in WebViews
- **Throttled Events**: Debounce rapid user input events
- **Background Operations**: Keep UI responsive during processing

## Security Best Practices

### WebView Security
```typescript
// Strict Content Security Policy
private generateCSP(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    
    return [
        `default-src 'none'`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}'`,
        `font-src ${webview.cspSource}`,
        `img-src ${webview.cspSource} https: data:`,
        `connect-src https:` // Only if external APIs needed
    ].join('; ');
}

// Secure message handling
private async handleMessage(message: any): Promise<void> {
    // Validate message structure
    if (!this.isValidMessage(message)) {
        console.error('Invalid message received:', message);
        return;
    }
    
    // Sanitize data
    const sanitizedData = this.sanitizeMessageData(message.data);
    
    // Process based on command
    switch (message.command) {
        case 'allowedCommand1':
            await this.handleAllowedCommand1(sanitizedData);
            break;
        default:
            console.warn('Unknown or disallowed command:', message.command);
    }
}
```

### Input Validation and Sanitization
- **Command Validation**: Validate all command parameters
- **File Path Sanitization**: Sanitize file paths to prevent directory traversal
- **External Data Validation**: Validate data from external sources
- **User Input Sanitization**: Sanitize user inputs before processing

## Accessibility Implementation

### Keyboard Navigation
```typescript
// Accessible tree view implementation
export class AccessibleTreeProvider implements vscode.TreeDataProvider<AccessibleTreeItem> {
    getTreeItem(element: AccessibleTreeItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label);
        
        // Set accessibility information
        treeItem.accessibilityInformation = {
            label: element.accessibleLabel,
            role: element.role || 'treeitem'
        };
        
        // Set description for additional context
        treeItem.description = element.description;
        
        // Set tooltip for screen readers
        treeItem.tooltip = new vscode.MarkdownString(element.detailedDescription);
        
        return treeItem;
    }
}

// Accessible command implementation
vscode.commands.registerCommand('extension.accessibleAction', async () => {
    // Provide clear progress feedback
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Processing action...",
        cancellable: true
    }, async (progress, token) => {
        progress.report({ message: "Step 1 of 3: Initializing" });
        // ... processing steps with progress updates
        return processResult;
    });
    
    // Announce completion with details
    vscode.window.showInformationMessage(
        `Action completed. ${result.itemsProcessed} items processed successfully.`
    );
});
```

### Screen Reader Support
- **Semantic Markup**: Use proper ARIA labels in WebViews
- **Descriptive Text**: Provide meaningful descriptions for all UI elements
- **Progress Indication**: Clear feedback for long-running operations
- **Error Communication**: Specific, actionable error messages

## Theme Integration Standards

### CSS Custom Properties Usage
```css
/* VS Code theme integration */
:root {
    /* Color variables */
    --vscode-foreground: var(--vscode-foreground);
    --vscode-background: var(--vscode-editor-background);
    --vscode-secondary-bg: var(--vscode-sideBar-background);
    
    /* Interactive element colors */
    --button-bg: var(--vscode-button-background);
    --button-fg: var(--vscode-button-foreground);
    --button-hover: var(--vscode-button-hoverBackground);
    
    /* Border and focus colors */
    --border-color: var(--vscode-panel-border);
    --focus-color: var(--vscode-focusBorder);
    
    /* Typography */
    --font-family: var(--vscode-font-family);
    --font-size: var(--vscode-font-size);
}

/* High contrast theme support */
@media (prefers-contrast: high) {
    .interactive-element {
        border: 2px solid var(--vscode-contrastBorder);
    }
    
    .interactive-element:focus {
        outline: 3px solid var(--vscode-focusBorder);
        outline-offset: 2px;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

### Theme Responsiveness
- **Dynamic Theme Changes**: Handle theme changes at runtime
- **Color Token Usage**: Use VS Code color tokens consistently
- **High Contrast Support**: Ensure visibility in high contrast themes
- **Custom Theme Support**: Respect user custom themes

## Testing Standards

### Unit Testing Patterns
```typescript
// Comprehensive unit testing
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Extension Component Tests', () => {
    let sandbox: sinon.SinonSandbox;
    
    setup(() => {
        sandbox = sinon.createSandbox();
    });
    
    teardown(() => {
        sandbox.restore();
    });
    
    test('should handle command execution correctly', async () => {
        // Setup
        const mockService = sandbox.createStubInstance(ExtensionService);
        const command = new CommandHandler(mockService);
        
        // Execute
        await command.execute(['test', 'parameters']);
        
        // Verify
        assert(mockService.processCommand.calledOnce);
        assert.deepStrictEqual(
            mockService.processCommand.firstCall.args,
            [['test', 'parameters']]
        );
    });
    
    test('should handle errors gracefully', async () => {
        // Setup error scenario
        const mockService = sandbox.createStubInstance(ExtensionService);
        mockService.processCommand.rejects(new Error('Test error'));
        
        const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
        const command = new CommandHandler(mockService);
        
        // Execute
        await command.execute(['invalid']);
        
        // Verify error handling
        assert(showErrorStub.calledOnce);
        assert(showErrorStub.firstCall.args[0].includes('Test error'));
    });
});
```

### Integration Testing
- **VS Code API Integration**: Test actual VS Code API interactions
- **Workspace Testing**: Test with real workspace scenarios
- **Cross-Platform Testing**: Validate across operating systems
- **Performance Testing**: Measure and validate performance metrics

## Documentation Standards

### Code Documentation
```typescript
/**
 * Manages custom tree view functionality with drag-drop support
 * and context-sensitive actions.
 * 
 * @example
 * ```typescript
 * const provider = new CustomTreeProvider(initialData);
 * const treeView = vscode.window.createTreeView('customView', {
 *     treeDataProvider: provider,
 *     canSelectMany: true
 * });
 * ```
 */
export class CustomTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    /**
     * Event fired when tree data changes.
     * Subscribe to this event to refresh the tree view.
     */
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void>;
    
    /**
     * Creates a new tree provider with initial data.
     * 
     * @param initialData - Initial tree data to display
     * @param options - Configuration options for tree behavior
     */
    constructor(
        private initialData: TreeItem[],
        private options: TreeProviderOptions = {}
    ) {
        // Implementation
    }
    
    /**
     * Refreshes the tree view data.
     * 
     * @param element - Specific element to refresh, or undefined to refresh entire tree
     */
    refresh(element?: TreeItem): void {
        this._onDidChangeTreeData.fire(element);
    }
}
```

### User Documentation
- **Clear Installation Instructions**: Step-by-step installation and setup
- **Usage Examples**: Practical examples with screenshots
- **Configuration Guide**: Complete settings documentation
- **Troubleshooting**: Common issues and solutions

## Marketplace Quality Standards

### Package.json Requirements
- **Complete Metadata**: Publisher, version, description, categories, keywords
- **Proper Contribution Points**: Commands, views, configuration, menus
- **Activation Events**: Specific, efficient activation triggers
- **Asset References**: Icon, gallery banner, screenshot references

### Asset Standards
- **Icon Design**: 128x128 PNG with transparent background
- **Screenshots**: High-quality (1280x720+) showcasing key features
- **Animations**: Smooth GIFs demonstrating workflows (under 5MB)
- **Documentation**: Comprehensive README with clear value proposition

### Quality Checklist
- [ ] Extension activates without errors
- [ ] All commands are properly registered and functional
- [ ] UI components are accessible and theme-responsive
- [ ] Performance impact is minimal (< 100ms activation)
- [ ] Documentation is comprehensive and accurate
- [ ] All tests pass across platforms
- [ ] Security best practices are implemented
- [ ] Marketplace guidelines are followed

## Continuous Improvement

### User Feedback Integration
- **Analytics Implementation**: Track feature usage and performance
- **Error Reporting**: Collect and analyze error patterns
- **User Surveys**: Regular feedback collection and analysis
- **Community Engagement**: Active response to issues and feature requests

### Performance Monitoring
- **Telemetry**: Non-invasive usage and performance tracking
- **Benchmarking**: Regular performance regression testing
- **Optimization**: Ongoing optimization based on real-world usage
- **Compatibility**: Continuous testing with VS Code updates

These best practices ensure professional, performant, and user-friendly VS Code extensions that integrate seamlessly with the VS Code ecosystem while providing excellent developer and user experiences.