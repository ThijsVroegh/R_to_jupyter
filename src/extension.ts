import * as vscode from 'vscode';

const console = {
    log: function(...args: any[]) {
        // Forward to VS Code's console
        vscode.window.showInformationMessage(args.join(' '));
    },
    error: function(...args: any[]) {
        // Forward to VS Code's console
        vscode.window.showErrorMessage(args.join(' '));
    }
};

export function activate(context: vscode.ExtensionContext) {
    console.log('R Send to Jupyter extension is now active');

    // Register the command to send R code to Jupyter
    const disposableSelection = vscode.commands.registerCommand('rSendToJupyter.sendSelection', async () => {
        await sendToJupyter('selection');
    });

    // Register the command to send entire R file to Jupyter
    const disposableFile = vscode.commands.registerCommand('rSendToJupyter.sendFile', async () => {
        await sendToJupyter('file');
    });

    context.subscriptions.push(disposableSelection, disposableFile);
}

/**
 * Sends code to Jupyter notebook with an R kernel
 * @param mode 'selection' to send selected text, 'file' to send entire file
 */
async function sendToJupyter(mode: 'selection' | 'file') {
    try {
        // Get the active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor");
            return;
        }

        // Check if the active editor is an R file
        if (editor.document.languageId !== 'r') {
            vscode.window.showWarningMessage("Active file is not an R file");
            return;
        }

        // Get the text to send based on mode
        let codeToSend: string;
        if (mode === 'selection') {
            const selection = editor.selection;
            
            if (selection.isEmpty) {
                // No text selected, try to detect code block
                const lineNumber = selection.active.line;
                const currentLine = editor.document.lineAt(lineNumber);
                
                // Check if this line is part of a code block
                const blockRange = detectCodeBlock(editor.document, lineNumber);
                
                if (blockRange && blockRange.start.line !== blockRange.end.line) {
                    // We found a multi-line code block
                    editor.selection = new vscode.Selection(
                        blockRange.start,
                        blockRange.end
                    );
                    codeToSend = editor.document.getText(blockRange);
                } else {
                    // Just use the current line
                    editor.selection = new vscode.Selection(
                        currentLine.range.start,
                        currentLine.range.end
                    );
                    codeToSend = currentLine.text;
                }
            } else {
                // Text is selected, use the selection
                codeToSend = editor.document.getText(selection);
            }

            if (!codeToSend || codeToSend.trim() === '') {
                vscode.window.showWarningMessage("No code selected or line is empty");
                return;
            }
        } else {
            // Get entire file content
            codeToSend = editor.document.getText();

            if (!codeToSend) {
                vscode.window.showWarningMessage("File is empty");
                return;
            }

            // Confirm before sending large files
            const lineCount = editor.document.lineCount;
            if (lineCount > 100) {
                const confirmed = await vscode.window.showWarningMessage(
                    `This file has ${lineCount} lines. Are you sure you want to send the entire file to Jupyter?`,
                    'Yes', 'No'
                );
                if (confirmed !== 'Yes') {
                    return;
                }
            }
        }

        // Check if Jupyter extension is available
        const jupyterExtension = vscode.extensions.getExtension('ms-toolsai.jupyter');
        if (!jupyterExtension) {
            vscode.window.showErrorMessage("Jupyter extension is not installed. Please install it from the marketplace.");
            return;
        }

        // Ensure Jupyter extension is activated
        if (!jupyterExtension.isActive) {
            try {
                await jupyterExtension.activate();
            } catch (error) {
                console.error('Failed to activate Jupyter extension:', error);
                vscode.window.showErrorMessage(`Failed to activate Jupyter extension: ${error}`);
                return;
            }
        }

        // First, try to get existing Jupyter notebooks
        const notebooks = vscode.workspace.notebookDocuments;
        let rKernelNotebook = notebooks.find(notebook => {
            // Check if this is a Jupyter notebook with an R kernel
            return notebook.notebookType === 'jupyter-notebook' &&
                   notebook.metadata &&
                   notebook.metadata.kernelInfo &&
                   notebook.metadata.kernelInfo.language === 'r';
        });

        // Keep track of whether we're using an existing notebook
        let usingExistingNotebook = !!rKernelNotebook;
        let activeNotebookEditor: vscode.NotebookEditor | undefined;

        if (rKernelNotebook) {
            // Find the editor for this notebook
            activeNotebookEditor = vscode.window.visibleNotebookEditors.find(
                editor => editor.notebook === rKernelNotebook
            );

            // If we have a notebook but no editor, show the notebook first
            if (!activeNotebookEditor) {
                const document = await vscode.workspace.openNotebookDocument(rKernelNotebook.uri);
                activeNotebookEditor = await vscode.window.showNotebookDocument(document, {
                    viewColumn: vscode.ViewColumn.Beside, // Opens in split editor (to the right)
                    preserveFocus: false // Optional: auto-focus on notebook
                });
            }

            // Use the API to add a new cell with the R code
            try {
                // Show status message
                vscode.window.setStatusBarMessage('Adding code to existing R notebook...', 2000);

                // Add a new code cell to the existing notebook
                const cellData = new vscode.NotebookCellData(
                    vscode.NotebookCellKind.Code,
                    codeToSend,
                    'r'
                );

                // Create a workspace edit to add the cell
                const edit = new vscode.WorkspaceEdit();
                // Use the notebook API's specific methods to append rather than replace cells
                try {
                    // Move to the last cell of the notebook
                    if (activeNotebookEditor && activeNotebookEditor.notebook.cellCount > 0) {
                        const lastCellIndex = activeNotebookEditor.notebook.cellCount - 1;
                        activeNotebookEditor.selection = new vscode.NotebookRange(lastCellIndex, lastCellIndex + 1);

                        // Insert a code cell below the last cell using commands API
                        await vscode.commands.executeCommand('notebook.cell.insertCodeCellBelow');

                        // Wait for the new cell to be created
                        await new Promise(resolve => setTimeout(resolve, 300));

                        // Get the newly created cell and replace its contents
                        if (activeNotebookEditor.notebook.cellCount > lastCellIndex + 1) {
                            const newCell = activeNotebookEditor.notebook.cellAt(lastCellIndex + 1);

                            // Replace the content of the new cell
                            if (newCell && newCell.document) {
                                const cellEdit = new vscode.WorkspaceEdit();
                                const fullRange = new vscode.Range(
                                    0, 0,
                                    newCell.document.lineCount,
                                    newCell.document.lineCount > 0
                                        ? newCell.document.lineAt(newCell.document.lineCount - 1).text.length
                                        : 0
                                );
                                cellEdit.replace(newCell.document.uri, fullRange, codeToSend);
                                await vscode.workspace.applyEdit(cellEdit);

                                // Execute the cell
                                await vscode.commands.executeCommand(
                                    'notebook.cell.execute',
                                    { start: lastCellIndex + 1, end: lastCellIndex + 2 }
                                );

                                vscode.window.setStatusBarMessage('Code added to notebook and executed', 3000);
                            }
                        }
                    }
                } catch (cellAddError) {
                    console.error('Error adding cell to notebook:', cellAddError);
                    vscode.window.showErrorMessage(`Failed to add code to notebook: ${cellAddError}`);
                }
            } catch (error) {
                console.error('Error appending to existing notebook:', error);
                vscode.window.showErrorMessage(`Failed to add code to notebook: ${error}`);
            }
        } else {
            // If no R kernel notebook is open, we'll create one
            // Show status message
            const statusMessage = vscode.window.setStatusBarMessage(
                mode === 'selection'
                    ? 'Opening R Jupyter Interactive Window...'
                    : 'Opening R Jupyter Interactive Window for file execution...',
                3000
            );

            // Try to create a new interactive window with R kernel
            try {
                // Check if R kernel is available
                const jupyterExtension = vscode.extensions.getExtension('ms-toolsai.jupyter');
                if (!jupyterExtension) {
                    vscode.window.showErrorMessage("Jupyter extension is not installed. Please install it from the marketplace.");
                    return;
                }

                // Ensure Jupyter extension is activated
                if (!jupyterExtension.isActive) {
                    try {
                        await jupyterExtension.activate();
                    } catch (error) {
                        // Error handling...
                    }
                }

                // Get the Jupyter API and fetch available kernels
                const jupyterApi = jupyterExtension.exports;

                // Try different methods to get kernels based on API version
                let kernels;
                let hasRKernel = false;

                try {
                    // Try newer API method
                    if (typeof jupyterApi.kernels !== 'undefined' && typeof jupyterApi.kernels.getKernelSpecs === 'function') {
                        kernels = await jupyterApi.kernels.getKernelSpecs();
                    }
                    // Try older API method
                    else if (typeof jupyterApi.getKernelSpecs === 'function') {
                        kernels = await jupyterApi.getKernelSpecs();
                    }
                    // Try alternative API structures
                    else if (typeof jupyterApi.getKernels === 'function') {
                        kernels = await jupyterApi.getKernels();
                    }

                    // Check if we have an R kernel
                    if (Array.isArray(kernels)) {
                        hasRKernel = kernels.some((kernel: any) =>
                            kernel.label?.toLowerCase().includes('r') ||
                            kernel.display_name?.toLowerCase().includes('r') ||
                            kernel.description?.toLowerCase().includes('r'));
                    }
                } catch (kernelError) {
                    console.error('Error getting kernel specs:', kernelError);
                    // Continue without kernel check - we'll try the interactive window directly
                }

                // Skip the warning dialog and proceed directly
                // Instead of showing a warning, just log a message
                if (!kernels || !hasRKernel) {
                    // Warning message removed
                    // console.log('Could not verify R kernel availability. Continuing anyway.');
                    // We'll still show information about IRkernel in the status bar
                    vscode.window.setStatusBarMessage(
                        'Please ensure IRkernel is installed if you encounter issues',
                        5000
                    );
                }

                // Use a completely different approach that creates a notebook with R kernel
                try {
                    // First, check if there's an existing untitled notebook we can use
                    const untitledNotebooks = vscode.workspace.notebookDocuments.filter(
                        doc => doc.uri.scheme === 'untitled' && doc.notebookType === 'jupyter-notebook'
                    );

                    let notebookUri: vscode.Uri;
                    let document: vscode.NotebookDocument;

                    if (untitledNotebooks.length > 0) {
                        // Use the first untitled notebook
                        document = untitledNotebooks[0];
                        notebookUri = untitledNotebooks[0].uri;
                    } else {
                        // Create a new untitled notebook document
                        notebookUri = vscode.Uri.parse('untitled:notebook.ipynb');
                        document = await vscode.workspace.openNotebookDocument(notebookUri);
                    }

                    // Show the notebook
                    activeNotebookEditor = await vscode.window.showNotebookDocument(document, {
                        viewColumn: vscode.ViewColumn.Beside, // Opens in split editor (to the right)
                        preserveFocus: false // Optional: auto-focus on notebook
                    });

                    // Try to set the kernel to R
                    try {
                        await vscode.commands.executeCommand('notebook.selectKernel', {
                            extension: 'jupyter',
                            id: 'r'
                        });
                    } catch (kernelError) {
                        console.error('Error selecting R kernel:', kernelError);
                        // Try another approach to select R kernel
                        try {
                            await vscode.commands.executeCommand('jupyter.notebookeditor.selectkernel');
                        } catch (error) {
                            console.error('Error showing kernel picker:', error);
                        }
                    }

                    // Wait for kernel selection
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Now try to add a cell with the R code
                    if (activeNotebookEditor) {
                        // Get current notebook document
                        const notebookDocument = activeNotebookEditor.notebook;

                        // Create a notebook cell with the R code
                        const cellData = new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Code,
                            codeToSend,
                            'r' // Make sure it's an R cell
                        );

                        // Try to execute the notebook editor API directly
                        // First, check if there are already cells
                        if (notebookDocument.cellCount > 0) {
                            // Move to the last cell of the notebook
                            const lastCellIndex = notebookDocument.cellCount - 1;
                            activeNotebookEditor.selection = new vscode.NotebookRange(lastCellIndex, lastCellIndex + 1);

                            // Insert a code cell below
                            await vscode.commands.executeCommand('notebook.cell.insertCodeCellBelow');

                            // Get the newly created empty cell and replace its contents
                            if (activeNotebookEditor.notebook.cellCount > lastCellIndex + 1) {
                                const cell = activeNotebookEditor.notebook.cellAt(lastCellIndex + 1);

                                // Replace the content of the new cell
                                try {
                                    if (cell && cell.document) {
                                        const cellEdit = new vscode.WorkspaceEdit();
                                        const fullRange = new vscode.Range(
                                            0, 0,
                                            cell.document.lineCount,
                                            cell.document.lineCount > 0
                                                ? cell.document.lineAt(cell.document.lineCount - 1).text.length
                                                : 0
                                        );
                                        cellEdit.replace(cell.document.uri, fullRange, codeToSend);
                                        await vscode.workspace.applyEdit(cellEdit);
                                    }
                                } catch (docError) {
                                    console.error('Error modifying cell content:', docError);
                                    throw new Error('Could not modify cell content');
                                }
                            }
                        } else {
                            // This is the first cell - add it differently
                            const edit = new vscode.WorkspaceEdit();

                            // Use a different approach to add the first cell
                            // First create a cell
                            await vscode.commands.executeCommand('notebook.cell.insertCodeCellAtTop');

                            // Then update its content
                            if (notebookDocument.cellCount > 0) {
                                const cell = notebookDocument.cellAt(0);
                                if (cell && cell.document) {
                                    const cellEdit = new vscode.WorkspaceEdit();
                                    const fullRange = new vscode.Range(
                                        0, 0,
                                        cell.document.lineCount,
                                        cell.document.lineCount > 0
                                            ? cell.document.lineAt(cell.document.lineCount - 1).text.length
                                            : 0
                                    );
                                    cellEdit.replace(cell.document.uri, fullRange, codeToSend);
                                    await vscode.workspace.applyEdit(cellEdit);
                                }
                            }
                        }

                        // Wait for the notebook to update
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Execute the cell
                        if (activeNotebookEditor.notebook.cellCount > 0) {
                            const lastCellIndex = activeNotebookEditor.notebook.cellCount - 1;
                            await vscode.commands.executeCommand(
                                'notebook.cell.execute',
                                { start: lastCellIndex, end: lastCellIndex + 1 }
                            );

                            vscode.window.setStatusBarMessage('R code sent to notebook and executed', 3000);
                        }
                    } else {
                        throw new Error('No active notebook editor found');
                    }
                } catch (notebookError) {
                    console.error('Error creating notebook and sending code:', notebookError);
                    // Try one more fallback approach - create a .R file and use the Jupyter Run command
                    try {
                        // Create a temporary .R file
                        const tempDoc = await vscode.workspace.openTextDocument({
                            content: codeToSend,
                            language: 'r'
                        });

                        // Show the document
                        await vscode.window.showTextDocument(tempDoc);

                        // Try to run the current file in Jupyter
                        await vscode.commands.executeCommand('jupyter.runFileInteractive');

                        vscode.window.setStatusBarMessage('R code sent to Jupyter using temporary file', 3000);
                    } catch (finalError) {
                        const errorMessage = finalError instanceof Error ? finalError.message : String(finalError);
                        throw new Error(`Failed to send code to Jupyter: ${errorMessage}`);
                    }
                }
            } catch (error) {
                console.error('Error creating interactive window:', error);

                // Provide more helpful error messages based on error type
                if (error instanceof Error) {
                    if (error.message.includes('kernel')) {
                        vscode.window.showErrorMessage(
                            'Failed to start R kernel. Please ensure R and IRkernel are properly installed:\n' +
                            '1. Install R from https://www.r-project.org/\n' +
                            '2. In R console run: install.packages("IRkernel")\n' +
                            '3. In R console run: IRkernel::installspec()'
                        );
                    } else if (error.message.includes('timeout')) {
                        vscode.window.showErrorMessage('Kernel connection timed out. Please try again or restart VS Code.');
                    } else {
                        vscode.window.showErrorMessage(`Failed to create R Jupyter Interactive Window: ${error.message}`);
                    }
                } else {
                    vscode.window.showErrorMessage(`Failed to create R Jupyter Interactive Window. Error: ${error}`);
                }
                return;
            }
        }

        // Show success message
        vscode.window.setStatusBarMessage(
            mode === 'selection'
                ? 'Code sent to Jupyter'
                : 'File sent to Jupyter',
            3000
        );
    } catch (error) {
        console.error(`Error in rSendToJupyter.send${mode === 'selection' ? 'Selection' : 'File'}:`, error);
        vscode.window.showErrorMessage(`Error sending code to Jupyter: ${error}`);
    }
}

/**
 * Detects a code block in R code
 * @param document The text document
 * @param currentLine The line to check
 * @returns A range covering the entire code block
 */
function detectCodeBlock(document: vscode.TextDocument, currentLine: number): vscode.Range {
    // Simple check if the line is empty or a comment
    const currentLineText = document.lineAt(currentLine).text.trim();
    if (currentLineText === '' || currentLineText.startsWith('#')) {
        return document.lineAt(currentLine).range;
    }
    
    // Detect if we're in a pipe chain or code block
    return detectPipeOrBlockRange(document, currentLine);
}

/**
 * Detects the range of a pipe chain or code block
 */
function detectPipeOrBlockRange(document: vscode.TextDocument, currentLine: number): vscode.Range {
    /**
     * Checks if a line contains dplyr pipe operators
     */
    const hasDplyrPipe = (line: string): boolean => {
        return line.includes('%>%') || line.includes('|>');
    };
    
    /**
     * Checks if a line ends with dplyr pipe operators
     */
    const endsDplyrPipe = (line: string): boolean => {
        return line.trim().endsWith('%>%') || line.trim().endsWith('|>');
    };
    
    /**
     * Checks if a line starts with dplyr pipe operators
     */
    const startsDplyrPipe = (line: string): boolean => {
        return line.trim().startsWith('%>%') || line.trim().startsWith('|>');
    };
    
    /**
     * Checks if a line contains ggplot plus operator
     */
    const hasPlus = (line: string): boolean => {
        return line.includes('+');
    };
    
    /**
     * Checks if a line ends with plus
     */
    const endsPlus = (line: string): boolean => {
        return line.trim().endsWith('+');
    };
    
    /**
     * Checks if a line starts with plus
     */
    const startsPlus = (line: string): boolean => {
        return line.trim().startsWith('+');
    };
    
    /**
     * Checks if a line is part of a ggplot expression
     */
    const isGgplotRelated = (line: string): boolean => {
        return line.includes('ggplot(') || 
               line.includes('geom_') ||
               line.includes('scale_') || 
               line.includes('theme_') ||
               line.includes('labs(') ||
               line.includes('coord_') ||
               line.includes('facet_');
    };
    
    // Get the current line text and adjacent lines
    const currentLineText = document.lineAt(currentLine).text;
    const prevLine = currentLine > 0 ? document.lineAt(currentLine - 1).text : '';
    const nextLine = currentLine < document.lineCount - 1 ? document.lineAt(currentLine + 1).text : '';
    
    // Check if we're in a pipe or ggplot chain
    const isInDplyrPipe = hasDplyrPipe(currentLineText) || 
                           endsDplyrPipe(prevLine) ||
                           startsDplyrPipe(currentLineText) ||
                           startsDplyrPipe(nextLine);
                           
   
    const isInGgplot = isGgplotRelated(currentLineText) ||
                       hasPlus(currentLineText) ||
                       endsPlus(prevLine) ||
                       startsPlus(currentLineText) ||
                       startsPlus(nextLine);
    
    // If not in any chain, just return the current line
    if (!isInDplyrPipe && !isInGgplot) {
        return document.lineAt(currentLine).range;
    }
    
    // --- Find the start of the code block ---
    let startLine = currentLine;
    
    // Look backward to find the start of the chain
    for (let i = currentLine; i >= 0; i--) {
        const line = document.lineAt(i).text.trim();
        
        // Skip empty lines and comments
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        
        // Check for data source or assignment that could be the start
        if ((line.includes('<-') || line.includes('=')) && 
            !endsDplyrPipe(line) && !endsPlus(line)) {
            startLine = i;
            break;
        }
        
        // Check for data frame references that could be the start
        if (i > 0) {
            const prevToLine = document.lineAt(i-1).text.trim();
            // If current line doesn't continue and previous doesn't end with continuation
            if (!startsDplyrPipe(line) && !startsPlus(line) &&
                !endsDplyrPipe(prevToLine) && !endsPlus(prevToLine)) {
                // This could be a start (data reference, etc.)
                startLine = i;
                break;
            }
        }
        
        // Keep tracking back
        startLine = i;
    }
    
    // --- Find the end of the code block ---
    let endLine = currentLine;
    
    // Look forward to find the end of the chain
    for (let i = currentLine; i < document.lineCount; i++) {
        const line = document.lineAt(i).text.trim();
        
        // Skip empty lines and comments
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        
        // Update the current end line as we go
        endLine = i;
        
        // If this line doesn't end with pipe/plus and next line doesn't continue
        if (!endsDplyrPipe(line) && !endsPlus(line) && 
            (i === document.lineCount - 1 || 
             (!startsDplyrPipe(document.lineAt(i+1).text) && 
              !startsPlus(document.lineAt(i+1).text)))) {
            break;
        }
    }
    
    // Return the range spanning the entire chain
    return new vscode.Range(
        new vscode.Position(startLine, 0),
        document.lineAt(endLine).range.end
    );
}

/**
 * Helper function to detect ggplot expressions specifically
 */
function isPartOfGgplotExpression(document: vscode.TextDocument, lineNumber: number): boolean {
    const lineText = document.lineAt(lineNumber).text;
    
    // Check if this line contains ggplot code
    if (lineText.includes('ggplot(') || 
        lineText.trim().startsWith('geom_') ||
        lineText.trim().startsWith('scale_') ||
        lineText.trim().startsWith('theme_') ||
        lineText.trim().startsWith('labs(') ||
        lineText.trim().startsWith('coord_') ||
        lineText.trim().startsWith('facet_') ||
        lineText.trim().startsWith('+')) {
        return true;
    }
    
    // Check if this line is part of a ggplot continuation
    for (let i = lineNumber - 1; i >= 0; i--) {
        const previousLine = document.lineAt(i).text.trim();
        if (previousLine === '' || previousLine.startsWith('#')) {
            continue;
        }
        
        if (previousLine.endsWith('+') || 
            previousLine.includes('ggplot(') ||
            previousLine.trim().startsWith('geom_') ||
            previousLine.trim().startsWith('scale_') ||
            previousLine.trim().startsWith('theme_') ||
            previousLine.trim().startsWith('labs(') ||
            previousLine.trim().startsWith('coord_') ||
            previousLine.trim().startsWith('facet_')) {
            return true;
        }
        
        // If we hit a line that doesn't end with + and isn't ggplot related, stop
        break;
    }
    
    return false;
}

export function deactivate() {}
