document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const versionSelect = document.getElementById('version-select');
    const btnRefresh = document.getElementById('btn-refresh');
    const refreshIcon = document.getElementById('refresh-icon');
    const btnRefreshText = document.getElementById('btn-refresh-text');
    const currentBadge = document.getElementById('current-badge');
    
    const btnNew = document.getElementById('btn-new');
    const btnSave = document.getElementById('btn-save');
    const inputFilename = document.getElementById('input-filename');
    const inputContent = document.getElementById('input-content');
    
    const activeFilename = document.getElementById('active-filename');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const previewRender = document.getElementById('preview-render');
    const previewLoader = document.getElementById('preview-loader');
    const previewActionButtons = document.getElementById('preview-action-buttons');
    const btnCopy = document.getElementById('btn-copy');
    const btnCsv = document.getElementById('btn-csv');
    const btnExportAll = document.getElementById('btn-export-all');
    
    const toastContainer = document.getElementById('toast-container');

    let currentSelectedFile = '';

    // Initialize application
    init();

    function init() {
        loadFilesList();
        setupEventListeners();
    }

    // Load list of files from the server
    async function loadFilesList(selectAndLoadFile = null) {
        try {
            const response = await fetch('/api/files');
            const data = await response.json();

            if (data.success && data.files) {
                // Keep track of current selection
                const prevSelection = selectAndLoadFile || versionSelect.value;
                
                // Clear existing options (except first placeholder)
                versionSelect.innerHTML = '<option value="" disabled selected>Select a file...</option>';
                
                data.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file;
                    option.textContent = file;
                    versionSelect.appendChild(option);
                });

                // Update current active badge
                if (data.files.length > 0) {
                    currentBadge.textContent = `${data.files.length} Files Available`;
                } else {
                    currentBadge.textContent = 'No Files';
                }

                // Restore or set selection
                if (prevSelection && data.files.includes(prevSelection)) {
                    versionSelect.value = prevSelection;
                    loadFileContent(prevSelection);
                } else if (!prevSelection && data.files.length > 0) {
                    // Auto-select first file if nothing was selected
                    versionSelect.value = data.files[0];
                    loadFileContent(data.files[0]);
                }
            } else {
                showToast('Failed to load files list', 'error');
            }
        } catch (error) {
            console.error('Error fetching files list:', error);
            showToast('Server connection error', 'error');
        }
    }

    // Load content of a specific file
    async function loadFileContent(filename) {
        if (!filename) return;
        
        showPreviewLoading(true);
        currentSelectedFile = filename;
        activeFilename.textContent = filename;

        try {
            const response = await fetch(`/api/file/${encodeURIComponent(filename)}`);
            const data = await response.json();

            if (data.success) {
                renderMarkdown(data.content);
                
                // Populate editor fields
                inputFilename.value = data.filename;
                inputContent.value = data.content;
            } else {
                showToast(data.error || 'Failed to load file contents', 'error');
                showPlaceholder(true);
            }
        } catch (error) {
            console.error('Error fetching file content:', error);
            showToast('Failed to connect to server', 'error');
            showPlaceholder(true);
        } finally {
            showPreviewLoading(false);
        }
    }

    // Save release notes to server
    async function saveFile() {
        const filename = inputFilename.value.trim();
        const content = inputContent.value;

        if (!filename) {
            showToast('Please enter a filename', 'error');
            inputFilename.focus();
            return;
        }

        if (!content.trim()) {
            showToast('Please write some content before saving', 'error');
            inputContent.focus();
            return;
        }

        btnSave.disabled = true;
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = `
            <svg class="spinning" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
            Saving File...
        `;

        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename, content })
            });

            const data = await response.json();

            if (data.success) {
                showToast(`Saved successfully: ${data.filename}`, 'success');
                // Reload list and select the saved file
                await loadFilesList(data.filename);
            } else {
                showToast(data.error || 'Failed to save file', 'error');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            showToast('Network error while saving file', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    }

    // Render markdown and replace custom badges
    function renderMarkdown(markdownText) {
        if (typeof marked === 'undefined') {
            previewRender.innerHTML = `<p class="error">Marked library not loaded.</p>`;
            return;
        }

        // Parse markdown to HTML
        let htmlContent = marked.parse(markdownText);

        // Replace tag formats like [Added] or [Added] with beautiful badges
        // We use regex to support global replacement and flexible casing
        const badgesConfig = [
            {
                key: 'Added',
                icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
            },
            {
                key: 'Fixed',
                icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
            },
            {
                key: 'Changed',
                icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>'
            },
            {
                key: 'Removed',
                icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>'
            },
            {
                key: 'Security',
                icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
            }
        ];

        badgesConfig.forEach(badge => {
            const regex = new RegExp(`\\[${badge.key}\\]`, 'gi');
            const replacement = `<span class="badge badge-${badge.key.toLowerCase()}">${badge.icon}${badge.key}</span>`;
            htmlContent = htmlContent.replace(regex, replacement);
        });

        // Inject content
        previewRender.innerHTML = htmlContent;
        addCodeCopyButtons();
        showPlaceholder(false);
    }

    // Set UI State helpers
    function showPlaceholder(show) {
        if (show) {
            previewPlaceholder.classList.remove('hidden');
            previewRender.classList.add('hidden');
            previewActionButtons.classList.add('hidden');
        } else {
            previewPlaceholder.classList.add('hidden');
            previewRender.classList.remove('hidden');
            previewActionButtons.classList.remove('hidden');
        }
    }

    function showPreviewLoading(show) {
        if (show) {
            previewLoader.classList.remove('hidden');
        } else {
            previewLoader.classList.add('hidden');
        }
    }

    // Event Listeners setup
    function setupEventListeners() {
        // Dropdown selection change
        versionSelect.addEventListener('change', (e) => {
            loadFileContent(e.target.value);
        });

        // Refresh Button with spinner animation & delay for visual polish
        btnRefresh.addEventListener('click', async () => {
            if (btnRefresh.classList.contains('disabled')) return;

            // Trigger loading styling
            btnRefresh.classList.add('disabled');
            refreshIcon.classList.add('spinning');
            btnRefreshText.textContent = 'Refreshing...';
            showPreviewLoading(true);

            // Fetch and simulate processing time for visual delight
            const refreshPromise = loadFilesList(versionSelect.value);
            const delayPromise = new Promise(resolve => setTimeout(resolve, 800));

            try {
                await Promise.all([refreshPromise, delayPromise]);
                showToast('Workspace refreshed successfully', 'success');
            } catch (error) {
                showToast('Refresh error occurred', 'error');
            } finally {
                btnRefresh.classList.remove('disabled');
                refreshIcon.classList.remove('spinning');
                btnRefreshText.textContent = 'Refresh Data';
                showPreviewLoading(false);
            }
        });

        // New File click
        btnNew.addEventListener('click', () => {
            inputFilename.value = '';
            inputContent.value = `# Release Notes - Version X.Y.Z\n\nShort description here...\n\n### Changelog\n\n*   [Added] New feature detail\n*   [Fixed] Description of bug fix\n*   [Security] Security patch details\n\n---\n*Released on June 16, 2026.*`;
            inputFilename.focus();
            showToast('New release notes editor ready', 'success');
        });

        // Save Button click
        btnSave.addEventListener('click', saveFile);

        // Copy Markdown to Clipboard
        btnCopy.addEventListener('click', async () => {
            const content = inputContent.value;
            if (!content) {
                showToast('No content to copy', 'error');
                return;
            }
            try {
                await navigator.clipboard.writeText(content);
                showToast('Changelog copied to clipboard!', 'success');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                showToast('Could not copy to clipboard', 'error');
            }
        });

        // Export to CSV
        btnCsv.addEventListener('click', () => {
            const content = inputContent.value;
            const filename = currentSelectedFile || inputFilename.value.trim() || 'changelog.md';
            if (!content) {
                showToast('No content to export', 'error');
                return;
            }
            exportToCSV(filename, content);
        });

        // Export All versions to CSV
        btnExportAll.addEventListener('click', async () => {
            if (btnExportAll.classList.contains('disabled')) return;
            
            btnExportAll.classList.add('disabled');
            showToast('Gathering all changelogs...', 'info');
            
            try {
                // Fetch list of files
                const response = await fetch('/api/files');
                const data = await response.json();
                
                if (!data.success || !data.files || data.files.length === 0) {
                    showToast('No files to export', 'error');
                    btnExportAll.classList.remove('disabled');
                    return;
                }
                
                // Fetch contents of all files
                const fetchPromises = data.files.map(file => 
                    fetch(`/api/file/${encodeURIComponent(file)}`).then(res => res.json())
                );
                
                const filesData = await Promise.all(fetchPromises);
                
                // Compile into a single CSV
                const csvRows = [['Version', 'Category', 'Description']];
                
                filesData.forEach(filePayload => {
                    if (!filePayload.success) return;
                    
                    const version = filePayload.filename.replace('.md', '');
                    const lines = filePayload.content.split('\n');
                    let currentSection = 'General';
                    
                    lines.forEach(line => {
                        line = line.trim();
                        if (!line) return;
                        
                        if (line.startsWith('#')) {
                            currentSection = line.replace(/#+\s+/, '').trim();
                            return;
                        }
                        
                        if (line.startsWith('*') || line.startsWith('-')) {
                            let content = line.substring(1).trim();
                            const badgeMatch = content.match(/^\[(Added|Fixed|Changed|Removed|Security)\]/i);
                            if (badgeMatch) {
                                const category = badgeMatch[1];
                                const desc = content.replace(/^\[.*?\]/, '').trim();
                                csvRows.push([version, category, desc]);
                            } else {
                                csvRows.push([version, currentSection, content]);
                            }
                        }
                    });
                });
                
                // Download CSV
                const csvContent = csvRows.map(row => 
                    row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')
                ).join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `consolidated_changelog.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showToast('All changelogs exported!', 'success');
            } catch (error) {
                console.error('Export all error:', error);
                showToast('Error exporting all changelogs', 'error');
            } finally {
                btnExportAll.classList.remove('disabled');
            }
        });

        // Optional: Local auto-preview rendering on text typing in the editor
        let typingTimer;
        inputContent.addEventListener('input', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                // Render live markdown in preview panel if the active editing file matches
                const filename = inputFilename.value.trim() || 'Unsaved Draft';
                activeFilename.textContent = `${filename} (Draft)`;
                renderMarkdown(inputContent.value);
            }, 300); // Wait for user to stop typing for 300ms
        });
    }

    // Helper to parse Markdown and download CSV
    function exportToCSV(filename, markdownContent) {
        const lines = markdownContent.split('\n');
        const csvRows = [['Version', 'Category', 'Description']];
        const version = filename.replace('.md', '');
        
        let currentSection = 'General';
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            // Check for headers (e.g. ### Highlights)
            if (line.startsWith('#')) {
                currentSection = line.replace(/#+\s+/, '').trim();
                return;
            }
            
            // Check for list items
            if (line.startsWith('*') || line.startsWith('-')) {
                let content = line.substring(1).trim();
                
                // Parse tags like [Added]
                const badgeMatch = content.match(/^\[(Added|Fixed|Changed|Removed|Security)\]/i);
                if (badgeMatch) {
                    const category = badgeMatch[1];
                    const desc = content.replace(/^\[.*?\]/, '').trim();
                    csvRows.push([version, category, desc]);
                } else {
                    csvRows.push([version, currentSection, content]);
                }
            }
        });
        
        // Convert rows to CSV format
        const csvContent = csvRows.map(row => 
            row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${version}_changelog.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Changelog exported to CSV!', 'success');
        } catch (err) {
            console.error('CSV Export Error:', err);
            showToast('Failed to export CSV', 'error');
        }
    }

    // Helper to add interactive copy buttons to all <pre> blocks in the preview
    function addCodeCopyButtons() {
        const preBlocks = previewRender.querySelectorAll('pre');
        preBlocks.forEach(pre => {
            // Prevent duplicate buttons
            if (pre.querySelector('.code-copy-btn')) return;

            const button = document.createElement('button');
            button.className = 'code-copy-btn';
            button.type = 'button';
            button.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>Copy</span>
            `;

            button.addEventListener('click', async () => {
                const code = pre.querySelector('code');
                const codeText = code ? code.innerText : pre.innerText;
                try {
                    await navigator.clipboard.writeText(codeText);
                    button.querySelector('span').textContent = 'Copied!';
                    showToast('Code block copied!', 'success');
                    setTimeout(() => {
                        button.querySelector('span').textContent = 'Copy';
                    }, 2000);
                } catch (err) {
                    showToast('Failed to copy code', 'error');
                }
            });

            pre.appendChild(button);
        });
    }

    // Toast Notification Creator
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = document.createElement('div');
        if (type === 'success') {
            icon.className = 'toast-icon-success';
            icon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
        } else {
            icon.className = 'toast-icon-error';
            icon.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            `;
        }

        const text = document.createElement('span');
        text.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(text);
        toastContainer.appendChild(toast);

        // Animate toast out and remove
        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 4000);
    }
});
