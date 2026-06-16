import os
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# The workspace is the current working directory
WORKSPACE_DIR = os.path.abspath(os.path.dirname(__file__))

def get_markdown_files():
    files = []
    # Scan the workspace directory for markdown files
    for filename in os.listdir(WORKSPACE_DIR):
        if filename.endswith('.md'):
            files.append(filename)
    # Sort files, putting newer versions first if they follow a pattern, otherwise alphabetical
    files.sort(reverse=True)
    return files

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/files')
def list_files():
    try:
        files = get_markdown_files()
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/file/<filename>')
def get_file(filename):
    # Security check to prevent directory traversal
    filename = os.path.basename(filename)
    if not filename.endswith('.md'):
        return jsonify({'success': False, 'error': 'Invalid file format. Only Markdown files allowed.'}), 400
    
    file_path = os.path.join(WORKSPACE_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'error': 'File not found.'}), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'success': True, 'content': content, 'filename': filename})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/save', methods=['POST'])
def save_file():
    data = request.get_json()
    if not data or 'filename' not in data or 'content' not in data:
        return jsonify({'success': False, 'error': 'Missing filename or content.'}), 400
    
    filename = os.path.basename(data['filename'])
    if not filename.endswith('.md'):
        filename = filename + '.md'
        
    content = data['content']
    
    file_path = os.path.join(WORKSPACE_DIR, filename)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True, 'filename': filename})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
