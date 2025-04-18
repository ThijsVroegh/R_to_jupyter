# Send R Selection to Jupyter - Documentation

## Installation Guide

### Option 1: Installing from VSIX File

1. Download the `.vsix` file from this package
2. In VS Code, go to Extensions view (Ctrl+Shift+X)
3. Click the "..." menu in the top-right corner
4. Select "Install from VSIX..." and choose the downloaded file
5. Restart VS Code

### Option 2: Manual Installation from Source

If Option 1 doesn't work, you can install the extension manually:

1. Extract the extension source files
2. Copy the entire folder to your VS Code extensions directory:
   - Windows: `%USERPROFILE%\.vscode\extensions`
   - macOS/Linux: `~/.vscode/extensions`
3. Restart VS Code

### Setting Up the R Kernel

Before using the extension, make sure you have an R kernel installed for Jupyter:

1. Install R from [https://www.r-project.org/](https://www.r-project.org/)
2. Open R console and run:
   ```R
   install.packages('IRkernel')
   IRkernel::installspec()
   ```

## Usage Guide

### Getting Started

1. **Install the extension** and R kernel as described above
2. **Open an R file** with a `.R` extension
3. **Write some R code** in your file

### Sending Selected Code to Jupyter

#### Using Keyboard Shortcut

1. Select the R code you want to execute
2. Press `Ctrl+Enter`
3. The code will be sent to a Jupyter notebook with an R kernel

#### Using Context Menu

1. Select the R code you want to execute
2. Right-click on the selected code
3. Choose "Send Selection to Jupyter (R)" from the context menu

### Sending Entire Files to Jupyter

#### Using Keyboard Shortcut

1. Open the R file you want to execute
2. Press `Ctrl+Shift+Enter` (no need to select any code)
3. The entire file will be sent to a Jupyter notebook with an R kernel
4. For files with more than 100 lines, you'll be asked to confirm before sending

#### Using Context Menu

1. Open the R file you want to execute
2. Right-click anywhere in the editor
3. Choose "Send File to Jupyter (R)" from the context menu

### First-Time Usage

When you use the extension for the first time:

1. If no Jupyter notebook with an R kernel is open, one will be created automatically
2. You may be prompted to select an R kernel
3. Once the kernel is selected, your code will be executed

## Troubleshooting

If you encounter errors during execution:

1. Check the error message in the notification
2. For kernel-related issues, you'll receive guidance on how to install R and the IRkernel package
3. If code execution fails, you'll be given the option to restart the kernel and try again

### Common Issues

- **Jupyter extension missing**: Install the Jupyter extension from the VS Code marketplace
- **No R kernel available**: Follow the R kernel installation instructions above
- **Code execution timeout**: Try restarting the R kernel
- **No code selected**: Make sure to select valid R code before pressing Ctrl+Enter

## Examples

### Example 1: Basic R Operations

```R
# Create a vector
numbers <- c(1, 2, 3, 4, 5)

# Calculate mean
mean(numbers)
```

Select the code above and press `Ctrl+Enter` to see the result in the Jupyter notebook.

### Example 2: Creating a Plot

```R
# Create sample data
x <- 1:10
y <- x^2

# Create a plot
plot(x, y, type = "o", col = "blue",
     main = "Sample Plot", xlab = "X", ylab = "Y")
```

Select the code above and press `Ctrl+Enter` to see the plot in the Jupyter notebook.

## Tips and Tricks

- You can select multiple code blocks and send them all at once
- The extension works with any valid R code
- For best results, ensure your R kernel is properly installed and configured
- Use the Jupyter notebook interface to interact with your results
- You can continue editing your R file while the Jupyter notebook is open