# Send R Selection to Jupyter

## Overview

This VSCode extension allows you to send selected R code from `.R` files directly to a Jupyter notebook with an R kernel. It provides functionality similar to the built-in Python feature that allows sending Python code to the Jupyter interactive window.

## Features

- Send selected R code to Jupyter notebooks with Ctrl+Enter
- Send entire R file to Jupyter notebooks with Ctrl+Shift+Enter
- Automatically opens a Jupyter interactive window with R kernel if none exists
- Context menu options for sending code to Jupyter
- Improved error handling with clear messages
- Kernel restart option if code execution fails

## Requirements

- Visual Studio Code 1.99.0 or higher
- Jupyter extension for VS Code (automatically installed as a dependency)
- R kernel for Jupyter

## Installation

### Installing the R Kernel for Jupyter

Before using the Jupyter notebook functionality, you need to have an R kernel installed for Jupyter:

1. Install R from [https://www.r-project.org/](https://www.r-project.org/)
2. Open R console and run the following commands:

```R
install.packages('IRkernel')
IRkernel::installspec()
```

### Installing the Extension

1. Download the `.vsix` file from this package
2. In VS Code, go to the Extensions view (Ctrl+Shift+X)
3. Click on the "..." menu in the top-right corner of the Extensions view
4. Select "Install from VSIX..." and choose the downloaded file
5. Restart VS Code after installation

## Usage

### Sending Selected Code to Jupyter

1. Open an R file (`.R` extension)
2. Select the code you want to run
3. Press Ctrl+Enter to send the selected code to Jupyter
4. If no Jupyter notebook with R kernel is open, one will be created automatically

You can also right-click on selected code and choose "Send Selection to Jupyter (R)" from the context menu.

### Sending Entire File to Jupyter

1. Open an R file (`.R` extension)
2. Press Ctrl+Shift+Enter to send the entire file content to Jupyter
3. For files with more than 100 lines, you'll be asked to confirm before sending

You can also right-click in the editor and choose "Send File to Jupyter (R)" from the context menu.

## Troubleshooting

If you encounter issues:

- Make sure the Jupyter extension is installed
- Verify that an R kernel is available for Jupyter
- Check that your R code is properly selected before pressing Ctrl+Enter
- Look for error messages in the status bar or notification area
- If your code fails to execute, you'll be given an option to restart the R kernel automatically

## Extension Settings

This extension does not add any VS Code settings.

## Known Issues

- Large files with many dependencies may take longer to process
- The extension requires an active R kernel to be available

## Release Notes

### 0.0.1

Initial release:
- Send selected R code to Jupyter notebooks
- Send entire R files to Jupyter notebooks
- Automatic R kernel selection
- Error handling and status messages
